# Workflow de qualidade e pendências

O workflow [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) valida o projeto em
camadas independentes. Uma falha agora interrompe a etapa correspondente e não é convertida em
sucesso artificial.

## Ordem do pipeline

1. **Go** — configura a versão declarada em `migracao-go/go.mod`, verifica `gofmt`, executa
   `go vet` e roda todos os testes com cobertura.
2. **Descoberta Node** — localiza somente aplicações de primeiro nível em `apps/` que possuem
   `package.json`.
3. **Qualidade por aplicação** — em paralelo, executa `npm ci`, `prisma generate` quando houver
   schema, lint, typecheck, testes unitários e build.
4. **Playwright** — roda as suítes Next.js do Frota, Portal e Painel de Locação na branch
   principal. Também pode ser disparado manualmente com `workflow_dispatch` e `run_e2e=true`.

## Resolvido nesta rodada

- Go do CI alinhado à versão `1.26.5` do módulo.
- Removidos `|| exit 0`, `|| true` e outros caminhos que mascaravam falhas.
- Adicionadas validações de formatação, typecheck, build e geração do Prisma.
- E2E deixou de instalar Playwright globalmente e passou a instalar o navegador por aplicação.
- Relatórios Playwright gerados localmente passaram a ser ignorados pelo ESLint.
- Código Go formatado com `gofmt`; `go vet` e 112 testes passam localmente.
- WhatsApp portado para o módulo Go de Alojamentos: webhook de mensagens de grupo e
  individuais, parser por gatilhos, criação de pedidos a partir de mensagens e cobertura E2E
  dedicada (`apps/alojamentos/e2e/whatsapp.go.spec.ts`).
- `ModuloCompras` criado e `TemAcesso` aplicado nos handlers de Compras.

## Próximas pendências fora do CI

- Executar o workflow em um runner GitHub após o push e ajustar diferenças específicas do
  ambiente Linux.
- Integrar devolução de Compras ao estorno financeiro e criar perfis de tesouraria dedicados
  (em andamento).
- Configurar publicadores externos do outbox (bancos, CNAB/PIX, e-mail e SEFAZ/Sebrae).
- Concluir implantação de produção, HTTPS, backups e teste de restauração descritos em
  [`backlog.md`](backlog.md).
