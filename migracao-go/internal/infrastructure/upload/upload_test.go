package upload

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestValidarExtensao(t *testing.T) {
	casos := []struct {
		nome string
		ok   bool
	}{
		{"planilha.xlsx", true},
		{"PLANILHA.XLSX", true},
		{"planilha.xlsm", true},
		{"planilha.xls", false},
		{"planilha.exe", false},
		{"planilha.xlsx.exe", false},
		{"semextensao", false},
	}
	for _, c := range casos {
		err := ValidarExtensao(c.nome, ".xlsx", ".xlsm")
		if (err == nil) != c.ok {
			t.Errorf("ValidarExtensao(%q): esperava ok=%v, veio err=%v", c.nome, c.ok, err)
		}
	}
}

func TestValidarAssinaturaXLSX(t *testing.T) {
	if err := ValidarAssinaturaXLSX([]byte("PK\x03\x04resto do zip")); err != nil {
		t.Errorf("assinatura ZIP válida foi recusada: %v", err)
	}
	if err := ValidarAssinaturaXLSX([]byte("não é zip")); err == nil {
		t.Error("esperava erro para conteúdo sem assinatura ZIP")
	}
	if err := ValidarAssinaturaXLSX([]byte("PK")); err == nil {
		t.Error("esperava erro para assinatura truncada")
	}
	if err := ValidarAssinaturaXLSX(nil); err == nil {
		t.Error("esperava erro para conteúdo vazio")
	}
}

func TestLerAssinatura_PreservaConteudoCompleto(t *testing.T) {
	original := []byte("PK\x03\x04" + "conteúdo qualquer depois da assinatura, inclusive acentuação")
	inicio, completo, err := LerAssinatura(bytes.NewReader(original))
	if err != nil {
		t.Fatalf("LerAssinatura: %v", err)
	}
	if err := ValidarAssinaturaXLSX(inicio); err != nil {
		t.Fatalf("assinatura extraída deveria validar: %v", err)
	}

	lido, err := io.ReadAll(completo)
	if err != nil {
		t.Fatalf("ler o resto: %v", err)
	}
	if !bytes.Equal(lido, original) {
		t.Fatalf("conteúdo completo não bate: esperava %q, veio %q", original, lido)
	}
}

func TestLerAssinatura_ArquivoMenorQueAAssinatura(t *testing.T) {
	inicio, completo, err := LerAssinatura(bytes.NewReader([]byte("PK")))
	if err != nil {
		t.Fatalf("não deveria falhar em arquivo curto: %v", err)
	}
	if err := ValidarAssinaturaXLSX(inicio); err == nil {
		t.Error("esperava rejeição para arquivo menor que a assinatura")
	}
	lido, _ := io.ReadAll(completo)
	if string(lido) != "PK" {
		t.Fatalf("conteúdo deveria ser preservado mesmo curto, veio %q", lido)
	}
}

func TestNomeInterno_NuncaRepeteEIgnoraONomeOriginal(t *testing.T) {
	a := NomeInterno("upload", ".xlsx")
	b := NomeInterno("upload", ".xlsx")
	if a == b {
		t.Fatalf("dois nomes gerados vieram iguais: %q", a)
	}
	if filepath.Ext(a) != ".xlsx" {
		t.Fatalf("extensão não preservada: %q", a)
	}
}

func TestCaminhoDentroDaPasta(t *testing.T) {
	pasta := t.TempDir()
	dentro := filepath.Join(pasta, "upload-abc.xlsx")

	if !CaminhoDentroDaPasta(dentro, pasta) {
		t.Error("caminho legítimo dentro da pasta foi recusado")
	}

	// Path traversal: sobe um nível a partir da pasta de uploads.
	fora := filepath.Join(pasta, "..", "fora-da-pasta.xlsx")
	if CaminhoDentroDaPasta(fora, pasta) {
		t.Error("caminho fora da pasta (via ..) foi aceito")
	}

	// Caminho absoluto de outro lugar do disco inteiro.
	outraPasta := t.TempDir()
	if CaminhoDentroDaPasta(filepath.Join(outraPasta, "x.xlsx"), pasta) {
		t.Error("caminho absoluto de outra pasta foi aceito")
	}
}

// TestCaminhoDentroDaPasta_CasoReal reproduz o cenário do bug corrigido em
// ImportarConfirmar: um `caminho` de formulário adulterado tentando escapar da pasta de
// uploads real usada pelo processo.
func TestCaminhoDentroDaPasta_CasoReal(t *testing.T) {
	raiz := t.TempDir()
	pastaUploads := filepath.Join(raiz, "dados")
	if err := os.MkdirAll(pastaUploads, 0o755); err != nil {
		t.Fatal(err)
	}
	segredo := filepath.Join(raiz, "segredo.txt")
	if err := os.WriteFile(segredo, []byte("não deveria ser lido"), 0o644); err != nil {
		t.Fatal(err)
	}

	adulterado := filepath.Join(pastaUploads, "..", "segredo.txt")
	if CaminhoDentroDaPasta(adulterado, pastaUploads) {
		t.Fatal("path traversal para fora da pasta de uploads não foi bloqueado")
	}
}
