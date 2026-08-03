'use server'

import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { lerPlanilhaFuncionarios, type LinhaFuncionario } from '@/lib/planilha/funcionarios'
import { EVENTO, STATUS } from '@/lib/dominio/constantes'
import { formatarCpf } from '@/lib/dominio/cpf'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

export type ItemPrevia = {
  linha: number
  nome: string
  cpf: string
  cargo: string | null
  obra: string | null
  admitidoEm: string | null
  /** NOVO — entra no cadastro; JA_EXISTE — o CPF já está no RH e a linha é ignorada. */
  situacao: 'NOVO' | 'JA_EXISTE'
  /** Cargo ou obra citados na planilha que ainda não existem no RH. */
  criaCargo: boolean
  criaObra: boolean
}

export type Previa = {
  itens: ItemPrevia[]
  novos: number
  jaExistem: number
  cargosNovos: string[]
  obrasNovas: string[]
  semAdmissao: number
  ignoradas: Array<{ linha: number; motivo: string; conteudo: string }>
  colunasReconhecidas: string[]
  colunasIgnoradas: string[]
}

const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

async function lerFormulario(formData: FormData) {
  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error('Escolha a planilha antes de continuar.')
  }
  if (arquivo.size > 8 * 1024 * 1024) {
    throw new Error('A planilha passa de 8 MB. Remova imagens e abas que não são de cadastro.')
  }
  return lerPlanilhaFuncionarios(await arquivo.arrayBuffer())
}

/**
 * Lê a planilha e diz o que vai acontecer — sem gravar nada.
 *
 * A prévia existe porque importar cadastro de gente é irreversível na prática: uma planilha
 * com a coluna errada criaria cem funcionários com nome de cargo, e desfazer isso é apagar
 * um por um. Ver antes o que entra custa um clique e evita a tarde inteira.
 */
export async function gerarPrevia(formData: FormData): Promise<Resultado<Previa>> {
  await exigirLancamento()

  try {
    const leitura = await lerFormulario(formData)

    const [existentes, cargos, obras] = await Promise.all([
      prisma.funcionario.findMany({ select: { cpf: true } }),
      prisma.cargo.findMany({ select: { nome: true } }),
      prisma.obra.findMany({ select: { codigo: true, descricao: true } }),
    ])

    const cpfsNoBanco = new Set(existentes.map((f) => f.cpf))
    const cargosNoBanco = new Set(cargos.map((c) => normalizar(c.nome)))
    const obrasNoBanco = new Set([
      ...obras.map((o) => normalizar(o.codigo)),
      ...obras.map((o) => normalizar(o.descricao)),
    ])

    const cargosNovos = new Set<string>()
    const obrasNovas = new Set<string>()

    const itens: ItemPrevia[] = leitura.linhas.map((l) => {
      const jaExiste = cpfsNoBanco.has(l.cpf)
      const criaCargo = !!l.cargo && !cargosNoBanco.has(normalizar(l.cargo))
      const criaObra = !!l.obra && !obrasNoBanco.has(normalizar(l.obra))

      if (!jaExiste && criaCargo && l.cargo) cargosNovos.add(l.cargo)
      if (!jaExiste && criaObra && l.obra) obrasNovas.add(l.obra)

      return {
        linha: l.linha,
        nome: l.nome,
        cpf: formatarCpf(l.cpf),
        cargo: l.cargo,
        obra: l.obra,
        admitidoEm: l.admitidoEm ? DATA.format(l.admitidoEm) : null,
        situacao: jaExiste ? 'JA_EXISTE' : 'NOVO',
        criaCargo,
        criaObra,
      }
    })

    return {
      ok: true,
      dados: {
        itens,
        novos: itens.filter((i) => i.situacao === 'NOVO').length,
        jaExistem: itens.filter((i) => i.situacao === 'JA_EXISTE').length,
        cargosNovos: [...cargosNovos].sort(),
        obrasNovas: [...obrasNovas].sort(),
        semAdmissao: leitura.linhas.filter((l) => !l.admitidoEm).length,
        ignoradas: leitura.ignoradas,
        colunasReconhecidas: leitura.colunasReconhecidas,
        colunasIgnoradas: leitura.colunasIgnoradas,
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao ler a planilha.' }
  }
}

export type ResumoImportacao = { criados: number; pulados: number; cargosCriados: number; obrasCriadas: number }

/**
 * Grava o que a prévia mostrou.
 *
 * A planilha é lida de novo, e não guardada entre os dois passos: guardar exigiria arquivo
 * temporário ou sessão, e o custo de reler alguns milhares de linhas é menor que o de um
 * arquivo esquecido no disco com o CPF de todo o quadro.
 *
 * Quem já está no RH é PULADO, nunca sobrescrito. Uma planilha antiga reimportada por
 * engano apagaria telefone, foto e endereço atualizados à mão — e ninguém perceberia.
 */
export async function importar(formData: FormData): Promise<Resultado<ResumoImportacao>> {
  const sessao = await exigirLancamento()

  try {
    const leitura = await lerFormulario(formData)

    const existentes = await prisma.funcionario.findMany({ select: { cpf: true } })
    const cpfsNoBanco = new Set(existentes.map((f) => f.cpf))
    const novos = leitura.linhas.filter((l) => !cpfsNoBanco.has(l.cpf))

    if (novos.length === 0) {
      return { ok: false, erro: 'Nenhum funcionário novo na planilha — todos os CPFs já estão no RH.' }
    }

    const [cargos, obras] = await Promise.all([
      prisma.cargo.findMany({ select: { id: true, nome: true } }),
      prisma.obra.findMany({ select: { id: true, codigo: true, descricao: true } }),
    ])

    const cargoPorNome = new Map(cargos.map((c) => [normalizar(c.nome), c.id]))
    const obraPorChave = new Map<string, string>()
    for (const o of obras) {
      obraPorChave.set(normalizar(o.codigo), o.id)
      obraPorChave.set(normalizar(o.descricao), o.id)
    }

    let cargosCriados = 0
    let obrasCriadas = 0

    // Cargos e obras entram antes, fora do laço de pessoas: criar dentro faria a mesma obra
    // ser criada duas vezes quando dois funcionários da mesma obra caíssem na mesma leva.
    for (const l of novos) {
      if (l.cargo && !cargoPorNome.has(normalizar(l.cargo))) {
        const c = await prisma.cargo.create({ data: { nome: l.cargo.trim() } })
        cargoPorNome.set(normalizar(l.cargo), c.id)
        cargosCriados++
      }
      if (l.obra && !obraPorChave.has(normalizar(l.obra))) {
        const codigo = l.obra.trim().slice(0, 20).toUpperCase()
        const o = await prisma.obra.create({
          data: { codigo, cliente: l.obra.trim(), descricao: l.obra.trim() },
        })
        obraPorChave.set(normalizar(l.obra), o.id)
        obraPorChave.set(normalizar(codigo), o.id)
        obrasCriadas++
      }
    }

    // A matrícula é gerada em sequência a partir da maior existente. Fora da transação de
    // cada pessoa porque `proximaMatricula` consultaria o banco a cada linha e devolveria a
    // mesma para todas antes de qualquer gravação.
    const ultimo = await prisma.funcionario.findFirst({
      orderBy: { matricula: 'desc' }, select: { matricula: true },
    })
    let proximo = ultimo ? Number(ultimo.matricula.replace(/\D/g, '')) + 1 : 1

    let criados = 0
    for (const l of novos) {
      const matricula = l.matricula?.trim() || `SC-${String(proximo++).padStart(4, '0')}`
      const dados = montarDados(l, matricula, cargoPorNome, obraPorChave)

      try {
        const criado = await prisma.funcionario.create({ data: dados })
        await prisma.evento.create({
          data: {
            funcionarioId: criado.id,
            tipo: EVENTO.ADMISSAO,
            descricaoHumana: 'Cadastro importado de planilha',
            detalhe: `Linha ${l.linha} da planilha`,
            ocorridoEm: criado.admitidoEm,
            registradoPor: sessao.nome,
          },
        })
        criados++
      } catch {
        // Matrícula repetida ou CPF que entrou entre a leitura e a gravação: a linha é
        // pulada em vez de derrubar a importação inteira, e a contagem final denuncia.
      }
    }

    revalidarTelas('/funcionarios', '/')
    return {
      ok: true,
      dados: { criados, pulados: leitura.linhas.length - criados, cargosCriados, obrasCriadas },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao importar.' }
  }
}

function montarDados(
  l: LinhaFuncionario, matricula: string,
  cargoPorNome: Map<string, string>, obraPorChave: Map<string, string>,
) {
  return {
    nome: l.nome,
    cpf: l.cpf,
    matricula,
    // Sem data na planilha, entra hoje: admissão é obrigatória no cadastro, e recusar a
    // linha por causa disso jogaria fora a pessoa inteira por um campo que se corrige na tela.
    admitidoEm: l.admitidoEm ?? new Date(new Date().toISOString().slice(0, 10)),
    status: l.status ?? STATUS.ATIVO,
    tipoContrato: l.tipoContrato?.trim().toUpperCase() ?? 'CLT',
    rg: l.rg,
    dataNascimento: l.dataNascimento,
    sexo: l.sexo,
    telefone: l.telefone,
    email: l.email,
    cidade: l.cidade,
    uf: l.uf?.slice(0, 2).toUpperCase() ?? null,
    salario: l.salario,
    tamanhoCamisa: l.tamanhoCamisa,
    tamanhoCalca: l.tamanhoCalca,
    tamanhoCalcado: l.tamanhoCalcado,
    cargoId: l.cargo ? cargoPorNome.get(normalizar(l.cargo)) ?? null : null,
    obraId: l.obra ? obraPorChave.get(normalizar(l.obra)) ?? null : null,
  }
}
