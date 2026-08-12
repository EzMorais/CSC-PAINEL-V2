package identidade

// LinhaUsuario é o modelo de visualização de uma linha da lista de usuários — já formatado
// pelo handler, o template só desenha. "Aberta" controla se o <details> começa expandido
// (usado depois de um redirect pós-POST pra mostrar o resultado da ação naquela linha).
type LinhaUsuario struct {
	ID, Nome, Email     string
	Cargo, RotuloCargo  string
	Ativo               bool
	SistemasTexto       string
	ModulosSelecionados []string
	PapelFinanceiro     string
	SouEu               bool
	Aberta              bool
	Mensagem            string
	Erro                string
}

type FormCriacao struct {
	Aberto                           bool
	Erro                             string
	Nome, Email, Telefone, Cargo     string
	Modulos                          []string
	PapelFinanceiro                  string
}

type LinhaAcesso struct {
	Sucesso     bool
	NomeOuEmail string
	Motivo      string
	DataHora    string
}

type OpcaoCargo struct{ Valor, Rotulo, Descricao string }
type OpcaoModulo struct{ Valor, Rotulo string }
type OpcaoPapelFinanceiro struct{ Valor, Rotulo, Descricao string }
