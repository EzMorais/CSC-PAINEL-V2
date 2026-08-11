// Comando importar-programacao carrega a lista operacional de pessoas, funções e veículos.
// É idempotente: pessoas são identificadas pelo nome normalizado, funções pela sigla e
// veículos pela placa (ou pelo modelo, quando não há placa).
package main

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/infrastructure/database"
)

type pessoa struct {
	nome, funcao, sigla, tipo string
	ativo, ausente, motorista bool
	foto, ausencia            *string
}

type veiculo struct {
	modelo string
	placa  *string
}

func main() {
	if len(os.Args) != 2 {
		log.Fatal("uso: go run ./cmd/importar-programacao <arquivo.tsv>")
	}
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "portal.db"
	}
	db, err := database.Abrir(dbPath)
	if err != nil {
		log.Fatalf("abrir banco: %v", err)
	}
	defer db.Close()
	if err := database.AplicarMigracoes(db); err != nil {
		log.Fatalf("aplicar migrações: %v", err)
	}

	pessoas, veiculos, err := lerArquivo(os.Args[1])
	if err != nil {
		log.Fatalf("ler arquivo: %v", err)
	}
	if len(pessoas) == 0 || len(veiculos) == 0 {
		log.Fatalf("arquivo incompleto: %d pessoas e %d veículos", len(pessoas), len(veiculos))
	}

	resultado, err := importar(context.Background(), db, pessoas, veiculos)
	if err != nil {
		log.Fatalf("importar: %v", err)
	}
	fmt.Printf("Importação concluída: %d funções criadas, %d pessoas criadas, %d atualizadas, %d veículos criados e %d atualizados.\n",
		resultado.funcoesCriadas, resultado.pessoasCriadas, resultado.pessoasAtualizadas, resultado.veiculosCriados, resultado.veiculosAtualizados)
}

func lerArquivo(caminho string) ([]pessoa, []veiculo, error) {
	arquivo, err := os.Open(caminho)
	if err != nil {
		return nil, nil, err
	}
	defer arquivo.Close()

	var pessoas []pessoa
	var veiculos []veiculo
	secaoVeiculos := false
	scanner := bufio.NewScanner(arquivo)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	for scanner.Scan() {
		linha := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), "\ufeff"))
		if linha == "" {
			continue
		}
		campos := strings.Split(linha, "\t")
		for i := range campos {
			campos[i] = strings.TrimSpace(campos[i])
		}
		cabecalho := strings.ToUpper(campos[0])
		if cabecalho == "VEICULO" || cabecalho == "VEÍCULO" {
			secaoVeiculos = true
			continue
		}
		if strings.HasPrefix(cabecalho, "FUNCION") || cabecalho == "NOME" {
			continue
		}
		if secaoVeiculos {
			if campos[0] == "" {
				continue
			}
			var placa *string
			if len(campos) > 1 {
				placa = opcional(campos[1])
			}
			veiculos = append(veiculos, veiculo{modelo: campos[0], placa: placa})
			continue
		}
		if len(campos) < 6 {
			return nil, nil, fmt.Errorf("linha de funcionário inválida: %q", linha)
		}
		p := pessoa{nome: campos[0], funcao: campos[1], sigla: strings.ToUpper(campos[2]), tipo: strings.ToUpper(campos[3])}
		p.ativo = chave(campos[4]) == "SIM"
		p.ausente = campos[5] != "" && campos[5] != "-"
		p.ausencia = opcional(campos[5])
		if len(campos) > 6 {
			p.foto = opcional(campos[6])
		}
		p.motorista = p.sigla == "MOT" || strings.Contains(chave(p.funcao), "MOTORISTA")
		pessoas = append(pessoas, p)
	}
	return pessoas, veiculos, scanner.Err()
}

type resumo struct{ funcoesCriadas, pessoasCriadas, pessoasAtualizadas, veiculosCriados, veiculosAtualizados int }

func importar(ctx context.Context, db *sql.DB, pessoas []pessoa, veiculos []veiculo) (res resumo, err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return res, err
	}
	defer tx.Rollback()
	agora := time.Now().UTC().Format(time.RFC3339)

	funcoes := map[string]string{}
	rows, err := tx.QueryContext(ctx, `SELECT sigla, nome FROM programacao_funcoes`)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var sigla, nome string
		if err = rows.Scan(&sigla, &nome); err != nil {
			rows.Close()
			return res, err
		}
		funcoes[sigla] = nome
	}
	rows.Close()
	ordem := len(funcoes)
	for _, p := range pessoas {
		if _, existe := funcoes[p.sigla]; existe {
			continue
		}
		ordem++
		if _, err = tx.ExecContext(ctx, `INSERT INTO programacao_funcoes(id,sigla,nome,ordem,ativa,cor) VALUES(?,?,?,?,1,'#8B0000')`, uuid.NewString(), p.sigla, p.funcao, ordem); err != nil {
			return res, err
		}
		funcoes[p.sigla] = p.funcao
		res.funcoesCriadas++
	}

	for _, p := range pessoas {
		var id string
		err = tx.QueryRowContext(ctx, `SELECT id FROM programacao_funcionarios WHERE lower(trim(nome))=lower(trim(?)) LIMIT 1`, p.nome).Scan(&id)
		if err == sql.ErrNoRows {
			_, err = tx.ExecContext(ctx, `INSERT INTO programacao_funcionarios(id,nome,funcao_sigla,foto,ativo,ausente,ausente_obs,motorista,tipo,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?)`, uuid.NewString(), p.nome, p.sigla, p.foto, p.ativo, p.ausente, p.ausencia, p.motorista, p.tipo, agora)
			res.pessoasCriadas++
		} else if err == nil {
			_, err = tx.ExecContext(ctx, `UPDATE programacao_funcionarios SET nome=?,funcao_sigla=?,foto=COALESCE(?,foto),ativo=?,ausente=?,ausente_obs=?,motorista=?,tipo=? WHERE id=?`, p.nome, p.sigla, p.foto, p.ativo, p.ausente, p.ausencia, p.motorista, p.tipo, id)
			res.pessoasAtualizadas++
		}
		if err != nil {
			return res, fmt.Errorf("pessoa %s: %w", p.nome, err)
		}
	}

	for _, v := range veiculos {
		var id string
		if v.placa != nil {
			err = tx.QueryRowContext(ctx, `SELECT id FROM programacao_veiculos WHERE upper(replace(placa,'-',''))=upper(replace(?,'-','')) LIMIT 1`, *v.placa).Scan(&id)
		} else {
			err = tx.QueryRowContext(ctx, `SELECT id FROM programacao_veiculos WHERE placa IS NULL AND lower(trim(modelo))=lower(trim(?)) LIMIT 1`, v.modelo).Scan(&id)
		}
		if err == sql.ErrNoRows {
			_, err = tx.ExecContext(ctx, `INSERT INTO programacao_veiculos(id,modelo,placa,ativo,criado_em) VALUES(?,?,?,1,?)`, uuid.NewString(), v.modelo, v.placa, agora)
			res.veiculosCriados++
		} else if err == nil {
			_, err = tx.ExecContext(ctx, `UPDATE programacao_veiculos SET modelo=?,placa=?,ativo=1 WHERE id=?`, v.modelo, v.placa, id)
			res.veiculosAtualizados++
		}
		if err != nil {
			return res, fmt.Errorf("veículo %s: %w", v.modelo, err)
		}
	}
	return res, tx.Commit()
}

func opcional(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return nil
	}
	return &s
}

func chave(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
