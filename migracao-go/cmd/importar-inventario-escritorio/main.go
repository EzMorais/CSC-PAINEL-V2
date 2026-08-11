package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"siqueiracampos/servidor/internal/config"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	"siqueiracampos/servidor/internal/infrastructure/database"
)

type item struct {
	nome       string
	quantidade float64
	categoria  dominio.Categoria
}

var inventario = []item{
	{"Martelo", 2, dominio.CategoriaFerramenta}, {"Martelo de borracha", 12, dominio.CategoriaFerramenta},
	{"Alicate universal", 5, dominio.CategoriaFerramenta}, {"Alicate bico de papagaio", 6, dominio.CategoriaFerramenta},
	{"Alicate bico fino", 4, dominio.CategoriaFerramenta}, {"Esquadro", 4, dominio.CategoriaFerramenta},
	{"Nível de bolha", 4, dominio.CategoriaFerramenta}, {"Trena longa", 4, dominio.CategoriaFerramenta},
	{"Talhadeira", 34, dominio.CategoriaFerramenta}, {"Marreta 1kg", 4, dominio.CategoriaFerramenta},
	{"Marreta 1,5kg", 2, dominio.CategoriaFerramenta}, {"Marreta 2kg", 4, dominio.CategoriaFerramenta},
	{"Chave de boca 13/16", 3, dominio.CategoriaFerramenta}, {"Chave de boca 21", 1, dominio.CategoriaFerramenta},
	{"Chave de boca 22", 1, dominio.CategoriaFerramenta}, {"Chave de boca 23", 1, dominio.CategoriaFerramenta},
	{"Chave de boca 26", 3, dominio.CategoriaFerramenta}, {"Chave de boca 30", 1, dominio.CategoriaFerramenta},
	{"Chave de boca 32", 2, dominio.CategoriaFerramenta}, {"Chave ajustável 300mm", 3, dominio.CategoriaFerramenta},
	{"Chave ajustável 375mm", 1, dominio.CategoriaFerramenta}, {"Arco de serra", 3, dominio.CategoriaFerramenta},
	{"Broca (geral)", 34, dominio.CategoriaFerramenta}, {"Broca 0,7mm", 1, dominio.CategoriaFerramenta},
	{"Broca 17mm", 1, dominio.CategoriaFerramenta}, {"Ponteiro", 32, dominio.CategoriaFerramenta},
	{"Ponteiro para martelete", 30, dominio.CategoriaFerramenta},

	{"Camiseta de obra cinza - PP", 0, dominio.CategoriaEPI}, {"Camiseta de obra cinza - P", 0, dominio.CategoriaEPI},
	{"Camiseta de obra cinza - M", 3, dominio.CategoriaEPI}, {"Camiseta de obra cinza - G", 4, dominio.CategoriaEPI},
	{"Camiseta de obra cinza - GG", 0, dominio.CategoriaEPI}, {"Camiseta de obra cinza - XG", 61, dominio.CategoriaEPI},
	{"Camiseta de escritório azul - PP", 0, dominio.CategoriaEPI}, {"Camiseta de escritório azul - P", 0, dominio.CategoriaEPI},
	{"Camiseta de escritório azul - M", 0, dominio.CategoriaEPI}, {"Camiseta de escritório azul - G", 2, dominio.CategoriaEPI},
	{"Camiseta de escritório azul - GG", 0, dominio.CategoriaEPI}, {"Camiseta de escritório azul - XG", 2, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 36", 1, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 38", 0, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 40", 1, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 42", 0, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 44", 2, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 46", 2, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 48", 10, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 50", 5, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 52", 0, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 54", 0, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 56", 11, dominio.CategoriaEPI}, {"Calça de obra com refletivo - 58", 0, dominio.CategoriaEPI},
	{"Calça de obra com refletivo - 60", 0, dominio.CategoriaEPI},
	{"Capacete de segurança - Cinza", 19, dominio.CategoriaEPI}, {"Capacete de segurança - Outras cores", 13, dominio.CategoriaEPI},
	{"Jugular para capacete", 24, dominio.CategoriaEPI}, {"Respirador / máscara específica", 53, dominio.CategoriaEPI},
	{"Colete refletivo - P", 0, dominio.CategoriaEPI}, {"Colete refletivo - M", 0, dominio.CategoriaEPI},
	{"Colete refletivo - G", 5, dominio.CategoriaEPI}, {"Colete refletivo - GG", 0, dominio.CategoriaEPI},
	{"Capa de chuva - P", 0, dominio.CategoriaEPI}, {"Capa de chuva - M", 9, dominio.CategoriaEPI},
	{"Capa de chuva - G", 23, dominio.CategoriaEPI}, {"Capa de chuva - GG", 13, dominio.CategoriaEPI},
	{"Touca ninja", 46, dominio.CategoriaEPI}, {"Óculos de segurança - Incolor", 159, dominio.CategoriaEPI},
	{"Óculos de segurança - Escuro", 73, dominio.CategoriaEPI}, {"Protetor auricular - Plug", 226, dominio.CategoriaEPI},
	{"Protetor auricular - Concha", 12, dominio.CategoriaEPI}, {"Luva preta tato - G", 1, dominio.CategoriaEPI},
	{"Luva nitrílica - G", 1300, dominio.CategoriaEPI}, {"Luva pigmentada - G", 65, dominio.CategoriaEPI},
	{"Luva de proteção para obra", 0, dominio.CategoriaEPI}, {"Máscara de proteção", 0, dominio.CategoriaEPI},
	{"Botina de segurança - 36", 0, dominio.CategoriaEPI}, {"Botina de segurança - 37", 4, dominio.CategoriaEPI},
	{"Botina de segurança - 38", 4, dominio.CategoriaEPI}, {"Botina de segurança - 39", 4, dominio.CategoriaEPI},
	{"Botina de segurança - 40", 0, dominio.CategoriaEPI}, {"Botina de segurança - 41", 6, dominio.CategoriaEPI},
	{"Botina de segurança - 42", 4, dominio.CategoriaEPI}, {"Botina de segurança - 43", 3, dominio.CategoriaEPI},
	{"Botina de segurança - 44", 3, dominio.CategoriaEPI}, {"Botina de segurança - 45", 10, dominio.CategoriaEPI},
	{"Botina de segurança - 46", 0, dominio.CategoriaEPI},
}

func main() {
	ctx := context.Background()
	cfg := config.Carregar()
	db, err := database.Abrir(cfg.CaminhoBanco)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = database.AplicarMigracoes(db); err != nil {
		log.Fatal(err)
	}
	materiais := database.NovoEstoqueMaterialRepositorio(db)
	movimentos := database.NovoEstoqueMovimentacaoRepositorio(db)
	existentes, err := materiais.Listar(ctx, dominio.FiltrosMaterial{})
	if err != nil {
		log.Fatal(err)
	}
	porNome := make(map[string]*dominio.Material, len(existentes))
	for i := range existentes {
		porNome[strings.ToLower(existentes[i].Nome)] = &existentes[i]
	}
	responsavel := "Guilherme Bolina"
	documento := "Inventário escritório 11/08/2026"
	observacao := "Ajuste para saldo físico informado; responsável: Guilherme Bolina"
	criados, ajustados := 0, 0
	for i, entrada := range inventario {
		m := porNome[strings.ToLower(entrada.nome)]
		if m == nil {
			local := "Escritório (estoque principal)"
			m = &dominio.Material{Codigo: fmt.Sprintf("INV-20260811-%03d", i+1), Nome: entrada.nome, Categoria: entrada.categoria, Unidade: "UN", Localizacao: &local, Observacao: &documento}
			if err = materiais.Criar(ctx, m); err != nil {
				log.Fatalf("cadastrar %s: %v", entrada.nome, err)
			}
			porNome[strings.ToLower(entrada.nome)] = m
			criados++
		}
		saldo, e := materiais.SaldoDoMaterial(ctx, m.ID)
		if e != nil {
			log.Fatalf("saldo %s: %v", entrada.nome, e)
		}
		diferenca := entrada.quantidade - saldo
		if diferenca == 0 {
			continue
		}
		tipo := dominio.MovAjustePositivo
		if diferenca < 0 {
			tipo = dominio.MovAjusteNegativo
			diferenca = -diferenca
		}
		mov := &dominio.Movimentacao{Tipo: tipo, Quantidade: diferenca, Documento: &documento, Observacao: &observacao, OcorridoEm: time.Date(2026, 8, 11, 12, 0, 0, 0, time.Local), RegistradoPor: &responsavel, MaterialID: m.ID}
		if err = movimentos.Criar(ctx, mov); err != nil {
			log.Fatalf("ajustar %s: %v", entrada.nome, err)
		}
		ajustados++
	}
	fmt.Printf("Inventário aplicado: %d itens, %d cadastros novos, %d saldos ajustados no escritório.\n", len(inventario), criados, ajustados)
	if os.Getenv("DATABASE_PATH") == "" {
		fmt.Println("Aviso: DATABASE_PATH não informado; usado", cfg.CaminhoBanco)
	}
}
