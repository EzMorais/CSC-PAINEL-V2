package database

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/programacao"
)

type ProgramacaoRepositorio struct{ DB *sql.DB }

func NovoProgramacaoRepositorio(db *sql.DB) *ProgramacaoRepositorio {
	return &ProgramacaoRepositorio{DB: db}
}

func agoraRFC3339() string { return time.Now().UTC().Format(time.RFC3339) }

// inClausula preenche um `%s` com "?,?,?" pros ids dados, devolvendo a query pronta e os
// argumentos na mesma ordem.
func inClausula(modelo string, ids []string) (string, []any) {
	marcadores := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return fmt.Sprintf(modelo, marcadores), args
}

// ── Frentes ──────────────────────────────────────────────────────────────────────────────

const selFrente = `SELECT id,nome,cor,logo,ordem,colunas,obra_codigo,ativa,criado_em FROM programacao_frentes`

func scanFrente(s interface{ Scan(...any) error }) (dominio.Frente, error) {
	var f dominio.Frente
	var logo, obraCodigo sql.NullString
	var ativa int
	var criadoEm string
	err := s.Scan(&f.ID, &f.Nome, &f.Cor, &logo, &f.Ordem, &f.Colunas, &obraCodigo, &ativa, &criadoEm)
	f.Logo, f.ObraCodigo = txt(logo), txt(obraCodigo)
	f.Ativa = ativa != 0
	f.CriadoEm = tempo(criadoEm)
	return f, err
}

func (r *ProgramacaoRepositorio) ListarFrentes(ctx context.Context, ativas bool) ([]dominio.Frente, error) {
	q := selFrente
	if ativas {
		q += " WHERE ativa=1"
	}
	q += " ORDER BY ordem"
	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Frente
	for rows.Next() {
		f, err := scanFrente(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) BuscarFrente(ctx context.Context, id string) (*dominio.Frente, error) {
	f, err := scanFrente(r.DB.QueryRowContext(ctx, selFrente+" WHERE id=?", id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *ProgramacaoRepositorio) CriarFrente(ctx context.Context, f *dominio.Frente) error {
	f.ID = uuid.NewString()
	f.CriadoEm = time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_frentes(id,nome,cor,logo,ordem,colunas,obra_codigo,ativa,criado_em)VALUES(?,?,?,?,?,?,?,1,?)`,
		f.ID, f.Nome, f.Cor, f.Logo, f.Ordem, f.Colunas, f.ObraCodigo, f.CriadoEm.Format(time.RFC3339))
	return err
}

func (r *ProgramacaoRepositorio) AtualizarFrente(ctx context.Context, f *dominio.Frente) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_frentes SET nome=?,cor=?,logo=?,colunas=?,obra_codigo=? WHERE id=?`,
		f.Nome, f.Cor, f.Logo, f.Colunas, f.ObraCodigo, f.ID)
	return err
}

func (r *ProgramacaoRepositorio) AlternarFrente(ctx context.Context, id string, ativa bool) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_frentes SET ativa=? WHERE id=?`, ativa, id)
	return err
}

func (r *ProgramacaoRepositorio) ApagarFrente(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM programacao_frentes WHERE id=?`, id)
	return err
}

func (r *ProgramacaoRepositorio) ContarUsosFrente(ctx context.Context, id string) (int, error) {
	var n int
	err := r.DB.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM programacao_escalas WHERE frente_id=?)+(SELECT count(*) FROM programacao_recursos WHERE frente_id=?)`, id, id).Scan(&n)
	return n, err
}

func (r *ProgramacaoRepositorio) ReordenarFrentes(ctx context.Context, idA string, ordemA int, idB string, ordemB int) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE programacao_frentes SET ordem=? WHERE id=?`, ordemA, idA); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE programacao_frentes SET ordem=? WHERE id=?`, ordemB, idB); err != nil {
		return err
	}
	return tx.Commit()
}

// ── Funções ──────────────────────────────────────────────────────────────────────────────

const selFuncao = `SELECT id,sigla,nome,cargo_rh,ordem,ativa,cor FROM programacao_funcoes`

func scanFuncao(s interface{ Scan(...any) error }) (dominio.Funcao, error) {
	var f dominio.Funcao
	var cargoRh sql.NullString
	var ativa int
	err := s.Scan(&f.ID, &f.Sigla, &f.Nome, &cargoRh, &f.Ordem, &ativa, &f.Cor)
	f.CargoRH = txt(cargoRh)
	f.Ativa = ativa != 0
	return f, err
}

func (r *ProgramacaoRepositorio) ListarFuncoes(ctx context.Context, ativas bool) ([]dominio.Funcao, error) {
	q := selFuncao
	if ativas {
		q += " WHERE ativa=1"
	}
	q += " ORDER BY ordem"
	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Funcao
	for rows.Next() {
		f, err := scanFuncao(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) CriarFuncao(ctx context.Context, f *dominio.Funcao) error {
	f.ID = uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_funcoes(id,sigla,nome,cargo_rh,ordem,ativa,cor)VALUES(?,?,?,?,?,1,?)`,
		f.ID, f.Sigla, f.Nome, f.CargoRH, f.Ordem, f.Cor)
	return err
}

// AtualizarFuncao só toca nos campos editáveis pela tela — ordem e ativa mudam por
// AlternarFuncao/reordenação, não por aqui.
func (r *ProgramacaoRepositorio) AtualizarFuncao(ctx context.Context, f *dominio.Funcao) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_funcoes SET sigla=?,nome=?,cargo_rh=?,cor=? WHERE id=?`,
		f.Sigla, f.Nome, f.CargoRH, f.Cor, f.ID)
	return err
}

func (r *ProgramacaoRepositorio) AlternarFuncao(ctx context.Context, id string, ativa bool) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_funcoes SET ativa=? WHERE id=?`, ativa, id)
	return err
}

// ── Funcionários (cadastro local) ───────────────────────────────────────────────────────

const selFuncionario = `SELECT id,nome,funcao_sigla,foto,ativo,ausente,ausente_obs,motorista,tipo,criado_em FROM programacao_funcionarios`

func scanFuncionario(s interface{ Scan(...any) error }) (dominio.Funcionario, error) {
	var f dominio.Funcionario
	var funcaoSigla, foto, ausenteObs sql.NullString
	var ativo, ausente, motorista int
	var criadoEm string
	err := s.Scan(&f.ID, &f.Nome, &funcaoSigla, &foto, &ativo, &ausente, &ausenteObs, &motorista, &f.Tipo, &criadoEm)
	f.FuncaoSigla, f.Foto, f.AusenteObs = txt(funcaoSigla), txt(foto), txt(ausenteObs)
	f.Ativo, f.Ausente, f.Motorista = ativo != 0, ausente != 0, motorista != 0
	f.CriadoEm = tempo(criadoEm)
	return f, err
}

func (r *ProgramacaoRepositorio) ListarFuncionarios(ctx context.Context, somenteAtivos bool) ([]dominio.Funcionario, error) {
	q := selFuncionario
	if somenteAtivos {
		q += " WHERE ativo=1"
	}
	q += " ORDER BY nome"
	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Funcionario
	for rows.Next() {
		f, err := scanFuncionario(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) BuscarFuncionario(ctx context.Context, id string) (*dominio.Funcionario, error) {
	f, err := scanFuncionario(r.DB.QueryRowContext(ctx, selFuncionario+" WHERE id=?", id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *ProgramacaoRepositorio) BuscarFuncionarios(ctx context.Context, ids []string) ([]dominio.Funcionario, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	q, args := inClausula(selFuncionario+" WHERE id IN (%s)", ids)
	rows, err := r.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Funcionario
	for rows.Next() {
		f, err := scanFuncionario(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) CriarFuncionario(ctx context.Context, f *dominio.Funcionario) error {
	f.ID = uuid.NewString()
	f.CriadoEm = time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_funcionarios(id,nome,funcao_sigla,foto,ativo,ausente,motorista,tipo,criado_em)VALUES(?,?,?,?,1,0,?,?,?)`,
		f.ID, f.Nome, f.FuncaoSigla, f.Foto, f.Motorista, f.Tipo, f.CriadoEm.Format(time.RFC3339))
	return err
}

func (r *ProgramacaoRepositorio) AtualizarFuncionario(ctx context.Context, f *dominio.Funcionario) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_funcionarios SET nome=?,funcao_sigla=?,foto=?,motorista=?,tipo=? WHERE id=?`,
		f.Nome, f.FuncaoSigla, f.Foto, f.Motorista, f.Tipo, f.ID)
	return err
}

func (r *ProgramacaoRepositorio) AlternarFuncionarioAtivo(ctx context.Context, id string, ativo bool) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_funcionarios SET ativo=? WHERE id=?`, ativo, id)
	return err
}

func (r *ProgramacaoRepositorio) AlternarFuncionarioAusente(ctx context.Context, id string, ausente bool, obs *string) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_funcionarios SET ausente=?,ausente_obs=? WHERE id=?`, ausente, obs, id)
	return err
}

// ── Veículos (cadastro local) ───────────────────────────────────────────────────────────

const selVeiculo = `SELECT id,modelo,placa,motorista_nome,foto,ativo,criado_em FROM programacao_veiculos`

func scanVeiculo(s interface{ Scan(...any) error }) (dominio.Veiculo, error) {
	var v dominio.Veiculo
	var placa, motoristaNome, foto sql.NullString
	var ativo int
	var criadoEm string
	err := s.Scan(&v.ID, &v.Modelo, &placa, &motoristaNome, &foto, &ativo, &criadoEm)
	v.Placa, v.MotoristaNome, v.Foto = txt(placa), txt(motoristaNome), txt(foto)
	v.Ativo = ativo != 0
	v.CriadoEm = tempo(criadoEm)
	return v, err
}

func (r *ProgramacaoRepositorio) ListarVeiculos(ctx context.Context, somenteAtivos bool) ([]dominio.Veiculo, error) {
	q := selVeiculo
	if somenteAtivos {
		q += " WHERE ativo=1"
	}
	q += " ORDER BY modelo"
	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.Veiculo
	for rows.Next() {
		v, err := scanVeiculo(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) CriarVeiculo(ctx context.Context, v *dominio.Veiculo) error {
	v.ID = uuid.NewString()
	v.CriadoEm = time.Now().UTC()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_veiculos(id,modelo,placa,motorista_nome,foto,ativo,criado_em)VALUES(?,?,?,?,?,1,?)`,
		v.ID, v.Modelo, v.Placa, v.MotoristaNome, v.Foto, v.CriadoEm.Format(time.RFC3339))
	return err
}

func (r *ProgramacaoRepositorio) AtualizarVeiculo(ctx context.Context, v *dominio.Veiculo) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_veiculos SET modelo=?,placa=?,motorista_nome=?,foto=? WHERE id=?`,
		v.Modelo, v.Placa, v.MotoristaNome, v.Foto, v.ID)
	return err
}

func (r *ProgramacaoRepositorio) AlternarVeiculoAtivo(ctx context.Context, id string, ativo bool) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_veiculos SET ativo=? WHERE id=?`, ativo, id)
	return err
}

// ── Programação do dia ──────────────────────────────────────────────────────────────────

const selEscala = `SELECT id,programacao_id,frente_id,funcionario_id,funcionario_local_id,nome,funcao_sigla,ordem,observacao FROM programacao_escalas`
const selRecurso = `SELECT id,programacao_id,frente_id,tipo,placa,descricao,motorista_nome,destaque,veiculo_local_id,ordem FROM programacao_recursos`

func scanEscala(s interface{ Scan(...any) error }) (dominio.Escala, error) {
	var e dominio.Escala
	var funcionarioID, funcionarioLocalID, funcaoSigla, observacao sql.NullString
	err := s.Scan(&e.ID, &e.ProgramacaoID, &e.FrenteID, &funcionarioID, &funcionarioLocalID, &e.Nome, &funcaoSigla, &e.Ordem, &observacao)
	e.FuncionarioID, e.FuncionarioLocalID, e.FuncaoSigla, e.Observacao = txt(funcionarioID), txt(funcionarioLocalID), txt(funcaoSigla), txt(observacao)
	return e, err
}
func scanRecurso(s interface{ Scan(...any) error }) (dominio.Recurso, error) {
	var rc dominio.Recurso
	var placa, motoristaNome, veiculoLocalID sql.NullString
	var tipo string
	var destaque int
	err := s.Scan(&rc.ID, &rc.ProgramacaoID, &rc.FrenteID, &tipo, &placa, &rc.Descricao, &motoristaNome, &destaque, &veiculoLocalID, &rc.Ordem)
	rc.Tipo = dominio.TipoRecurso(tipo)
	rc.Placa, rc.MotoristaNome, rc.VeiculoLocalID = txt(placa), txt(motoristaNome), txt(veiculoLocalID)
	rc.Destaque = destaque != 0
	return rc, err
}

func (r *ProgramacaoRepositorio) carregarEscalasRecursos(ctx context.Context, programacaoID string) ([]dominio.Escala, []dominio.Recurso, error) {
	linhasE, err := r.DB.QueryContext(ctx, selEscala+" WHERE programacao_id=? ORDER BY frente_id,ordem", programacaoID)
	if err != nil {
		return nil, nil, err
	}
	defer linhasE.Close()
	var escalas []dominio.Escala
	for linhasE.Next() {
		e, err := scanEscala(linhasE)
		if err != nil {
			return nil, nil, err
		}
		escalas = append(escalas, e)
	}
	if err = linhasE.Err(); err != nil {
		return nil, nil, err
	}

	linhasR, err := r.DB.QueryContext(ctx, selRecurso+" WHERE programacao_id=? ORDER BY frente_id,ordem", programacaoID)
	if err != nil {
		return nil, nil, err
	}
	defer linhasR.Close()
	var recursos []dominio.Recurso
	for linhasR.Next() {
		rc, err := scanRecurso(linhasR)
		if err != nil {
			return nil, nil, err
		}
		recursos = append(recursos, rc)
	}
	return escalas, recursos, linhasR.Err()
}

func scanProgramacao(s interface{ Scan(...any) error }) (dominio.Programacao, error) {
	var p dominio.Programacao
	var data, status, criadoEm, atualizadoEm string
	var publicadaEm, publicadaPor, observacao sql.NullString
	err := s.Scan(&p.ID, &data, &status, &publicadaEm, &publicadaPor, &observacao, &criadoEm, &atualizadoEm)
	p.Data = tempo(data)
	p.Status = dominio.StatusProgramacao(status)
	if publicadaEm.Valid {
		t := tempo(publicadaEm.String)
		p.PublicadaEm = &t
	}
	p.PublicadaPor, p.Observacao = txt(publicadaPor), txt(observacao)
	p.CriadoEm, p.AtualizadoEm = tempo(criadoEm), tempo(atualizadoEm)
	return p, err
}

const selProgramacao = `SELECT id,data,status,publicada_em,publicada_por,observacao,criado_em,atualizado_em FROM programacoes`

func (r *ProgramacaoRepositorio) ProgramacaoDoDia(ctx context.Context, data time.Time) (*dominio.Programacao, error) {
	p, err := scanProgramacao(r.DB.QueryRowContext(ctx, selProgramacao+" WHERE data=?", data.Format(time.DateOnly)))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.Escalas, p.Recursos, err = r.carregarEscalasRecursos(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProgramacaoRepositorio) UltimaProgramacaoAntesDe(ctx context.Context, data time.Time) (*dominio.Programacao, error) {
	p, err := scanProgramacao(r.DB.QueryRowContext(ctx, selProgramacao+" WHERE data<? ORDER BY data DESC LIMIT 1", data.Format(time.DateOnly)))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.Escalas, p.Recursos, err = r.carregarEscalasRecursos(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProgramacaoRepositorio) DiasRecentes(ctx context.Context, limite int) ([]dominio.DiaListado, error) {
	rows, err := r.DB.QueryContext(ctx, `SELECT p.id,p.data,p.status,(SELECT count(*) FROM programacao_escalas e WHERE e.programacao_id=p.id) FROM programacoes p ORDER BY p.data DESC LIMIT ?`, limite)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dominio.DiaListado
	for rows.Next() {
		var d dominio.DiaListado
		var data, status string
		if err = rows.Scan(&d.ID, &data, &status, &d.Escalas); err != nil {
			return nil, err
		}
		d.Data, d.Status = tempo(data), dominio.StatusProgramacao(status)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *ProgramacaoRepositorio) CriarOuObterDia(ctx context.Context, data time.Time) (*dominio.Programacao, error) {
	existente, err := r.ProgramacaoDoDia(ctx, data)
	if err != nil {
		return nil, err
	}
	if existente != nil {
		return existente, nil
	}
	agora := agoraRFC3339()
	id := uuid.NewString()
	_, err = r.DB.ExecContext(ctx, `INSERT INTO programacoes(id,data,status,criado_em,atualizado_em)VALUES(?,?,'RASCUNHO',?,?) ON CONFLICT(data) DO NOTHING`,
		id, data.Format(time.DateOnly), agora, agora)
	if err != nil {
		return nil, err
	}
	return r.ProgramacaoDoDia(ctx, data)
}

func (r *ProgramacaoRepositorio) Publicar(ctx context.Context, data time.Time, publicadaPor string) error {
	agora := agoraRFC3339()
	res, err := r.DB.ExecContext(ctx, `UPDATE programacoes SET status='PUBLICADA',publicada_em=?,publicada_por=?,atualizado_em=? WHERE data=?`,
		agora, publicadaPor, agora, data.Format(time.DateOnly))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("não há programação nesse dia")
	}
	return nil
}

// SubstituirDia apaga escalas/recursos do dia de destino e recria a partir do que foi
// passado — usado por CopiarDe. Numa transação só: se apagar der certo e criar falhar, o
// dia não fica vazio sem ninguém ter pedido isso.
func (r *ProgramacaoRepositorio) SubstituirDia(ctx context.Context, programacaoID string, escalas []dominio.Escala, recursos []dominio.Recurso) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err = tx.ExecContext(ctx, `DELETE FROM programacao_escalas WHERE programacao_id=?`, programacaoID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM programacao_recursos WHERE programacao_id=?`, programacaoID); err != nil {
		return err
	}
	for _, e := range escalas {
		if _, err = tx.ExecContext(ctx, `INSERT INTO programacao_escalas(id,programacao_id,frente_id,funcionario_id,funcionario_local_id,nome,funcao_sigla,ordem,observacao)VALUES(?,?,?,?,?,?,?,?,?)`,
			uuid.NewString(), programacaoID, e.FrenteID, e.FuncionarioID, e.FuncionarioLocalID, e.Nome, e.FuncaoSigla, e.Ordem, e.Observacao); err != nil {
			return err
		}
	}
	for _, rc := range recursos {
		if _, err = tx.ExecContext(ctx, `INSERT INTO programacao_recursos(id,programacao_id,frente_id,tipo,placa,descricao,motorista_nome,destaque,veiculo_local_id,ordem)VALUES(?,?,?,?,?,?,?,?,?,?)`,
			uuid.NewString(), programacaoID, rc.FrenteID, string(rc.Tipo), rc.Placa, rc.Descricao, rc.MotoristaNome, rc.Destaque, rc.VeiculoLocalID, rc.Ordem); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ── Escalas ──────────────────────────────────────────────────────────────────────────────

func (r *ProgramacaoRepositorio) UltimaOrdemEscala(ctx context.Context, programacaoID, frenteID string) (int, error) {
	var ordem sql.NullInt64
	err := r.DB.QueryRowContext(ctx, `SELECT max(ordem) FROM programacao_escalas WHERE programacao_id=? AND frente_id=?`, programacaoID, frenteID).Scan(&ordem)
	return int(ordem.Int64), err
}

func (r *ProgramacaoRepositorio) CriarEscala(ctx context.Context, e *dominio.Escala) error {
	e.ID = uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_escalas(id,programacao_id,frente_id,funcionario_id,funcionario_local_id,nome,funcao_sigla,ordem,observacao)VALUES(?,?,?,?,?,?,?,?,?)`,
		e.ID, e.ProgramacaoID, e.FrenteID, e.FuncionarioID, e.FuncionarioLocalID, e.Nome, e.FuncaoSigla, e.Ordem, e.Observacao)
	return err
}

func (r *ProgramacaoRepositorio) BuscarEscala(ctx context.Context, id string) (*dominio.Escala, time.Time, error) {
	var e dominio.Escala
	var data string
	linha := r.DB.QueryRowContext(ctx, `SELECT e.id,e.programacao_id,e.frente_id,e.funcionario_id,e.funcionario_local_id,e.nome,e.funcao_sigla,e.ordem,e.observacao,p.data FROM programacao_escalas e JOIN programacoes p ON p.id=e.programacao_id WHERE e.id=?`, id)
	var funcionarioID, funcionarioLocalID, funcaoSigla, observacao sql.NullString
	err := linha.Scan(&e.ID, &e.ProgramacaoID, &e.FrenteID, &funcionarioID, &funcionarioLocalID, &e.Nome, &funcaoSigla, &e.Ordem, &observacao, &data)
	if err == sql.ErrNoRows {
		return nil, time.Time{}, nil
	}
	if err != nil {
		return nil, time.Time{}, err
	}
	e.FuncionarioID, e.FuncionarioLocalID, e.FuncaoSigla, e.Observacao = txt(funcionarioID), txt(funcionarioLocalID), txt(funcaoSigla), txt(observacao)
	return &e, tempo(data), nil
}

func (r *ProgramacaoRepositorio) BuscarEscalaPorNomeNaFrente(ctx context.Context, programacaoID, frenteID, nome string) (*dominio.Escala, error) {
	e, err := scanEscala(r.DB.QueryRowContext(ctx, selEscala+` WHERE programacao_id=? AND frente_id=? AND nome=?`, programacaoID, frenteID, nome))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *ProgramacaoRepositorio) MoverEscala(ctx context.Context, id, frenteID string, ordem int) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_escalas SET frente_id=?,ordem=? WHERE id=?`, frenteID, ordem, id)
	return err
}

func (r *ProgramacaoRepositorio) TirarEscala(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM programacao_escalas WHERE id=?`, id)
	return err
}

func (r *ProgramacaoRepositorio) TrocarFuncaoEscala(ctx context.Context, id string, funcaoSigla *string) error {
	_, err := r.DB.ExecContext(ctx, `UPDATE programacao_escalas SET funcao_sigla=? WHERE id=?`, funcaoSigla, id)
	return err
}

// ── Recursos ─────────────────────────────────────────────────────────────────────────────

func (r *ProgramacaoRepositorio) UltimaOrdemRecurso(ctx context.Context, programacaoID, frenteID string) (int, error) {
	var ordem sql.NullInt64
	err := r.DB.QueryRowContext(ctx, `SELECT max(ordem) FROM programacao_recursos WHERE programacao_id=? AND frente_id=?`, programacaoID, frenteID).Scan(&ordem)
	return int(ordem.Int64), err
}

func (r *ProgramacaoRepositorio) CriarRecurso(ctx context.Context, rc *dominio.Recurso) error {
	rc.ID = uuid.NewString()
	_, err := r.DB.ExecContext(ctx, `INSERT INTO programacao_recursos(id,programacao_id,frente_id,tipo,placa,descricao,motorista_nome,destaque,veiculo_local_id,ordem)VALUES(?,?,?,?,?,?,?,?,?,?)`,
		rc.ID, rc.ProgramacaoID, rc.FrenteID, string(rc.Tipo), rc.Placa, rc.Descricao, rc.MotoristaNome, rc.Destaque, rc.VeiculoLocalID, rc.Ordem)
	return err
}

func (r *ProgramacaoRepositorio) BuscarRecurso(ctx context.Context, id string) (*dominio.Recurso, time.Time, error) {
	var rc dominio.Recurso
	var data, tipo string
	var placa, motoristaNome, veiculoLocalID sql.NullString
	var destaque int
	linha := r.DB.QueryRowContext(ctx, `SELECT r.id,r.programacao_id,r.frente_id,r.tipo,r.placa,r.descricao,r.motorista_nome,r.destaque,r.veiculo_local_id,r.ordem,p.data FROM programacao_recursos r JOIN programacoes p ON p.id=r.programacao_id WHERE r.id=?`, id)
	err := linha.Scan(&rc.ID, &rc.ProgramacaoID, &rc.FrenteID, &tipo, &placa, &rc.Descricao, &motoristaNome, &destaque, &veiculoLocalID, &rc.Ordem, &data)
	if err == sql.ErrNoRows {
		return nil, time.Time{}, nil
	}
	if err != nil {
		return nil, time.Time{}, err
	}
	rc.Tipo = dominio.TipoRecurso(tipo)
	rc.Placa, rc.MotoristaNome, rc.VeiculoLocalID = txt(placa), txt(motoristaNome), txt(veiculoLocalID)
	rc.Destaque = destaque != 0
	return &rc, tempo(data), nil
}

func (r *ProgramacaoRepositorio) TirarRecurso(ctx context.Context, id string) error {
	_, err := r.DB.ExecContext(ctx, `DELETE FROM programacao_recursos WHERE id=?`, id)
	return err
}
