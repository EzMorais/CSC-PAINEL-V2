package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLerArquivo(t *testing.T) {
	dir := t.TempDir()
	arquivo := filepath.Join(dir, "lista.txt")
	conteudo := "FUNCIONÁRIOS\nNOME\tFUNÇÃO\tSIGLA\tTIPO\tATIVO\tAUSENCIA\tFOTO\n" +
		"JOÃO DA SILVA\tMOTORISTA\tMOT\tCSC\tSim\t-\t-\n\n" +
		"Veiculo\tPlaca\nRETROESCAVADEIRA\t-\nCAMINHÃO\tABC1D23\n"
	if err := os.WriteFile(arquivo, []byte(conteudo), 0600); err != nil {
		t.Fatal(err)
	}

	pessoas, veiculos, err := lerArquivo(arquivo)
	if err != nil {
		t.Fatal(err)
	}
	if len(pessoas) != 1 || pessoas[0].nome != "JOÃO DA SILVA" || !pessoas[0].motorista || pessoas[0].ausente {
		t.Fatalf("pessoa interpretada incorretamente: %+v", pessoas)
	}
	if len(veiculos) != 2 || veiculos[0].placa != nil || veiculos[1].placa == nil || *veiculos[1].placa != "ABC1D23" {
		t.Fatalf("veículos interpretados incorretamente: %+v", veiculos)
	}
}
