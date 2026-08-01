import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { classificarColuna15, type Coluna15 } from './coluna15'
import { ABAS_IGNORADAS, type MapaAbas } from './mapa-abas'

export type LinhaPlanilha = {
  aba: string
  linha: number
  numeroOrigem: string | null
  descricao: string
  trCodigo: string | null
  dataInicio: Date | null
  dataFim: Date | null
  valorItem: number | null
  fornecedorBruto: string | null
  devolvida: boolean
  obraCodigo: string
  obraAConfirmar: boolean
  /**
   * `true` quando a assinatura deste registro (descrição normalizada + Tr,
   * mais datas e valor no caso de devoluções) aparece em mais de uma aba.
   * A planilha repete equipamentos entre abas de obras diferentes e o campo
   * `Tr` não identifica um equipamento — é número de requisição/nota, que
   * cobre vários itens — então é impossível distinguir automaticamente um
   * erro de copiar/colar de uma remessa legitimamente dividida entre duas
   * obras. Por isso importamos tudo e sinalizamos para revisão humana em vez
   * de descartar.
   */
  possivelDuplicata: boolean
} & Coluna15

export type ResultadoParse = {
  linhas: LinhaPlanilha[]
  ignoradas: { aba: string; linha: number; motivo: string }[]
}

/** Marcadores que encerram o bloco de LOCAÇÕES. */
const FIM_DO_BLOCO = ['LEGENDA:', 'DEVOLUÇÕES', 'DEVOLUCOES', '◂ VOLTAR AO RESUMO']

const COL = {
  numero: 1, descricao: 2, tr: 3, inicio: 4, fim: 5,
  valorItem: 12, fornecedor: 14, coluna15: 15,
} as const

function texto(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && 'result' in v) return texto(v.result as ExcelJS.CellValue)
  if (typeof v === 'object' && 'richText' in v) {
    return (v.richText as { text: string }[]).map((r) => r.text).join('').trim() || null
  }
  const s = String(v).trim()
  return s || null
}

function data(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'object' && v !== null && 'result' in v) return data(v.result as ExcelJS.CellValue)
  return null
}

function numero(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'result' in v) return numero(v.result as ExcelJS.CellValue)
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function ehFimDoBloco(v: string | null): boolean {
  if (!v) return false
  return FIM_DO_BLOCO.some((m) => v.toUpperCase().includes(m))
}

function localizarCabecalho(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 60); r++) {
    if (texto(ws.getRow(r).getCell(COL.numero).value) === 'Nº') return r
  }
  return null
}

function localizarDevolucoes(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 400); r++) {
    const v = texto(ws.getRow(r).getCell(COL.numero).value)
    if (v === 'DEVOLUÇÕES' || v === 'DEVOLUCOES') return r
  }
  return null
}

function lerLinha(
  ws: ExcelJS.Worksheet, r: number, aba: string, obraCodigo: string,
  obraAConfirmar: boolean, devolvida: boolean
): LinhaPlanilha | null {
  const row = ws.getRow(r)
  const descricao = texto(row.getCell(COL.descricao).value)
  if (!descricao) return null
  // A planilha repete o banner "DEVOLUÇÕES" (às vezes em 2 linhas seguidas,
  // preenchendo todas as colunas) logo após o marcador que abre o bloco.
  // Sem este filtro, a segunda linha do banner vira uma "devolução" fake
  // com fornecedor="DEVOLUÇÕES".
  if (ehFimDoBloco(descricao)) return null

  // Normaliza ANTES de classificar: `texto()` desembrulha células de fórmula
  // ({ formula, result }) e richText. Sem isso, elas virariam a string
  // "[object Object]" e entrariam no banco como observação.
  const c15 = classificarColuna15(texto(row.getCell(COL.coluna15).value))

  return {
    aba, linha: r, obraCodigo, obraAConfirmar, devolvida, descricao,
    possivelDuplicata: false,
    numeroOrigem: texto(row.getCell(COL.numero).value),
    trCodigo: texto(row.getCell(COL.tr).value),
    dataInicio: data(row.getCell(COL.inicio).value),
    dataFim: data(row.getCell(COL.fim).value),
    valorItem: numero(row.getCell(COL.valorItem).value),
    fornecedorBruto: texto(row.getCell(COL.fornecedor).value),
    ...c15,
  }
}

/**
 * Abre a planilha contornando um defeito do arquivo de origem.
 *
 * A planilha da construtora grava comentários em `xl/comments/comment1.xml`,
 * mas o padrão OOXML — e o que o ExcelJS espera — é `xl/comments1.xml`. Com o
 * caminho fora do padrão, `wb.xlsx.readFile()` estoura com
 * "Cannot read properties of undefined (reading 'comments')" e nenhum dado é lido.
 *
 * Comentários não interessam à importação, então removemos essas partes do zip
 * em memória (e as referências a elas nos `.rels` e no `[Content_Types].xml`)
 * antes de entregar o arquivo ao ExcelJS. O arquivo em disco não é alterado.
 */
export async function abrirPlanilha(caminho: string): Promise<ExcelJS.Workbook> {
  const zip = await JSZip.loadAsync(await readFile(caminho))

  for (const nome of Object.keys(zip.files)) {
    if (/comments?\/|\.vml$|comments\d*\.xml$/i.test(nome)) zip.remove(nome)
  }

  for (const nome of Object.keys(zip.files).filter((f) => /_rels\/.*\.rels$/.test(f))) {
    const xml = await zip.file(nome)!.async('string')
    zip.file(nome, xml.replace(/<Relationship[^>]*(?:comments|vmlDrawing)[^>]*\/>/gi, ''))
  }

  const tipos = zip.file('[Content_Types].xml')
  if (tipos) {
    const xml = await tipos.async('string')
    zip.file('[Content_Types].xml', xml.replace(/<Override[^>]*(?:comments|vml)[^>]*\/>/gi, ''))
  }

  const wb = new ExcelJS.Workbook()
  // exceljs 4.4.0 declara seu próprio tipo `Buffer` (um stub quase vazio) que
  // não bate estruturalmente com o Buffer real do Node; `any` é o contorno padrão.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load((await zip.generateAsync({ type: 'nodebuffer' })) as any)
  return wb
}

/**
 * Lê a planilha e devolve as linhas interpretadas.
 *
 * `mapa` diz de qual obra é cada aba, e é construído a partir das obras cadastradas
 * (`construirMapa`). Manter isso fora do parser é o que faz o importador servir a qualquer
 * planilha: quem cadastra as obras informa de qual aba cada uma vem.
 */
export async function lerPlanilha(caminho: string, mapa: MapaAbas): Promise<ResultadoParse> {
  const wb = await abrirPlanilha(caminho)

  const linhas: LinhaPlanilha[] = []
  const ignoradas: ResultadoParse['ignoradas'] = []

  for (const ws of wb.worksheets) {
    if (ABAS_IGNORADAS.has(ws.name)) continue

    const destino = mapa[ws.name] ?? null
    if (!destino) {
      ignoradas.push({ aba: ws.name, linha: 0, motivo: 'aba sem mapeamento para obra' })
      continue
    }

    const aConfirmar = destino.obrasCompartilhando.length > 0
    const cabecalho = localizarCabecalho(ws)
    if (cabecalho === null) {
      ignoradas.push({ aba: ws.name, linha: 0, motivo: 'cabeçalho "Nº" não encontrado' })
      continue
    }

    const inicioDevolucoes = localizarDevolucoes(ws)
    const fimLocacoes = inicioDevolucoes ?? ws.rowCount

    // Bloco LOCAÇÕES
    for (let r = cabecalho + 1; r < fimLocacoes; r++) {
      const marcador = texto(ws.getRow(r).getCell(COL.numero).value)
      if (ehFimDoBloco(marcador)) break
      const linha = lerLinha(ws, r, ws.name, destino.obraPrincipal, aConfirmar, false)
      if (linha) linhas.push(linha)
    }

    // Bloco DEVOLUÇÕES. Itens já devolvidos não entram na fila de
    // reclassificação de obra — só locações ativas precisam de confirmação
    // manual pela interface — então `obraAConfirmar` é sempre `false` aqui,
    // mesmo em abas compartilhadas.
    if (inicioDevolucoes !== null) {
      let vaziasSeguidas = 0
      for (let r = inicioDevolucoes + 1; r <= ws.rowCount && vaziasSeguidas < 20; r++) {
        const linha = lerLinha(ws, r, ws.name, destino.obraPrincipal, false, true)
        if (linha) { linhas.push(linha); vaziasSeguidas = 0 } else { vaziasSeguidas++ }
      }
    }
  }

  marcarPossiveisDuplicatas(linhas)
  return { linhas, ignoradas }
}

/** Maiúsculas, sem acento, espaços colapsados — só para comparar assinaturas. */
export function normalizarDescricao(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function assinaturaAtivo(l: LinhaPlanilha): string {
  return [normalizarDescricao(l.descricao), l.trCodigo ?? ''].join('|')
}

// Propositalmente SEM `dataFim`: no bloco DEVOLUÇÕES a planilha usa
// `fim = início` como marcador de campo não preenchido em uma das abas
// duplicadas. Incluir `dataFim` faria a comparação falhar bem onde a chance
// de duplicata é maior — o registro incompleto nunca bateria com o completo.
// Como a regra é sinalizar (não descartar), um falso positivo custa só uma
// revisão humana; um falso negativo deixaria custo duplicado invisível nos
// indicadores. Entre os dois erros, prefira marcar demais.
export function assinaturaDevolvida(l: LinhaPlanilha): string {
  return [
    normalizarDescricao(l.descricao),
    l.trCodigo ?? '',
    l.dataInicio?.getTime() ?? '',
    l.valorItem ?? '',
  ].join('|')
}

/**
 * A planilha repete equipamentos entre abas de obras diferentes. O campo
 * `Tr` não identifica um equipamento — é número de requisição/nota, e um
 * mesmo Tr cobre vários itens — então é impossível distinguir automaticamente
 * um erro de copiar/colar de uma remessa legitimamente dividida entre duas
 * obras. Decisão do cliente: importar tudo e sinalizar `possivelDuplicata`
 * para revisão humana, em vez de descartar dado financeiro.
 *
 * Marca TODAS as ocorrências (não só as excedentes) de uma assinatura que
 * aparece em mais de uma aba. Ativos e devolvidas são espaços separados:
 * um ativo nunca casa com uma devolvida, porque a assinatura de devolvida
 * também inclui datas e valor.
 */
function marcarPossiveisDuplicatas(linhas: LinhaPlanilha[]): void {
  function marcarGrupo(itens: LinhaPlanilha[], assinatura: (l: LinhaPlanilha) => string) {
    const abasPorAssinatura = new Map<string, Set<string>>()
    for (const l of itens) {
      const chave = assinatura(l)
      const abas = abasPorAssinatura.get(chave) ?? new Set<string>()
      abas.add(l.aba)
      abasPorAssinatura.set(chave, abas)
    }
    for (const l of itens) {
      if ((abasPorAssinatura.get(assinatura(l))?.size ?? 0) > 1) l.possivelDuplicata = true
    }
  }

  marcarGrupo(linhas.filter((l) => !l.devolvida), assinaturaAtivo)
  marcarGrupo(linhas.filter((l) => l.devolvida), assinaturaDevolvida)
}
