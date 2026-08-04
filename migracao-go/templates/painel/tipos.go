package painel

type Opcao struct{ Valor, Rotulo string }

type LinhaLocacao struct {
	ID, Descricao, TrCodigo    string
	ObraTexto, FornecedorTexto string
	DataInicio, DataFim        string
	StatusRotulo, StatusCor    string
	ValorTotal                 string
	Estado                     string
}

type FiltrosView struct {
	Busca, ObraID, FornecedorID, Status, Estado string
	AConfirmar                                  bool
}

type EntradaLocacaoForm struct {
	Erro                                                   string
	ObraID, Descricao, TrCodigo, FornecedorID, Observacoes string
	Quantidade, ValorItem, DataInicio, DataFim             string
}

type DetalheLocacao struct {
	ID, Descricao, TrCodigo            string
	ObraTexto, ObraID, FornecedorTexto string
	DataInicio, DataFim, ValorTotal    string
	// DataInicioISO alimenta o <input type="date"> do formulário de transferir — o campo
	// HTML exige AAAA-MM-DD, diferente do DD/MM/AAAA usado para exibição (DataInicio).
	DataInicioISO                                string
	StatusRotulo, StatusCor                      string
	Quantidade, Estado, Observacoes              string
	Devolvida                                    bool
	Historico                                    []string
	Erro, Mensagem                               string
	AbrirRenovar, AbrirTransferir, AbrirDevolver bool
	DataDevolucaoProposta                        string
}
