import { periodoPorDias, quantidadePeriodos, valorTotal } from '../src/lib/dominio/periodo'
import { brl, dataBR, parseDataBR } from '../src/lib/dominio/formato'

let falhas = 0
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  // Normaliza espaços (regular e não separável) para comparação
  const normalizaEspacos = (s: string) => s.replace(/\s/g, ' ')
  const obtidoStr = normalizaEspacos(String(obtido))
  const esperadoStr = normalizaEspacos(String(esperado))
  const ok = obtidoStr === esperadoStr
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome.padEnd(38)} esperado=${esperado}  obtido=${obtido}`)
}

conferir('1 dia é Diário',        periodoPorDias(1), 'Diário')
conferir('7 dias é Semanal',      periodoPorDias(7), 'Semanal')
conferir('15 dias é Quinzenal',   periodoPorDias(15), 'Quinzenal')
conferir('30 dias é Mensal',      periodoPorDias(30), 'Mensal')
conferir('60 dias é Mensal',      periodoPorDias(60), 'Mensal')

conferir('30 dias = 1 período',   quantidadePeriodos(30), 1)
conferir('31 dias = 2 períodos',  quantidadePeriodos(31), 2)
conferir('60 dias = 2 períodos',  quantidadePeriodos(60), 2)
// 8 a 15 dias é Quinzenal pela coluna J, então o divisor é 15 — não 7.
// Duas semanas é inatingível por construção: nunca há 2 períodos semanais.
conferir('14 dias = 1 quinzena',  quantidadePeriodos(14), 1)
conferir('7 dias = 1 semana',     quantidadePeriodos(7), 1)
conferir('16 dias = 1 mês',       quantidadePeriodos(16), 1)

// Caso real da planilha: MARTELETE 11KG, R$ 650, 2 períodos mensais = R$ 1300.
// 23/05 a 22/07 são 60 dias exatos → ceil(60/30) = 2.
conferir(
  'martelete 650 x 2 meses',
  valorTotal(650, new Date(Date.UTC(2026, 4, 23)), new Date(Date.UTC(2026, 6, 22))),
  1300
)

// 61 dias já entram no terceiro período — a locação vira 3 mensalidades.
conferir(
  'martelete 61 dias = 3 meses',
  valorTotal(650, new Date(Date.UTC(2026, 4, 23)), new Date(Date.UTC(2026, 6, 23))),
  1950
)

conferir('brl formata em real',   brl(123681.5), 'R$ 123.681,50')
conferir('brl trata nulo',        brl(null), 'R$ 0,00')
conferir('data em UTC não recua', dataBR(new Date('2026-07-31T00:00:00Z')), '31/07/2026')
conferir('parse pt-BR',           parseDataBR('31/07/2026')?.toISOString().slice(0, 10), '2026-07-31')
conferir('parse ISO',             parseDataBR('2026-07-31')?.toISOString().slice(0, 10), '2026-07-31')
conferir('parse inválido',        parseDataBR('não é data'), 'null')

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
