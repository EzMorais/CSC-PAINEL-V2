package database

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	dominio "siqueiracampos/servidor/internal/domain/alojamentos"
)

type AlojamentosRepositorio struct{ DB *sql.DB }

func NovoAlojamentosRepositorio(db *sql.DB) *AlojamentosRepositorio {
	return &AlojamentosRepositorio{DB: db}
}
func tempo(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	if t.IsZero() {
		t, _ = time.Parse(time.DateOnly, s)
	}
	return t
}
func nint(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}
func nflt(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	return &n.Float64
}
func parseTempoNulo(s sql.NullString) *time.Time {
	if !s.Valid {
		return nil
	}
	t := tempo(s.String)
	return &t
}

func (r *AlojamentosRepositorio) Indicadores(ctx context.Context) (i dominio.Indicadores, err error) {
	err = r.DB.QueryRowContext(ctx, `SELECT
 (SELECT count(*) FROM alojamentos WHERE ativo=1),
 (SELECT count(*) FROM alocacoes WHERE status='ATIVA'),
 max(0,(SELECT coalesce(sum(coalesce((SELECT sum(capacidade) FROM quartos q WHERE q.alojamento_id=a.id AND q.ativo=1),capacidade_total,0)),0) FROM alojamentos a WHERE ativo=1)-(SELECT count(*) FROM alocacoes WHERE status='ATIVA')),
 (SELECT count(*) FROM pedidos_alojamento WHERE status IN ('ABERTO','EM_ANDAMENTO'))`).Scan(&i.AlojamentosAtivos, &i.Moradores, &i.Vagas, &i.PedidosAbertos)
	return
}
func scanAloj(s interface{ Scan(...any) error }) (*dominio.Alojamento, error) {
	var a dominio.Alojamento
	var cep, lo, num, co, ba, ci, uf, rn, tr, gw, fo, ob sql.NullString
	var lat, lng sql.NullFloat64
	var cap sql.NullInt64
	var ativo int
	var cr, at string
	err := s.Scan(&a.ID, &a.Nome, &cep, &lo, &num, &co, &ba, &ci, &uf, &lat, &lng, &cap, &rn, &tr, &gw, &fo, &ob, &ativo, &cr, &at, &a.Ocupacao)
	a.CEP = txt(cep)
	a.Logradouro = txt(lo)
	a.Numero = txt(num)
	a.Complemento = txt(co)
	a.Bairro = txt(ba)
	a.Cidade = txt(ci)
	a.UF = txt(uf)
	a.Lat = nflt(lat)
	a.Lng = nflt(lng)
	a.CapacidadeTotal = nint(cap)
	a.ResponsavelNome = txt(rn)
	a.TelefoneResponsavel = txt(tr)
	a.GrupoWhatsappID = txt(gw)
	a.Foto = txt(fo)
	a.Observacoes = txt(ob)
	a.Ativo = ativo != 0
	a.CriadoEm = tempo(cr)
	a.AtualizadoEm = tempo(at)
	return &a, err
}

const selAloj = `SELECT a.id,a.nome,a.cep,a.logradouro,a.numero,a.complemento,a.bairro,a.cidade,a.uf,a.lat,a.lng,a.capacidade_total,a.responsavel_nome,a.telefone_responsavel,a.grupo_whatsapp_id,a.foto,a.observacoes,a.ativo,a.criado_em,a.atualizado_em,(SELECT count(*) FROM alocacoes x WHERE x.alojamento_id=a.id AND x.status='ATIVA') FROM alojamentos a`

func (r *AlojamentosRepositorio) ListarAlojamentos(ctx context.Context, ativos bool) ([]dominio.Alojamento, error) {
	q := selAloj
	if ativos {
		q += " WHERE a.ativo=1"
	}
	q += " ORDER BY a.nome"
	rows, e := r.DB.QueryContext(ctx, q)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Alojamento
	for rows.Next() {
		a, e := scanAloj(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}
func (r *AlojamentosRepositorio) BuscarAlojamento(ctx context.Context, id string) (*dominio.Alojamento, error) {
	a, e := scanAloj(r.DB.QueryRowContext(ctx, selAloj+" WHERE a.id=?", id))
	if e == sql.ErrNoRows {
		return nil, nil
	}
	if e != nil {
		return nil, e
	}
	rows, e := r.DB.QueryContext(ctx, `SELECT q.id,q.alojamento_id,q.numero,q.capacidade,q.tipo,q.observacoes,q.ativo,q.criado_em,(SELECT count(*) FROM alocacoes x WHERE x.quarto_id=q.id AND x.status='ATIVA') FROM quartos q WHERE q.alojamento_id=? ORDER BY q.numero`, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		var q dominio.Quarto
		var ti, ob sql.NullString
		var ativo int
		var cr string
		if e := rows.Scan(&q.ID, &q.AlojamentoID, &q.Numero, &q.Capacidade, &ti, &ob, &ativo, &cr, &q.Ocupacao); e != nil {
			return nil, e
		}
		q.Tipo = txt(ti)
		q.Observacoes = txt(ob)
		q.Ativo = ativo != 0
		q.CriadoEm = tempo(cr)
		a.Quartos = append(a.Quartos, q)
	}
	return a, rows.Err()
}
func (r *AlojamentosRepositorio) CriarAlojamento(ctx context.Context, a *dominio.Alojamento) error {
	a.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO alojamentos(id,nome,cep,logradouro,numero,complemento,bairro,cidade,uf,capacidade_total,responsavel_nome,telefone_responsavel,foto,observacoes,ativo,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, a.ID, a.Nome, a.CEP, a.Logradouro, a.Numero, a.Complemento, a.Bairro, a.Cidade, a.UF, a.CapacidadeTotal, a.ResponsavelNome, a.TelefoneResponsavel, a.Foto, a.Observacoes, 1, rfc3339(&a.CriadoEm), rfc3339(&a.AtualizadoEm))
	return e
}
func (r *AlojamentosRepositorio) AtualizarAlojamento(ctx context.Context, a *dominio.Alojamento) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE alojamentos SET nome=?,cep=?,logradouro=?,numero=?,complemento=?,bairro=?,cidade=?,uf=?,capacidade_total=?,responsavel_nome=?,telefone_responsavel=?,foto=?,observacoes=?,atualizado_em=? WHERE id=?`, a.Nome, a.CEP, a.Logradouro, a.Numero, a.Complemento, a.Bairro, a.Cidade, a.UF, a.CapacidadeTotal, a.ResponsavelNome, a.TelefoneResponsavel, a.Foto, a.Observacoes, rfc3339(&a.AtualizadoEm), a.ID)
	return e
}
func (r *AlojamentosRepositorio) AlternarAlojamento(ctx context.Context, id string, v bool) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE alojamentos SET ativo=?,atualizado_em=? WHERE id=?`, v, time.Now().UTC().Format(time.RFC3339), id)
	return e
}
func (r *AlojamentosRepositorio) VincularGrupo(ctx context.Context, alojamentoID string, grupoID *string) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if grupoID != nil {
		if _, err = tx.ExecContext(ctx, `UPDATE alojamentos SET grupo_whatsapp_id=NULL WHERE grupo_whatsapp_id=? AND id<>?`, *grupoID, alojamentoID); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE alojamentos SET grupo_whatsapp_id=?,atualizado_em=? WHERE id=?`, grupoID, time.Now().UTC().Format(time.RFC3339), alojamentoID); err != nil {
		return err
	}
	return tx.Commit()
}
func (r *AlojamentosRepositorio) CriarQuarto(ctx context.Context, q *dominio.Quarto) error {
	q.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO quartos(id,alojamento_id,numero,capacidade,tipo,observacoes,ativo,criado_em)VALUES(?,?,?,?,?,?,1,?)`, q.ID, q.AlojamentoID, q.Numero, q.Capacidade, q.Tipo, q.Observacoes, rfc3339(&q.CriadoEm))
	return e
}
func (r *AlojamentosRepositorio) AlternarQuarto(ctx context.Context, id string, v bool) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE quartos SET ativo=? WHERE id=?`, v, id)
	return e
}
func (r *AlojamentosRepositorio) ListarRotas(ctx context.Context, ativos bool) ([]dominio.Rota, error) {
	q := `SELECT id,nome,motorista,veiculo,horario_ida,horario_volta,capacidade,obra_codigo,observacao,ativo,criado_em,atualizado_em FROM rotas_onibus`
	if ativos {
		q += " WHERE ativo=1"
	}
	q += " ORDER BY nome"
	rows, e := r.DB.QueryContext(ctx, q)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Rota
	for rows.Next() {
		var v dominio.Rota
		var mo, ve, hi, hv, oc, ob sql.NullString
		var ca sql.NullInt64
		var at int
		var cr, up string
		if e := rows.Scan(&v.ID, &v.Nome, &mo, &ve, &hi, &hv, &ca, &oc, &ob, &at, &cr, &up); e != nil {
			return nil, e
		}
		v.Motorista = txt(mo)
		v.Veiculo = txt(ve)
		v.HorarioIda = txt(hi)
		v.HorarioVolta = txt(hv)
		v.Capacidade = nint(ca)
		v.ObraCodigo = txt(oc)
		v.Observacao = txt(ob)
		v.Ativo = at != 0
		v.CriadoEm = tempo(cr)
		v.AtualizadoEm = tempo(up)
		out = append(out, v)
	}
	return out, rows.Err()
}
func (r *AlojamentosRepositorio) CriarRota(ctx context.Context, v *dominio.Rota) error {
	v.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO rotas_onibus(id,nome,motorista,veiculo,horario_ida,horario_volta,capacidade,obra_codigo,observacao,ativo,criado_em,atualizado_em)VALUES(?,?,?,?,?,?,?,?,?,1,?,?)`, v.ID, v.Nome, v.Motorista, v.Veiculo, v.HorarioIda, v.HorarioVolta, v.Capacidade, v.ObraCodigo, v.Observacao, rfc3339(&v.CriadoEm), rfc3339(&v.AtualizadoEm))
	return e
}
func (r *AlojamentosRepositorio) AlternarRota(ctx context.Context, id string, v bool) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE rotas_onibus SET ativo=?,atualizado_em=? WHERE id=?`, v, time.Now().UTC().Format(time.RFC3339), id)
	return e
}
func scanAloc(s interface{ Scan(...any) error }) (*dominio.Alocacao, error) {
	var a dominio.Alocacao
	var oc, qi, oi, ds, ms, ca, ri, te, ob, rp sql.NullString
	var entrada, cr, up string
	err := s.Scan(&a.ID, &a.FuncionarioID, &a.FuncionarioNome, &a.FuncionarioMatricula, &oc, &a.AlojamentoID, &a.AlojamentoNome, &qi, &a.QuartoNumero, &oi, &entrada, &ds, &a.Status, &ms, &a.TransporteTipo, &ca, &ri, &a.RotaNome, &te, &ob, &rp, &cr, &up)
	a.ObraCodigo = txt(oc)
	a.DataEntrada = tempo(entrada)
	a.QuartoID = txt(qi)
	a.ObraID = txt(oi)
	a.DataSaida = parseTempoNulo(ds)
	a.MotivoSaida = txt(ms)
	a.CaronaComNome = txt(ca)
	a.RotaID = txt(ri)
	a.Telefone = txt(te)
	a.Observacoes = txt(ob)
	a.RegistradoPor = txt(rp)
	a.CriadoEm = tempo(cr)
	a.AtualizadoEm = tempo(up)
	return &a, err
}

const selAloc = `SELECT x.id,x.funcionario_id,x.funcionario_nome,x.funcionario_matricula,x.obra_codigo,x.alojamento_id,a.nome,x.quarto_id,coalesce(q.numero,''),x.obra_id,x.data_entrada,x.data_saida,x.status,x.motivo_saida,x.transporte_tipo,x.carona_com_nome,x.rota_onibus_id,coalesce(ro.nome,''),x.telefone,x.observacoes,x.registrado_por,x.criado_em,x.atualizado_em FROM alocacoes x JOIN alojamentos a ON a.id=x.alojamento_id LEFT JOIN quartos q ON q.id=x.quarto_id LEFT JOIN rotas_onibus ro ON ro.id=x.rota_onibus_id`

func (r *AlojamentosRepositorio) ListarAlocacoes(ctx context.Context, status string) ([]dominio.Alocacao, error) {
	q := selAloc
	if status != "" {
		q += " WHERE x.status=?"
	}
	q += " ORDER BY x.data_entrada DESC"
	var rows *sql.Rows
	var e error
	if status != "" {
		rows, e = r.DB.QueryContext(ctx, q, status)
	} else {
		rows, e = r.DB.QueryContext(ctx, q)
	}
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Alocacao
	for rows.Next() {
		a, e := scanAloc(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}
func (r *AlojamentosRepositorio) BuscarAlocacaoAtivaDoFuncionario(ctx context.Context, id string) (*dominio.Alocacao, error) {
	a, e := scanAloc(r.DB.QueryRowContext(ctx, selAloc+` WHERE x.funcionario_id=? AND x.status='ATIVA'`, id))
	if e == sql.ErrNoRows {
		return nil, nil
	}
	return a, e
}
func (r *AlojamentosRepositorio) OcupacaoQuarto(ctx context.Context, id string) (n int, e error) {
	e = r.DB.QueryRowContext(ctx, `SELECT count(*) FROM alocacoes WHERE quarto_id=? AND status='ATIVA'`, id).Scan(&n)
	return
}
func (r *AlojamentosRepositorio) CriarAlocacao(ctx context.Context, a *dominio.Alocacao) error {
	a.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO alocacoes(id,funcionario_id,funcionario_nome,funcionario_matricula,obra_codigo,alojamento_id,quarto_id,obra_id,data_entrada,status,transporte_tipo,carona_com_nome,rota_onibus_id,telefone,observacoes,registrado_por,criado_em,atualizado_em)VALUES(?,?,?,?,?,?,?,?,?,'ATIVA',?,?,?,?,?,?,?,?)`, a.ID, a.FuncionarioID, a.FuncionarioNome, a.FuncionarioMatricula, a.ObraCodigo, a.AlojamentoID, a.QuartoID, a.ObraID, a.DataEntrada.Format(time.DateOnly), a.TransporteTipo, a.CaronaComNome, a.RotaID, a.Telefone, a.Observacoes, a.RegistradoPor, rfc3339(&a.CriadoEm), rfc3339(&a.AtualizadoEm))
	return e
}
func (r *AlojamentosRepositorio) EncerrarAlocacao(ctx context.Context, id string, d time.Time, m *string) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE alocacoes SET status='ENCERRADA',data_saida=?,motivo_saida=?,atualizado_em=? WHERE id=?`, d.Format(time.DateOnly), m, time.Now().UTC().Format(time.RFC3339), id)
	return e
}
func (r *AlojamentosRepositorio) AtualizarTelefone(ctx context.Context, id string, t *string) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE alocacoes SET telefone=?,atualizado_em=? WHERE id=?`, t, time.Now().UTC().Format(time.RFC3339), id)
	return e
}
func (r *AlojamentosRepositorio) ListarPedidos(ctx context.Context, status string) ([]dominio.Pedido, error) {
	q := `SELECT p.id,p.alojamento_id,a.nome,p.tipo,p.titulo,p.descricao,p.status,p.prioridade,p.alocacao_id,p.funcionario_nome,p.atendido_por,p.atendido_em,p.resposta_observacao,p.origem,p.telefone_origem,p.grupo_origem_id,p.nome_origem,p.registrado_por,p.criado_em,p.atualizado_em FROM pedidos_alojamento p JOIN alojamentos a ON a.id=p.alojamento_id`
	if status != "" {
		q += " WHERE p.status=?"
	}
	q += " ORDER BY p.criado_em DESC"
	var rows *sql.Rows
	var e error
	if status != "" {
		rows, e = r.DB.QueryContext(ctx, q, status)
	} else {
		rows, e = r.DB.QueryContext(ctx, q)
	}
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Pedido
	for rows.Next() {
		var p dominio.Pedido
		var de, ai, fn, ap, ae, ro, to, goi, no, rp sql.NullString
		var cr, up string
		if e := rows.Scan(&p.ID, &p.AlojamentoID, &p.AlojamentoNome, &p.Tipo, &p.Titulo, &de, &p.Status, &p.Prioridade, &ai, &fn, &ap, &ae, &ro, &p.Origem, &to, &goi, &no, &rp, &cr, &up); e != nil {
			return nil, e
		}
		p.Descricao = txt(de)
		p.AlocacaoID = txt(ai)
		p.FuncionarioNome = txt(fn)
		p.AtendidoPor = txt(ap)
		p.AtendidoEm = parseTempoNulo(ae)
		p.RespostaObservacao = txt(ro)
		p.TelefoneOrigem = txt(to)
		p.GrupoOrigemID = txt(goi)
		p.NomeOrigem = txt(no)
		p.RegistradoPor = txt(rp)
		p.CriadoEm = tempo(cr)
		p.AtualizadoEm = tempo(up)
		out = append(out, p)
	}
	return out, rows.Err()
}
func (r *AlojamentosRepositorio) CriarPedido(ctx context.Context, p *dominio.Pedido) error {
	p.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO pedidos_alojamento(id,alojamento_id,tipo,titulo,descricao,status,prioridade,alocacao_id,funcionario_nome,origem,registrado_por,criado_em,atualizado_em)VALUES(?,?,?,?,?,'ABERTO',?,?,?,?,?,?,?)`, p.ID, p.AlojamentoID, p.Tipo, p.Titulo, p.Descricao, p.Prioridade, p.AlocacaoID, p.FuncionarioNome, p.Origem, p.RegistradoPor, rfc3339(&p.CriadoEm), rfc3339(&p.AtualizadoEm))
	return e
}
func (r *AlojamentosRepositorio) AtualizarPedido(ctx context.Context, id, status string, obs *string, nome string, quando *time.Time) error {
	_, e := r.DB.ExecContext(ctx, `UPDATE pedidos_alojamento SET status=?,resposta_observacao=?,atendido_por=?,atendido_em=?,atualizado_em=? WHERE id=?`, status, obs, optDB(nome), rfc3339(quando), time.Now().UTC().Format(time.RFC3339), id)
	return e
}
func optDB(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func (r *AlojamentosRepositorio) ListarProgramacao(ctx context.Context, de, ate time.Time) ([]dominio.Programacao, error) {
	rows, e := r.DB.QueryContext(ctx, `SELECT p.id,p.data,p.tipo,p.titulo,p.descricao,p.horario,p.responsavel_nome,p.criado_por,p.criado_em,p.atualizado_em,p.alojamento_id,a.nome FROM programacoes_alojamento p LEFT JOIN alojamentos a ON a.id=p.alojamento_id WHERE p.data BETWEEN ? AND ? ORDER BY p.data,p.horario`, de.Format(time.DateOnly), ate.Format(time.DateOnly))
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	var out []dominio.Programacao
	for rows.Next() {
		var p dominio.Programacao
		var d, cr, up string
		var de, ho, re, cp, ai, an sql.NullString
		if e := rows.Scan(&p.ID, &d, &p.Tipo, &p.Titulo, &de, &ho, &re, &cp, &cr, &up, &ai, &an); e != nil {
			return nil, e
		}
		p.Data = tempo(d)
		p.Descricao = txt(de)
		p.Horario = txt(ho)
		p.ResponsavelNome = txt(re)
		p.CriadoPor = txt(cp)
		p.CriadoEm = tempo(cr)
		p.AtualizadoEm = tempo(up)
		p.AlojamentoID = txt(ai)
		p.AlojamentoNome = txt(an)
		out = append(out, p)
	}
	return out, rows.Err()
}
func (r *AlojamentosRepositorio) CriarProgramacao(ctx context.Context, p *dominio.Programacao) error {
	p.ID = uuid.NewString()
	_, e := r.DB.ExecContext(ctx, `INSERT INTO programacoes_alojamento(id,data,tipo,titulo,descricao,horario,responsavel_nome,criado_por,criado_em,atualizado_em,alojamento_id)VALUES(?,?,?,?,?,?,?,?,?,?,?)`, p.ID, p.Data.Format(time.DateOnly), p.Tipo, p.Titulo, p.Descricao, p.Horario, p.ResponsavelNome, p.CriadoPor, rfc3339(&p.CriadoEm), rfc3339(&p.AtualizadoEm), p.AlojamentoID)
	return e
}
func (r *AlojamentosRepositorio) ExcluirProgramacao(ctx context.Context, id string) error {
	_, e := r.DB.ExecContext(ctx, `DELETE FROM programacoes_alojamento WHERE id=?`, id)
	return e
}
