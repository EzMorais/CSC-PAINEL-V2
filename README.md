# ERP Construtora Siqueira Campos

Sistema integrado de gestão para a operação de obras da Construtora Siqueira Campos. O ERP reúne planejamento diário, pessoas, segurança do trabalho, materiais, compras, finanças, frota, alojamentos e equipamentos em uma única experiência de acesso.

O objetivo é substituir controles dispersos e planilhas paralelas por processos rastreáveis, com a **obra** como eixo comum entre os setores.

## Visão do produto

O sistema organiza a operação de ponta a ponta:

```text
Planejamento da obra
        ↓
Programação diária de equipe e recursos
        ↓
Estoque e compras ──→ recebimento ──→ financeiro
        ↓                    ↑
RH/SST, frota e alojamentos apoiam a execução
```

Cada módulo é responsável pelo fato operacional que registra. As integrações evitam recadastro de pessoas, materiais, equipamentos, pedidos e títulos, preservando a origem de cada informação.

## Módulos

| Módulo | Finalidade | Rota pública |
|---|---|---|
| Hub e identidade | Login, usuários, permissões e acesso aos módulos | `/` |
| Painel de locação | Equipamentos alugados por obra, vencimentos, importação e exportação | `/painel` |
| RH e SST | Funcionários, cargos, documentos, treinamentos, exames, uniformes, EPIs e auditorias | `/rh` |
| Almoxarifado | Materiais, movimentações, saldos, inventário, aprovações e solicitações de compra | `/almoxarifado` |
| Compras | Cotações, pedidos, recebimentos, divergências, fornecedores e contratos | `/compras` |
| Financeiro | Contas a pagar e receber, faturamento, fiscal, competência e controles operacionais | `/financeiro` |
| Programação diária | Escala de pessoas, veículos, máquinas e frentes de trabalho | `/programacao` |
| Frota | Veículos, manutenção, abastecimento e disponibilidade operacional | `/frota` |
| Cadastros | Cadastros operacionais legados compartilhados | `/cadastros` |
| Alojamentos | Moradores, vagas, pedidos e logística de alojamento | `/alojamentos` |
| WhatsApp | Integração de mensagens e saúde do conector, sem tela pública própria | `/whatsapp/saude` |

## Fluxos integrados

### Operação da obra

1. Engenharia e operação definem frente, data, equipe e recursos na Programação.
2. RH/SST fornece a situação de pessoas, treinamentos, exames e entregas de EPI.
3. Frota disponibiliza veículos e máquinas aptos à escala.
4. Almoxarifado controla os materiais necessários e encaminha necessidades de reposição.

### Suprimentos e financeiro

1. Uma solicitação aprovada avança para cotação e pedido de compra.
2. O recebimento registra aceite, divergência ou devolução e atualiza o estoque.
3. O aceite gera a obrigação financeira correspondente, mantendo a rastreabilidade da origem.
4. Financeiro acompanha títulos, competência, faturamento e controle fiscal.

### Pessoas e segurança

- A entrega de EPI no Almoxarifado gera a ficha correspondente no RH/SST.
- O RH centraliza dados de funcionários, treinamentos, exames, documentos e ocorrências.
- A Programação consulta os cadastros operacionais para reduzir conflitos de escala.

## Acesso único e permissões

O ERP usa uma sessão única baseada em cookie assinado. Uma pessoa autenticada pode circular pelos módulos aos quais possui permissão, sem novo login.

- O acesso é controlado por usuário, cargo e módulo liberado.
- Administradores gerenciam usuários e permissões.
- Regras de autorização são verificadas antes do acesso aos módulos, inclusive os que ainda operam atrás do gateway.
- O segredo `AUTH_SECRET` deve ser forte e idêntico entre os serviços que participam da sessão única.

Não versionar segredos, bancos de dados, arquivos de sessão do WhatsApp, anexos ou dados reais de funcionários, clientes e fornecedores.

## Arquitetura

O projeto segue uma migração gradual para um núcleo único em Go, sem interromper módulos legados que ainda são necessários à operação.

```text
Navegador
   │
   ├── Desenvolvimento: http://localhost:3010
   └── Produção: HTTPS → Nginx → núcleo ERP Go
                                      ├── módulos nativos em Go
                                      └── gateway para módulos internos legados
```

### Núcleo ERP

O serviço em [`migracao-go`](migracao-go) concentra:

- identidade e hub de acesso;
- Painel de locação;
- RH e SST;
- Almoxarifado;
- Compras;
- Financeiro;
- Alojamentos;
- health checks em `/healthz` e `/readyz`.

O núcleo usa Go, SQLite, migrações versionadas e uma organização orientada a domínio, aplicação, adaptadores de infraestrutura e handlers HTTP.

### Módulos encaminhados pelo gateway

Os serviços abaixo continuam em Next.js durante a transição, mas são acessados pela mesma entrada pública:

| Serviço | Rota pública | Observação |
|---|---|---|
| Cadastros | `/cadastros` | Aplicação legada interna |
| Frota | `/frota` | Participa da sessão única |
| Programação | `/programacao` | Aplicação legada; a entrada abre a programação diária de referência |
| WhatsApp | `/whatsapp` | Conector interno, sem interface de negócio pública |

As portas internas não são ponto de entrada para usuários. Em desenvolvimento, o gateway recebe em `3010`; em produção, apenas o Nginx expõe HTTP/HTTPS.

## Execução local

### Pré-requisitos

- Windows com PowerShell;
- Node.js 24;
- Go 1.26.5;
- dependências dos aplicativos instaladas automaticamente pelo inicializador quando necessário.

### Início rápido

Na raiz do repositório, execute:

```powershell
.\scripts\iniciar-projeto.ps1
```

O script prepara os bancos de preview, inicia o núcleo e os serviços internos necessários, verifica a disponibilidade HTTP e expõe o ERP em:

```text
http://localhost:3010
```

Para abrir a entrada pública automaticamente ao final da inicialização:

```powershell
$env:ABRIR_NAVEGADOR = '1'
.\scripts\iniciar-projeto.ps1
```

Para testar em outro computador da rede, defina o nome ou IP público antes de iniciar. Isso faz os links internos apontarem para o host correto:

```powershell
$env:CSC_HOST = 'nome-do-host-ou-ip'
.\scripts\iniciar-projeto.ps1
```

### Endereços locais

| Área | Endereço |
|---|---|
| Entrada e login | `http://localhost:3010/` |
| Painel de locação | `http://localhost:3010/painel` |
| RH e SST | `http://localhost:3010/rh` |
| Almoxarifado | `http://localhost:3010/almoxarifado` |
| Compras | `http://localhost:3010/compras` |
| Financeiro | `http://localhost:3010/financeiro` |
| Programação diária | `http://localhost:3010/programacao` |
| Frota | `http://localhost:3010/frota` |
| Cadastros | `http://localhost:3010/cadastros` |
| Alojamentos | `http://localhost:3010/alojamentos` |
| Saúde do núcleo | `http://localhost:3010/healthz` |

## Configuração e implantação

Para produção, o projeto utiliza Docker Compose e Nginx com HTTPS. O fluxo recomendado está em [docs/deploy.md](docs/deploy.md).

Resumo:

1. Copie [`.env.example`](.env.example) para `.env` e informe as URLs públicas do domínio.
2. Copie cada arquivo `*.env.production.example` para o respectivo `.env.production`.
3. Gere um `AUTH_SECRET` forte e compartilhe o mesmo valor entre os serviços do SSO.
4. Configure DNS, certificado HTTPS e firewall para as portas 80 e 443.
5. Execute `docker compose up -d --build`.

Os valores `NEXT_PUBLIC_*` são incorporados ao JavaScript no build do Next.js. Portanto, ajuste o `.env` da raiz antes de construir as imagens.

## Qualidade e testes

O pipeline de integração contínua executa:

- formatação, `go vet` e testes do núcleo Go;
- instalação determinística com `npm ci`;
- geração de clientes Prisma quando aplicável;
- lint, verificação de tipos e build dos aplicativos Node.js;
- testes Playwright dos módulos e fluxos pelo gateway.

Comandos úteis durante o desenvolvimento:

```powershell
# Núcleo Go
Set-Location migracao-go
go vet ./...
go test ./...

# Programação diária
Set-Location ..\apps\programacao
npm run typecheck
npx playwright test --config=playwright.go.config.ts
```

Consulte também [docs/WORKFLOW_CI.md](docs/WORKFLOW_CI.md) para o fluxo de qualidade.

## Diretrizes de dados e operação

- Registros financeiros devem preservar valor, origem, competência, responsável e trilha de auditoria.
- Movimentações de estoque não devem editar saldo diretamente; o saldo é derivado dos eventos registrados.
- Compras, recebimentos e títulos financeiros devem manter vínculo com obra, responsável e documento de origem.
- Dados de pessoas e documentos de SST exigem tratamento compatível com a LGPD e as políticas internas da empresa.
- Bancos SQLite e volumes de produção exigem rotina de backup testada e restauração documentada antes de atualizações relevantes.

## Roadmap funcional

O ERP já concentra uma base operacional ampla, mas a evolução prioritária continua sendo a integração por obra, centro de custo e etapa de serviço. As frentes em desenvolvimento incluem:

- orçamento, EAP, cronograma, diário de obra e medições;
- apropriação de mão de obra, material, frota e locação por serviço;
- controle gerencial de custo comprometido, realizado e pago por obra;
- matriz documental e bloqueios de aptidão na programação;
- conciliação bancária, DRE por obra e fluxos fiscais;
- central de pendências, alertas e SLAs entre setores.

A avaliação funcional detalhada, incluindo capacidades atuais e lacunas, está em [docs/BRIEFING_ERP_CONSTRUTORA.md](docs/BRIEFING_ERP_CONSTRUTORA.md) e [docs/REVISAO_SETORES_E_DADOS_ERP.md](docs/REVISAO_SETORES_E_DADOS_ERP.md).

## Documentação técnica

| Documento | Conteúdo |
|---|---|
| [docs/deploy.md](docs/deploy.md) | Implantação com Docker, Nginx e HTTPS |
| [docs/design-system.md](docs/design-system.md) | Diretrizes de interface e identidade visual |
| [docs/WORKFLOW_CI.md](docs/WORKFLOW_CI.md) | Pipeline de qualidade e CI |
| [migracao-go/README.md](migracao-go/README.md) | Estratégia e estado da migração para o núcleo Go |
| [migracao-go/ARQUITETURA.md](migracao-go/ARQUITETURA.md) | Arquitetura do núcleo ERP |
| [apps/programacao/README.md](apps/programacao/README.md) | Operação da Programação diária |
| [apps/frota/README.md](apps/frota/README.md) | Operação da Frota |
| [apps/whatsapp/README.md](apps/whatsapp/README.md) | Conector WhatsApp |

---

Uso interno da Construtora Siqueira Campos. Dados de produção e credenciais não devem ser publicados fora dos controles autorizados da empresa.
