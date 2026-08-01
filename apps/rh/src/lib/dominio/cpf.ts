/**
 * Validação e formatação de CPF.
 *
 * Existe porque `Funcionario.cpf` é único: sem conferir os dígitos, um erro de digitação
 * vira um funcionário novo em vez de um aviso, e o duplicado só aparece meses depois,
 * quando dois cadastros disputam o mesmo ASO.
 */

/** Só os dígitos — é assim que o CPF é gravado, para a unicidade não depender de máscara. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

function digitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * (pesoInicial - i)
  }
  const resto = (soma * 10) % 11
  // 10 e 11 valem 0 — a regra da Receita, não um arredondamento nosso.
  return resto === 10 || resto === 11 ? 0 : resto
}

export function cpfValido(valor: string): boolean {
  const cpf = apenasDigitos(valor)
  if (cpf.length !== 11) return false

  // 00000000000, 11111111111... passam na conta dos dígitos, mas não existem.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const d1 = digitoVerificador(cpf.slice(0, 9), 10)
  if (d1 !== Number(cpf[9])) return false

  const d2 = digitoVerificador(cpf.slice(0, 10), 11)
  return d2 === Number(cpf[10])
}

/** "12345678909" → "123.456.789-09". Devolve a entrada crua se não tiver 11 dígitos. */
export function formatarCpf(valor: string): string {
  const cpf = apenasDigitos(valor)
  if (cpf.length !== 11) return valor
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}
