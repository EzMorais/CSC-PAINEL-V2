package compras

import (
	"strconv"
	"strings"
	"time"
)

func formatarNumero(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}

func agora() time.Time { return time.Now().UTC() }

func normalizarNumero(v string) string {
	v = strings.TrimSpace(v)
	v = strings.ReplaceAll(v, ".", "")
	v = strings.ReplaceAll(v, ",", ".")
	return v
}
