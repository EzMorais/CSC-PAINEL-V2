/**
 * Os cargos vêm do Portal, dentro do crachá de sessão.
 *
 * Esta cópia existe para o módulo saber ler o cargo sem consultar o banco do Portal — se
 * precisasse perguntar, o módulo pararia toda vez que o Portal caísse. Quem manda na
 * definição é `apps/portal/src/lib/dominio/cargos.ts`; mudou lá, atualize aqui.
 */
export const CARGO = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  GERENTE: 'GERENTE',
  OPERACIONAL: 'OPERACIONAL',
  CONSULTA: 'CONSULTA',
} as const

export type Cargo = (typeof CARGO)[keyof typeof CARGO]

export const ROTULO_CARGO: Record<Cargo, string> = {
  ADMIN: 'Administrador do sistema',
  DIRETORIA: 'Diretoria',
  GERENTE: 'Gerente / Engenheiro',
  OPERACIONAL: 'Operacional',
  CONSULTA: 'Consulta',
}

/** Lança dados: cadastra, movimenta, edita. */
export function podeLancar(cargo: string): boolean {
  return cargo === CARGO.ADMIN || cargo === CARGO.OPERACIONAL || cargo === CARGO.GERENTE
}

/**
 * Aprova o que outra pessoa lançou.
 *
 * OPERACIONAL fica de fora justamente por ser quem lança — é a separação que faz a
 * aprovação valer alguma coisa.
 */
export function podeAprovar(cargo: string): boolean {
  return cargo === CARGO.ADMIN || cargo === CARGO.GERENTE || cargo === CARGO.DIRETORIA
}

export function podeAdministrar(cargo: string): boolean {
  return cargo === CARGO.ADMIN
}
