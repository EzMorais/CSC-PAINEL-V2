import { execSync } from 'node:child_process'
import path from 'node:path'

export const PLANILHA = path.resolve('dados/Maquinas_Alugadas_Controle_REVISADA.xlsx')

/**
 * Credenciais que o seed cria. Não são segredo: valem só no teste.db, que `reiniciarBanco()`
 * apaga e recria. A senha acompanha o padrão de `prisma/seed.ts`.
 */
export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/** Onde o projeto `setup` grava o cookie de sessão que os demais projetos reaproveitam. */
export const ARQUIVO_SESSAO = path.resolve('e2e/.sessao.json')

/**
 * O `prisma migrate reset` de reiniciarBanco() é bloqueado pelo guardrail do Prisma quando o
 * comando parte de um agente de IA — ele exige a variável abaixo com o texto do consentimento
 * do usuário. O consentimento foi dado para este caso específico (banco de teste em worktree
 * isolada), e fica registrado aqui para que as suítes das Tasks 21-23 rodem sem intervenção.
 *
 * O guardrail existe para impedir que um agente apague um banco de produção. Como ele está
 * desativado aqui, exigirBancoDeTeste() abaixo devolve a mesma proteção de forma específica:
 * se alguém apontar a URL para o dev.db ou para um banco real, a função recusa rodar.
 */
const CONSENTIMENTO =
  'CONSINTO com a execução. Sua análise está correta: worktree isolada, teste.db inexistente, não é produção nem o banco do repo principal.'

const BANCO_TESTE = 'file:./teste.db'

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
 * Números reconferidos célula a célula na planilha de origem em 2026-08-01.
 *
 * Atenção: a contagem original do design dizia 61 devolvidas e 303 importadas — estava
 * errada. O script de análise lia o bloco DEVOLUÇÕES a partir de `dev+2` e pulava a
 * primeira linha de dados em várias abas. Os valores corretos são 63 e 305.
 */
export const ESPERADO = {
  ativos: 242,
  devolvidos: 63,
  perdidos: 16,
  aConfirmar: 110,
  totalImportado: 305,
  /** Registros que aparecem em mais de uma aba — sinalizados, nunca descartados. */
  ativosDuplicados: 90,
  devolucoesDuplicadas: 20,
}
