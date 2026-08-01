/**
 * Confere a validação de CPF contra casos conhecidos.
 *
 * Segue a convenção do Painel de Locação: cada regra pura de `src/lib/dominio/` tem um
 * `verificar-*.ts` que roda em segundos e imprime números conferíveis.
 */
import { cpfValido, formatarCpf, apenasDigitos } from '../src/lib/dominio/cpf'

// CPFs sintaticamente válidos (dígitos verificadores corretos) e inválidos.
const CASOS: Array<{ cpf: string; esperado: boolean; porque: string }> = [
  { cpf: '529.982.247-25', esperado: true, porque: 'válido, com máscara' },
  { cpf: '52998224725', esperado: true, porque: 'válido, só dígitos' },
  { cpf: '111.444.777-35', esperado: true, porque: 'válido' },
  { cpf: '529.982.247-24', esperado: false, porque: 'último dígito errado' },
  { cpf: '111.111.111-11', esperado: false, porque: 'todos iguais — passa na conta, não existe' },
  { cpf: '000.000.000-00', esperado: false, porque: 'todos zeros' },
  { cpf: '123', esperado: false, porque: 'curto demais' },
  { cpf: '', esperado: false, porque: 'vazio' },
  { cpf: '5299822472512', esperado: false, porque: 'longo demais' },
]

let falhas = 0
console.log('CPF — validação\n')
for (const { cpf, esperado, porque } of CASOS) {
  const obtido = cpfValido(cpf)
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`  [${ok ? 'OK  ' : 'ERRO'}] ${cpf.padEnd(16)} → ${String(obtido).padEnd(5)} (${porque})`)
}

console.log('\nCPF — formatação\n')
const FORMATO: Array<[string, string]> = [
  ['52998224725', '529.982.247-25'],
  ['529.982.247-25', '529.982.247-25'],
  ['123', '123'],
]
for (const [entrada, esperado] of FORMATO) {
  const obtido = formatarCpf(entrada)
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`  [${ok ? 'OK  ' : 'ERRO'}] ${entrada.padEnd(16)} → ${obtido}`)
}

console.log(`\napenasDigitos('529.982.247-25') = ${apenasDigitos('529.982.247-25')}`)
console.log(falhas === 0 ? '\nTudo confere.' : `\n${falhas} caso(s) fora do esperado.`)
process.exit(falhas === 0 ? 0 : 1)
