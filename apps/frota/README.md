# Frota — Controle de Veículos

Sistema web para controlar frota, manutenções e abastecimento de uma
construtora. Roda num servidor da empresa; todo mundo acessa pelo navegador,
sem instalar nada na máquina de cada um.

Substitui uma planilha Excel preenchida à mão — e continua **gerando essa mesma
planilha** ao final, no formato exato que a diretoria já recebe.

---

## O que ele faz

**Veículos** — cadastro completo com seguro, licenciamento, FIPE e
quilometragem. Cada veículo mostra um hodômetro de revisão: uma régua da última
revisão até a próxima, com a agulha na quilometragem atual. Fica âmbar quando
falta pouco e vermelho quando passou.

**Manutenções** — registra problema, categoria, prioridade e status. Aceita foto
ou PDF do orçamento como anexo; no celular a câmera abre direto.

**Abastecimento** — importa o CSV que o sistema do posto exporta, ou lança à mão.
Ao escolher a placa, o campo de combustível já filtra pelos combustíveis
autorizados daquele veículo. O km informado no abastecimento também atualiza o
veículo.

**Alertas** — seguro vencendo, revisão atrasada, multa em aberto e problema
parado há mais de 30 dias. Separado entre "resolver agora" e "acompanhar".

**Planilha da diretoria** — um botão gera o `.xlsx` com quatro abas: as duas
originais (CONTROLE e MANUTENÇÕES E PROBLEMAS), mais ABASTECIMENTO e DASHBOARD.

---

## Instalar (passo a passo)

### O que precisa antes

Só uma coisa: **Node.js 24 LTS**.

1. Acesse [nodejs.org](https://nodejs.org)
2. Baixe o botão que diz **LTS**
3. Abra o instalador e **marque a caixa "Add to PATH"** — essa parte importa;
   sem ela o Windows não encontra o Node depois
4. Conclua a instalação

Para conferir se deu certo, abra o Prompt de Comando e digite:

```
node --version
```

Deve aparecer algo como `v24.18.1`. Se aparecer "não é reconhecido como comando",
o "Add to PATH" não foi marcado — reinstale marcando.

### Instalando o sistema

1. Baixe o projeto (botão verde **Code → Download ZIP** aqui no GitHub)

2. **Extraia o ZIP** — botão direito → *Extrair Tudo*. Escolha uma pasta de
   verdade, tipo `C:\frota`.

   > Não dê duplo clique no `.bat` de dentro do ZIP. O Windows abre o arquivo
   > compactado numa pasta temporária que ele apaga depois, e a instalação se
   > perde. O instalador detecta isso e avisa, mas é bom já saber.

3. Entre na pasta extraída e dê duplo clique em **`instalar.bat`**

   Ele confere o Node, instala as dependências, compila o sistema e prepara o
   banco de dados. Leva alguns minutos na primeira vez.

4. Dê duplo clique em **`iniciar.bat`**

   A janela mostra o endereço de acesso, algo como `http://192.168.1.10:3000`.
   Deixe essa janela aberta — é o servidor rodando.

5. Abra esse endereço no navegador

   **Usuário:** `admin@siqueiracampos.com.br`
   **Senha:** `frota2026`

   Troque a senha depois do primeiro acesso.

### Para o sistema subir sozinho com o Windows

Botão direito em **`instalar-servico.bat`** → *Executar como administrador*.

A partir daí ele inicia junto com o servidor, sem precisar de ninguém.

Para desfazer:

```
schtasks /Delete /TN "FrotaSiqueiraCampos" /F
```

---

## Usando no dia a dia

Quem estiver na mesma rede (ou na VPN) abre o endereço no navegador —
computador, celular ou tablet.

No celular a navegação fica numa barra embaixo, ao alcance do polegar, para o
motorista conseguir lançar o abastecimento no posto com uma mão só.

### Trazer os dados de uma planilha existente

Se você já controla a frota numa planilha, dá para importar em vez de digitar
tudo: na tela de veículos existe a importação de `.xlsx`. Ele lê as abas
`CONTROLE` e `MANUTENÇÕES E PROBLEMAS`.

### Importar o CSV do posto

Na tela de abastecimento, botão **Importar CSV**. Antes de gravar, ele mostra
quais colunas encontrou e quantos registros vai trazer, para você conferir.

O cadastro de veículos autorizados é atualizado pela placa. Se o arquivo trouxer
colunas de litros ou valor, os abastecimentos entram como lançamentos novos.

---

## Backup

Duas pastas, e é só isso:

| O quê | Onde |
|---|---|
| Banco de dados | `dados\` |
| Fotos e orçamentos | `.next\standalone\public\anexos\` |

Copie essas duas para qualquer lugar seguro. Para restaurar, é só colocar de
volta no mesmo lugar.

---

## Alertas por e-mail (opcional)

Abra o arquivo `.env` num editor de texto e preencha:

```
SMTP_HOST="smtp.seuprovedor.com.br"
SMTP_PORT="587"
SMTP_USER="frota@suaempresa.com.br"
SMTP_PASS="a-senha"
SMTP_DE="frota@suaempresa.com.br"
ALERTA_PARA="voce@suaempresa.com.br"
```

Sem esses valores o sistema funciona normalmente, só não envia e-mail.

---

## Atualizar para uma versão nova

1. Feche a janela do `iniciar.bat`
2. Baixe o ZIP novo e extraia por cima da pasta antiga
3. Rode `instalar.bat` de novo
4. Rode `iniciar.bat`

A pasta `dados\` não é tocada — os registros continuam lá.

---

## Se der problema

**"node não é reconhecido como comando"**
O Node não foi instalado ou o "Add to PATH" não foi marcado. Reinstale pelo
[nodejs.org](https://nodejs.org) marcando a opção.

**"você está rodando de dentro do arquivo compactado"**
Extraia o ZIP para uma pasta de verdade antes de rodar o `instalar.bat`.

**"Node.js vXX é antigo demais"**
O sistema usa o módulo SQLite embutido, que existe a partir do Node 22.5.
Instale o Node 24 LTS.

**Abre mas não aparece nenhum veículo**
Olhe a janela preta do `iniciar.bat`. Se estiver escrito
`[frota] ATENÇÃO: nenhum veículo neste banco`, o caminho do banco está errado —
confira a linha `DATABASE_URL` no arquivo `.env`.

**Outra pessoa na rede não consegue abrir**
Libere a porta 3000 no Firewall do Windows do servidor:

```
netsh advfirewall firewall add rule name="Frota" dir=in action=allow protocol=TCP localport=3000
```

---

## Para quem for mexer no código

```bash
npm install      # instala dependências
npm run seed     # popula o banco com dados de exemplo
npm run dev      # ambiente de desenvolvimento em http://localhost:3000
npm run build    # compila para produção
npm start        # roda a versão compilada
```

**Testes automatizados** (Playwright):

```bash
npx playwright install chromium
npm test
```

Cobrem login, bloqueio de rota sem sessão, navegação, troca de motorista,
download da planilha e a barra inferior no perfil de celular.

### Estrutura

```
src/
  app/
    (app)/           páginas autenticadas: veículos, manutenções, abastecimento, alertas
    entrar/          tela de login
    api/             exportação do xlsx e logout
    acoes.ts         server actions (toda escrita passa por aqui)
  components/        Casca (navegação), Hodometro, Selo, Kpi
  db/                schema Drizzle, conexão e seed
  lib/
    auth.ts          sessão em cookie assinado e bcrypt
    frota.ts         cálculo de alertas, revisão e indicadores
    xlsx.ts          geração da planilha
vendor/
  better-sqlite3/    adaptador local sobre o node:sqlite
```

### Decisões técnicas que valem explicação

**Nenhum módulo nativo.** O banco usa o `node:sqlite`, que já vem dentro do
Node. A pasta `vendor/better-sqlite3` é um adaptador de ~90 linhas que expõe a
API que o Drizzle espera. Isso elimina `node-gyp`, Visual Studio Build Tools e a
loteria de binários pré-compilados a cada versão nova do Node — o que
inviabilizava a instalação num servidor Windows comum.

**Build standalone.** `node server.js` e pronto, sem precisar de nginx ou IIS na
frente.

**Fontes com degradação graciosa.** Se o servidor tiver internet, usa Barlow
Condensed e IBM Plex. Sem internet, cai para a stack nativa do Windows sem
quebrar o layout.

### Sobre a planilha gerada

As abas CONTROLE e MANUTENÇÕES E PROBLEMAS foram conferidas célula a célula
contra o arquivo original: larguras de coluna, cores do tema, alturas de linha,
formatos numéricos contábeis e fórmulas.

Uma diferença é proposital. Na planilha original, a fórmula da coluna "Dias em
Aberto" está deslocada uma linha — na linha 4 ela lê `=IF(F5="";"";HOJE()-E5)`,
apontando para a linha de baixo, o que faz a contagem sair errada. A versão
gerada usa a fórmula correta.
