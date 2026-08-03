import 'server-only'
import ExcelJS from 'exceljs'
import { apenasDigitos, cpfValido } from '@/lib/dominio/cpf'
import { STATUS } from '@/lib/dominio/constantes'

/**
 * Leitura da planilha de funcionários.
 *
 * Os cabeçalhos são reconhecidos por APELIDO, e não por posição: a planilha de RH de uma
 * construtora nunca vem com as colunas na mesma ordem duas vezes, e exigir um modelo fixo
 * faria o importador ser usado uma vez e abandonado. "Nome", "NOME COMPLETO" e
 * "Funcionário" são a mesma coluna.
 */

const APELIDOS: Record<string, string[]> = {
  nome: ['nome', 'nome completo', 'funcionario', 'colaborador'],
  cpf: ['cpf', 'c.p.f', 'cpf/mf'],
  matricula: ['matricula', 'matrícula', 'registro', 'chapa'],
  rg: ['rg', 'identidade'],
  dataNascimento: ['data de nascimento', 'nascimento', 'dt nascimento', 'data nascimento'],
  admitidoEm: ['admissao', 'admissão', 'data de admissao', 'data de admissão', 'dt admissao', 'admitido em'],
  cargo: ['cargo', 'funcao', 'função'],
  obra: ['obra', 'centro de custo', 'lotacao', 'lotação'],
  telefone: ['telefone', 'celular', 'fone', 'contato'],
  email: ['email', 'e-mail'],
  status: ['status', 'situacao', 'situação'],
  sexo: ['sexo', 'genero', 'gênero'],
  salario: ['salario', 'salário'],
  tipoContrato: ['tipo de contrato', 'contrato', 'regime'],
  cidade: ['cidade', 'municipio', 'município'],
  uf: ['uf', 'estado'],
  tamanhoCamisa: ['camisa', 'tamanho camisa', 'tam camisa'],
  tamanhoCalca: ['calca', 'calça', 'tamanho calca', 'tam calca'],
  tamanhoCalcado: ['calcado', 'calçado', 'bota', 'tamanho calcado', 'tam calcado'],
}

function normalizar(texto: string): string {
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type LinhaFuncionario = {
  linha: number
  nome: string
  cpf: string
  matricula: string | null
  admitidoEm: Date | null
  cargo: string | null
  obra: string | null
  status: string
  rg: string | null
  dataNascimento: Date | null
  telefone: string | null
  email: string | null
  sexo: string | null
  salario: number | null
  tipoContrato: string | null
  cidade: string | null
  uf: string | null
  tamanhoCamisa: string | null
  tamanhoCalca: string | null
  tamanhoCalcado: string | null
}

export type LinhaIgnorada = { linha: number; motivo: string; conteudo: string }

/**
 * Converte o que veio da célula em data.
 *
 * O Excel devolve `Date` quando a célula está formatada como data e texto quando não está —
 * e a planilha de RH tem as duas coisas na mesma coluna, porque alguém digitou algumas à
 * mão. Aceitar só um dos formatos perderia metade das linhas sem dizer por quê.
 */
function paraData(valor: unknown): Date | null {
  if (!valor) return null

  if (valor instanceof Date) {
    return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()))
  }

  const texto = String(valor).trim()
  const br = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(texto)
  if (br) {
    const ano = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])
    const d = new Date(Date.UTC(ano, Number(br[2]) - 1, Number(br[1])))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))

  return null
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  // Célula com fórmula vem como objeto; o que interessa é o resultado.
  const bruto = typeof valor === 'object' && 'result' in (valor as object)
    ? String((valor as { result: unknown }).result ?? '')
    : String(valor)
  const limpo = bruto.trim()
  return limpo ? limpo : null
}

function numero(valor: unknown): number | null {
  const t = texto(valor)
  if (!t) return null
  const n = Number(t.replace(/[R$\s.]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const STATUS_ACEITOS: Record<string, string> = {
  ativo: STATUS.ATIVO,
  afastado: STATUS.AFASTADO,
  ferias: STATUS.FERIAS,
  desligado: STATUS.DESLIGADO,
  demitido: STATUS.DESLIGADO,
  inativo: STATUS.DESLIGADO,
}

export type LeituraPlanilha = {
  linhas: LinhaFuncionario[]
  ignoradas: LinhaIgnorada[]
  colunasReconhecidas: string[]
  colunasIgnoradas: string[]
}

export async function lerPlanilhaFuncionarios(buffer: ArrayBuffer): Promise<LeituraPlanilha> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const aba = wb.worksheets[0]
  if (!aba) throw new Error('A planilha está vazia.')

  // O cabeçalho nem sempre é a primeira linha: é comum haver título e logotipo em cima.
  // Procura nas primeiras dez a linha que tem "nome" e "cpf".
  let linhaCabecalho = 0
  const posicaoDaColuna = new Map<string, number>()

  for (let i = 1; i <= Math.min(10, aba.rowCount); i++) {
    const candidatas = new Map<string, number>()
    aba.getRow(i).eachCell((cell, col) => {
      const t = normalizar(texto(cell.value) ?? '')
      if (!t) return
      for (const [campo, apelidos] of Object.entries(APELIDOS)) {
        if (apelidos.includes(t) && !candidatas.has(campo)) candidatas.set(campo, col)
      }
    })
    if (candidatas.has('nome') && candidatas.has('cpf')) {
      linhaCabecalho = i
      for (const [k, v] of candidatas) posicaoDaColuna.set(k, v)
      break
    }
  }

  if (linhaCabecalho === 0) {
    throw new Error(
      'Não encontrei as colunas "Nome" e "CPF" nas primeiras linhas. Confira se a planilha ' +
        'tem uma linha de cabeçalho com esses nomes.',
    )
  }

  const naoReconhecidas: string[] = []
  aba.getRow(linhaCabecalho).eachCell((cell, col) => {
    const t = texto(cell.value)
    if (!t) return
    if (![...posicaoDaColuna.values()].includes(col)) naoReconhecidas.push(t)
  })

  const ler = (row: ExcelJS.Row, campo: string) => {
    const col = posicaoDaColuna.get(campo)
    return col ? row.getCell(col).value : null
  }

  const linhas: LinhaFuncionario[] = []
  const ignoradas: LinhaIgnorada[] = []
  const cpfsVistos = new Set<string>()

  for (let i = linhaCabecalho + 1; i <= aba.rowCount; i++) {
    const row = aba.getRow(i)
    const nome = texto(ler(row, 'nome'))
    const cpfBruto = texto(ler(row, 'cpf'))

    if (!nome && !cpfBruto) continue // linha em branco: separador, não erro

    const resumo = `${nome ?? '—'} / ${cpfBruto ?? '—'}`

    if (!nome || nome.length < 3) {
      ignoradas.push({ linha: i, motivo: 'sem nome', conteudo: resumo })
      continue
    }

    const cpf = apenasDigitos(cpfBruto ?? '')
    if (!cpf) {
      ignoradas.push({ linha: i, motivo: 'sem CPF', conteudo: resumo })
      continue
    }
    if (!cpfValido(cpf)) {
      ignoradas.push({ linha: i, motivo: 'CPF inválido', conteudo: resumo })
      continue
    }
    if (cpfsVistos.has(cpf)) {
      ignoradas.push({ linha: i, motivo: 'CPF repetido na própria planilha', conteudo: resumo })
      continue
    }
    cpfsVistos.add(cpf)

    const statusBruto = normalizar(texto(ler(row, 'status')) ?? '')
    const admitidoEm = paraData(ler(row, 'admitidoEm'))

    linhas.push({
      linha: i,
      nome,
      cpf,
      matricula: texto(ler(row, 'matricula')),
      admitidoEm,
      cargo: texto(ler(row, 'cargo')),
      obra: texto(ler(row, 'obra')),
      status: STATUS_ACEITOS[statusBruto] ?? STATUS.ATIVO,
      rg: texto(ler(row, 'rg')),
      dataNascimento: paraData(ler(row, 'dataNascimento')),
      telefone: texto(ler(row, 'telefone')),
      email: texto(ler(row, 'email')),
      sexo: texto(ler(row, 'sexo')),
      salario: numero(ler(row, 'salario')),
      tipoContrato: texto(ler(row, 'tipoContrato')),
      cidade: texto(ler(row, 'cidade')),
      uf: texto(ler(row, 'uf')),
      tamanhoCamisa: texto(ler(row, 'tamanhoCamisa')),
      tamanhoCalca: texto(ler(row, 'tamanhoCalca')),
      tamanhoCalcado: texto(ler(row, 'tamanhoCalcado')),
    })
  }

  return {
    linhas,
    ignoradas,
    colunasReconhecidas: [...posicaoDaColuna.keys()],
    colunasIgnoradas: naoReconhecidas,
  }
}
