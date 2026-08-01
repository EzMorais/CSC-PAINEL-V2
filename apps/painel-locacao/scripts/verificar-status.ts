import { calcularStatus, diasRestantes, rotuloVencimento } from '../src/lib/dominio/status'

const HOJE = new Date('2026-07-31T10:00:00')

const casos: { nome: string; dataFim: Date | null; devolvidaEm: Date | null; esperado: string }[] = [
  { nome: 'devolvida ignora a data fim', dataFim: new Date('2026-12-01T00:00:00'), devolvidaEm: new Date('2026-07-01T00:00:00'), esperado: 'DEVOLVIDA' },
  { nome: 'sem data fim',                dataFim: null,                            devolvidaEm: null, esperado: 'SEM_PRAZO' },
  { nome: 'venceu ontem',                dataFim: new Date('2026-07-30T00:00:00'),  devolvidaEm: null, esperado: 'VENCIDA' },
  { nome: 'vence hoje',                  dataFim: new Date('2026-07-31T00:00:00'),  devolvidaEm: null, esperado: 'ATENCAO' },
  { nome: 'vence em 7 dias (limite)',    dataFim: new Date('2026-08-07T00:00:00'),  devolvidaEm: null, esperado: 'ATENCAO' },
  { nome: 'vence em 8 dias',             dataFim: new Date('2026-08-08T00:00:00'),  devolvidaEm: null, esperado: 'ATIVA' },
]

let falhas = 0
for (const c of casos) {
  const obtido = calcularStatus({ dataFim: c.dataFim, devolvidaEm: c.devolvidaEm }, HOJE)
  const ok = obtido === c.esperado
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${c.nome.padEnd(32)} esperado=${c.esperado.padEnd(10)} obtido=${obtido}`)
}

// Regressão de fuso horário: datas do banco são UTC-meia-noite representando um dia de
// calendário. Ler seus componentes em horário local as jogava para o dia anterior no
// Brasil, e a tela exibia "08/08/2026 — vence em 7 dias" quando faltavam 8.
console.log('\nFuso horário (data armazenada em UTC-meia-noite):')
{
  const fim = new Date('2026-08-08T00:00:00Z')
  const d = diasRestantes(fim, HOJE)
  const ok = d === 8
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} 31/07 -> 08/08 são 8 dias            esperado=8         obtido=${d}`)

  const st = calcularStatus({ dataFim: fim, devolvidaEm: null }, HOJE)
  const ok2 = st === 'ATIVA'
  if (!ok2) falhas++
  console.log(`${ok2 ? 'ok  ' : 'FALHA'} e portanto ATIVA, não ATENCAO         esperado=ATIVA     obtido=${st}`)
}

console.log('\nRótulos:')
console.log(' ', rotuloVencimento(new Date('2026-07-30T00:00:00'), HOJE))
console.log(' ', rotuloVencimento(new Date('2026-07-31T00:00:00'), HOJE))
console.log(' ', rotuloVencimento(new Date('2026-08-03T00:00:00'), HOJE))
console.log(' ', rotuloVencimento(null, HOJE))
console.log(' dias até 2026-08-08:', diasRestantes(new Date('2026-08-08T00:00:00'), HOJE))

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
