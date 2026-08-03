# Serviço de WhatsApp — Alojamentos

Liga o WhatsApp do celular corporativo aos **pedidos do módulo de Alojamentos**. O morador
manda mensagem, vira pedido no sistema; o pedido anda, o grupo recebe aviso.

## Os dois caminhos

**No grupo do alojamento** (o caminho principal). Quem precisa começa a mensagem com
`#pedido` — também valem `#chamado` e `/pedido`:

```
Morador:  #pedido a torneira do quarto 3 está vazando
Sistema:  ✅ Pedido #TM5K8H registrado para Marcos — Manutenção.
          Aviso aqui quando andar.
```

Todo o resto da conversa é **ignorado**: o grupo é dos moradores, não um canal do sistema.
Grupo que não estiver vinculado a um alojamento é ignorado por inteiro.

O tipo sai da própria frase (torneira, vazamento → manutenção; detergente, vassoura →
limpeza). Dá para declarar: `#pedido limpeza acabou o sabão`. A confirmação sempre diz o
tipo que entrou, para quem pediu ver na hora se ficou errado — a gestão corrige na tela.

**No privado**, quem escrever recebe um menu numerado e vai passo a passo. Aqui o número
**precisa** estar cadastrado na alocação, senão não há como saber quem é. No grupo isso não
é necessário: o grupo já diz o alojamento e o nome vem do próprio WhatsApp.

## Antes de tudo: o que você precisa saber

A conexão é feita como **dispositivo vinculado**, o mesmo mecanismo do WhatsApp Web. O
número **continua funcionando normalmente no celular** — este serviço só aparece na lista de
"Aparelhos conectados".

Em troca disso, a biblioteca usada (Baileys) é **não-oficial**, e o uso **contraria os termos
do WhatsApp**. A Meta pode banir o número. O risco real vem de disparo em massa para quem não
pediu, e por isso o sistema:

- **só responde a quem escreveu primeiro**;
- **só avisa quem tem pedido em aberto**;
- espaça os envios em alguns segundos.

**Não afrouxe essas três regras.** Se um dia a empresa aceitar dedicar um número novo, dá para
migrar para a API oficial da Meta mexendo só neste serviço — o Alojamentos não muda.

## Como rodar

```bash
npm install
npm start
```

Precisa de um `.env` com o **mesmo `AUTH_SECRET`** dos outros módulos:

```
AUTH_SECRET="…o mesmo dos outros .env…"
PORTA_WHATSAPP="3006"
URL_ALOJAMENTOS="http://localhost:3005"
PASTA_SESSAO="./sessao"
```

## Parear o celular

1. Com o serviço rodando, abra o Alojamentos em **WhatsApp** (menu lateral)
2. No celular corporativo: WhatsApp → três pontinhos → **Aparelhos conectados** →
   **Conectar um aparelho**
3. Aponte para o QR da tela

O pareamento fica salvo na pasta `sessao/` e sobrevive a reinícios. Só é preciso repetir se
alguém desvincular o aparelho pelo celular.

## Vincular os grupos

Depois de parear, a mesma tela lista **os grupos em que o número está**. Escolha o
alojamento de cada um. São sete cliques, uma vez só.

Vale a pena entender por que é assim: o identificador de um grupo não aparece em lugar
nenhum do aplicativo, então não teria como alguém digitá-lo. E o vínculo guarda o
identificador, não o nome — se alguém renomear o grupo, nada quebra.

O celular corporativo precisa **estar nos grupos**. Se não estiver, a lista vem vazia.

> A pasta `sessao/` são as **credenciais do número**: quem a tiver manda mensagem como a
> empresa. Ela está no `.gitignore` — não versione, não mande por e-mail.

## Publicar em nuvem

Precisa de máquina que **fique ligada**. Não funciona em Vercel/Netlify: serverless mata o
processo entre requisições e a conexão morre junto. Servem VPS, Fly.io, Railway ou Render
(como *Web Service*, não *Function*).

Há um `Dockerfile` pronto. Dois cuidados:

1. **Monte um volume em `/app/sessao`.** Sem isso, cada deploy apaga o pareamento e alguém
   precisa ler o QR de novo.
2. **`URL_ALOJAMENTOS` precisa apontar para onde o Alojamentos responde de verdade** — se ele
   também for para a nuvem, é o endereço de lá, não `localhost`.

```bash
docker build -t csc-whatsapp .
docker run -d --name csc-whatsapp \
  -p 3006:3006 \
  -v csc-whatsapp-sessao:/app/sessao \
  -e AUTH_SECRET="…" \
  -e URL_ALOJAMENTOS="https://alojamentos.suaempresa.com.br" \
  csc-whatsapp
```

## As rotas

Todas exigem o token de integração assinado com o `AUTH_SECRET` — exceto `/saude`, que só
diz que o processo está de pé e não conta nada sobre o número.

| Rota | O que faz |
|---|---|
| `GET /saude` | Verificação de vida, para o contêiner |
| `GET /estado` | Conexão, número pareado e o QR quando falta parear |
| `GET /grupos` | Os grupos em que o número está, para a tela de vínculo |
| `POST /enviar` | `{ destino, texto }` — `destino` é um número ou um jid de grupo |

Mensagem recebida é repassada para `POST /api/integracao/whatsapp/recebida` no Alojamentos,
que responde com o que dizer. **Toda a decisão mora lá** — este serviço é transporte.

## Quando algo não funciona

**"O serviço de WhatsApp não respondeu" na tela do Alojamentos**
O processo não está rodando, ou `URL_WHATSAPP` no `.env` do Alojamentos aponta para o lugar
errado.

**Conectado, mas a mensagem no grupo não virou pedido**
Três causas, nesta ordem: a mensagem não começou com `#pedido`; o grupo não está vinculado a
nenhum alojamento (confira na tela de WhatsApp); ou o texto depois do gatilho ficou curto
demais — menos de cinco caracteres não abre pedido.

**No privado, o morador manda e não vira pedido**
O WhatsApp dele não está cadastrado na alocação (tela de Moradores). Número não reconhecido
recebe orientação em vez de abrir pedido — de propósito: pedido de quem não se sabe quem é
encheria a lista de mensagem de desconhecido. Se aquele número já tiver falado em algum
grupo, a resposta ensina a usar o `#pedido` no grupo.

**"A sessão foi encerrada no celular"**
Alguém desvinculou o aparelho, ou o número foi banido. Apague a pasta `sessao/`, suba o
serviço de novo e leia o QR. Se o QR não parear, o número foi banido.
