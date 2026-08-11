# Deploy em produção (VPS)

Roteiro para colocar as 8 aplicações no ar num servidor (VPS) com Docker, atrás de um
domínio próprio e HTTPS. Assume um VPS **Linux** (Ubuntu ou Debian — os comandos abaixo são
para esses dois; noutra distro os passos de instalação do Docker mudam, o resto é igual) e
que você já tem acesso SSH a ele.

Se você só quer rodar o projeto no seu computador para desenvolver, use
[COMECE-AQUI.md](COMECE-AQUI.md) em vez deste arquivo — este aqui é só para publicar de
verdade, num servidor, para todo mundo acessar pela internet.

---

## Antes de começar: como as peças se encaixam

O repositório tem 9 aplicações (8 Next.js + o binário único em Go, `migracao-go`). Sete
delas dividem um **login único**: entrar no Portal deixa a pessoa já autenticada no Painel
de Locação, RH, Almoxarifado, Programação, Alojamentos e no próprio binário Go. Isso
funciona por causa de um cookie de sessão que o Portal emite e os outros conferem — e
**cookie sem domínio explícito vale para o mesmo host, em qualquer porta, mas não atravessa
hosts diferentes**. Por isso, ao contrário do que se poderia imaginar, esses sete sistemas
**não** ganham cada um um subdomínio bonito (`rh.suaempresa.com`, `estoque.suaempresa.com`...)
— eles continuam no mesmo domínio, diferenciados por porta, exatamente como quando você roda
tudo em `localhost` no seu computador. Trocar isso por subdomínios separados quebraria o
"loga uma vez, circula em todos".

| Sistema | Endereço em produção |
|---|---|
| Portal | `https://sistemas.SEUDOMINIO.com.br:3004` |
| Painel de Locação | `https://sistemas.SEUDOMINIO.com.br:3000` |
| RH | `https://sistemas.SEUDOMINIO.com.br:3002` |
| Almoxarifado | `https://sistemas.SEUDOMINIO.com.br:3003` |
| Programação | `https://sistemas.SEUDOMINIO.com.br:3007` |
| Alojamentos | `https://sistemas.SEUDOMINIO.com.br:3005` |
| Binário Go (`migracao-go`) | `https://sistemas.SEUDOMINIO.com.br:3010` |
| Frota | `https://frota.SEUDOMINIO.com.br` (login próprio, sem essa restrição) |
| WhatsApp | não tem tela — roda por dentro, os Alojamentos conversam com ele |

`migracao-go` **convive** com os apps Next.js acima em vez de substituí-los — é o Strangler
Fig documentado em `migracao-go/README.md`: já serve Portal/Painel/Almoxarifado/RH/
Alojamentos/Compras/Financeiro/Programação por dentro, num único processo, mas nenhum
Next.js correspondente é desligado por este roteiro. Isso só acontece módulo a módulo,
depois que a suíte de referência Playwright daquele módulo passar contra o Go. Até lá, ambos
ficam no ar — normal ter, por exemplo, RH acessível tanto em `:3002` (Next.js) quanto em
`:3010/rh` (Go).

Cada aplicação roda no seu próprio contêiner Docker, com seu próprio banco SQLite guardado
num volume (sobrevive a reinícios e a `docker compose up --build`). Um nginx na frente
recebe tudo em HTTPS e encaminha para o contêiner certo.

---

## Passo 1 — Domínio e DNS

Você precisa de um domínio (`SEUDOMINIO.com.br`, ou o que já tiver). No painel do seu
provedor de domínio, crie **dois registros A** apontando para o IP do VPS:

| Tipo | Nome | Valor |
|---|---|---|
| A | `sistemas` | `IP_DO_SEU_VPS` |
| A | `frota` | `IP_DO_SEU_VPS` |

Propagação costuma levar de alguns minutos a algumas horas. Para conferir, de qualquer
computador:

```bash
ping sistemas.SEUDOMINIO.com.br
ping frota.SEUDOMINIO.com.br
```

Os dois precisam responder com o IP do VPS antes de seguir para o Passo 6 (o certificado
HTTPS só sai se o domínio já estiver apontando certo).

---

## Passo 2 — Instalar o Docker no VPS

Conectado por SSH no VPS:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Saia e entre de novo no SSH (o grupo só passa a valer numa sessão nova). Confirme:

```bash
docker --version
docker compose version
```

---

## Passo 3 — Clonar o projeto no VPS

```bash
cd ~
git clone https://github.com/EzMorais/CSC-PAINEL.git
cd CSC-PAINEL
```

(Repositório privado — o `git clone` só funciona se o VPS tiver uma credencial com acesso.
Caminho mais simples: gerar um [token de acesso pessoal](https://github.com/settings/tokens)
no GitHub e usar `git clone https://SEU_TOKEN@github.com/EzMorais/CSC-PAINEL.git`, ou
configurar uma chave SSH no VPS e adicioná-la em Deploy Keys do repositório.)

---

## Passo 4 — Trocar `SEUDOMINIO.com.br` pelo domínio real

Os arquivos de configuração usam `SEUDOMINIO.com.br` como marcador. Troque pelo seu domínio
de verdade em todos de uma vez:

```bash
grep -rl "SEUDOMINIO.com.br" nginx .env.example apps/*/.env.production.example | \
  xargs sed -i 's/SEUDOMINIO\.com\.br/suaempresa.com.br/g'
```

(troque `suaempresa.com.br` pelo domínio real antes de rodar)

---

## Passo 5 — Criar e preencher os arquivos de configuração

### 5.0 — O `.env` da raiz (endereços públicos de cada sistema)

```bash
cp .env.example .env
```

Este arquivo é diferente dos `.env.production` de cada app: ele só tem os endereços
**públicos** (`NEXT_PUBLIC_URL_*`) que aparecem no navegador — o Next.js grava esses
valores dentro do JavaScript já no momento de compilar (`docker compose build`), não
quando o contêiner roda, então precisam estar aqui, prontos, antes do Passo 8. Como o
Passo 4 já trocou `SEUDOMINIO.com.br` pelo domínio real, o `.env` já nasce correto — só
confira se bateu.

### 5.1 — O `.env.production` de cada app

Cada pasta em `apps/` tem um `.env.production.example`. Copie cada um para
`.env.production` na mesma pasta:

```bash
for d in portal painel-locacao rh estoque programacao alojamentos frota whatsapp; do
  cp "apps/$d/.env.production.example" "apps/$d/.env.production"
done
cp migracao-go/.env.production.example migracao-go/.env.production
```

### 5.2 — O segredo compartilhado (login único)

Portal, Painel de Locação, RH, Almoxarifado, Programação, Alojamentos, WhatsApp e o binário
Go (`migracao-go`) precisam do **mesmo** `AUTH_SECRET`. Gere um valor:

```bash
openssl rand -base64 48
```

Cole o resultado no lugar de `COLOQUE_O_SEGREDO_COMPARTILHADO_DOS_6_SISTEMAS_AQUI` nos 8
arquivos:

```bash
apps/portal/.env.production
apps/painel-locacao/.env.production
apps/rh/.env.production
apps/estoque/.env.production
apps/programacao/.env.production
apps/alojamentos/.env.production
apps/whatsapp/.env.production
migracao-go/.env.production
```

> **Por que todos precisam ser idênticos:** é esse valor que faz o crachá assinado pelo
> Portal (ou, depois de migrado, pelo binário Go — os dois emitem o mesmo formato de cookie)
> ser aceito nos outros. Um valor diferente em qualquer um deles não dá erro visível — a
> pessoa simplesmente é jogada de volta pro login ao entrar naquele sistema, o que é confuso
> de diagnosticar. Se isso acontecer depois do deploy, confira primeiro se todos os
> `AUTH_SECRET` são byte-a-byte iguais.

### 5.3 — O segredo do Frota (separado, não reaproveite o de cima)

```bash
openssl rand -base64 48
```

Cole em `apps/frota/.env.production`, no lugar de `COLOQUE_UM_SEGREDO_SO_DO_FROTA_AQUI`.
Aproveite e defina a senha do admin do Frota no mesmo arquivo (`SENHA_ADMIN`).

### 5.4 — Chave do Google Maps (Alojamentos, opcional)

Usada para autocompletar endereço no cadastro de obras. Sem uma chave válida, o resto do
sistema funciona normalmente — só esse autocompletar que não aparece. Gere uma em
[console.cloud.google.com](https://console.cloud.google.com/) se quiser essa parte, e cole
o mesmo valor em dois lugares: `GOOGLE_MAPS_API_KEY` em
`apps/alojamentos/.env.production` (lado servidor) e `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no
`.env` da raiz (lado navegador, Passo 5.0).

---

## Passo 6 — Abrir as portas no firewall

O sistema usa portas fora do padrão para o grupo de login único (explicado no topo deste
arquivo). Libere no firewall do VPS **e** no painel do provedor de nuvem, se ele tiver um
firewall próprio (AWS Security Group, DigitalOcean Cloud Firewall etc. — bloqueiam antes
mesmo de chegar no servidor):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3002/tcp
sudo ufw allow 3003/tcp
sudo ufw allow 3004/tcp
sudo ufw allow 3005/tcp
sudo ufw allow 3007/tcp
sudo ufw allow 3010/tcp
sudo ufw enable
```

---

## Passo 7 — Primeiro certificado HTTPS

O nginx definitivo (`nginx/nginx.conf`) já espera um certificado pronto — mas o certificado
só existe depois que o certbot conseguir validar o domínio por HTTP. Por isso o primeiro
certificado sai com uma config temporária, só de HTTP:

```bash
# 1. Sobe um nginx temporário, só na porta 80, para o certbot conseguir validar o domínio
docker run -d --name nginx-bootstrap \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx.bootstrap.conf:/etc/nginx/nginx.conf:ro" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  nginx:1.27-alpine

# 2. Pede o certificado (troque o e-mail; cobre os dois domínios de uma vez)
docker run --rm \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d sistemas.suaempresa.com.br -d frota.suaempresa.com.br \
  --email seu-email@exemplo.com --agree-tos --no-eff-email

# 3. Derruba o nginx temporário — o de verdade sobe no próximo passo
docker rm -f nginx-bootstrap
```

Se o passo 2 falhar com erro de validação, o motivo quase sempre é o DNS do Passo 1 ainda
não ter propagado, ou a porta 80 estar bloqueada no firewall do provedor — confira os dois
antes de tentar de novo.

---

## Passo 8 — Subir tudo

```bash
docker compose up -d --build
```

A primeira vez demora — está compilando as 9 aplicações. Acompanhe:

```bash
docker compose logs -f
```

Quando os logs pararem de rolar coisas em vermelho, teste:

- `https://sistemas.suaempresa.com.br:3004` → tela de login do Portal
- Entre com `admin@siqueiracampos.com.br` / `locacao2026`
- Clique nos ícones do hub de navegação (canto da tela) e confira se entra direto nos
  outros sistemas, sem pedir login de novo
- `https://sistemas.suaempresa.com.br:3010` → mesma sessão, hub servido pelo binário Go
- `https://frota.suaempresa.com.br` → login separado, `admin@siqueiracampos.com.br` / a
  senha que você definiu em `SENHA_ADMIN`

O primeiro boot de cada sistema roda sozinho as migrações do banco e cria os dados de
exemplo (contas de teste, veículos de exemplo etc. — apague-os pelas telas de cada sistema
antes de usar para valer, mesma recomendação do `COMECE-AQUI.md`).

---

## Passo 9 — Renovar o certificado sozinho

Certificados do Let's Encrypt valem 90 dias. Configure uma tarefa para renovar e recarregar
o nginx automaticamente:

```bash
crontab -e
```

Adicione (troque `/caminho/para` pelo caminho real onde ficou o `git clone`):

```
0 3 * * * docker run --rm -v /caminho/para/CSC-PAINEL/nginx/certbot/conf:/etc/letsencrypt -v /caminho/para/CSC-PAINEL/nginx/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot -q && docker compose -f /caminho/para/CSC-PAINEL/docker-compose.yml exec nginx nginx -s reload
```

---

## Do dia a dia

**Ver o que está rodando:**
```bash
docker compose ps
```

**Ver logs de um sistema específico:**
```bash
docker compose logs -f rh
```

**Publicar uma atualização de código:**
```bash
git pull
docker compose up -d --build
```
Os bancos ficam em volumes separados do contêiner — reconstruir a imagem não apaga dados.

**Backup dos bancos:**
```bash
mkdir -p backup-$(date +%F)
for v in portal_data painel_locacao_data rh_data estoque_data programacao_data alojamentos_data frota_dados migracao_go_data migracao_go_dados; do
  docker run --rm -v csc-painel_$v:/dados -v "$(pwd)/backup-$(date +%F)":/backup alpine \
    tar czf /backup/$v.tar.gz -C /dados .
done
```

**Reiniciar um sistema específico:**
```bash
docker compose restart rh
```

---

## Problemas comuns

**Entrei no Portal mas outro sistema pede login de novo**
Os `AUTH_SECRET` não estão idênticos entre os sistemas do grupo de login único (inclui o
binário Go). Confira byte a byte (Passo 5.2) — é a causa em praticamente todos os casos.

**Os links do hub de navegação apontam para "localhost" ou dão erro**
O `.env` da raiz (Passo 5.0) não existia — ou foi editado depois — na hora do
`docker compose build`. Diferente dos `.env.production` de cada app, os
`NEXT_PUBLIC_URL_*` só entram em vigor recompilando: `cp .env.example .env` (se ainda não
fez), edite, e rode `docker compose up -d --build` de novo. Reiniciar o contêiner sem
recompilar não resolve — o valor já está gravado dentro do JavaScript da build anterior.

**A entrega de EPI (RH ↔ Almoxarifado) não funciona**
Mesma causa do item acima — os dois fazem parte do mesmo grupo e usam o mesmo
`AUTH_SECRET`.

**Alojamentos não consegue mandar mensagem no WhatsApp**
O `AUTH_SECRET` do `apps/whatsapp/.env.production` também precisa ser igual ao dos outros 6
— é ele que assina o pedido entre os dois sistemas. Depois de corrigir, `docker compose
restart whatsapp alojamentos`. Para conectar o número pela primeira vez, veja o QR code nos
logs: `docker compose logs -f whatsapp`.

**`docker compose up -d --build` falha com erro do Prisma**
Normalmente falta de memória do VPS durante a compilação (o `next build` de 6 apps ao mesmo
tempo pesa). Rode um app por vez: `docker compose build portal`, depois `docker compose
build painel-locacao`, e assim por diante, antes do `up -d`.

**Certificado expirado / cadeado vermelho no navegador**
O cron do Passo 9 não rodou ou falhou. Rode manualmente o comando de renovação do Passo 9
(sem o `-q`, para ver o erro) e confira o cron com `crontab -l`.

**Preciso trocar a porta de algum sistema**
Não é só trocar no `docker-compose.yml` — o nginx, os `NEXT_PUBLIC_URL_*` de todos os apps do
grupo de login único, `URL_FROTA`/`URL_PORTAL` do `migracao-go/.env.production` (se a porta
trocada for a do Frota ou do Portal) e o firewall também mudam. Evite, a menos que seja
realmente necessário.
