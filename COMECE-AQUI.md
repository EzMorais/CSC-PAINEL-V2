# Como rodar este projeto em outro computador

Guia para quem nunca usou terminal nem instalou um projeto de programação antes.
O repositório tem **várias aplicações**, cada uma numa pasta dentro de `apps/`:

| Pasta | Sistema | Porta | Para que serve |
|---|---|---|---|
| `apps/portal` | **Portal** | 3004 | **Entrada de tudo**: login, usuários e cargos |
| `apps/programacao` | Programação diária | 3007 | Programação diária de equipes por frente/cliente |
| `apps/painel-locacao` | Painel de Locação | 3000 | Equipamentos alugados por obra |
| `apps/rh` | RH e SST | 3002 | Funcionários, treinamentos, exames, EPIs, documentos |
| `apps/estoque` | Almoxarifado | 3003 | Materiais, entradas/saídas por obra e compras |
| `apps/frota` | Frota | 3000 | Veículos, manutenções e abastecimento |

**Comece pelo Portal.** É ele que tem a tela de login e o cadastro de gente; os outros não
pedem senha própria. Entrando uma vez, você circula por todos.

Cada um roda separado, com seu próprio banco de dados.

> **Almoxarifado e RH andam juntos.** Quando um EPI sai do estoque para um funcionário, a
> ficha de entrega aparece sozinha no RH. Para isso funcionar, os dois precisam do **mesmo
> `AUTH_SECRET`** no arquivo `.env` — o instalador automático já cuida disso; se instalar à
> mão, copie o `.env` do RH para a pasta do estoque.

> **Num computador totalmente novo, sem nada instalado?** Tem um caminho ainda mais direto:
> baixe **[github.com/EzMorais/VISUAL-TT](https://github.com/EzMorais/VISUAL-TT)** (público,
> sem precisar de login pra baixar) e rode o `.bat` de lá — ele instala tudo, inclusive baixa
> este projeto sozinho. É o mesmo instalador descrito abaixo, só que também resolve o "baixar
> o projeto" pra quem ainda não tem GitHub Desktop nem conta logada em nada.

---

## Caminho rápido (recomendado): um script instala tudo sozinho

Só dois passos manuais — baixar o projeto e clicar num arquivo. O script cuida do resto:
Node.js, Git, Visual Studio Code, GitHub CLI, Claude Code, as extensões do VS Code
recomendadas para este projeto, e todos os módulos instalados com banco de dados pronto.

### 1. Baixar o projeto com o GitHub Desktop

1. Baixe e instale o [GitHub Desktop](https://desktop.github.com/)
2. Abra o programa e faça login com a conta do GitHub que tem acesso a este repositório
   (ele é privado — sem login com acesso, o download não aparece)
3. Menu **File → Clone repository**
4. Procure `CSC-PAINEL` na lista (aba "GitHub.com") e escolha uma pasta local, tipo `C:\CSC-PAINEL`
5. Clique **Clone**

### 2. Rodar o script de instalação

1. Abra a pasta onde clonou o projeto (Explorador de Arquivos)
2. Dê duplo clique em **`configurar-novo-computador.bat`**
3. Uma janela azul do **Controle de Conta de Usuário** do Windows pode aparecer perguntando
   se o programa pode fazer alterações no dispositivo — clique **Sim**. É esperado: instalar
   programas exige essa permissão.
4. Uma janela preta abre e mostra o progresso de cada etapa (1/6, 2/6...). **Não fecha
   sozinha** — quando terminar tudo, ela pede para apertar Enter.
5. A primeira vez demora — pode passar de 15 minutos, dependendo da internet. Deixe rodando.

Se alguma etapa falhar (falta de internet no meio, por exemplo), **é seguro rodar o arquivo
de novo**: cada passo confere se já foi feito antes de repetir.

Quando terminar, o projeto abre sozinho no VS Code. Para **usar** cada sistema, falta só
ligar o servidor de cada um — veja os passos 4 a 8 abaixo (pule a parte de instalar
dependências e criar `.env`: o script já fez isso).

> **O que o script instala**, para quem quiser conferir ou fazer à mão depois: Node.js LTS,
> Git, Visual Studio Code, GitHub CLI, [Claude Code](https://claude.com/claude-code) (o
> assistente de IA usado para construir este projeto), e as extensões do VS Code em
> `.vscode/extensions.json` — Prisma, ESLint, Tailwind CSS IntelliSense, GitLens, Error Lens,
> SQLTools e Path Intellisense. Você não precisa saber o que cada uma faz — é só deixar o VS
> Code instalar quando ele perguntar (aparece um aviso "This workspace has extension
> recommendations" ao abrir a pasta, com um botão **Install All**).

Prefere entender ou fazer cada passo manualmente (ou o script não funcionou)? Segue o passo
a passo completo abaixo.

---

## Passo a passo manual

## Passo 1 — Instalar o Node.js

Todos os sistemas precisam do **Node.js**. É um programa só, serve para todos.

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

---

## Passo 2 — Baixar o projeto

O repositório é **privado**, então baixar o ZIP direto do site do GitHub só funciona se você
estiver logado com uma conta que tenha acesso.

**Caminho mais fácil para quem não usa terminal: GitHub Desktop**

1. Baixe e instale o [GitHub Desktop](https://desktop.github.com/)
2. Abra o programa e faça login com a conta do GitHub que tem acesso ao repositório
3. Menu **File → Clone repository**
4. Procure `CSC-PAINEL` na lista (aba "GitHub.com") e escolha uma pasta local, tipo `C:\CSC-PAINEL`
5. Clique **Clone**

Isso baixa o projeto inteiro (todos os módulos) para o seu computador.

> Se preferir usar o terminal em vez do GitHub Desktop, com o [Git](https://git-scm.com/)
> instalado e a conta do GitHub autenticada:
> ```
> git clone https://github.com/EzMorais/CSC-PAINEL.git
> ```

---

## Passo 3 — Abrir o terminal na pasta certa

Cada sistema abaixo precisa de comandos digitados num terminal, dentro da pasta dele
(`apps/portal`, `apps/painel-locacao`, `apps/rh`, `apps/estoque` ou `apps/frota`).

Jeito mais simples de abrir o terminal já na pasta certa:

1. Abra o Explorador de Arquivos e navegue até, por exemplo, `C:\CSC-PAINEL\apps\painel-locacao`
2. Clique na barra de endereço, apague o caminho, digite `cmd` e aperte Enter

Uma janela preta abre já "dentro" daquela pasta. É ali que os comandos dos passos seguintes
vão ser digitados.

---

## Passo 4 — Portal (faça este primeiro)

É ele que guarda os usuários. Sem o Portal, não há com que fazer login em nenhum dos outros.
Numa janela de terminal dentro de `apps/portal`:

```bash
npm install
echo DATABASE_URL="file:./dev.db" > .env
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abra **http://localhost:3004**. Login: `admin@siqueiracampos.com.br` / `locacao2026`.

> **Guarde o `.env` deste passo.** Nos passos seguintes você vai **copiar este arquivo** em
> vez de gerar um novo — é o mesmo `AUTH_SECRET` que faz o login do Portal valer nos outros
> sistemas.

O seed cria contas de **exemplo** de cada cargo (senha `exemplo2026`) para você ver a
hierarquia funcionando. Apague-as no Portal antes de usar para valer.

---

## Passo 5 — Painel de Locação

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
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run gerar:exemplo
npm run dev
```

> O `npx prisma generate` não é opcional. As versões novas do npm bloqueiam os scripts de
> instalação dos pacotes por segurança, e é justamente um desses scripts que normalmente
> prepararia o acesso ao banco sozinho. Sem essa linha, tudo instala "com sucesso" e só
> quebra no comando seguinte, com a mensagem `@prisma/client did not initialize yet`.

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

---

## Passo 6 — RH

Mesma lógica, numa janela de terminal aberta dentro de `apps/rh`:

```bash
npm install
echo DATABASE_URL="file:./dev.db" > .env
node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64')+'\"')" >> .env
npx prisma generate
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

---

## Passo 7 — Almoxarifado

Numa janela de terminal dentro de `apps/estoque`. Aqui **não** se cria um segredo novo: ele
precisa ser o mesmo do RH, senão a entrega de EPI não consegue falar com o RH.

```bash
copy ..\rh\.env .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abra **http://localhost:3003**. Login: o mesmo dos outros
(`admin@siqueiracampos.com.br` / `locacao2026`).

---

## Passo 8 — Frota

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
`apps/frota/README.md`.

> **Atenção às portas:** Painel de Locação e Frota usam a mesma porta (3000) por padrão. Para
> rodar os dois ao mesmo tempo na mesma máquina, mude a porta de um deles — no Painel de
> Locação: `npm run dev -- --port 3010`.

---

## Problemas comuns

**"node não é reconhecido como comando interno ou externo"**
O Node não foi instalado ou o "Add to PATH" não foi marcado. Reinstale pelo
[nodejs.org](https://nodejs.org) marcando essa opção, e reinicie o computador.

**Aparece `path length ... exceeds max length of filesystem`**
A pasta onde você colocou o projeto está fundo demais. O Windows tem um limite antigo de
tamanho de caminho, e os arquivos internos do Next.js são longos. Mova a pasta para perto da
raiz do disco — `C:\CSC-PAINEL` resolve.

**Aparece `@prisma/client did not initialize yet`**
Faltou rodar `npx prisma generate` dentro da pasta daquele sistema. As versões novas do npm
bloqueiam os scripts de instalação dos pacotes, e esse comando é o que normalmente rodaria
sozinho. Rode ele e repita o comando que falhou.

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
de arquitetura, comandos de teste): `apps/painel-locacao/README.md` e `apps/frota/README.md`.
