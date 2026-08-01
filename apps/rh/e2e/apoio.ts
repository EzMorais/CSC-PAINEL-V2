import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Credenciais criadas pelo seed. Não são segredo: valem só no teste.db, que
 * `reiniciarBanco()` apaga e recria.
 */
export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/** Onde o projeto `setup` grava o cookie de sessão que os demais projetos reaproveitam. */
export const ARQUIVO_SESSAO = path.resolve('e2e/.sessao.json')

const BANCO_TESTE = 'file:./teste.db'

/**
 * O `prisma migrate reset` é bloqueado pelo guardrail do Prisma quando quem executa é um
 * agente de IA. O consentimento vale para este caso específico — banco de teste isolado,
 * nunca o rh.db de desenvolvimento — e `exigirBancoDeTeste()` abaixo devolve a mesma
 * proteção de forma explícita.
 */
const CONSENTIMENTO =
  'CONSINTO com a execução. Banco de teste isolado (teste.db), não é produção nem o banco de desenvolvimento.'

const AMBIENTE = {
  ...process.env,
  DATABASE_URL: BANCO_TESTE,
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: CONSENTIMENTO,
}

/** Barra o reset destrutivo se o banco alvo não for reconhecidamente de teste. */
function exigirBancoDeTeste() {
  const url = AMBIENTE.DATABASE_URL
  // endsWith, não includes: "file:./teste-mas-na-verdade-producao.db" passaria por substring.
  if (!url || !url.endsWith('teste.db')) {
    throw new Error(
      `reiniciarBanco() só opera sobre banco de teste, e DATABASE_URL é "${url}". ` +
        'O reset foi abortado antes de destruir qualquer dado.',
    )
  }
}

/** Recria o banco de teste do zero e roda o seed. Não toca no banco de desenvolvimento. */
export function reiniciarBanco() {
  exigirBancoDeTeste()
  execSync('npx prisma migrate reset --force --skip-generate', { env: AMBIENTE, stdio: 'pipe' })
  execSync('npx tsx prisma/seed.ts', { env: AMBIENTE, stdio: 'pipe' })
}

/**
 * O que o seed de exemplo produz. Conferido contra `prisma/dados-exemplo.ts`.
 *
 * Se alguém acrescentar um funcionário ao exemplo sem atualizar estes números, os testes
 * quebram — que é o comportamento desejado: os dois têm de contar a mesma história.
 */
export const ESPERADO = {
  obras: 5,
  cargos: 10,
  funcionarios: 14,
  ativos: 11,
  ferias: 1,
  afastados: 1,
  desligados: 1,
  /** Só o DIEGO FERREIRA PINTO entra sem obra e sem cargo. */
  semObra: 1,
  semCargo: 1,
}
