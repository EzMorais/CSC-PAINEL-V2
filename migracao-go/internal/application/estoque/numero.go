package estoque

import (
	"strconv"
	"time"
)

// formatarNumero imprime sem casas decimais desnecessárias (5, não 5.00) — mesmo efeito de
// interpolar um number diretamente numa template string JS.
func formatarNumero(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}

func agora() time.Time { return time.Now().UTC() }
