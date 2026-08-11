// Package upload reúne as checagens comuns aos dois pontos de recebimento de arquivo do
// binário (importador do Painel de Locação e importador de funcionários do RH — ver
// internal/handlers/painel/importar.go e internal/handlers/rh/importacao.go). Não confia em
// nada que o cliente declara sobre o arquivo: nem extensão do nome, nem caminho devolvido num
// campo de formulário.
package upload

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"path/filepath"
	"strings"
)

var (
	ErrExtensaoNaoPermitida = errors.New("extensão de arquivo não permitida")
	ErrAssinaturaInvalida   = errors.New("o conteúdo do arquivo não confere com um Excel (.xlsx/.xlsm) válido")
)

// ValidarExtensao confere o nome ORIGINAL (só pra dar uma mensagem de erro cedo e específica
// pro usuário) — nunca é a única defesa: ValidarAssinatura confere o conteúdo de verdade,
// porque um nome de arquivo é um dado do cliente, trocável em qualquer editor de requisição.
func ValidarExtensao(nome string, permitidas ...string) error {
	ext := strings.ToLower(filepath.Ext(nome))
	for _, p := range permitidas {
		if ext == strings.ToLower(p) {
			return nil
		}
	}
	return ErrExtensaoNaoPermitida
}

// assinaturaZIP é o cabeçalho de qualquer arquivo ZIP — .xlsx/.xlsm são ZIP por dentro (Office
// Open XML), então isto é a checagem de CONTEÚDO real, independente do nome declarado.
var assinaturaZIP = []byte("PK\x03\x04")

// ValidarAssinaturaXLSX recebe os primeiros bytes já lidos do arquivo (ver LerAssinatura).
func ValidarAssinaturaXLSX(inicio []byte) error {
	if len(inicio) < len(assinaturaZIP) || !bytes.Equal(inicio[:len(assinaturaZIP)], assinaturaZIP) {
		return ErrAssinaturaInvalida
	}
	return nil
}

// LerAssinatura consome só os primeiros bytes de r (o bastante pra checar a assinatura) e
// devolve um io.Reader que ainda produz o conteúdo INTEIRO, incluindo os bytes já lidos — o
// chamador nunca precisa saber que a checagem espiou o início do arquivo.
func LerAssinatura(r io.Reader) (inicio []byte, completo io.Reader, err error) {
	buf := make([]byte, len(assinaturaZIP))
	n, err := io.ReadFull(r, buf)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return nil, nil, err
	}
	return buf[:n], io.MultiReader(bytes.NewReader(buf[:n]), r), nil
}

// NomeInterno gera um nome de arquivo aleatório para gravar em disco — nunca o nome que o
// cliente enviou. Usa crypto/rand (não time.Now(), que é previsível e não impede colisão sob
// dois uploads no mesmo milissegundo).
func NomeInterno(prefixo, extensao string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand.Read só falha se o SO não tiver fonte de aleatoriedade — sem fallback sensato aqui
	return prefixo + "-" + hex.EncodeToString(b) + extensao
}

// CaminhoDentroDaPasta confere que `caminho` resolve para dentro de `pasta` — defesa contra um
// campo de formulário adulterado apontando pra fora da pasta de uploads (ex.: `../../etc/passwd`
// ou um caminho absoluto de outro lugar do disco).
func CaminhoDentroDaPasta(caminho, pasta string) bool {
	pastaAbs, err := filepath.Abs(pasta)
	if err != nil {
		return false
	}
	caminhoAbs, err := filepath.Abs(caminho)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(pastaAbs, caminhoAbs)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}
