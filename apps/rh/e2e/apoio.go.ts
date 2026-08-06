import { execSync } from 'node:child_process'
import path from 'node:path'
import { SignJWT } from 'jose'

/**
 * Suporte da suíte que roda contra o binário Go único (`playwright.go.config.ts`) — ver
 * migracao-go/README.md "Como os testes de referência funcionam" e
 * migracao-go/rh/COMPORTAMENTO.md. Especificações NOVAS (`*.go.spec.ts`), não cópia de
 * `.spec.ts` originais (o RH nem tinha suíte prévia — só este arquivo de apoio existia).
 * Mesmo padrão de `apps/estoque/e2e/apoio.go.ts`.
 */

export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'rh-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'
export const ARQUIVO_SESSAO_GO = path.resolve(__dirname, '.sessao-go.json')

export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/**
 * Cargo OPERACIONAL, módulo RH — já semeado por `semearExemplos` (cmd/seed/main.go).
 * Lança, mas não administra (não pode excluir funcionário).
 */
export const USUARIO_OPERACIONAL = { email: 'rh@exemplo.com.br', senha: 'exemplo2026' }

/**
 * Cargo CONSULTA, módulos Painel+RH — já semeado por `semearExemplos`. Só lê: usado pra
 * exercitar a guarda de lançamento (não pode criar/editar nada).
 */
export const USUARIO_CONSULTA = { email: 'mestre@exemplo.com.br', senha: 'exemplo2026' }

/**
 * Assina um token de integração para os testes de `integracao-*.go.spec.ts` — mesmo
 * contrato de `apps/rh/src/lib/integracao.ts`: HS256, `{origem, tipo: 'integracao'}`,
 * validade curta. `AUTH_SECRET_GO` acima tem 47 caracteres, acima do mínimo de 32 exigido.
 */
export async function assinarTokenIntegracaoTeste(origem: string, validadeSegundos = 60): Promise<string> {
  return new SignJWT({ origem, tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${validadeSegundos}s`)
    .sign(new TextEncoder().encode(AUTH_SECRET_GO))
}

/** Reseta via SQL e roda o seed do binário único (`cmd/seed/main.go`, `semearRH`). */
export function reiniciarBancoGo() {
  execSync('go run ./cmd/seed', {
    cwd: RAIZ_GO,
    env: { ...process.env, DATABASE_PATH: BANCO_GO, AUTH_SECRET: AUTH_SECRET_GO, SEED_RESET: '1' },
    stdio: 'pipe',
  })
}

/**
 * O que `semearRH` produz — conferido contra `cmd/seed/main.go`. Reaproveita os MESMOS
 * números de obras/cargos/funcionários já estabelecidos em `apps/rh/e2e/apoio.ts`
 * (`ESPERADO`, que vem de `prisma/dados-exemplo.ts`) — é o mesmo elenco de pessoas e obras,
 * só que semeado direto pelo binário Go em vez de via Prisma. As entidades que o seed do
 * Next.js não cobre (treinamentos, exames, documentos, auditorias, uniformes, EPI) são
 * fixture nova, desenhada especificamente para esta suíte — ver comentário de cada
 * `*.go.spec.ts` para o que cada uma representa.
 */
export const ESPERADO = {
  obras: 5,
  cargos: 10,
  /**
   * 2 ramos + 2 setores cada — versão reduzida do organograma real do Next.js (2 ramos +
   * 19 setores, `apps/rh/prisma/seed.ts` `ORGANOGRAMA`), compacta o bastante pra suíte não
   * ficar inchada mas mantendo os DOIS nomes que a lógica de nível de obra depende: o setor
   * "Obras" (ramo Engenharia) é onde `departamentoId` aponta para quem tem `nivelObra`
   * preenchido — mesmo papel que cumpre no seed do Next.js.
   *   Administrativo → RH, Financeiro
   *   Engenharia      → Obras, Planejamento
   */
  departamentos: 6,
  funcionarios: 14,
  ativos: 11,
  ferias: 1,
  afastados: 1,
  desligados: 1,
  /** Só o DIEGO FERREIRA PINTO entra sem obra e sem cargo — mesmo dado do Next.js. */
  semObra: 1,
  semCargo: 1,

  treinamentos: 3,
  exames: 3,
  documentos: 3, // 2 empresa + 1 pessoal
  entregasUniforme: 2,
  auditorias: 1,
  itensAuditoria: 3,
  naoConformidades: 2, // 1 solta + 1 gerada automaticamente do item reprovado
  entregasEpi: 1, // simula o que o Almoxarifado já teria enviado
}

/**
 * Plano exato da fixture nova (treinamento/exame/uniforme/documento/auditoria/EPI) —
 * `cmd/seed/main.go` `semearRH` precisa implementar exatamente isto, é o que os specs
 * individuais conferem. Centralizado aqui para não haver dois lugares divergindo sobre
 * "quem tem o quê".
 *
 * - Treinamento 1: NR_35 "Trabalho em Altura — Turma A", realizado há ~400 dias,
 *   validade ~35 dias atrás (VENCIDO). Participantes: JOÃO BATISTA SILVEIRA, ANTÔNIO
 *   PEREIRA LIMA.
 * - Treinamento 2: NR_18 "Construção Civil — Turma B", realizado há ~350 dias, validade
 *   daqui a ~15 dias (VENCENDO, dentro da janela de 30 dias). Participantes: PAULO
 *   HENRIQUE COSTA, RAFAEL AUGUSTO MENDES.
 * - Treinamento 3: NR_10 "Segurança em Eletricidade — Integração", realizado há ~100
 *   dias, SEM validade (válido pra sempre — não deve aparecer em nenhum alerta).
 *   Participante: MARCOS VINÍCIUS ALVES.
 * - Exame 1: PAULO HENRIQUE COSTA, PERIODICO, validade ~5 dias atrás (VENCIDO), APTO.
 * - Exame 2: FERNANDA APARECIDA DIAS, PERIODICO, validade daqui a ~20 dias (VENCENDO),
 *   APTO.
 * - Exame 3: RAFAEL AUGUSTO MENDES, ADMISSIONAL, validade daqui a ~185 dias (válido, fora
 *   da janela), APTO_COM_RESTRICAO.
 * - Uniforme 1: PAULO HENRIQUE COSTA, CAMISA, ADMISSAO.
 * - Uniforme 2: RAFAEL AUGUSTO MENDES, CALCADO, REPOSICAO.
 * - Documento 1: empresa, PGR, obra EX-1001-25, vigente (sem `validoAte` vencendo).
 * - Documento 2: empresa, PCMSO, obra EX-1002-25, `validoAte` vencendo em ~10 dias.
 * - Documento 3: pessoal, RG, funcionário PAULO HENRIQUE COSTA.
 * - Auditoria 1: obra EX-1001-25, com 3 itens — 2 CONFORME, 1 NAO_CONFORME. O item
 *   reprovado gera automaticamente 1 NaoConformidade vinculada por `auditoriaItemId`.
 * - NaoConformidade solta (sem item de auditoria): gravidade ALTA, status ABERTA.
 * - EntregaEpi: PAULO HENRIQUE COSTA, simulando ficha já recebida do Almoxarifado
 *   (`movimentacaoId: "mov-exemplo-001"`, material "Capacete de segurança").
 *
 * PAULO HENRIQUE COSTA concentra vínculo de quase todo tipo de propósito — é quem os
 * testes de exclusão bloqueada usam. WELLINGTON SANTOS CRUZ não tem nenhum vínculo — é
 * quem os testes de exclusão permitida usam.
 */
export const FIXTURE = {
  funcionarioComVinculos: 'PAULO HENRIQUE COSTA',
  funcionarioSemVinculos: 'WELLINGTON SANTOS CRUZ',
}
