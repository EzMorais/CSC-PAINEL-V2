# CSC — Painéis Internos (Construtora Siqueira Campos)

Monorepo com três sistemas web internos, cada um numa pasta dentro de `apps/`:

| Pasta | Sistema | Para que serve |
|---|---|---|
| [`apps/painel-locacao`](apps/painel-locacao) | Painel de Locação | Controle de equipamentos alugados por obra |
| [`apps/rh`](apps/rh) | RH | Cadastro de funcionários, documentos, treinamentos |
| [`apps/frota`](apps/frota) | Frota | Controle de veículos, manutenções e abastecimento |

Cada sistema é independente: roda separado, com seu próprio banco de dados e seu próprio
login. Todos são Next.js + TypeScript, com Prisma (ou Drizzle, no caso do Frota) sobre
SQLite.

Repositório **privado** — contém a operação de uma empresa real.

---

## Como rodar em outro computador

Guia para quem nunca usou terminal nem instalou um projeto de programação antes. Você não
precisa instalar os três sistemas — só o(s) que for usar.

### Passo 1 — Instalar o Node.js

Todos os três sistemas precisam do **Node.js**. É um programa só, serve para os três.

1. Acesse [nodejs.org](https://nodejs.org)
2. Clique no botão que diz **LTS** (é a versão recomendada)
3. Abra o instalador baixado e siga clicando **Next**
   - No Windows, na tela que lista componentes, deixe **"Add to PATH"** marcado — isso é
     importante, sem isso o computador não acha o Node depois
4. Termine a instalação e **reinicie o computador** (garante que o PATH seja atualizado)

Para conferir se funcionou, abra o **Prompt de Comando** (tecla Windows → digite `cmd` →
Enter) e digite:

```
node --version
```

Deve aparecer algo como `v24.x.x`. Se aparecer "não é reconhecido como comando", volte ao
passo 3 e reinstale marcando "Add to PATH".

### Passo 2 — Baixar o projeto

O repositório é **privado**, então baixar o ZIP direto do site do GitHub só funciona se você
estiver logado com uma conta que tenha acesso.

**Caminho mais fácil para quem não usa terminal: GitHub Desktop**

1. Baixe e instale o [GitHub Desktop](https://desktop.github.com/)
2. Abra o programa e faça login com a conta do GitHub que tem acesso ao repositório
3. Menu **File → Clone repository**
4. Procure `CSC-PAINEL` na lista (aba "GitHub.com") e escolha uma pasta local, tipo `C:\CSC-PAINEL`
5. Clique **Clone**

Isso baixa o projeto inteiro (os três sistemas) para o seu computador.

> Se preferir usar o terminal em vez do GitHub Desktop, com o [Git](https://git-scm.com/)
> instalado e a conta do GitHub autenticada:
> ```
> git clone https://github.com/EzMorais/CSC-PAINEL.git
> ```

### Passo 3 — Abrir o terminal na pasta certa

Cada sistema abaixo precisa de comandos digitados num terminal, dentro da pasta dele
(`apps/painel-locacao`, `apps/rh` ou `apps/frota`).

Jeito mais simples de abrir o terminal já na pasta certa:

1. Abra o Explorador de Arquivos e navegue até, por exemplo, `C:\CSC-PAINEL\apps\painel-locacao`
2. Clique na barra de endereço, apague o caminho, digite `cmd` e aperte Enter

Uma janela preta abre já "dentro" daquela pasta. É ali que os comandos dos passos seguintes
vão ser digitados.

### Passo 4 — Painel de Locação

Na janela de terminal aberta dentro de `apps/painel-locacao`, digite cada linha e aperte
Enter, esperando a anterior terminar:

```bash
npm install
```

Demora alguns minutos na primeira vez (baixa as peças que o sistema usa). Depois, crie o
arquivo de configuração:

```bash
echo DATABASE_URL="file:./dev.db" > .env
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
```

Depois:

```bash
npx prisma migrate deploy
npm run db:seed
npm run gerar:exemplo
npm run dev
```

Quando aparecer `Ready` no terminal, abra o navegador em **http://localhost:3000**.

**Login:**

| | |
|---|---|
| Usuário | `admin@siqueiracampos.com.br` |
| Senha | `locacao2026` |

Troque a senha depois do primeiro acesso. O painel aparece vazio — vá em **Importar**, envie
o arquivo `dados/EXEMPLO_Maquinas_Alugadas.xlsx` (gerado no passo anterior) para popular com
dados de teste, ou importe a planilha real da empresa.

Para deixar rodando, **não feche essa janela do terminal** — é o servidor. Para desligar,
clique dentro dela e aperte `Ctrl+C`.

### Passo 5 — RH

Mesma lógica, numa janela de terminal aberta dentro de `apps/rh`:

```bash
npm install
echo DATABASE_URL="file:./dev.db" > .env
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abra **http://localhost:3002** (o RH usa uma porta diferente do Painel de Locação, para os
dois poderem rodar ao mesmo tempo).

**Login:** mesmos usuário e senha do Painel de Locação (`admin@siqueiracampos.com.br` /
`locacao2026`).

> Se você quiser que uma pessoa logada no Painel de Locação já entre automaticamente no RH
> sem logar de novo, use exatamente o mesmo valor de `AUTH_SECRET` nos dois arquivos `.env`
> em vez de gerar um novo para o RH. Não é obrigatório — sem isso cada sistema pede login
> separado, e funciona normalmente.

### Passo 6 — Frota

O Frota já vem com instaladores prontos (arquivos `.bat`), então não precisa digitar nada
no terminal:

1. Entre na pasta `apps/frota`
2. Dê duplo clique em **`instalar.bat`** — confere o Node, instala tudo e prepara o banco.
   Leva alguns minutos na primeira vez
3. Dê duplo clique em **`iniciar.bat`** — abre uma janela mostrando o endereço, algo como
   `http://localhost:3000`
4. Abra esse endereço no navegador

**Login:**

| | |
|---|---|
| Usuário | `admin@siqueiracampos.com.br` |
| Senha | `frota2026` |

Deixe a janela do `iniciar.bat` aberta enquanto usa o sistema — fechá-la desliga o servidor.

Detalhes extras (backup, alertas por e-mail, rodar como serviço do Windows) estão em
[`apps/frota/README.md`](apps/frota/README.md).

> **Atenção às portas:** Painel de Locação e Frota usam a mesma porta (3000) por padrão. Para
> rodar os dois ao mesmo tempo na mesma máquina, mude a porta de um deles — no Painel de
> Locação: `npm run dev -- --port 3010`.

### Problemas comuns

**"node não é reconhecido como comando interno ou externo"**
O Node não foi instalado ou o "Add to PATH" não foi marcado. Reinstale pelo
[nodejs.org](https://nodejs.org) marcando essa opção, e reinicie o computador.

**A tela de login não aceita, ou dá erro estranho ao abrir**
Confira se o arquivo `.env` foi criado dentro da pasta certa (`apps/painel-locacao/.env`,
por exemplo) e se a linha `AUTH_SECRET` tem mais de 32 caracteres.

**Terminal fecha sozinho ou mostra erro em vermelho**
Copie a mensagem de erro e peça ajuda a quem mantém o projeto — geralmente é uma etapa que
não terminou (ex.: `npm install` foi interrompido).

**Quero apagar tudo e começar do zero**
No Painel de Locação: `npm run db:reset` apaga o banco e recadastra os dados de exemplo. No
RH e no Frota, apague o arquivo do banco (indicado no `.env`, ou a pasta `dados/` no Frota) e
rode o passo do seed de novo.

---

## Para quem for mexer no código

Cada sistema tem seu próprio README com mais detalhes técnicos (estrutura de pastas, decisões
de arquitetura, comandos de teste): [`apps/painel-locacao/README.md`](apps/painel-locacao/README.md)
e [`apps/frota/README.md`](apps/frota/README.md).

Este mesmo guia de instalação também está em [`COMECE-AQUI.md`](COMECE-AQUI.md), como arquivo
avulso caso precise mandar só ele para alguém.
