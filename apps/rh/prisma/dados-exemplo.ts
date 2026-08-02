/**
 * Dados de EXEMPLO, fictícios, para quem clona o repositório conseguir rodar o módulo.
 *
 * Nomes, CPFs, salários e endereços de funcionários reais NÃO entram no controle de
 * versão — são dados pessoais. Eles ficam em `prisma/dados-locais.json`, que é
 * git-ignored; se esse arquivo existir, o seed usa ele no lugar deste módulo.
 *
 * Os CPFs abaixo são sintaticamente válidos (passam nos dígitos verificadores) e foram
 * escolhidos por isso: sem CPF válido o cadastro é recusado pela própria validação, e o
 * seed não conseguiria popular nada.
 */

export type ObraSeed = {
  cliente: string
  codigo: string
  descricao: string
  responsavel: string | null
}

export type CargoSeed = {
  nome: string
  cbo: string | null
  risco: 'NORMAL' | 'INSALUBRE' | 'PERICULOSO'
}

export type FuncionarioSeed = {
  nome: string
  cpf: string
  /** Código da obra — a mesma chave natural usada pelo Painel de Locação. */
  obraCodigo: string | null
  cargoNome: string | null
  status: 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO'
  /** Dias atrás, contados a partir de hoje. Mantém o seed com datas sempre recentes. */
  admitidoHaDias: number
  telefone: string | null
  cidade: string | null
  uf: string | null
  tamanhoCamisa: string | null
  tamanhoCalca: string | null
  tamanhoCalcado: string | null
}

export type DadosSeed = {
  obras: ObraSeed[]
  cargos: CargoSeed[]
  funcionarios: FuncionarioSeed[]
}

/** Mesmos códigos do Painel de Locação: é por eles que os dois cadastros se reconhecem. */
export const DADOS_EXEMPLO: DadosSeed = {
  obras: [
    { cliente: 'ALFA INDUSTRIAL', codigo: 'EX-1001-25',  descricao: 'CONSTRUÇÃO DE GALPÃO',  responsavel: 'ana' },
    { cliente: 'ALFA INDUSTRIAL', codigo: 'EX-1002-25',  descricao: 'REDE DE DRENAGEM',      responsavel: 'ana' },
    { cliente: 'BETA LOGÍSTICA',  codigo: 'EX-1010-25A', descricao: 'PRÉDIO ADMINISTRATIVO', responsavel: 'bruno' },
    { cliente: 'BETA LOGÍSTICA',  codigo: 'EX-1010-25B', descricao: 'DOCA DE CARREGAMENTO',  responsavel: 'bruno' },
    { cliente: 'GAMA ALIMENTOS',  codigo: 'EX-1020-26',  descricao: 'AMPLIAÇÃO DA FÁBRICA',  responsavel: 'carla' },
  ],

  cargos: [
    { nome: 'Pedreiro',              cbo: '7152-10', risco: 'NORMAL' },
    { nome: 'Servente de obras',     cbo: '7170-20', risco: 'NORMAL' },
    { nome: 'Carpinteiro',           cbo: '7155-10', risco: 'NORMAL' },
    { nome: 'Armador de ferragem',   cbo: '7153-05', risco: 'NORMAL' },
    { nome: 'Eletricista de obras',  cbo: '7156-15', risco: 'PERICULOSO' },
    { nome: 'Soldador',              cbo: '7243-15', risco: 'INSALUBRE' },
    { nome: 'Operador de máquinas',  cbo: '7151-20', risco: 'PERICULOSO' },
    { nome: 'Mestre de obras',       cbo: '7102-10', risco: 'NORMAL' },
    { nome: 'Técnico em segurança',  cbo: '3516-05', risco: 'NORMAL' },
    { nome: 'Auxiliar administrativo', cbo: '4110-05', risco: 'NORMAL' },
  ],

  funcionarios: [
    { nome: 'JOÃO BATISTA SILVEIRA',   cpf: '529.982.247-25', obraCodigo: 'EX-1001-25',  cargoNome: 'Mestre de obras',        status: 'ATIVO',     admitidoHaDias: 940, telefone: '(11) 90000-0001', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'G',  tamanhoCalca: '42', tamanhoCalcado: '42' },
    { nome: 'ANTÔNIO PEREIRA LIMA',    cpf: '111.444.777-35', obraCodigo: 'EX-1001-25',  cargoNome: 'Pedreiro',               status: 'ATIVO',     admitidoHaDias: 620, telefone: '(11) 90000-0002', cidade: 'Guarulhos',  uf: 'SP', tamanhoCamisa: 'M',  tamanhoCalca: '40', tamanhoCalcado: '41' },
    { nome: 'CARLOS EDUARDO ROCHA',    cpf: '390.533.447-05', obraCodigo: 'EX-1001-25',  cargoNome: 'Servente de obras',      status: 'ATIVO',     admitidoHaDias: 410, telefone: '(11) 90000-0003', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'M',  tamanhoCalca: '40', tamanhoCalcado: '40' },
    { nome: 'MARCOS VINÍCIUS ALVES',   cpf: '693.318.670-93', obraCodigo: 'EX-1002-25',  cargoNome: 'Eletricista de obras',   status: 'ATIVO',     admitidoHaDias: 300, telefone: '(11) 90000-0004', cidade: 'Osasco',     uf: 'SP', tamanhoCamisa: 'G',  tamanhoCalca: '42', tamanhoCalcado: '43' },
    { nome: 'PAULO HENRIQUE COSTA',    cpf: '045.464.870-70', obraCodigo: 'EX-1002-25',  cargoNome: 'Soldador',               status: 'ATIVO',     admitidoHaDias: 250, telefone: '(11) 90000-0005', cidade: 'Barueri',    uf: 'SP', tamanhoCamisa: 'GG', tamanhoCalca: '44', tamanhoCalcado: '44' },
    { nome: 'RAFAEL AUGUSTO MENDES',   cpf: '857.706.930-37', obraCodigo: 'EX-1010-25A', cargoNome: 'Carpinteiro',            status: 'ATIVO',     admitidoHaDias: 180, telefone: '(11) 90000-0006', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'M',  tamanhoCalca: '40', tamanhoCalcado: '41' },
    { nome: 'FERNANDA APARECIDA DIAS', cpf: '153.509.460-56', obraCodigo: 'EX-1010-25A', cargoNome: 'Técnico em segurança',   status: 'ATIVO',     admitidoHaDias: 150, telefone: '(11) 90000-0007', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'P',  tamanhoCalca: '38', tamanhoCalcado: '37' },
    { nome: 'JOSÉ ROBERTO NASCIMENTO', cpf: '206.884.290-41', obraCodigo: 'EX-1010-25B', cargoNome: 'Armador de ferragem',    status: 'FERIAS',    admitidoHaDias: 720, telefone: '(11) 90000-0008', cidade: 'Carapicuíba', uf: 'SP', tamanhoCamisa: 'G', tamanhoCalca: '42', tamanhoCalcado: '42' },
    { nome: 'LUCIANA MARTINS SOUZA',   cpf: '478.171.480-31', obraCodigo: 'EX-1010-25B', cargoNome: 'Auxiliar administrativo', status: 'ATIVO',    admitidoHaDias: 90,  telefone: '(11) 90000-0009', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'P',  tamanhoCalca: '38', tamanhoCalcado: '36' },
    { nome: 'SEBASTIÃO GOMES FARIA',   cpf: '350.451.795-60', obraCodigo: 'EX-1020-26',  cargoNome: 'Operador de máquinas',   status: 'AFASTADO',  admitidoHaDias: 520, telefone: '(11) 90000-0010', cidade: 'Jandira',    uf: 'SP', tamanhoCamisa: 'G',  tamanhoCalca: '42', tamanhoCalcado: '43' },
    { nome: 'ADRIANO CÉSAR BARBOSA',   cpf: '624.919.590-46', obraCodigo: 'EX-1020-26',  cargoNome: 'Pedreiro',               status: 'ATIVO',     admitidoHaDias: 60,  telefone: '(11) 90000-0011', cidade: 'Cotia',      uf: 'SP', tamanhoCamisa: 'M',  tamanhoCalca: '40', tamanhoCalcado: '40' },
    { nome: 'WELLINGTON SANTOS CRUZ',  cpf: '937.132.370-18', obraCodigo: 'EX-1020-26',  cargoNome: 'Servente de obras',      status: 'ATIVO',     admitidoHaDias: 25,  telefone: '(11) 90000-0012', cidade: 'Itapevi',    uf: 'SP', tamanhoCamisa: 'M',  tamanhoCalca: '40', tamanhoCalcado: '41' },
    // Sem obra e sem cargo de propósito: alimenta o indicador de cadastro incompleto,
    // que ficaria sempre zerado — e portanto não conferível — se todo mundo viesse completo.
    { nome: 'DIEGO FERREIRA PINTO',    cpf: '295.859.030-59', obraCodigo: null,          cargoNome: null,                     status: 'ATIVO',     admitidoHaDias: 10,  telefone: null,              cidade: null,         uf: null, tamanhoCamisa: null, tamanhoCalca: null, tamanhoCalcado: null },
    { nome: 'MARIA DE LOURDES RAMOS',  cpf: '832.194.320-93', obraCodigo: 'EX-1001-25',  cargoNome: 'Servente de obras',      status: 'DESLIGADO', admitidoHaDias: 800, telefone: '(11) 90000-0014', cidade: 'São Paulo',  uf: 'SP', tamanhoCamisa: 'P',  tamanhoCalca: '38', tamanhoCalcado: '37' },
  ],
}
