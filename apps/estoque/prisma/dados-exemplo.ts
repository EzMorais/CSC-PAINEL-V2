/**
 * Dados de EXEMPLO, fictícios, para quem clona o repositório conseguir rodar o módulo.
 *
 * Preços de compra e fornecedores reais NÃO entram no controle de versão — são informação
 * comercial. Eles ficam em `prisma/dados-locais.json`, que é git-ignored; se esse arquivo
 * existir, o seed usa ele no lugar deste módulo.
 */

export type ObraSeed = {
  cliente: string
  codigo: string
  descricao: string
  responsavel: string | null
}

export type FornecedorSeed = {
  nome: string
  cnpj: string | null
  telefone: string | null
}

export type MaterialSeed = {
  nome: string
  categoria: string
  unidade: string
  estoqueMinimo: number
  localizacao: string | null
}

export type MovimentacaoSeed = {
  /** Nome do material — casado por nome na hora de semear. */
  material: string
  tipo: string
  quantidade: number
  valorUnitario: number | null
  /** Código da obra, para saída e devolução. */
  obraCodigo: string | null
  fornecedorNome: string | null
  documento: string | null
  /** Dias atrás, contados de hoje. Mantém o seed com datas sempre recentes. */
  haDias: number
}

export type DadosSeed = {
  obras: ObraSeed[]
  fornecedores: FornecedorSeed[]
  materiais: MaterialSeed[]
  movimentacoes: MovimentacaoSeed[]
}

/** Mesmos códigos dos outros módulos: é por eles que os cadastros se reconhecem. */
export const DADOS_EXEMPLO: DadosSeed = {
  obras: [
    { cliente: 'ALFA INDUSTRIAL', codigo: 'EX-1001-25',  descricao: 'CONSTRUÇÃO DE GALPÃO',  responsavel: 'ana' },
    { cliente: 'ALFA INDUSTRIAL', codigo: 'EX-1002-25',  descricao: 'REDE DE DRENAGEM',      responsavel: 'ana' },
    { cliente: 'BETA LOGÍSTICA',  codigo: 'EX-1010-25A', descricao: 'PRÉDIO ADMINISTRATIVO', responsavel: 'bruno' },
    { cliente: 'BETA LOGÍSTICA',  codigo: 'EX-1010-25B', descricao: 'DOCA DE CARREGAMENTO',  responsavel: 'bruno' },
    { cliente: 'GAMA ALIMENTOS',  codigo: 'EX-1020-26',  descricao: 'AMPLIAÇÃO DA FÁBRICA',  responsavel: 'carla' },
  ],

  fornecedores: [
    { nome: 'CONSTRUMAIS MATERIAIS',   cnpj: '11.222.333/0001-44', telefone: '(11) 3000-0001' },
    { nome: 'FERRO E AÇO DISTRIBUIDORA', cnpj: '22.333.444/0001-55', telefone: '(11) 3000-0002' },
    { nome: 'ELÉTRICA CENTRAL',        cnpj: '33.444.555/0001-66', telefone: '(11) 3000-0003' },
    { nome: 'SEGURANÇA TOTAL EPI',     cnpj: '44.555.666/0001-77', telefone: '(11) 3000-0004' },
  ],

  materiais: [
    { nome: 'Cimento CP-II 50kg',            categoria: 'CIMENTO_ARGAMASSA', unidade: 'SC',  estoqueMinimo: 50, localizacao: 'Galpão A' },
    { nome: 'Argamassa AC-II 20kg',          categoria: 'CIMENTO_ARGAMASSA', unidade: 'SC',  estoqueMinimo: 30, localizacao: 'Galpão A' },
    { nome: 'Areia média lavada',            categoria: 'AGREGADO',          unidade: 'M3',  estoqueMinimo: 10, localizacao: 'Pátio' },
    { nome: 'Brita 1',                       categoria: 'AGREGADO',          unidade: 'M3',  estoqueMinimo: 10, localizacao: 'Pátio' },
    { nome: 'Vergalhão CA-50 10mm',          categoria: 'ACO_FERRAGEM',      unidade: 'PC',  estoqueMinimo: 40, localizacao: 'Galpão B' },
    { nome: 'Arame recozido 18',             categoria: 'ACO_FERRAGEM',      unidade: 'KG',  estoqueMinimo: 25, localizacao: 'Galpão B' },
    { nome: 'Tábua de pinus 2,5m',           categoria: 'MADEIRA',           unidade: 'PC',  estoqueMinimo: 20, localizacao: 'Galpão B' },
    { nome: 'Cabo flexível 2,5mm²',          categoria: 'ELETRICA',          unidade: 'RL',  estoqueMinimo: 5,  localizacao: 'Prateleira C1' },
    { nome: 'Eletroduto PVC 3/4"',           categoria: 'ELETRICA',          unidade: 'PC',  estoqueMinimo: 15, localizacao: 'Prateleira C2' },
    { nome: 'Tubo PVC esgoto 100mm',         categoria: 'HIDRAULICA',        unidade: 'PC',  estoqueMinimo: 12, localizacao: 'Prateleira D1' },
    { nome: 'Tinta acrílica branca 18L',     categoria: 'PINTURA',           unidade: 'UN',  estoqueMinimo: 4,  localizacao: 'Prateleira E1' },
    { nome: 'Manta asfáltica 4mm',           categoria: 'IMPERMEABILIZACAO', unidade: 'RL',  estoqueMinimo: 6,  localizacao: 'Prateleira E2' },
    { nome: 'Capacete de segurança branco',  categoria: 'EPI',               unidade: 'UN',  estoqueMinimo: 20, localizacao: 'Armário EPI' },
    { nome: 'Luva de raspa',                 categoria: 'EPI',               unidade: 'PAR', estoqueMinimo: 30, localizacao: 'Armário EPI' },
    { nome: 'Disco de corte 7"',             categoria: 'CONSUMIVEL',        unidade: 'UN',  estoqueMinimo: 25, localizacao: 'Prateleira F1' },
    { nome: 'Furadeira de impacto 1/2"',     categoria: 'FERRAMENTA',        unidade: 'UN',  estoqueMinimo: 0,  localizacao: 'Armário ferramentas' },
  ],

  // Entradas primeiro, saídas depois — a ordem importa: uma saída lançada antes da entrada
  // seria recusada por saldo insuficiente, que é exatamente a regra que o sistema aplica.
  movimentacoes: [
    { material: 'Cimento CP-II 50kg',           tipo: 'ENTRADA', quantidade: 200, valorUnitario: 42.90, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',    documento: 'NF 10231', haDias: 40 },
    { material: 'Argamassa AC-II 20kg',         tipo: 'ENTRADA', quantidade: 120, valorUnitario: 24.50, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',    documento: 'NF 10231', haDias: 40 },
    { material: 'Areia média lavada',           tipo: 'ENTRADA', quantidade: 40,  valorUnitario: 95.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',    documento: 'NF 10250', haDias: 35 },
    { material: 'Brita 1',                      tipo: 'ENTRADA', quantidade: 35,  valorUnitario: 110.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',   documento: 'NF 10250', haDias: 35 },
    { material: 'Vergalhão CA-50 10mm',         tipo: 'ENTRADA', quantidade: 300, valorUnitario: 38.00, obraCodigo: null, fornecedorNome: 'FERRO E AÇO DISTRIBUIDORA', documento: 'NF 4412', haDias: 33 },
    { material: 'Arame recozido 18',            tipo: 'ENTRADA', quantidade: 80,  valorUnitario: 18.90, obraCodigo: null, fornecedorNome: 'FERRO E AÇO DISTRIBUIDORA', documento: 'NF 4412', haDias: 33 },
    { material: 'Tábua de pinus 2,5m',          tipo: 'ENTRADA', quantidade: 100, valorUnitario: 27.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',    documento: 'NF 10288', haDias: 30 },
    { material: 'Cabo flexível 2,5mm²',         tipo: 'ENTRADA', quantidade: 20,  valorUnitario: 189.00, obraCodigo: null, fornecedorNome: 'ELÉTRICA CENTRAL',        documento: 'NF 887',   haDias: 28 },
    { material: 'Eletroduto PVC 3/4"',          tipo: 'ENTRADA', quantidade: 60,  valorUnitario: 12.40, obraCodigo: null, fornecedorNome: 'ELÉTRICA CENTRAL',        documento: 'NF 887',   haDias: 28 },
    { material: 'Tubo PVC esgoto 100mm',        tipo: 'ENTRADA', quantidade: 40,  valorUnitario: 56.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',   documento: 'NF 10301', haDias: 25 },
    { material: 'Tinta acrílica branca 18L',    tipo: 'ENTRADA', quantidade: 12,  valorUnitario: 289.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',  documento: 'NF 10301', haDias: 25 },
    { material: 'Manta asfáltica 4mm',          tipo: 'ENTRADA', quantidade: 18,  valorUnitario: 245.00, obraCodigo: null, fornecedorNome: 'CONSTRUMAIS MATERIAIS',  documento: 'NF 10301', haDias: 25 },
    { material: 'Capacete de segurança branco', tipo: 'ENTRADA', quantidade: 60,  valorUnitario: 21.90, obraCodigo: null, fornecedorNome: 'SEGURANÇA TOTAL EPI',     documento: 'NF 553',   haDias: 22 },
    { material: 'Luva de raspa',                tipo: 'ENTRADA', quantidade: 100, valorUnitario: 9.80,  obraCodigo: null, fornecedorNome: 'SEGURANÇA TOTAL EPI',     documento: 'NF 553',   haDias: 22 },
    { material: 'Disco de corte 7"',            tipo: 'ENTRADA', quantidade: 80,  valorUnitario: 7.50,  obraCodigo: null, fornecedorNome: 'FERRO E AÇO DISTRIBUIDORA', documento: 'NF 4460', haDias: 20 },
    { material: 'Furadeira de impacto 1/2"',    tipo: 'ENTRADA', quantidade: 4,   valorUnitario: 459.00, obraCodigo: null, fornecedorNome: 'FERRO E AÇO DISTRIBUIDORA', documento: 'NF 4460', haDias: 20 },

    { material: 'Cimento CP-II 50kg',           tipo: 'SAIDA', quantidade: 80, valorUnitario: null, obraCodigo: 'EX-1001-25',  fornecedorNome: null, documento: 'REQ 001', haDias: 18 },
    { material: 'Areia média lavada',           tipo: 'SAIDA', quantidade: 18, valorUnitario: null, obraCodigo: 'EX-1001-25',  fornecedorNome: null, documento: 'REQ 001', haDias: 18 },
    { material: 'Brita 1',                      tipo: 'SAIDA', quantidade: 16, valorUnitario: null, obraCodigo: 'EX-1001-25',  fornecedorNome: null, documento: 'REQ 001', haDias: 18 },
    { material: 'Vergalhão CA-50 10mm',         tipo: 'SAIDA', quantidade: 120, valorUnitario: null, obraCodigo: 'EX-1001-25', fornecedorNome: null, documento: 'REQ 002', haDias: 15 },
    { material: 'Arame recozido 18',            tipo: 'SAIDA', quantidade: 30, valorUnitario: null, obraCodigo: 'EX-1001-25',  fornecedorNome: null, documento: 'REQ 002', haDias: 15 },
    { material: 'Tubo PVC esgoto 100mm',        tipo: 'SAIDA', quantidade: 28, valorUnitario: null, obraCodigo: 'EX-1002-25',  fornecedorNome: null, documento: 'REQ 003', haDias: 12 },
    { material: 'Cabo flexível 2,5mm²',         tipo: 'SAIDA', quantidade: 16, valorUnitario: null, obraCodigo: 'EX-1010-25A', fornecedorNome: null, documento: 'REQ 004', haDias: 10 },
    { material: 'Eletroduto PVC 3/4"',          tipo: 'SAIDA', quantidade: 45, valorUnitario: null, obraCodigo: 'EX-1010-25A', fornecedorNome: null, documento: 'REQ 004', haDias: 10 },
    { material: 'Capacete de segurança branco', tipo: 'SAIDA', quantidade: 45, valorUnitario: null, obraCodigo: 'EX-1010-25B', fornecedorNome: null, documento: 'REQ 005', haDias: 8 },
    { material: 'Luva de raspa',                tipo: 'SAIDA', quantidade: 75, valorUnitario: null, obraCodigo: 'EX-1010-25B', fornecedorNome: null, documento: 'REQ 005', haDias: 8 },
    { material: 'Disco de corte 7"',            tipo: 'SAIDA', quantidade: 62, valorUnitario: null, obraCodigo: 'EX-1020-26',  fornecedorNome: null, documento: 'REQ 006', haDias: 6 },
    { material: 'Tinta acrílica branca 18L',    tipo: 'SAIDA', quantidade: 9,  valorUnitario: null, obraCodigo: 'EX-1020-26',  fornecedorNome: null, documento: 'REQ 006', haDias: 6 },
    { material: 'Manta asfáltica 4mm',          tipo: 'SAIDA', quantidade: 14, valorUnitario: null, obraCodigo: 'EX-1002-25',  fornecedorNome: null, documento: 'REQ 007', haDias: 5 },
    { material: 'Tábua de pinus 2,5m',          tipo: 'SAIDA', quantidade: 88, valorUnitario: null, obraCodigo: 'EX-1001-25',  fornecedorNome: null, documento: 'REQ 008', haDias: 4 },

    // Sobra que voltou da obra, e uma perda — para as duas situações aparecerem no extrato.
    { material: 'Tábua de pinus 2,5m',          tipo: 'DEVOLUCAO', quantidade: 12, valorUnitario: null, obraCodigo: 'EX-1001-25', fornecedorNome: null, documento: null, haDias: 2 },
    { material: 'Argamassa AC-II 20kg',         tipo: 'PERDA',     quantidade: 6,  valorUnitario: null, obraCodigo: null,         fornecedorNome: null, documento: null, haDias: 3 },
  ],
}
