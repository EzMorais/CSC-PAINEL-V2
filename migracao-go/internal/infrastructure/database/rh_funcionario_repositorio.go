package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"siqueiracampos/servidor/internal/domain/rh"
)

type RHFuncionarioRepositorio struct{ DB *sql.DB }

func NovoRHFuncionarioRepositorio(db *sql.DB) *RHFuncionarioRepositorio {
	return &RHFuncionarioRepositorio{DB: db}
}

const colunasFuncionario = `
	id, matricula, nome, cpf, rg, data_nascimento, sexo, estado_civil, nome_mae, foto,
	telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf,
	status, admitido_em, demitido_em, motivo_saida, salario, tipo_contrato,
	banco, agencia, conta, tipo_conta, chave_pix,
	tamanho_camisa, tamanho_calca, tamanho_calcado, observacoes, nivel_obra, criado_em,
	obra_id, cargo_id, departamento_id`

func lerFuncionario(linha linhaEscaneavel) (*rh.Funcionario, error) {
	var f rh.Funcionario
	var rg, sexo, estadoCivil, nomeMae, foto, telefone, email sql.NullString
	var cep, logradouro, numero, complemento, bairro, cidade, uf sql.NullString
	var dataNascimento, demitidoEm, motivoSaida sql.NullString
	var salario sql.NullFloat64
	var banco, agencia, conta, tipoConta, chavePix sql.NullString
	var tamanhoCamisa, tamanhoCalca, tamanhoCalcado, observacoes, nivelObra sql.NullString
	var criadoEm, admitidoEm string
	var obraID, cargoID, departamentoID sql.NullString

	if err := linha.Scan(
		&f.ID, &f.Matricula, &f.Nome, &f.CPF, &rg, &dataNascimento, &sexo, &estadoCivil, &nomeMae, &foto,
		&telefone, &email, &cep, &logradouro, &numero, &complemento, &bairro, &cidade, &uf,
		&f.Status, &admitidoEm, &demitidoEm, &motivoSaida, &salario, &f.TipoContrato,
		&banco, &agencia, &conta, &tipoConta, &chavePix,
		&tamanhoCamisa, &tamanhoCalca, &tamanhoCalcado, &observacoes, &nivelObra, &criadoEm,
		&obraID, &cargoID, &departamentoID,
	); err != nil {
		return nil, err
	}

	f.RG, f.Sexo, f.EstadoCivil, f.NomeMae, f.Foto = txt(rg), txt(sexo), txt(estadoCivil), txt(nomeMae), txt(foto)
	f.Telefone, f.Email = txt(telefone), txt(email)
	f.CEP, f.Logradouro, f.Numero, f.Complemento, f.Bairro, f.Cidade, f.UF = txt(cep), txt(logradouro), txt(numero), txt(complemento), txt(bairro), txt(cidade), txt(uf)
	f.DataNascimento = parseRFC3339Ptr(dataNascimento)
	f.DemitidoEm = parseRFC3339Ptr(demitidoEm)
	f.MotivoSaida = txt(motivoSaida)
	if salario.Valid {
		f.Salario = &salario.Float64
	}
	f.Banco, f.Agencia, f.Conta, f.TipoConta, f.ChavePix = txt(banco), txt(agencia), txt(conta), txt(tipoConta), txt(chavePix)
	f.TamanhoCamisa, f.TamanhoCalca, f.TamanhoCalcado = txt(tamanhoCamisa), txt(tamanhoCalca), txt(tamanhoCalcado)
	f.Observacoes, f.NivelObra = txt(observacoes), txt(nivelObra)
	f.AdmitidoEm, _ = time.Parse(time.RFC3339, admitidoEm)
	f.CriadoEm, _ = time.Parse(time.RFC3339, criadoEm)
	f.ObraID, f.CargoID, f.DepartamentoID = txt(obraID), txt(cargoID), txt(departamentoID)
	return &f, nil
}

func (r *RHFuncionarioRepositorio) buscar(ctx context.Context, condicao, arg string) (*rh.Funcionario, error) {
	linha := r.DB.QueryRowContext(ctx, `SELECT `+colunasFuncionario+` FROM funcionarios WHERE `+condicao, arg)
	f, err := lerFuncionario(linha)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return f, err
}

func (r *RHFuncionarioRepositorio) BuscarPorID(ctx context.Context, id string) (*rh.Funcionario, error) {
	return r.buscar(ctx, "id = ?", id)
}

func (r *RHFuncionarioRepositorio) BuscarPorCPF(ctx context.Context, cpf string) (*rh.Funcionario, error) {
	return r.buscar(ctx, "cpf = ?", cpf)
}

func (r *RHFuncionarioRepositorio) Listar(ctx context.Context, filtros rh.FiltrosFuncionario) ([]rh.Funcionario, error) {
	consulta := `SELECT ` + colunasFuncionario + ` FROM funcionarios WHERE 1=1`
	var args []any
	if busca := strings.TrimSpace(filtros.Busca); busca != "" {
		consulta += ` AND (nome LIKE ? OR matricula LIKE ?)`
		termo := "%" + busca + "%"
		args = append(args, termo, termo)
	}
	if filtros.Status != "" {
		consulta += ` AND status = ?`
		args = append(args, filtros.Status)
	}
	if filtros.ObraID != "" {
		consulta += ` AND obra_id = ?`
		args = append(args, filtros.ObraID)
	}
	if filtros.CargoID != "" {
		consulta += ` AND cargo_id = ?`
		args = append(args, filtros.CargoID)
	}
	consulta += ` ORDER BY nome ASC`

	linhas, err := r.DB.QueryContext(ctx, consulta, args...)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var fs []rh.Funcionario
	for linhas.Next() {
		f, err := lerFuncionario(linhas)
		if err != nil {
			return nil, err
		}
		fs = append(fs, *f)
	}
	return fs, linhas.Err()
}

// ListarAtivosParaIntegracao — ver COMPORTAMENTO.md §6: exclui DESLIGADO. A projeção que
// omite CPF/salário/endereço/telefone acontece na camada de aplicação (o repositório
// devolve a entidade inteira; minimizar dado é decisão do handler que monta a resposta),
// mesma responsabilidade que os outros módulos já seguem.
func (r *RHFuncionarioRepositorio) ListarAtivosParaIntegracao(ctx context.Context) ([]rh.Funcionario, error) {
	linhas, err := r.DB.QueryContext(ctx,
		`SELECT `+colunasFuncionario+` FROM funcionarios WHERE status != ? ORDER BY nome ASC`, rh.StatusDesligado)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var fs []rh.Funcionario
	for linhas.Next() {
		f, err := lerFuncionario(linhas)
		if err != nil {
			return nil, err
		}
		fs = append(fs, *f)
	}
	return fs, linhas.Err()
}

func (r *RHFuncionarioRepositorio) UltimaMatricula(ctx context.Context) (string, error) {
	var matricula string
	err := r.DB.QueryRowContext(ctx, `SELECT matricula FROM funcionarios ORDER BY matricula DESC LIMIT 1`).Scan(&matricula)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return matricula, err
}

func inserirFuncionario(ctx context.Context, tx *sql.Tx, id string, f *rh.Funcionario, agora string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO funcionarios (
			id, matricula, nome, cpf, rg, data_nascimento, sexo, estado_civil, nome_mae, foto,
			telefone, email, cep, logradouro, numero, complemento, bairro, cidade, uf,
			status, admitido_em, demitido_em, motivo_saida, salario, tipo_contrato,
			banco, agencia, conta, tipo_conta, chave_pix,
			tamanho_camisa, tamanho_calca, tamanho_calcado, observacoes, nivel_obra, criado_em,
			obra_id, cargo_id, departamento_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, f.Matricula, f.Nome, f.CPF, f.RG, rfc3339(f.DataNascimento), f.Sexo, f.EstadoCivil, f.NomeMae, f.Foto,
		f.Telefone, f.Email, f.CEP, f.Logradouro, f.Numero, f.Complemento, f.Bairro, f.Cidade, f.UF,
		f.Status, rfc3339(&f.AdmitidoEm), rfc3339(f.DemitidoEm), f.MotivoSaida, f.Salario, f.TipoContrato,
		f.Banco, f.Agencia, f.Conta, f.TipoConta, f.ChavePix,
		f.TamanhoCamisa, f.TamanhoCalca, f.TamanhoCalcado, f.Observacoes, f.NivelObra, agora,
		f.ObraID, f.CargoID, f.DepartamentoID,
	)
	return err
}

func atualizarFuncionarioTx(ctx context.Context, tx *sql.Tx, f *rh.Funcionario) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE funcionarios SET
			nome = ?, cpf = ?, rg = ?, data_nascimento = ?, sexo = ?, estado_civil = ?, nome_mae = ?, foto = ?,
			telefone = ?, email = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?,
			status = ?, admitido_em = ?, demitido_em = ?, motivo_saida = ?, salario = ?, tipo_contrato = ?,
			banco = ?, agencia = ?, conta = ?, tipo_conta = ?, chave_pix = ?,
			tamanho_camisa = ?, tamanho_calca = ?, tamanho_calcado = ?, observacoes = ?, nivel_obra = ?,
			obra_id = ?, cargo_id = ?, departamento_id = ?
		WHERE id = ?`,
		f.Nome, f.CPF, f.RG, rfc3339(f.DataNascimento), f.Sexo, f.EstadoCivil, f.NomeMae, f.Foto,
		f.Telefone, f.Email, f.CEP, f.Logradouro, f.Numero, f.Complemento, f.Bairro, f.Cidade, f.UF,
		f.Status, rfc3339(&f.AdmitidoEm), rfc3339(f.DemitidoEm), f.MotivoSaida, f.Salario, f.TipoContrato,
		f.Banco, f.Agencia, f.Conta, f.TipoConta, f.ChavePix,
		f.TamanhoCamisa, f.TamanhoCalca, f.TamanhoCalcado, f.Observacoes, f.NivelObra,
		f.ObraID, f.CargoID, f.DepartamentoID,
		f.ID,
	)
	return err
}

func gravarEventoTx(ctx context.Context, tx *sql.Tx, e *rh.Evento) error {
	id := uuid.NewString()
	registradoEm := e.RegistradoEm
	if registradoEm.IsZero() {
		registradoEm = time.Now().UTC()
	}
	_, err := tx.ExecContext(ctx, `
		INSERT INTO eventos (id, tipo, descricao_humana, detalhe, ocorrido_em, registrado_em, registrado_por, funcionario_id, obra_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, e.Tipo, e.DescricaoHumana, e.Detalhe, rfc3339(&e.OcorridoEm), rfc3339(&registradoEm), e.RegistradoPor, e.FuncionarioID, e.ObraID,
	)
	if err == nil {
		e.ID = id
	}
	return err
}

func traduzirErroFuncionario(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "UNIQUE constraint failed: funcionarios.cpf") {
		return rh.ErrCPFDuplicado
	}
	if strings.Contains(msg, "UNIQUE constraint failed: funcionarios.matricula") {
		return rh.ErrMatriculaDuplicada
	}
	return err
}

// Criar espelha `criarFuncionario` de actions/funcionarios.ts — grava o cadastro e o evento
// ADMISSAO numa transação só. Ver COMPORTAMENTO.md §3.
func (r *RHFuncionarioRepositorio) Criar(ctx context.Context, f *rh.Funcionario, eventoAdmissao *rh.Evento) error {
	id := uuid.NewString()
	agora := time.Now().UTC().Format(time.RFC3339)

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := inserirFuncionario(ctx, tx, id, f, agora); err != nil {
		return traduzirErroFuncionario(err)
	}
	eventoAdmissao.FuncionarioID = id
	if err := gravarEventoTx(ctx, tx, eventoAdmissao); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	f.ID = id
	return nil
}

// Atualizar espelha `editarFuncionario` — grava o cadastro e de 0 a 3 eventos automáticos
// (obra/cargo/status mudaram) na mesma transação. Ver COMPORTAMENTO.md §3.
func (r *RHFuncionarioRepositorio) Atualizar(ctx context.Context, f *rh.Funcionario, eventos []rh.Evento) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := atualizarFuncionarioTx(ctx, tx, f); err != nil {
		return traduzirErroFuncionario(err)
	}
	for i := range eventos {
		eventos[i].FuncionarioID = f.ID
		if err := gravarEventoTx(ctx, tx, &eventos[i]); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *RHFuncionarioRepositorio) ContarVinculos(ctx context.Context, funcionarioID string) (rh.VinculosFuncionario, error) {
	var v rh.VinculosFuncionario
	consultas := []struct {
		tabela string
		alvo   *int
	}{
		{"entregas_epi", &v.EntregasEpi},
		{"entregas_uniforme", &v.EntregasUniforme},
		{"exames", &v.Exames},
		{"treinamento_participantes", &v.Treinamentos},
		{"documentos", &v.Documentos},
		{"eventos", &v.Eventos},
		{"dependentes", &v.Dependentes},
	}
	for _, c := range consultas {
		if err := r.DB.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM `+c.tabela+` WHERE funcionario_id = ?`, funcionarioID,
		).Scan(c.alvo); err != nil {
			return v, err
		}
	}
	return v, nil
}

// Excluir — eventos e dependentes somem junto via ON DELETE CASCADE (0004_rh.sql). Só
// chamar depois de confirmar Vinculos.Total() == 0 (COMPORTAMENTO.md §4).
func (r *RHFuncionarioRepositorio) Excluir(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM funcionarios WHERE id = ?`, id)
	return err
}

func (r *RHFuncionarioRepositorio) ContarPorStatus(ctx context.Context) (map[string]int, error) {
	linhas, err := r.DB.QueryContext(ctx, `SELECT status, COUNT(*) FROM funcionarios GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	contagem := map[string]int{}
	for linhas.Next() {
		var status string
		var n int
		if err := linhas.Scan(&status, &n); err != nil {
			return nil, err
		}
		contagem[status] = n
	}
	return contagem, linhas.Err()
}

// ContarCadastrosIncompletos conta PESSOAS (não ocorrências) sem obra OU sem cargo —
// COMPORTAMENTO.md §8: quem não tem os dois só conta uma vez.
func (r *RHFuncionarioRepositorio) ContarCadastrosIncompletos(ctx context.Context) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM funcionarios WHERE obra_id IS NULL OR cargo_id IS NULL`,
	).Scan(&n)
	return n, err
}

func (r *RHFuncionarioRepositorio) ContarPorObra(ctx context.Context) (map[string]int, error) {
	linhas, err := r.DB.QueryContext(ctx,
		`SELECT obra_id, COUNT(*) FROM funcionarios WHERE obra_id IS NOT NULL GROUP BY obra_id`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	contagem := map[string]int{}
	for linhas.Next() {
		var obraID string
		var n int
		if err := linhas.Scan(&obraID, &n); err != nil {
			return nil, err
		}
		contagem[obraID] = n
	}
	return contagem, linhas.Err()
}

// ---------- Dependente ----------

type RHDependenteRepositorio struct{ DB *sql.DB }

func NovoRHDependenteRepositorio(db *sql.DB) *RHDependenteRepositorio {
	return &RHDependenteRepositorio{DB: db}
}

func lerDependente(linha linhaEscaneavel) (*rh.Dependente, error) {
	var d rh.Dependente
	var dataNascimento, cpf sql.NullString
	var irrf, salarioFamilia int
	if err := linha.Scan(&d.ID, &d.Nome, &d.Parentesco, &dataNascimento, &cpf, &irrf, &salarioFamilia, &d.FuncionarioID); err != nil {
		return nil, err
	}
	d.DataNascimento = parseRFC3339Ptr(dataNascimento)
	d.CPF = txt(cpf)
	d.IRRF = irrf != 0
	d.SalarioFamilia = salarioFamilia != 0
	return &d, nil
}

func (r *RHDependenteRepositorio) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]rh.Dependente, error) {
	linhas, err := r.DB.QueryContext(ctx, `
		SELECT id, nome, parentesco, data_nascimento, cpf, irrf, salario_familia, funcionario_id
		FROM dependentes WHERE funcionario_id = ? ORDER BY nome ASC`, funcionarioID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var deps []rh.Dependente
	for linhas.Next() {
		d, err := lerDependente(linhas)
		if err != nil {
			return nil, err
		}
		deps = append(deps, *d)
	}
	return deps, linhas.Err()
}

func (r *RHDependenteRepositorio) Criar(ctx context.Context, d *rh.Dependente) error {
	id := uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO dependentes (id, nome, parentesco, data_nascimento, cpf, irrf, salario_familia, funcionario_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, d.Nome, d.Parentesco, rfc3339(d.DataNascimento), d.CPF, boolParaInt(d.IRRF), boolParaInt(d.SalarioFamilia), d.FuncionarioID,
	)
	if err != nil {
		return err
	}
	d.ID = id
	return nil
}

func (r *RHDependenteRepositorio) Remover(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM dependentes WHERE id = ?`, id)
	return err
}

// ---------- Evento ----------

type RHEventoRepositorio struct{ DB *sql.DB }

func NovoRHEventoRepositorio(db *sql.DB) *RHEventoRepositorio { return &RHEventoRepositorio{DB: db} }

func lerEvento(linha linhaEscaneavel) (*rh.Evento, error) {
	var e rh.Evento
	var detalhe, registradoPor, obraID sql.NullString
	var ocorridoEm, registradoEm string
	if err := linha.Scan(&e.ID, &e.Tipo, &e.DescricaoHumana, &detalhe, &ocorridoEm, &registradoEm, &registradoPor, &e.FuncionarioID, &obraID); err != nil {
		return nil, err
	}
	e.Detalhe = txt(detalhe)
	e.OcorridoEm, _ = time.Parse(time.RFC3339, ocorridoEm)
	e.RegistradoEm, _ = time.Parse(time.RFC3339, registradoEm)
	e.RegistradoPor = txt(registradoPor)
	e.ObraID = txt(obraID)
	return &e, nil
}

const colunasEvento = `id, tipo, descricao_humana, detalhe, ocorrido_em, registrado_em, registrado_por, funcionario_id, obra_id`

func (r *RHEventoRepositorio) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]rh.Evento, error) {
	linhas, err := r.DB.QueryContext(ctx,
		`SELECT `+colunasEvento+` FROM eventos WHERE funcionario_id = ? ORDER BY ocorrido_em DESC, registrado_em DESC`, funcionarioID)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var eventos []rh.Evento
	for linhas.Next() {
		e, err := lerEvento(linhas)
		if err != nil {
			return nil, err
		}
		eventos = append(eventos, *e)
	}
	return eventos, linhas.Err()
}

func (r *RHEventoRepositorio) ListarRecentes(ctx context.Context, limite int) ([]rh.Evento, error) {
	linhas, err := r.DB.QueryContext(ctx,
		`SELECT `+colunasEvento+` FROM eventos ORDER BY registrado_em DESC LIMIT ?`, limite)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()

	var eventos []rh.Evento
	for linhas.Next() {
		e, err := lerEvento(linhas)
		if err != nil {
			return nil, err
		}
		eventos = append(eventos, *e)
	}
	return eventos, linhas.Err()
}

func (r *RHEventoRepositorio) Criar(ctx context.Context, e *rh.Evento) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := gravarEventoTx(ctx, tx, e); err != nil {
		return err
	}
	return tx.Commit()
}
