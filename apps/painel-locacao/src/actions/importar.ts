'use server'

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidarTelas } from '@/lib/revalidar'
import { prisma } from '@/lib/prisma'
import { lerPlanilha, type LinhaPlanilha } from '@/lib/planilha/parser'
import { construirMapa } from '@/lib/planilha/mapa-abas'
import { MOVIMENTACAO } from '@/lib/dominio/constantes'
import { exigirSessao } from '@/lib/auth'

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

export type PreviaImportacao = {
  total: number
  ativos: number
  devolvidos: number
  perdidos: number
  aConfirmar: number
  possiveisDuplicatas: number
  fornecedoresNovos: string[]
  porAba: { aba: string; ativos: number; devolvidos: number }[]
  ignoradas: { aba: string; linha: number; motivo: string }[]
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

async function mapaFornecedores(): Promise<Map<string, string>> {
  const [fornecedores, aliases] = await Promise.all([
    prisma.fornecedor.findMany({ select: { id: true, nome: true } }),
    prisma.fornecedorAlias.findMany({ select: { alias: true, fornecedorId: true } }),
  ])
  const mapa = new Map<string, string>()
  for (const f of fornecedores) mapa.set(normalizar(f.nome), f.id)
  for (const a of aliases) mapa.set(normalizar(a.alias), a.fornecedorId)
  return mapa
}

/**
 * Monta o mapa aba -> obra a partir do que está cadastrado, em vez de uma tabela fixa no
 * código. É o que permite importar a planilha de qualquer empresa: basta que as obras
 * estejam cadastradas informando de qual aba vêm.
 */
async function mapaDasObras() {
  const obras = await prisma.obra.findMany({
    orderBy: { codigo: 'asc' },
    select: { codigo: true, abaOrigem: true },
  })
  return construirMapa(obras)
}

export async function gerarPrevia(caminho: string): Promise<Resultado<PreviaImportacao>> {
  await exigirSessao()
  try {
    const { linhas, ignoradas } = await lerPlanilha(caminho, await mapaDasObras())
    const mapa = await mapaFornecedores()

    const novos = new Set<string>()
    for (const l of linhas) {
      if (l.fornecedorBruto && !mapa.has(normalizar(l.fornecedorBruto))) novos.add(l.fornecedorBruto)
    }

    const porAba = new Map<string, { ativos: number; devolvidos: number }>()
    for (const l of linhas) {
      const e = porAba.get(l.aba) ?? { ativos: 0, devolvidos: 0 }
      if (l.devolvida) e.devolvidos++
      else e.ativos++
      porAba.set(l.aba, e)
    }

    return {
      ok: true,
      dados: {
        total: linhas.length,
        ativos: linhas.filter((l) => !l.devolvida).length,
        devolvidos: linhas.filter((l) => l.devolvida).length,
        perdidos: linhas.filter((l) => l.estado === 'PERDIDO').length,
        aConfirmar: linhas.filter((l) => l.obraAConfirmar).length,
        possiveisDuplicatas: linhas.filter((l) => l.possivelDuplicata).length,
        fornecedoresNovos: [...novos].sort(),
        porAba: [...porAba].map(([aba, v]) => ({ aba, ...v })),
        ignoradas,
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao ler a planilha' }
  }
}

// A identidade natural seria "descricao + trCodigo + obraId + dataInicio",
// mas Tr é número de requisição — não de equipamento — e cobre vários itens:
// há casos reais na planilha (mesma aba, mesma descrição, mesmo Tr, mesma
// data de início, `Nº` diferente) em que essa combinação colide entre duas
// linhas genuinamente distintas. Sem `numeroOrigem` no fim da chave, a
// segunda linha era descartada como se já existisse, mesmo na primeira
// importação — perda silenciosa de dado, não apenas falha de idempotência.
// `numeroOrigem` é o próprio "Nº" da planilha: determinístico para o mesmo
// arquivo (preserva a idempotência de reimportação) e, combinado com as
// demais colunas, resolve as 4 colisões observadas sem afetar os pares
// legítimos entre abas (que já têm obraId diferente e continuam sendo
// importados duas vezes, sinalizados via possivelDuplicata).
function chave(l: LinhaPlanilha, obraId: string): string {
  return [obraId, normalizar(l.descricao), l.trCodigo ?? '', l.dataInicio?.toISOString() ?? '', l.numeroOrigem ?? ''].join('|')
}

export async function confirmarImportacao(caminho: string): Promise<Resultado<{ criadas: number; puladas: number; fornecedoresCriados: number }>> {
  await exigirSessao()
  try {
    const { linhas } = await lerPlanilha(caminho, await mapaDasObras())

    const obras = await prisma.obra.findMany({ select: { id: true, codigo: true } })
    const obraPorCodigo = new Map(obras.map((o) => [o.codigo, o.id]))

    // Cria fornecedores que aparecem na planilha e não estão cadastrados
    let fornecedoresCriados = 0
    let mapa = await mapaFornecedores()
    for (const l of linhas) {
      if (!l.fornecedorBruto) continue
      if (mapa.has(normalizar(l.fornecedorBruto))) continue
      await prisma.fornecedor.create({ data: { nome: l.fornecedorBruto.trim() } })
      fornecedoresCriados++
      mapa = await mapaFornecedores()
    }

    // Chaves já existentes, para não duplicar em reimportação
    const existentes = await prisma.locacao.findMany({
      select: { obraId: true, descricao: true, trCodigo: true, dataInicio: true, numeroOrigem: true },
    })
    const jaTem = new Set(
      existentes.map((e) =>
        [e.obraId, normalizar(e.descricao), e.trCodigo ?? '', e.dataInicio?.toISOString() ?? '', e.numeroOrigem ?? ''].join('|')
      )
    )

    let criadas = 0
    let puladas = 0

    for (const l of linhas) {
      const obraId = obraPorCodigo.get(l.obraCodigo)
      if (!obraId) { puladas++; continue }

      const k = chave(l, obraId)
      if (jaTem.has(k)) { puladas++; continue }
      jaTem.add(k)

      const fornecedorId = l.fornecedorBruto ? mapa.get(normalizar(l.fornecedorBruto)) ?? null : null

      await prisma.locacao.create({
        data: {
          obraId,
          fornecedorId,
          descricao: l.descricao,
          trCodigo: l.trCodigo,
          quantidade: l.quantidade ?? 1,
          estado: l.estado ?? 'OK',
          observacoes: l.observacoes,
          dataInicio: l.dataInicio,
          dataFim: l.dataFim,
          valorItem: l.valorItem,
          devolvidaEm: l.devolvida ? (l.dataFim ?? l.dataInicio ?? new Date()) : null,
          obraAConfirmar: l.obraAConfirmar,
          possivelDuplicata: l.possivelDuplicata,
          numeroOrigem: l.numeroOrigem,
          movimentacoes: {
            create: {
              tipo: MOVIMENTACAO.IMPORTACAO,
              descricaoHumana: `Importado da aba ${l.aba}, linha ${l.linha}`,
            },
          },
        },
      })
      criadas++
    }

    // Fora de uma requisição Next.js real (ex.: script de importação em lote
    // via CLI), revalidatePath lança "static generation store missing" — a
    // gravação já terminou nesse ponto, então esse efeito de cache é best
    // effort e não deve derrubar um resultado que já foi persistido.
    revalidarTelas('/', '/locacoes')

    return { ok: true, dados: { criadas, puladas, fornecedoresCriados } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao gravar a importação' }
  }
}

/**
 * Recebe o arquivo enviado pela tela e o grava em `dados/upload-<timestamp>.xlsx`.
 * Só devolve o caminho — nada toca o banco aqui; quem lê é gerarPrevia, e só
 * confirmarImportacao grava.
 */
export async function receberUpload(formData: FormData): Promise<Resultado<{ caminho: string }>> {
  // Grava arquivo em disco: sem esta guarda qualquer um enche o servidor de uploads.
  await exigirSessao()
  try {
    const arquivo = formData.get('planilha')
    if (!(arquivo instanceof File)) return { ok: false, erro: 'Nenhum arquivo enviado.' }
    if (!arquivo.name.match(/\.(xlsx|xlsm)$/i)) return { ok: false, erro: 'Envie um arquivo .xlsx ou .xlsm.' }

    const pasta = path.join(process.cwd(), 'dados')
    await mkdir(pasta, { recursive: true })
    const caminho = path.join(pasta, `upload-${Date.now()}.xlsx`)
    await writeFile(caminho, Buffer.from(await arquivo.arrayBuffer()))

    return { ok: true, dados: { caminho } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao receber o arquivo' }
  }
}
