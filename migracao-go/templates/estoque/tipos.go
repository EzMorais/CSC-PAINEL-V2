package estoque

type Opcao struct{ Valor, Rotulo string }

type LinhaMaterial struct {
	ID, Codigo, Nome, Categoria, Unidade string
	Saldo, EstoqueMinimo, ValorEmEstoque string
	SituacaoRotulo, SituacaoCor          string
	Ativo                                bool
}

type FiltrosMateriaisView struct {
	Busca, Categoria, Situacao string
}

type FormMaterial struct {
	Aberto                                                           bool
	Erro                                                             string
	ID, Codigo, Nome, Categoria, Unidade, EstoqueMinimo, Localizacao string
	Observacao, CA, ValidadeCA                                       string
}

type LinhaMovimentacao struct {
	ID, TipoRotulo, TipoCor    string
	MaterialTexto, Quantidade  string
	ObraTexto, FornecedorTexto string
	OcorridoEm, RegistradoPor  string
	FichaPendente              bool
}

type DetalheMaterial struct {
	ID, Codigo, Nome, CategoriaRotulo, Unidade string
	Saldo, EstoqueMinimo                       string
	SituacaoRotulo, SituacaoCor                string
	Localizacao, Observacao, CA, ValidadeCA    string
	EhEPI, Ativo                               bool
	Historico                                  []LinhaMovimentacao
	Erro, Mensagem                             string
	AbrirMovimentar, AbrirAjustar              bool
}

type FormMovimentacao struct {
	Tipo, Quantidade, ValorUnitario                      string
	ObraID, FornecedorID, FuncionarioID, FuncionarioNome string
	Documento, Observacao, OcorridoEm                    string
}

type LinhaSolicitacao struct {
	ID, Numero, StatusRotulo, StatusCor string
	QtdItens                            int
	CriadoEm                            string
	EmailStatus                         string
}

type ItemSugeridoView struct {
	MaterialID, Codigo, Nome, Unidade string
	Saldo, EstoqueMinimo              string
	QuantidadeSugerida                string
	PrecoEstimado                     string
}

type DetalheSolicitacao struct {
	ID, Numero, StatusRotulo, StatusCor string
	CriadoEm, Observacao, RegistradoPor string
	Itens                               []LinhaItemSolicitacao
	EmailInfo                           string
	Erro, Mensagem                      string
	PodeExcluir                         bool
}

type LinhaItemSolicitacao struct {
	MaterialNome, MaterialCodigo, Unidade string
	Quantidade, PrecoEstimado             string
}

type LinhaAprovacao struct {
	ID, TipoRotulo, StatusRotulo, StatusCor string
	Resumo, Motivo, SolicitanteNome         string
	CriadoEm                                string
	MotivoDaRegra                           string
	PodeDecidir                             bool
}

type ConfiguracaoEmailForm struct {
	Existe                                                                          bool
	Erro, Mensagem                                                                  string
	Provedor, Host, Porta, Usuario, Senha, Remetente, DestinatarioPadrao, CopiaPara string
	EnviarAutomatico, Ativo                                                         bool
	TestadoEm                                                                       string
}

type KpisDashboard struct {
	TotalMateriais, SemEstoque, AbaixoDoMinimo string
	ValorEmEstoque                             string
	EntradasDoMes, SaidasDoMes                 string
	ObrasAtivas                                string
	AprovacoesPendentes                        string
}
