# Arquitetura do binário Go único

Adaptado do documento de arquitetura de produção com SQLite que o usuário forneceu, para as
especificidades deste monorepo. Complementa `migracao-go/README.md` (o plano/status por
módulo) — este arquivo é o "como construir", aquele é o "o quê e em que ordem".

## 1. Filosofia

Clean Architecture / Ports and Adapters (Hexagonal). **A camada de domínio nunca importa
`database/sql`, `sqlc` nem nada específico de SQLite** — ela define interfaces (as "portas");
a infraestrutura implementa (os "adaptadores"). Isso não é acadêmico aqui: é o que permite
trocar SQLite por outro banco no futuro sem reescrever regra de negócio, e é o que faz os
testes de domínio rodarem sem precisar de um banco de verdade.

SOLID, KISS, DRY, YAGNI, baixo acoplamento, alta coesão — como no resto do projeto. Nenhuma
camada superior conhece detalhe de implementação da camada inferior.

## 2. Banco único — decisão tomada em 2026-08-04

Confirmado: **um SQLite só**, bem modelado, sem separar por módulo. A duplicação de `Obra`
que apareceu ao mapear os 4 schemas restantes (Painel/RH/Almoxarifado/Alojamentos — ver
`README.md` §"Banco único") **vai ser unificada numa tabela só**, referenciada por FK a partir
de `locacoes`, `movimentacoes_estoque`, `funcionarios`/`eventos`/`documentos`/`auditorias` e
`alocacoes`/`distancias_obra`. Idem `Fornecedor` (duplicado entre Painel e Almoxarifado).
Critério do documento original — "só separar banco quando representar um Bounded Context
independente, nunca por tela ou funcionalidade" — não se aplica aqui: os 5 módulos deste
sistema são o mesmo negócio (uma construtora), só vistos por telas diferentes.

O design de schema exato (nomes de tabela, colunas migradas do formato Alojamentos que inclui
geocodificação) fica pra quando a migração chegar no segundo módulo — só então há um segundo
schema real pra unificar com o de identidade do Portal.

## 3. Estrutura do projeto

```text
cmd/
  servidor/
    main.go
internal/
  domain/                    # entidades e regras de negócio puras — zero import de SQLite
    identidade/
    locacao/
    rh/
    estoque/
    alojamentos/
    obra/                     # entidade compartilhada — ver §2
  application/                # casos de uso: orquestram domínio + portas de repositório
  repositories/                # INTERFACES (portas) — ex.: UsuarioRepository, ObraRepository
  services/
  handlers/                    # HTTP — um pacote por módulo, montam as rotas com o prefixo
    identidade/  locacao/  rh/  estoque/  alojamentos/
  middleware/                  # sessão, autorização por cargo/módulo (ver COMPORTAMENTO.md)
  infrastructure/
    database/                  # implementação SQLite das portas — o único lugar que importa driver
    migrations/                 # migrações versionadas (goose ou sqlc + arquivos .sql numerados)
    cache/                       # vazio até haver necessidade real
    queue/                        # vazio até haver necessidade real
templates/                     # Templ — um pacote por módulo + layout/ compartilhado
static/
configs/
scripts/
tests/
```

`domain/obra` existe separado dos outros domínios de propósito: é a entidade compartilhada, e
ficar dentro de `domain/locacao` ou `domain/rh` sugeriria erradamente que pertence a um módulo
só.

## 4. Camada de persistência

Repository Pattern. Cada porta em `internal/repositories/` é uma interface Go; a implementação
mora em `internal/infrastructure/database/`. Nunca SQL espalhado pelo projeto — consultas
centralizadas via `sqlc` (queries `.sql` versionadas geram código Go tipado) sobre
`database/sql`. `context.Context` em toda operação. Sem ORM pesado (nada de GORM completo).

## 5. Configuração do SQLite em produção

Todas justificadas, todas documentadas em `internal/infrastructure/database/` quando
implementadas:

| Configuração | Motivo |
|---|---|
| `journal_mode = WAL` | leitura concorrente com escrita — essencial num app com vários usuários simultâneos |
| `busy_timeout` configurado | reduz `SQLITE_BUSY` em contenção, em vez de falhar a requisição |
| `foreign_keys = ON` | SQLite não aplica FK por padrão — sem isto as constraints do schema viram decoração |
| Transações explícitas | operações relacionadas (ex.: criar usuário + acessos) não podem parar no meio |
| Prepared statements | via `sqlc`, para toda consulta recorrente |
| `EXPLAIN QUERY PLAN` | revisão periódica dos índices conforme os módulos entram |
| `PRAGMA optimize` | rodado periodicamente, não a cada request |
| Estratégia de vacuum | `auto_vacuum` ou `VACUUM` agendado, conforme o padrão de escrita observado — decisão que espera dados reais de uso, não decidida a priori |

Escritas curtas e objetivas, sem transação longa seguravel lock — SQLite serializa escritores.

## 6. Observabilidade e testabilidade

- Logs estruturados, tratamento consistente de erro (idiomático Go: erro é valor, não exceção).
- Health check de processo + de conexão com o banco.
- Monitoramento de consultas lentas — junto com a revisão de `EXPLAIN QUERY PLAN`.
- Testes: unitários de domínio (sem banco, mockando as portas de repositório), integração
  contra SQLite real, e os testes de comportamento Playwright já existentes em
  `apps/<módulo>/e2e/` — que continuam sendo a prova de equivalência funcional exigida antes de
  desligar cada Next.js (ver `README.md`).

## 7. Escalabilidade

Por módulo/interface bem definida, não por complexidade tecnológica adicionada de graça —
cache e processamento assíncrono só entram quando houver necessidade medida, não por padrão.
Redis fica de fora até haver uma razão concreta (fila distribuída, cache distribuído, pub/sub)
— o documento original do usuário e o desta migração concordam nisso.
