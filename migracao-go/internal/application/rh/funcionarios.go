package rh

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/rh"
)

var reDigitosMatricula = regexp.MustCompile(`\D`)

// ProximaMatricula gera "SC-0001" a partir do MAIOR número já existente + 1 — nunca por
// COUNT, para não colidir depois de uma exclusão. Mesma regra de queries/funcionarios.ts e
// de actions/importar-funcionarios.ts (COMPORTAMENTO.md §3).
func ProximaMatricula(ctx context.Context, repo dominio.FuncionarioRepositorio) (string, error) {
	ultima, err := repo.UltimaMatricula(ctx)
	if err != nil {
		return "", err
	}
	numero := 0
	if ultima != "" {
		digitos := reDigitosMatricula.ReplaceAllString(ultima, "")
		if n, err := strconv.Atoi(digitos); err == nil {
			numero = n
		}
	}
	return fmt.Sprintf("SC-%04d", numero+1), nil
}

type GerenciadorFuncionarios struct {
	Funcionarios dominio.FuncionarioRepositorio
	Cargos       dominio.CargoRepositorio
	Eventos      dominio.EventoRepositorio
	// ResolverObraCodigo busca o código de uma obra pelo id — função, não interface de
	// cadastro.ObraRepositorio, para este pacote não importar o pacote cadastro (mesma
	// decisão do estoque: ver application/estoque/dashboard.go "não criar acoplamento
	// circular entre estoque e cadastro"). Devolve "" se a obra não existir.
	ResolverObraCodigo func(ctx context.Context, obraID string) (string, error)
}

// EntradaFuncionario espelha o formulário de 6 abas do Next.js — COMPORTAMENTO.md §2.
type EntradaFuncionario struct {
	Nome, CPF, AdmitidoEm, Status, TipoContrato              string
	RG, DataNascimento, Sexo, EstadoCivil, NomeMae, Foto     string
	Telefone, Email                                          string
	CEP, Logradouro, Numero, Complemento, Bairro, Cidade, UF string
	ObraID, CargoID, DepartamentoID, NivelObra, Salario      string
	Banco, Agencia, Conta, TipoConta, ChavePix               string
	TamanhoCamisa, TamanhoCalca, TamanhoCalcado              string
	Observacoes                                              string
}

func dataCalendario(v string) (*time.Time, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil, fmt.Errorf("Data inválida.")
	}
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	return &t, nil
}

// validar espelha o schema Zod de actions/funcionarios.ts — COMPORTAMENTO.md §2.
func (g *GerenciadorFuncionarios) validar(ctx context.Context, e EntradaFuncionario) (*dominio.Funcionario, []string) {
	var erros []string

	nome := strings.TrimSpace(e.Nome)
	if len(nome) < 3 {
		erros = append(erros, "Informe o nome completo.")
	}

	if strings.TrimSpace(e.CPF) == "" {
		erros = append(erros, "Informe o CPF.")
	} else if !dominio.CPFValido(e.CPF) {
		erros = append(erros, "CPF inválido — confira os dígitos.")
	}
	cpf := dominio.ApenasDigitos(e.CPF)
	if strings.TrimSpace(e.RG) == "" {
		erros = append(erros, "Informe o RG ou documento de identificação.")
	}
	dataNascimento, errNascimento := dataCalendario(e.DataNascimento)
	if errNascimento != nil || dataNascimento == nil {
		erros = append(erros, "Informe a data de nascimento.")
	} else if dataNascimento.After(time.Now().UTC()) {
		erros = append(erros, "Data de nascimento não pode estar no futuro.")
	}
	if strings.TrimSpace(e.Telefone) == "" {
		erros = append(erros, "Informe o telefone.")
	} else if n := len(dominio.ApenasDigitos(e.Telefone)); n < 10 || n > 11 {
		erros = append(erros, "Telefone deve ter DDD e 10 ou 11 dígitos.")
	}
	if len(dominio.ApenasDigitos(e.CEP)) != 8 {
		erros = append(erros, "Informe um CEP válido com 8 dígitos.")
	}
	if strings.TrimSpace(e.Logradouro) == "" {
		erros = append(erros, "Informe o logradouro.")
	}
	if strings.TrimSpace(e.Numero) == "" {
		erros = append(erros, "Informe o número do endereço.")
	}
	if strings.TrimSpace(e.Bairro) == "" {
		erros = append(erros, "Informe o bairro.")
	}
	if strings.TrimSpace(e.Cidade) == "" {
		erros = append(erros, "Informe a cidade.")
	}
	if len(strings.TrimSpace(e.UF)) != 2 {
		erros = append(erros, "Informe a UF com 2 letras.")
	}
	if strings.TrimSpace(e.CargoID) == "" {
		erros = append(erros, "Escolha o cargo.")
	}
	if strings.TrimSpace(e.DepartamentoID) == "" {
		erros = append(erros, "Escolha o departamento/setor.")
	}

	admitidoEm, err := dataCalendario(e.AdmitidoEm)
	if err != nil || admitidoEm == nil {
		erros = append(erros, "Informe a data de admissão.")
		admitidoEm = &time.Time{}
	}

	status := e.Status
	if status == "" {
		status = dominio.StatusAtivo
	}
	tipoContrato := e.TipoContrato
	if tipoContrato == "" {
		tipoContrato = "CLT"
	}
	tiposContrato := map[string]bool{"CLT": true, "PJ": true, "TEMPORARIO": true, "ESTAGIO": true, "APRENDIZ": true}
	if !tiposContrato[tipoContrato] {
		erros = append(erros, "Tipo de contrato inválido.")
	}

	if e.NivelObra != "" && !dominio.NivelObraValido(e.NivelObra) {
		erros = append(erros, "Nível de obra inválido.")
	}

	var salario *float64
	if strings.TrimSpace(e.Salario) != "" {
		v, err := strconv.ParseFloat(strings.TrimSpace(e.Salario), 64)
		if err != nil || v <= 0 {
			erros = append(erros, "Informe um salário válido maior que zero.")
		} else {
			salario = &v
		}
	} else {
		erros = append(erros, "Informe o salário.")
	}
	if e.Email != "" && (!strings.Contains(e.Email, "@") || strings.HasPrefix(e.Email, "@") || strings.HasSuffix(e.Email, "@")) {
		erros = append(erros, "E-mail inválido.")
	}
	if e.Banco != "" || e.Agencia != "" || e.Conta != "" || e.TipoConta != "" {
		if e.Banco == "" || e.Agencia == "" || e.Conta == "" || e.TipoConta == "" {
			erros = append(erros, "Preencha banco, agência, conta e tipo de conta em conjunto.")
		}
	}

	if len(erros) > 0 {
		return nil, erros
	}

	f := &dominio.Funcionario{
		Nome: nome, CPF: cpf, AdmitidoEm: *admitidoEm, Status: status, TipoContrato: tipoContrato,
		RG: ponteiro(e.RG), Sexo: ponteiro(e.Sexo), EstadoCivil: ponteiro(e.EstadoCivil), NomeMae: ponteiro(e.NomeMae),
		Foto: ponteiro(e.Foto), Telefone: ponteiro(e.Telefone), Email: ponteiro(e.Email),
		CEP: ponteiro(e.CEP), Logradouro: ponteiro(e.Logradouro), Numero: ponteiro(e.Numero),
		Complemento: ponteiro(e.Complemento), Bairro: ponteiro(e.Bairro), Cidade: ponteiro(e.Cidade), UF: ponteiro(e.UF),
		Salario: salario,
		Banco:   ponteiro(e.Banco), Agencia: ponteiro(e.Agencia), Conta: ponteiro(e.Conta),
		TipoConta: ponteiro(e.TipoConta), ChavePix: ponteiro(e.ChavePix),
		TamanhoCamisa: ponteiro(e.TamanhoCamisa), TamanhoCalca: ponteiro(e.TamanhoCalca), TamanhoCalcado: ponteiro(e.TamanhoCalcado),
		Observacoes: ponteiro(e.Observacoes), NivelObra: ponteiro(e.NivelObra),
		ObraID: ponteiro(e.ObraID), CargoID: ponteiro(e.CargoID), DepartamentoID: ponteiro(e.DepartamentoID),
	}
	f.DataNascimento = dataNascimento
	return f, nil
}

func traduzirErroFuncionario(err error) error {
	switch err {
	case dominio.ErrCPFDuplicado:
		return erroValidacao("Já existe um funcionário com este CPF.")
	case dominio.ErrMatriculaDuplicada:
		return erroValidacao("Matrícula já usada. Recarregue a página e tente de novo.")
	}
	return err
}

func (g *GerenciadorFuncionarios) descricaoObra(ctx context.Context, obraID *string) string {
	if obraID == nil || g.ResolverObraCodigo == nil {
		return "sem obra"
	}
	codigo, err := g.ResolverObraCodigo(ctx, *obraID)
	if err != nil || codigo == "" {
		return "sem obra"
	}
	return codigo
}

// Criar espelha `criarFuncionario` — gera a matrícula sequencial e o evento ADMISSAO.
// COMPORTAMENTO.md §3.
func (g *GerenciadorFuncionarios) Criar(ctx context.Context, e EntradaFuncionario, registradoPor string) (string, error) {
	f, erros := g.validar(ctx, e)
	if len(erros) > 0 {
		return "", erroValidacao(erros...)
	}

	matricula, err := ProximaMatricula(ctx, g.Funcionarios)
	if err != nil {
		return "", err
	}
	f.Matricula = matricula

	descricao := fmt.Sprintf("Admitido em %s", comum.DataBR(&f.AdmitidoEm))
	if f.ObraID != nil {
		descricao = fmt.Sprintf("Admitido em %s na obra %s", comum.DataBR(&f.AdmitidoEm), g.descricaoObra(ctx, f.ObraID))
	}
	evento := &dominio.Evento{
		Tipo: dominio.EventoAdmissao, DescricaoHumana: descricao, OcorridoEm: f.AdmitidoEm,
		RegistradoPor: ponteiro(registradoPor), ObraID: f.ObraID,
	}

	if err := g.Funcionarios.Criar(ctx, f, evento); err != nil {
		return "", traduzirErroFuncionario(err)
	}
	return f.ID, nil
}

// Editar espelha `editarFuncionario` — compara antes/depois e só gera evento para o que de
// fato mudou (obra, cargo, status). COMPORTAMENTO.md §3.
func (g *GerenciadorFuncionarios) Editar(ctx context.Context, id string, e EntradaFuncionario, registradoPor string) error {
	novo, erros := g.validar(ctx, e)
	if len(erros) > 0 {
		return erroValidacao(erros...)
	}

	antes, err := g.Funcionarios.BuscarPorID(ctx, id)
	if err != nil {
		return err
	}
	if antes == nil {
		return erroValidacao("Funcionário não encontrado.")
	}

	var eventos []dominio.Evento
	agora := time.Now().UTC()

	if !igual(novo.ObraID, antes.ObraID) {
		eventos = append(eventos, dominio.Evento{
			Tipo:            dominio.EventoMudancaObra,
			DescricaoHumana: fmt.Sprintf("Obra: %s → %s", g.descricaoObra(ctx, antes.ObraID), g.descricaoObra(ctx, novo.ObraID)),
			OcorridoEm:      agora, RegistradoPor: ponteiro(registradoPor), ObraID: novo.ObraID,
		})
	}
	if !igual(novo.CargoID, antes.CargoID) {
		eventos = append(eventos, dominio.Evento{
			Tipo:            dominio.EventoMudancaCargo,
			DescricaoHumana: fmt.Sprintf("Cargo: %s → %s", g.nomeCargo(ctx, antes.CargoID), g.nomeCargo(ctx, novo.CargoID)),
			OcorridoEm:      agora, RegistradoPor: ponteiro(registradoPor),
		})
	}
	if novo.Status != antes.Status {
		tipo, ok := dominio.TipoEventoPorStatus[novo.Status]
		if ok {
			eventos = append(eventos, dominio.Evento{
				Tipo: tipo,
				DescricaoHumana: fmt.Sprintf("Situação: %s → %s",
					dominio.RotuloStatus[antes.Status], dominio.RotuloStatus[novo.Status]),
				OcorridoEm: agora, RegistradoPor: ponteiro(registradoPor),
			})
		}
	}

	novo.ID = id
	novo.Matricula = antes.Matricula
	novo.CriadoEm = antes.CriadoEm
	if err := g.Funcionarios.Atualizar(ctx, novo, eventos); err != nil {
		return traduzirErroFuncionario(err)
	}
	return nil
}

func (g *GerenciadorFuncionarios) nomeCargo(ctx context.Context, cargoID *string) string {
	if cargoID == nil {
		return "sem cargo"
	}
	c, err := g.Cargos.BuscarPorID(ctx, *cargoID)
	if err != nil || c == nil {
		return "sem cargo"
	}
	return c.Nome
}

func igual(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// RegistrarEvento é o lançamento manual na timeline (advertência, promoção, observação...).
type EntradaEvento struct {
	Tipo, DescricaoHumana, OcorridoEm, Detalhe string
}

func (g *GerenciadorFuncionarios) RegistrarEvento(ctx context.Context, funcionarioID string, e EntradaEvento, registradoPor string) error {
	tipo := strings.TrimSpace(e.Tipo)
	if tipo == "" {
		return erroValidacao("Escolha o tipo.")
	}
	descricao := strings.TrimSpace(e.DescricaoHumana)
	if len(descricao) < 3 {
		return erroValidacao("Descreva o que aconteceu.")
	}
	ocorridoEm, err := dataCalendario(e.OcorridoEm)
	if err != nil || ocorridoEm == nil {
		return erroValidacao("Data inválida.")
	}

	f, err := g.Funcionarios.BuscarPorID(ctx, funcionarioID)
	if err != nil {
		return err
	}
	if f == nil {
		return erroValidacao("Funcionário não encontrado.")
	}

	evento := &dominio.Evento{
		Tipo: tipo, DescricaoHumana: descricao, Detalhe: ponteiro(e.Detalhe), OcorridoEm: *ocorridoEm,
		RegistradoPor: ponteiro(registradoPor), FuncionarioID: funcionarioID, ObraID: f.ObraID,
	}
	return g.Eventos.Criar(ctx, evento)
}

// Excluir espelha `excluirFuncionario` — bloqueada por prova legal, livre por Evento/Dependente.
// COMPORTAMENTO.md §4.
func (g *GerenciadorFuncionarios) Excluir(ctx context.Context, id string) (string, error) {
	f, err := g.Funcionarios.BuscarPorID(ctx, id)
	if err != nil {
		return "", err
	}
	if f == nil {
		return "", erroValidacao("Funcionário não encontrado.")
	}

	v, err := g.Funcionarios.ContarVinculos(ctx, id)
	if err != nil {
		return "", err
	}
	if v.Total() > 0 {
		var partes []string
		if v.EntregasEpi > 0 {
			partes = append(partes, fmt.Sprintf("%d entregas de EPI", v.EntregasEpi))
		}
		if v.EntregasUniforme > 0 {
			partes = append(partes, fmt.Sprintf("%d entregas de uniforme", v.EntregasUniforme))
		}
		if v.Exames > 0 {
			partes = append(partes, fmt.Sprintf("%d exames", v.Exames))
		}
		if v.Treinamentos > 0 {
			partes = append(partes, fmt.Sprintf("%d treinamentos", v.Treinamentos))
		}
		if v.Documentos > 0 {
			partes = append(partes, fmt.Sprintf("%d documentos", v.Documentos))
		}
		return "", erroValidacao(fmt.Sprintf(
			"%s tem %s. Esses registros são a prova de que a empresa entregou EPI e fez os "+
				"exames — apagar a pessoa apagaria a prova junto. Registre o desligamento em vez de excluir.",
			f.Nome, strings.Join(partes, ", ")))
	}

	if err := g.Funcionarios.Excluir(ctx, id); err != nil {
		return "", err
	}
	return f.Nome, nil
}
