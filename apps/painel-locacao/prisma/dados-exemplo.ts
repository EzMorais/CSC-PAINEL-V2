/**
 * Dados de EXEMPLO, fictícios, para quem clona o repositório conseguir rodar o sistema.
 *
 * Os dados reais da construtora — nomes de clientes, telefones de fornecedores e nomes de
 * funcionários — não entram no controle de versão. Eles ficam em `prisma/dados-locais.json`,
 * que é git-ignored; se esse arquivo existir, o seed usa ele no lugar deste módulo.
 *
 * Para usar os seus dados: crie `prisma/dados-locais.json` no mesmo formato do tipo
 * `DadosSeed` abaixo. O arquivo nunca sobe para o Git.
 */

export type ObraSeed = {
  cliente: string
  codigo: string
  descricao: string
  responsavel: string | null
  /** Nome da aba na planilha de origem. Mais de uma obra pode compartilhar a mesma. */
  abaOrigem: string
}

export type FornecedorSeed = {
  nome: string
  telefone: string | null
  /**
   * Grafias alternativas que aparecem na planilha. É o que faz a importação convergir
   * "MAQLOC" e "MAQLOC LOCAÇÕES" para um fornecedor só, em vez de criar dois.
   */
  aliases: string[]
}

export type DadosSeed = { obras: ObraSeed[]; fornecedores: FornecedorSeed[] }

/**
 * Três clientes fictícios com seis obras. Duas delas compartilham `abaOrigem` de propósito,
 * para reproduzir a situação real da planilha: uma aba que atende mais de uma obra e cujos
 * itens entram marcados como "obra a confirmar".
 */
export const DADOS_EXEMPLO: DadosSeed = {
  obras: [
    { cliente: 'ALFA INDUSTRIAL',  codigo: 'EX-1001-25',  descricao: 'CONSTRUÇÃO DE GALPÃO',        responsavel: 'ana',    abaOrigem: 'EX-1001-25_ALFA' },
    { cliente: 'ALFA INDUSTRIAL',  codigo: 'EX-1002-25',  descricao: 'REDE DE DRENAGEM',            responsavel: 'ana',    abaOrigem: 'EX-1002-25_ALFA' },
    { cliente: 'BETA LOGÍSTICA',   codigo: 'EX-1010-25A', descricao: 'PRÉDIO ADMINISTRATIVO',       responsavel: 'bruno',  abaOrigem: 'EX-1010-25_BETA' },
    { cliente: 'BETA LOGÍSTICA',   codigo: 'EX-1010-25B', descricao: 'DOCA DE CARREGAMENTO',        responsavel: 'bruno',  abaOrigem: 'EX-1010-25_BETA' },
    { cliente: 'GAMA ALIMENTOS',   codigo: 'EX-1020-26',  descricao: 'AMPLIAÇÃO DA FÁBRICA',        responsavel: 'carla',  abaOrigem: 'EX-1020-26_GAMA' },
    { cliente: 'AVULSO',           codigo: 'AVULSO',      descricao: 'Controle avulso',             responsavel: null,     abaOrigem: 'AVULSO' },
  ],
  fornecedores: [
    { nome: 'MAQLOC LOCAÇÕES',      telefone: '(11) 90000-0001', aliases: ['MAQLOC', 'MAQ LOC'] },
    { nome: 'ANDAIMES CENTRAL',     telefone: '(11) 90000-0002', aliases: ['ANDAIMES', 'CENTRAL ANDAIMES'] },
    { nome: 'FERRAMENTAS UNIÃO',    telefone: '(11) 90000-0003', aliases: ['UNIAO', 'UNIÃO'] },
    { nome: 'CAÇAMBAS RÁPIDAS',     telefone: '(11) 90000-0004', aliases: ['CACAMBAS', 'RAPIDAS'] },
    { nome: 'ELEVA PLATAFORMAS',    telefone: '(11) 90000-0005', aliases: ['ELEVA'] },
    { nome: 'GERADORES DO VALE',    telefone: '(11) 90000-0006', aliases: ['GERADORES'] },
    { nome: 'SANITÁRIOS MÓVEIS SP', telefone: '(11) 90000-0007', aliases: ['SANITARIOS'] },
    { nome: 'COMPRESSORES LESTE',   telefone: null,              aliases: ['COMPRESSORES'] },
  ],
}
