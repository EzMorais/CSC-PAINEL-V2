/**
 * Os tipos do catálogo da empresa e como cada um se apresenta na tela.
 *
 * Um tipo novo (andaime, ferramenta, fornecedor) entra aqui e só aqui: a tabela, a tela e as
 * ações são as mesmas para todos. O que muda de um tipo para o outro é o RÓTULO dos campos —
 * "código" na obra é "placa" no veículo — e quais deles aparecem.
 */

export const TIPO_CADASTRO = {
  OBRA: 'OBRA',
  CASA: 'CASA',
  VEICULO: 'VEICULO',
  MAQUINA: 'MAQUINA',
  MATERIAL: 'MATERIAL',
} as const

export type TipoCadastro = (typeof TIPO_CADASTRO)[keyof typeof TIPO_CADASTRO]

/** Os campos livres da tabela que um tipo pode usar. `codigo` e `nome` são obrigatórios em todos. */
export type CampoOpcional = 'detalhe' | 'identificador' | 'local' | 'unidade' | 'quantidade'

export type ConfigTipo = {
  rotuloSingular: string
  rotuloPlural: string
  /** Como o tipo se explica em uma linha, na aba. */
  descricao: string
  rotuloCodigo: string
  rotuloNome: string
  /** Só os campos listados aparecem no formulário e na tabela, na ordem dada. */
  campos: Array<{ campo: CampoOpcional; rotulo: string; dica?: string }>
}

export const CONFIG_TIPO: Record<TipoCadastro, ConfigTipo> = {
  OBRA: {
    rotuloSingular: 'Obra',
    rotuloPlural: 'Obras',
    descricao: 'Os canteiros em atividade, com cliente e endereço.',
    rotuloCodigo: 'Código da obra',
    rotuloNome: 'Nome da obra',
    campos: [
      { campo: 'detalhe', rotulo: 'Cliente' },
      { campo: 'local', rotulo: 'Endereço' },
      { campo: 'quantidade', rotulo: 'Área (m²)' },
    ],
  },
  CASA: {
    rotuloSingular: 'Casa',
    rotuloPlural: 'Casas',
    descricao: 'Os imóveis usados como alojamento dos funcionários.',
    rotuloCodigo: 'Código',
    rotuloNome: 'Nome da casa',
    campos: [
      { campo: 'local', rotulo: 'Endereço' },
      { campo: 'quantidade', rotulo: 'Vagas' },
      { campo: 'detalhe', rotulo: 'Responsável' },
    ],
  },
  VEICULO: {
    rotuloSingular: 'Veículo',
    rotuloPlural: 'Veículos',
    descricao: 'Carros, caminhões e vans da empresa.',
    rotuloCodigo: 'Código interno',
    rotuloNome: 'Veículo',
    campos: [
      { campo: 'identificador', rotulo: 'Placa', dica: 'ABC1D23' },
      { campo: 'detalhe', rotulo: 'Marca / modelo' },
      { campo: 'local', rotulo: 'Lotação' },
    ],
  },
  MAQUINA: {
    rotuloSingular: 'Máquina',
    rotuloPlural: 'Máquinas',
    descricao: 'Equipamentos e maquinário, próprios ou alugados.',
    rotuloCodigo: 'Patrimônio',
    rotuloNome: 'Máquina',
    campos: [
      { campo: 'detalhe', rotulo: 'Marca / modelo' },
      { campo: 'identificador', rotulo: 'Número de série' },
      { campo: 'local', rotulo: 'Onde está' },
    ],
  },
  MATERIAL: {
    rotuloSingular: 'Material',
    rotuloPlural: 'Materiais',
    descricao: 'O catálogo de insumos usados nas obras.',
    rotuloCodigo: 'Código',
    rotuloNome: 'Material',
    campos: [
      { campo: 'detalhe', rotulo: 'Categoria' },
      { campo: 'unidade', rotulo: 'Unidade', dica: 'SC, KG, UN, M³' },
      { campo: 'quantidade', rotulo: 'Estoque mínimo' },
    ],
  },
}

export const TIPOS_EM_ORDEM: TipoCadastro[] = [
  TIPO_CADASTRO.OBRA,
  TIPO_CADASTRO.CASA,
  TIPO_CADASTRO.VEICULO,
  TIPO_CADASTRO.MAQUINA,
  TIPO_CADASTRO.MATERIAL,
]

export function ehTipoValido(valor: string): valor is TipoCadastro {
  return valor in CONFIG_TIPO
}
