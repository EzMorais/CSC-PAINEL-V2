import { classificarColuna15 } from '../src/lib/planilha/coluna15'

let falhas = 0
function conferir(entrada: unknown, campo: 'quantidade' | 'estado' | 'observacoes', esperado: unknown) {
  const obtido = classificarColuna15(entrada)[campo]
  const ok = String(obtido) === String(esperado)
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${JSON.stringify(entrada).padEnd(20)} ${campo.padEnd(12)} esperado=${esperado}  obtido=${obtido}`)
}

// Valores reais encontrados na planilha
conferir('8', 'quantidade', 8)
conferir(1, 'quantidade', 1)
conferir('1096', 'quantidade', 1096)
conferir('PERDIDO', 'estado', 'PERDIDO')
conferir('PERDIDA', 'estado', 'PERDIDO')
conferir('ok', 'estado', 'OK')
conferir('OK', 'estado', 'OK')
conferir('TESTE ANDAIMES', 'observacoes', 'TESTE ANDAIMES')
conferir('CONTAINER', 'observacoes', 'CONTAINER')
conferir('OBSERVAÇÕES', 'observacoes', 'null')
conferir('UNIDADES', 'quantidade', 'null')
conferir(null, 'quantidade', 'null')
conferir('   ', 'observacoes', 'null')

console.log(falhas === 0 ? '\nTodos os casos passaram.' : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
