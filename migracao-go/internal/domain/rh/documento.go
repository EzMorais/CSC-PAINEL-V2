package rh

import (
	"context"
	"time"
)

// Categorias de documento de EMPRESA/OBRA (funcionarioId nulo) — COMPORTAMENTO.md §2.
const (
	DocEmpresaPGR   = "PGR"
	DocEmpresaPCMSO = "PCMSO"
	DocEmpresaLTCAT = "LTCAT"
	DocEmpresaAPR   = "APR"
	DocEmpresaPT    = "PT"
	DocEmpresaFISPQ = "FISPQ"
	DocEmpresaART   = "ART"
	DocEmpresaOutro = "OUTRO"
)

var CategoriasDocumentoEmpresa = []string{
	DocEmpresaPGR, DocEmpresaPCMSO, DocEmpresaLTCAT, DocEmpresaAPR, DocEmpresaPT, DocEmpresaFISPQ, DocEmpresaART, DocEmpresaOutro,
}

// Categorias de documento PESSOAL de admissão (funcionarioId preenchido) — COMPORTAMENTO.md §2.
const (
	DocPessoalRG                    = "RG"
	DocPessoalCPF                   = "CPF"
	DocPessoalCTPS                  = "CTPS"
	DocPessoalPISPasep              = "PIS_PASEP"
	DocPessoalTituloEleitor         = "TITULO_ELEITOR"
	DocPessoalReservista            = "RESERVISTA"
	DocPessoalComprovanteResidencia = "COMPROVANTE_RESIDENCIA"
	DocPessoalCertidao              = "CERTIDAO"
	DocPessoalContratoTrabalho      = "CONTRATO_TRABALHO"
	DocPessoalExameAdmissional      = "EXAME_ADMISSIONAL"
	DocPessoalDadosBancarios        = "DADOS_BANCARIOS"
	DocPessoalValeTransporte        = "VALE_TRANSPORTE"
	DocPessoalOutro                 = "OUTRO"
)

var CategoriasDocumentoPessoal = []string{
	DocPessoalRG, DocPessoalCPF, DocPessoalCTPS, DocPessoalPISPasep, DocPessoalTituloEleitor,
	DocPessoalReservista, DocPessoalComprovanteResidencia, DocPessoalCertidao, DocPessoalContratoTrabalho,
	DocPessoalExameAdmissional, DocPessoalDadosBancarios, DocPessoalValeTransporte, DocPessoalOutro,
}

// Documento cobre dois casos com o mesmo model — empresa/obra (FuncionarioID nulo) OU
// pessoal (FuncionarioID preenchido), exatamente um dos dois vínculos, nunca os dois nem
// nenhum (regra de aplicação, COMPORTAMENTO.md §2/§3). Versao incrementa por
// titulo+categoria+obraId(ou FuncionarioID) — reenviar não sobrescreve, cria versão nova.
type Documento struct {
	ID            string
	Categoria     string
	Titulo        string
	Versao        int
	VigenteDesde  *time.Time
	ValidoAte     *time.Time
	Arquivo       *string
	Observacao    *string
	RegistradoPor *string
	CriadoEm      time.Time
	ObraID        *string
	FuncionarioID *string
}

// DocumentoComContexto — projeção com o nome/código já resolvidos pra listagem, mesmo padrão
// de ExameComNome/EntregaUniformeComNome (mas aqui o vínculo é opcional para os dois lados).
type DocumentoComContexto struct {
	Documento
	FuncionarioNome *string
	ObraCodigo      *string
}

type DocumentoRepositorio interface {
	Listar(ctx context.Context) ([]DocumentoComContexto, error)
	ListarPorFuncionario(ctx context.Context, funcionarioID string) ([]Documento, error)
	BuscarPorID(ctx context.Context, id string) (*Documento, error)
	// ListarVersoes devolve todas as versões de um mesmo título+categoria+obra(ou
	// funcionário), mais recente primeiro — COMPORTAMENTO.md §3.
	ListarVersoes(ctx context.Context, titulo, categoria string, obraID, funcionarioID *string) ([]Documento, error)
	Criar(ctx context.Context, d *Documento) error
}
