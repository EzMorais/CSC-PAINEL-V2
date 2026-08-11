package financeiro

import (
	"testing"

	dominio "siqueiracampos/servidor/internal/domain/financeiro"
)

func TestCentavosSemFloat(t *testing.T) {
	casos := map[string]dominio.Centavos{
		"1.000,00": 100000,
		"50,00":    5000,
		"10,00":    1000,
		"1.234,56": 123456,
		"1234.56":  123456,
		"1.234":    123400,
	}
	for entrada, esperado := range casos {
		v, err := centavos(entrada, false)
		if err != nil || v != esperado {
			t.Fatalf("%q => %d (%v), esperado %d", entrada, v, err, esperado)
		}
	}
	for _, entrada := range []string{"", "0,00", "1,2345", "1,2,3", "abc", "-1,00"} {
		if _, err := centavos(entrada, false); err == nil {
			t.Fatalf("valor inválido aceito: %q", entrada)
		}
	}
}
