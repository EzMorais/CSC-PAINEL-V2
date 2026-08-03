/**
 * Os cargos do sistema — quem faz o quê.
 *
 * Cargo aqui é o papel de SISTEMA, não a função na obra. Um pedreiro e um mestre de obras
 * podem ser os dois "CONSULTA"; o cargo de obra vive no cadastro de funcionários do RH e
 * não tem relação com este.
 *
 * O princípio que dá sentido à lista: quem lança não aprova. Sem essa separação a aprovação
 * vira só um clique a mais na mesma mão, e deixa de proteger de qualquer coisa.
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

export const DESCRICAO_CARGO: Record<Cargo, string> = {
  ADMIN: 'Cadastra usuários e mexe nas configurações. Faz tudo que os outros fazem.',
  DIRETORIA: 'Vê tudo e aprova tudo. Não cadastra usuários nem lança no dia a dia.',
  GERENTE: 'Confere e aprova o que a equipe lançou, nos módulos a que tem acesso.',
  OPERACIONAL: 'Lança o dia a dia: entradas, saídas, cadastros. Não aprova o próprio lançamento.',
  CONSULTA: 'Só lê. Serve para quem precisa acompanhar sem poder alterar nada.',
}

export const TOM_CARGO: Record<Cargo, 'ativa' | 'atencao' | 'vencida' | 'devolvida'> = {
  ADMIN: 'vencida',
  DIRETORIA: 'atencao',
  GERENTE: 'ativa',
  OPERACIONAL: 'devolvida',
  CONSULTA: 'devolvida',
}

export const MODULO = {
  CADASTROS: 'CADASTROS',
  PROGRAMACAO: 'PROGRAMACAO',
  PAINEL: 'PAINEL',
  RH: 'RH',
  ESTOQUE: 'ESTOQUE',
  ALOJAMENTOS: 'ALOJAMENTOS',
  FROTA: 'FROTA',
} as const

export type Modulo = (typeof MODULO)[keyof typeof MODULO]

export const ROTULO_MODULO: Record<Modulo, string> = {
  CADASTROS: 'Cadastros',
  PROGRAMACAO: 'Programação diária',
  PAINEL: 'Painel de Locação',
  RH: 'RH e SST',
  ESTOQUE: 'Almoxarifado',
  ALOJAMENTOS: 'Alojamentos',
  FROTA: 'Frota',
}

/**
 * Endereço de cada módulo. Configurável porque um dia eles podem sair desta máquina.
 *
 * A Frota fica na 3000 por ser a única que já roda como serviço do Windows; o Painel de
 * Locação usa a 3001 quando as duas convivem no mesmo computador.
 *
 * Cadastros é caminho relativo por morar dentro do próprio Portal — não é outro servidor.
 */
export const URL_MODULO: Record<Modulo, string> = {
  CADASTROS: '/cadastros',
  PROGRAMACAO: process.env.NEXT_PUBLIC_URL_PROGRAMACAO ?? 'http://localhost:3007',
  PAINEL: process.env.NEXT_PUBLIC_URL_PAINEL ?? 'http://localhost:3001',
  RH: process.env.NEXT_PUBLIC_URL_RH ?? 'http://localhost:3002',
  ESTOQUE: process.env.NEXT_PUBLIC_URL_ESTOQUE ?? 'http://localhost:3003',
  ALOJAMENTOS: process.env.NEXT_PUBLIC_URL_ALOJAMENTOS ?? 'http://localhost:3005',
  FROTA: process.env.NEXT_PUBLIC_URL_FROTA ?? 'http://localhost:3000',
}

// ── O que cada cargo pode ────────────────────────────────────────────────────

/** Lança dados: cria, edita, movimenta. */
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

/** Administra o sistema: usuários, cargos, configurações sensíveis. */
export function podeAdministrar(cargo: string): boolean {
  return cargo === CARGO.ADMIN
}

/** Todo mundo que entrou lê. O que muda é o que consegue alterar. */
export function podeVer(cargo: string): boolean {
  return Object.values(CARGO).includes(cargo as Cargo)
}
