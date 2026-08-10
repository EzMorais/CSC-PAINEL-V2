package rh

import (
	"context"

	dominio "siqueiracampos/servidor/internal/domain/rh"
)

type GerenciadorDocumentos struct {
	Documentos dominio.DocumentoRepositorio
}

func (g *GerenciadorDocumentos) Listar(ctx context.Context) ([]dominio.DocumentoComContexto, error) {
	return g.Documentos.Listar(ctx)
}

func (g *GerenciadorDocumentos) ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]dominio.Documento, error) {
	return g.Documentos.ListarPorFuncionario(ctx, funcionarioID)
}

// Detalhe devolve o documento pedido e TODAS as versões da mesma
// título+categoria+obra(ou funcionário) — mais recente primeiro (COMPORTAMENTO.md §3).
func (g *GerenciadorDocumentos) Detalhe(ctx context.Context, id string) (*dominio.Documento, []dominio.Documento, error) {
	d, err := g.Documentos.BuscarPorID(ctx, id)
	if err != nil || d == nil {
		return d, nil, err
	}
	versoes, err := g.Documentos.ListarVersoes(ctx, d.Titulo, d.Categoria, d.ObraID, d.FuncionarioID)
	return d, versoes, err
}

// EntradaDocumento cobre os dois casos (empresa/obra OU pessoal) — exatamente um dos dois
// vínculos vem preenchido pelo chamador (handler decide qual formulário chamou).
type EntradaDocumento struct {
	Categoria, Titulo, VigenteDesde, ValidoAte, Observacao string
	ObraID, FuncionarioID                                  string
}

func (g *GerenciadorDocumentos) validarEntrada(e EntradaDocumento) []string {
	var erros []string
	if e.Categoria == "" {
		erros = append(erros, "Escolha a categoria.")
	}
	if e.Titulo == "" {
		erros = append(erros, "Informe o título.")
	}
	if (e.ObraID == "") == (e.FuncionarioID == "") {
		erros = append(erros, "Documento de empresa/obra e documento pessoal são mutuamente exclusivos.")
	}
	return erros
}

// Criar — versao sempre 1 (é a primeira vez que este título+categoria+vínculo aparece;
// reenvio de um já existente deve passar por NovaVersao, não por aqui).
func (g *GerenciadorDocumentos) Criar(ctx context.Context, e EntradaDocumento, registradoPor string) (string, error) {
	if erros := g.validarEntrada(e); len(erros) > 0 {
		return "", erroValidacao(erros...)
	}
	vigenteDesde, err := dataCalendario(e.VigenteDesde)
	if err != nil {
		return "", erroValidacao("Data de vigência inválida.")
	}
	validoAte, err := dataCalendario(e.ValidoAte)
	if err != nil {
		return "", erroValidacao("Data de validade inválida.")
	}

	d := &dominio.Documento{
		Categoria: e.Categoria, Titulo: e.Titulo, Versao: 1, VigenteDesde: vigenteDesde, ValidoAte: validoAte,
		Observacao: ponteiro(e.Observacao), RegistradoPor: ponteiro(registradoPor),
		ObraID: ponteiro(e.ObraID), FuncionarioID: ponteiro(e.FuncionarioID),
	}
	if err := g.Documentos.Criar(ctx, d); err != nil {
		return "", err
	}
	return d.ID, nil
}

// NovaVersao — reenviar um documento com o mesmo título+categoria+vínculo NUNCA sobrescreve,
// cria uma linha nova com versao = maior já existente + 1 (COMPORTAMENTO.md §3).
func (g *GerenciadorDocumentos) NovaVersao(ctx context.Context, documentoExistenteID, vigenteDesdeStr, validoAteStr, observacao string) (string, error) {
	existente, err := g.Documentos.BuscarPorID(ctx, documentoExistenteID)
	if err != nil {
		return "", err
	}
	if existente == nil {
		return "", erroValidacao("Documento não encontrado.")
	}
	versoes, err := g.Documentos.ListarVersoes(ctx, existente.Titulo, existente.Categoria, existente.ObraID, existente.FuncionarioID)
	if err != nil {
		return "", err
	}
	maiorVersao := existente.Versao
	for _, v := range versoes {
		if v.Versao > maiorVersao {
			maiorVersao = v.Versao
		}
	}

	vigenteDesde, err := dataCalendario(vigenteDesdeStr)
	if err != nil {
		return "", erroValidacao("Data de vigência inválida.")
	}
	validoAte, err := dataCalendario(validoAteStr)
	if err != nil {
		return "", erroValidacao("Data de validade inválida.")
	}

	novo := &dominio.Documento{
		Categoria: existente.Categoria, Titulo: existente.Titulo, Versao: maiorVersao + 1,
		VigenteDesde: vigenteDesde, ValidoAte: validoAte, Observacao: ponteiro(observacao),
		ObraID: existente.ObraID, FuncionarioID: existente.FuncionarioID,
	}
	if err := g.Documentos.Criar(ctx, novo); err != nil {
		return "", err
	}
	return novo.ID, nil
}
