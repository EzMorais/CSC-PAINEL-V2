import 'server-only';
import ExcelJS from 'exceljs';
import type { Veiculo, Manutencao, Abastecimento, VeiculoAutorizado } from '@/db/schema';
import { indicadoresCombustivel } from './frota';

// ── paleta exata medida da planilha original ─────────────────────────────────
// Cores extraídas do tema da planilha original (dk2 = #44546A com tint).
const TITULO_FUNDO = 'FF8497B0';   // theme3 / tint 0.4
const HEADER_FUNDO = 'FFADB9CA';   // theme3 / tint 0.6
const LINHA_MANUT = 'FFD6DCE5';    // theme3 / tint 0.8
const TEXTO_ESCURO = 'FF000000';   // theme1 = dk1
const AZUL_TOTAIS = 'FFBDD7EE';
const AZUL_MAN_HD = 'FF1F4E78';
// As abas novas (ABASTECIMENTO / DASHBOARD) usam a mesma paleta para o arquivo
// inteiro parecer um documento só, e não duas planilhas coladas.
const AZUL_TITULO = TITULO_FUNDO;
const AZUL_HEADER = HEADER_FUNDO;
const VERDE_KM = 'FFC6EFCE';
const VERDE_KM_F = 'FF006100';
const AMARELO_PROX = 'FFFFEB9C';
const AMARELO_PROX_F = 'FF9C5700';
const AMARELO_PRIO = 'FFFFF2CC';
const VERDE_CONCL = 'FFE2EFDA';
const BRANCO = 'FFFFFFFF';
const ZEBRA = 'FFF2F6FC';

// Formatos contábeis copiados literalmente da planilha original.
const FMT_MOEDA = '_-"R$"\\ * #,##0_-;\\-"R$"\\ * #,##0_-;_-"R$"\\ * "-"??_-;_-@_-';
const FMT_MOEDA_LOC = '_-[$R$-416]\\ * #,##0_-;\\-[$R$-416]\\ * #,##0_-;_-[$R$-416]\\ * "-"??_-;_-@_-';
const FMT_KM = '_-* #,##0_-;\\-* #,##0_-;_-* "-"??_-;_-@_-';
const FMT_DATA = 'mm-dd-yy';  // built-in 14 — o Excel exibe conforme o locale
const FMT_PCT = '0%';

const preencher = (cor: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: cor },
});

const borda: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

const centro: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
const esquerda: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };

function paraData(iso: string | null | undefined): Date | string {
  if (!iso) return '-';
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? s : d;
}

// ══════════════════════════════════════════════════════════════════════════════
export async function gerarPlanilha(dados: {
  veiculos: Veiculo[];
  manutencoes: Manutencao[];
  abastecimentos: Abastecimento[];
  autorizados: VeiculoAutorizado[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Controle de Frota — Siqueira Campos';
  wb.created = new Date();

  abaControle(wb, dados.veiculos);
  abaManutencoes(wb, dados.manutencoes);
  abaAbastecimento(wb, dados.abastecimentos, dados.autorizados, dados.veiculos);
  abaDashboard(wb, dados.veiculos, dados.manutencoes, dados.abastecimentos);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── ABA 1: CONTROLE ───────────────────────────────────────────────────────────
function abaControle(wb: ExcelJS.Workbook, vs: Veiculo[]) {
  const ws = wb.addWorksheet('CONTROLE', { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.mergeCells('A1:W1');
  const t = ws.getCell('A1');
  t.value = 'CONTROLE DE VEÍCULOS';
  t.fill = preencher(TITULO_FUNDO);
  t.font = { bold: true, size: 20, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
  t.alignment = centro;
  ws.getRow(1).height = 26.25;

  const cabecalhos = [
    'Veiculo', 'Placa', 'Ano', 'Renavan', 'Chassi', 'Seguro', 'Vencimento',
    'Aviso', 'Valor\nSeguro', 'Licenc. Atual', 'Multas e Outros', 'Taxas \nLic./IPVA',
    'km \nRevisão', 'km Atual', 'km Proxima', 'Revisão', 'Tabela FIPE JAN/25',
    -0.2, 'Situação', 'FUNCIONÁRIO', 'DATA', 'CHECK LIST', 'OBSERVAÇÕES',
  ];
  cabecalhos.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h as ExcelJS.CellValue;
    c.fill = preencher(HEADER_FUNDO);
    c.font = { bold: true, size: 11, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
    c.alignment = centro;
    c.border = borda;
  });
  // R2 guarda o desconto como número (-20%), exatamente como na planilha original
  ws.getCell(2, 18).numFmt = FMT_PCT;
  ws.getRow(2).height = 30;

  // larguras exatas do arquivo original
  const larguras = [36.71, 10.86, 9.71, 13.71, 21.14, 15.0, 16.43, 11.0, 12.29, 17.0,
    14.29, 13.86, 13.14, 14.14, 16.57, 13.14, 16.14, 13.43, 13.57, 18.86, 11.29, 16.0, 19.14];
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const INICIO = 3;
  vs.forEach((v, i) => {
    const r = INICIO + i;
    const alugado = v.situacao === 'ALUGADO';

    const def = (col: number, valor: ExcelJS.CellValue, fmt?: string, al = centro, bold = false) => {
      const c = ws.getCell(r, col);
      c.value = valor;
      c.font = { size: 11, bold, name: 'Calibri' };
      c.alignment = al;
      c.border = borda;
      if (fmt) c.numFmt = fmt;
      return c;
    };

    def(1, v.nome, undefined, esquerda, true);
    def(2, v.placa || '-');
    def(3, v.ano || '');
    def(4, v.renavam || '-');
    def(5, v.chassi || '');
    def(6, v.seguradora || '-');
    def(7, paraData(v.vencSeguro), FMT_DATA);

    // fórmula de aviso — idêntica à planilha original
    def(8, { formula: `IF(G${r}<TODAY(),"VENCIDO",IF(G${r}-TODAY()<=15,"ATENÇÃO","OK"))` } as ExcelJS.CellValue);

    def(9, v.valorSeguro || 0, FMT_MOEDA);
    def(10, v.licenciamento || '-');
    def(11, v.multas || 0, FMT_MOEDA_LOC);
    def(12, v.taxas || 0, FMT_MOEDA_LOC);

    const m = def(13, v.kmRevisao || 0, FMT_KM);
    m.fill = preencher(VERDE_KM);
    m.font = { size: 11, bold: true, color: { argb: VERDE_KM_F }, name: 'Calibri' };

    def(14, v.kmAtual || 0, FMT_KM, centro, true);

    // A original calcula a próxima revisão como fórmula sobre a última (=M+intervalo),
    // então a planilha continua se atualizando se o chefe editar a coluna M.
    const intervalo = (v.kmProxima || 0) - (v.kmRevisao || 0);
    const proxima: ExcelJS.CellValue = alugado
      ? 'ALUGADO'
      : intervalo > 0
        ? ({ formula: `M${r}+${intervalo}` } as ExcelJS.CellValue)
        : (v.kmProxima || 0);
    const o = def(15, proxima, alugado ? undefined : FMT_KM);
    o.fill = preencher(AMARELO_PROX);
    o.font = { size: 11, bold: true, color: { argb: AMARELO_PROX_F }, name: 'Calibri' };

    def(16, alugado ? '' : ({ formula: `O${r}-N${r}` } as ExcelJS.CellValue), FMT_KM, centro, true);
    def(17, v.fipe || 0, FMT_MOEDA, centro, true);
    def(18, { formula: `Q${r}*0.8` } as ExcelJS.CellValue, FMT_MOEDA);
    def(19, v.situacao || '');
    def(20, v.motorista || '', undefined, centro, true);
    def(21, '');
    def(22, '');
    def(23, '');
  });

  // linha de totais
  const ultima = INICIO + vs.length - 1;
  const tr = ultima + 2;
  const rotulo = ws.getCell(tr, 1);
  rotulo.value = 'TOTAIS';
  rotulo.font = { bold: true, size: 11, name: 'Calibri' };
  rotulo.fill = preencher(AZUL_TOTAIS);
  rotulo.border = borda;

  const somas: Record<number, string> = { 9: 'I', 11: 'K', 12: 'L', 17: 'Q', 18: 'R' };
  for (let col = 2; col <= 23; col++) {
    const c = ws.getCell(tr, col);
    c.fill = preencher(AZUL_TOTAIS);
    c.border = borda;
    const letra = somas[col];
    if (letra && vs.length) {
      c.value = { formula: `SUM(${letra}${INICIO}:${letra}${ultima})` } as ExcelJS.CellValue;
      c.font = { bold: true, size: 11, name: 'Calibri' };
      c.numFmt = FMT_MOEDA;
      c.alignment = centro;
    }
  }
}

// ── ABA 2: MANUTENÇÕES E PROBLEMAS ────────────────────────────────────────────
function abaManutencoes(wb: ExcelJS.Workbook, ms: Manutencao[]) {
  const ws = wb.addWorksheet('MANUTENÇÕES E PROBLEMAS', { views: [{ state: 'frozen', ySplit: 3 }] });

  ws.mergeCells('A1:K2');
  const t = ws.getCell('A1');
  t.value = 'CONTROLE DE MANUTENÇÃO E PROBLEMAS';
  t.font = { bold: true, size: 14, color: { argb: AZUL_MAN_HD }, name: 'Calibri' };
  t.alignment = centro;

  const cabecalhos = ['Placa', 'Problema Identificado', 'Categoria', 'Prioridade',
    'Data Identificação', 'Previsão Solução', 'Status', 'Oficina/Responsável',
    'Custo Estimado (R$)', 'Dias em Aberto', 'Observações'];
  cabecalhos.forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h;
    c.fill = preencher(AZUL_MAN_HD);
    c.font = { bold: true, size: 11, color: { argb: BRANCO }, name: 'Calibri' };
    c.alignment = centro;
    c.border = borda;
  });

  const larguras = [9.86, 55.29, 16.29, 11.57, 19.29, 19.0, 15.57, 22.43, 22.0, 16.43, 14.71];
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  ms.forEach((m, i) => {
    const r = 4 + i;

    const def = (col: number, valor: ExcelJS.CellValue, fmt?: string, al = centro) => {
      const c = ws.getCell(r, col);
      c.value = valor;
      c.font = { size: 10, name: 'Calibri' };
      c.fill = preencher(LINHA_MANUT);
      c.alignment = al;
      c.border = borda;
      if (fmt) c.numFmt = fmt;
      return c;
    };

    def(1, m.placa);
    def(2, m.problema, undefined, esquerda);
    def(3, m.categoria);
    def(4, m.prioridade).fill = preencher(AMARELO_PRIO);
    def(5, paraData(m.dataIdentificacao), FMT_DATA);
    def(6, m.previsaoSolucao ? paraData(m.previsaoSolucao) : '', FMT_DATA);
    def(7, m.status).fill = preencher(AMARELO_PRIO);
    def(8, m.oficina || '');
    def(9, m.custo || '', m.custo ? FMT_MOEDA : undefined);
    // A original tem a fórmula deslocada uma linha (=IF(F5="";...;TODAY()-E5) na
    // linha 4), o que faz a contagem de dias sair errada. Aqui vai corrigida.
    def(10, { formula: `IF(E${r}="","",TODAY()-E${r})` } as ExcelJS.CellValue, FMT_KM);
    def(11, m.obs || '', undefined, esquerda);
  });
}

// ── ABA 3: ABASTECIMENTO ──────────────────────────────────────────────────────
function abaAbastecimento(
  wb: ExcelJS.Workbook,
  abs: Abastecimento[],
  autorizados: VeiculoAutorizado[],
  vs: Veiculo[]
) {
  const ws = wb.addWorksheet('ABASTECIMENTO', { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.mergeCells('A1:L1');
  const t = ws.getCell('A1');
  t.value = 'CONTROLE DE ABASTECIMENTO';
  t.fill = preencher(AZUL_TITULO);
  t.font = { bold: true, size: 14, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
  t.alignment = centro;
  ws.getRow(1).height = 28;

  const cabecalhos = ['Data', 'Placa', 'Veículo', 'Motorista', 'Combustível',
    'Litros', 'Valor Total (R$)', 'R$/Litro', 'Km', 'Posto', 'Obs', 'UF'];
  cabecalhos.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    c.fill = preencher(AZUL_HEADER);
    c.font = { bold: true, size: 10, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
    c.alignment = centro;
    c.border = borda;
  });
  ws.getRow(2).height = 24;

  const larguras = [12, 10, 36, 18, 14, 10, 16, 12, 12, 24, 24, 6];
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const porPlaca = new Map(vs.map((v) => [v.placa, v]));
  const autPorPlaca = new Map(autorizados.map((a) => [a.placa, a]));

  const ordenados = [...abs].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  ordenados.forEach((a, i) => {
    const r = 3 + i;
    const fundo = i % 2 === 0 ? ZEBRA : BRANCO;
    const v = porPlaca.get(a.placa);
    const aut = autPorPlaca.get(a.placa);

    const def = (col: number, valor: ExcelJS.CellValue, fmt?: string, al = centro) => {
      const c = ws.getCell(r, col);
      c.value = valor;
      c.font = { size: 10, name: 'Calibri' };
      c.fill = preencher(fundo);
      c.alignment = al;
      c.border = borda;
      if (fmt) c.numFmt = fmt;
      return c;
    };

    def(1, paraData(a.data), FMT_DATA);
    def(2, a.placa);
    def(3, v?.nome ?? '', undefined, esquerda);
    def(4, v?.motorista ?? '', undefined, esquerda);
    def(5, a.combustivel || '');
    def(6, a.litros || 0, '#,##0.00');
    def(7, a.valorTotal || 0, FMT_MOEDA);
    def(8, a.litros ? ({ formula: `G${r}/F${r}` } as ExcelJS.CellValue) : '', FMT_MOEDA);
    def(9, a.km || '', FMT_KM);
    def(10, a.posto || '', undefined, esquerda);
    def(11, a.obs || '', undefined, esquerda);
    def(12, aut?.uf ?? 'SP');

    ws.getRow(r).height = 16;
  });

  let proxima = 4;
  if (ordenados.length) {
    const ultima = 2 + ordenados.length;
    const tr = ultima + 2;
    const rot = ws.getCell(tr, 1);
    rot.value = 'TOTAIS';
    rot.font = { bold: true, size: 11, name: 'Calibri' };
    rot.fill = preencher(AZUL_TOTAIS);

    const litros = ws.getCell(tr, 6);
    litros.value = { formula: `SUM(F3:F${ultima})` } as ExcelJS.CellValue;
    litros.numFmt = '#,##0.00';

    const valor = ws.getCell(tr, 7);
    valor.value = { formula: `SUM(G3:G${ultima})` } as ExcelJS.CellValue;
    valor.numFmt = FMT_MOEDA;

    const medio = ws.getCell(tr, 8);
    medio.value = { formula: `IF(F${tr}=0,"",G${tr}/F${tr})` } as ExcelJS.CellValue;
    medio.numFmt = FMT_MOEDA;

    [1, 6, 7, 8].forEach((col) => {
      const c = ws.getCell(tr, col);
      c.font = { bold: true, size: 11, name: 'Calibri' };
      c.fill = preencher(AZUL_TOTAIS);
      c.border = borda;
      c.alignment = centro;
    });
    proxima = tr + 3;
  }

  // tabela de veículos autorizados
  ws.mergeCells(`A${proxima}:L${proxima}`);
  const ct = ws.getCell(`A${proxima}`);
  ct.value = 'VEÍCULOS AUTORIZADOS NO POSTO';
  ct.fill = preencher(AZUL_MAN_HD);
  ct.font = { bold: true, size: 11, color: { argb: BRANCO }, name: 'Calibri' };
  ct.alignment = centro;
  ws.getRow(proxima).height = 22;

  const cab2 = ['Placa', 'UF', 'Modelo', 'Fabricante', 'Ano', 'Status', 'Combustíveis Autorizados'];
  cab2.forEach((h, i) => {
    const c = ws.getCell(proxima + 1, i + 1);
    c.value = h;
    c.fill = preencher(AZUL_HEADER);
    c.font = { bold: true, size: 10, color: { argb: BRANCO }, name: 'Calibri' };
    c.alignment = centro;
    c.border = borda;
  });

  autorizados.forEach((a, i) => {
    const r = proxima + 2 + i;
    const fundo = i % 2 === 0 ? ZEBRA : BRANCO;
    [a.placa, a.uf, a.modelo, a.fabricante, a.ano || '', a.status, a.combustiveis]
      .forEach((val, col) => {
        const c = ws.getCell(r, col + 1);
        c.value = val as ExcelJS.CellValue;
        c.fill = preencher(fundo);
        c.font = { size: 10, name: 'Calibri' };
        c.alignment = col === 2 || col === 6 ? esquerda : centro;
        c.border = borda;
      });
  });
}

// ── ABA 4: DASHBOARD ──────────────────────────────────────────────────────────
function abaDashboard(
  wb: ExcelJS.Workbook,
  vs: Veiculo[],
  ms: Manutencao[],
  abs: Abastecimento[]
) {
  const ws = wb.addWorksheet('DASHBOARD');
  ws.views = [{ showGridLines: false }];

  for (let c = 1; c <= 18; c++) ws.getColumn(c).width = 15;
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 28;

  ws.mergeCells('B1:R1');
  const t = ws.getCell('B1');
  t.value = 'DASHBOARD — CONTROLE DE FROTA | SIQUEIRA CAMPOS';
  t.fill = preencher(AZUL_TITULO);
  t.font = { bold: true, size: 16, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
  t.alignment = centro;
  ws.getRow(1).height = 34;

  ws.mergeCells('B2:R2');
  const sub = ws.getCell('B2');
  sub.value = `Gerado em ${new Date().toLocaleDateString('pt-BR')}`;
  sub.font = { italic: true, size: 10, color: { argb: 'FF595959' }, name: 'Calibri' };
  sub.alignment = centro;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = (iso: string) => {
    if (!iso) return null;
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
  };

  const segVencidos = vs.filter((v) => { const d = dias(v.vencSeguro); return d !== null && d < 0; }).length;
  const segAtencao = vs.filter((v) => { const d = dias(v.vencSeguro); return d !== null && d >= 0 && d <= 30; }).length;
  const revVencidas = vs.filter((v) => v.kmProxima > 0 && v.kmAtual >= v.kmProxima).length;
  const abertos = ms.filter((m) => m.status === 'Aberto').length;
  const andamento = ms.filter((m) => m.status === 'Em andamento').length;
  const concluidos = ms.filter((m) => m.status === 'Concluído').length;
  const multas = vs.reduce((s, v) => s + (v.multas || 0), 0);
  const valorFrota = vs.reduce((s, v) => s + (v.fipe || 0), 0);

  const cartao = (c1: string, c2: string, linha: number, rotulo: string, valor: string, cor: string) => {
    ws.mergeCells(`${c1}${linha}:${c2}${linha}`);
    ws.mergeCells(`${c1}${linha + 1}:${c2}${linha + 1}`);
    ws.mergeCells(`${c1}${linha + 2}:${c2}${linha + 2}`);
    const r = ws.getCell(`${c1}${linha}`);
    r.value = rotulo; r.fill = preencher(cor); r.alignment = centro;
    r.font = { size: 9, color: { argb: BRANCO }, name: 'Calibri' };
    const v = ws.getCell(`${c1}${linha + 1}`);
    v.value = valor; v.fill = preencher(cor); v.alignment = centro;
    v.font = { bold: true, size: 18, color: { argb: BRANCO }, name: 'Calibri' };
    ws.getCell(`${c1}${linha + 2}`).fill = preencher(cor);
    ws.getRow(linha).height = 18;
    ws.getRow(linha + 1).height = 32;
    ws.getRow(linha + 2).height = 8;
  };

  cartao('B', 'C', 4, 'Total de Veículos', String(vs.length), 'FF1F3864');
  cartao('D', 'E', 4, 'Seguros Vencidos', String(segVencidos), 'FFC00000');
  cartao('F', 'G', 4, 'Seguros em Atenção', String(segAtencao), 'FFED7D31');
  cartao('H', 'I', 4, 'Revisões Vencidas', String(revVencidas), 'FF7030A0');
  cartao('J', 'K', 4, 'Problemas Abertos', String(abertos), 'FFC00000');
  cartao('L', 'M', 4, 'Em Andamento', String(andamento), 'FFED7D31');
  cartao('N', 'O', 4, 'Concluídos', String(concluidos), 'FF375623');
  cartao('P', 'Q', 4, 'Multas', multas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), 'FF9E0B0F');

  const secao = (c1: string, c2: string, linha: number, titulo: string) => {
    ws.mergeCells(`${c1}${linha}:${c2}${linha}`);
    const c = ws.getCell(`${c1}${linha}`);
    c.value = titulo;
    c.fill = preencher(AZUL_HEADER);
    c.font = { bold: true, size: 11, color: { argb: TEXTO_ESCURO }, name: 'Calibri' };
    c.alignment = esquerda;
    ws.getRow(linha).height = 22;
  };

  const cabTabela = (linha: number, colInicio: number, cabs: string[]) => {
    cabs.forEach((h, i) => {
      const c = ws.getCell(linha, colInicio + i);
      c.value = h;
      c.fill = preencher(AZUL_TOTAIS);
      c.font = { bold: true, size: 10, color: { argb: 'FF1F3864' }, name: 'Calibri' };
      c.alignment = centro;
      c.border = borda;
    });
    ws.getRow(linha).height = 18;
  };

  const linhaTabela = (linha: number, colInicio: number, vals: (string | number)[], fundo: string, negrito = false) => {
    vals.forEach((v, i) => {
      const c = ws.getCell(linha, colInicio + i);
      c.value = v;
      c.fill = preencher(fundo);
      c.font = { size: 10, bold: negrito, name: 'Calibri' };
      c.alignment = i === 0 ? esquerda : centro;
      c.border = borda;
    });
    ws.getRow(linha).height = 16;
  };

  // seguros por seguradora
  secao('B', 'H', 8, 'SEGUROS POR SEGURADORA');
  cabTabela(9, 2, ['Seguradora', 'Veículos', 'Venc. mais próximo']);
  const porSeg = new Map<string, { qtd: number; min: number | null }>();
  for (const v of vs) {
    const k = v.seguradora || 'Sem seguro';
    const at = porSeg.get(k) ?? { qtd: 0, min: null };
    at.qtd++;
    const d = dias(v.vencSeguro);
    if (d !== null && (at.min === null || d < at.min)) at.min = d;
    porSeg.set(k, at);
  }
  let ln = 10;
  [...porSeg.entries()].sort().forEach(([nome, info], i) => {
    linhaTabela(ln++, 2, [nome, info.qtd, info.min === null ? '—' : `${info.min}d`], i % 2 === 0 ? ZEBRA : BRANCO);
  });

  // manutenções por categoria
  secao('J', 'Q', 8, 'MANUTENÇÕES POR CATEGORIA');
  cabTabela(9, 10, ['Categoria', 'Qtd']);
  const porCat = new Map<string, number>();
  for (const m of ms) porCat.set(m.categoria, (porCat.get(m.categoria) ?? 0) + 1);
  let lc = 10;
  [...porCat.entries()].sort((a, b) => b[1] - a[1]).forEach(([cat, qtd], i) => {
    linhaTabela(lc++, 10, [cat, qtd], i % 2 === 0 ? ZEBRA : BRANCO);
  });

  // valor da frota
  let base = Math.max(ln, lc) + 2;
  secao('B', 'Q', base, 'VALOR DA FROTA POR SITUAÇÃO (FIPE)');
  cabTabela(base + 1, 2, ['Situação', 'Veículos', 'Valor FIPE', '80% FIPE']);
  const porSit = new Map<string, { qtd: number; total: number }>();
  for (const v of vs) {
    const k = v.situacao || '—';
    const at = porSit.get(k) ?? { qtd: 0, total: 0 };
    at.qtd++; at.total += v.fipe || 0;
    porSit.set(k, at);
  }
  let ls = base + 2;
  [...porSit.entries()].forEach(([sit, info], i) => {
    linhaTabela(ls++, 2, [sit, info.qtd,
      info.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      (info.total * 0.8).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })],
      i % 2 === 0 ? ZEBRA : BRANCO);
  });
  linhaTabela(ls, 2, ['TOTAL', vs.length,
    valorFrota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    (valorFrota * 0.8).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })],
    AZUL_TOTAIS, true);

  // ── seção combustível ──────────────────────────────────────────────────────
  if (!abs.length) return;

  const ind = indicadoresCombustivel(abs);
  const bc = ls + 3;

  ws.mergeCells(`B${bc}:R${bc}`);
  const tc = ws.getCell(`B${bc}`);
  tc.value = 'ABASTECIMENTO — RESUMO';
  tc.fill = preencher(AZUL_TITULO);
  tc.font = { bold: true, size: 13, color: { argb: BRANCO }, name: 'Calibri' };
  tc.alignment = centro;
  ws.getRow(bc).height = 28;

  cartao('B', 'D', bc + 1, 'Total Gasto', ind.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), 'FFC00000');
  cartao('E', 'G', bc + 1, 'Total Litros', `${ind.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`, 'FF2563EB');
  cartao('H', 'J', bc + 1, 'Custo Médio/Litro', ind.custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }), 'FFD97706');
  cartao('K', 'M', bc + 1, 'Abastecimentos', String(ind.qtd), 'FF7C3AED');

  const bt = bc + 5;
  secao('B', 'H', bt, 'COMBUSTÍVEL — TOP 10 VEÍCULOS POR GASTO');
  cabTabela(bt + 1, 2, ['Placa', 'Veículo', 'Abast.', 'Litros', 'Valor Total', 'R$/L']);
  ind.porVeiculo.slice(0, 10).forEach((item, i) => {
    const media = item.litros ? item.valor / item.litros : 0;
    linhaTabela(bt + 2 + i, 2, [
      item.placa, item.veiculo.slice(0, 30), item.qtd,
      `${item.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`,
      item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }),
    ], i % 2 === 0 ? ZEBRA : BRANCO);
  });

  secao('J', 'Q', bt, 'POR TIPO DE COMBUSTÍVEL');
  cabTabela(bt + 1, 10, ['Combustível', 'Litros', 'Valor Total']);
  ind.porCombustivel.forEach((item, i) => {
    linhaTabela(bt + 2 + i, 10, [
      item.combustivel,
      `${item.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`,
      item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    ], i % 2 === 0 ? ZEBRA : BRANCO);
  });
}
