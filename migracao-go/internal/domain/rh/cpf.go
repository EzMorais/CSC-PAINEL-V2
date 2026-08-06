package rh

import "regexp"

// Validação e formatação de CPF — espelha apps/rh/src/lib/dominio/cpf.ts. Existe porque
// Funcionario.CPF é único: sem conferir os dígitos, um erro de digitação vira um
// funcionário novo em vez de um aviso.
var reNaoDigito = regexp.MustCompile(`\D`)

// ApenasDigitos remove tudo que não é dígito — é assim que o CPF é gravado, para a
// unicidade não depender de máscara.
func ApenasDigitos(valor string) string {
	return reNaoDigito.ReplaceAllString(valor, "")
}

func digitoVerificador(base string, pesoInicial int) int {
	soma := 0
	for i, r := range base {
		d := int(r - '0')
		soma += d * (pesoInicial - i)
	}
	resto := (soma * 10) % 11
	// 10 e 11 valem 0 — regra da Receita, não arredondamento nosso.
	if resto == 10 || resto == 11 {
		return 0
	}
	return resto
}

// sequenciaRepetida detecta "00000000000", "11111111111" etc. — Go's regexp (RE2) não
// suporta backreference (\1), diferente do regex de cpf.ts, então a checagem é feita
// comparando cada dígito ao primeiro em vez de via regex.
func sequenciaRepetida(cpf string) bool {
	for i := 1; i < len(cpf); i++ {
		if cpf[i] != cpf[0] {
			return false
		}
	}
	return true
}

// CPFValido confere os dois dígitos verificadores — mesma conta de digitoVerificador.go de
// cpf.ts. Rejeita sequências repetidas (00000000000, 11111111111...), que passam na conta
// dos dígitos mas não existem.
func CPFValido(valor string) bool {
	cpf := ApenasDigitos(valor)
	if len(cpf) != 11 {
		return false
	}
	if sequenciaRepetida(cpf) {
		return false
	}
	d1 := digitoVerificador(cpf[:9], 10)
	if d1 != int(cpf[9]-'0') {
		return false
	}
	d2 := digitoVerificador(cpf[:10], 11)
	return d2 == int(cpf[10]-'0')
}

// FormatarCPF: "12345678909" -> "123.456.789-09". Devolve a entrada crua se não tiver 11 dígitos.
func FormatarCPF(valor string) string {
	cpf := ApenasDigitos(valor)
	if len(cpf) != 11 {
		return valor
	}
	return cpf[:3] + "." + cpf[3:6] + "." + cpf[6:9] + "-" + cpf[9:]
}
