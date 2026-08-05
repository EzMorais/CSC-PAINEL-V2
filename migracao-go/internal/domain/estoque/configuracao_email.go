package estoque

import "time"

type ProvedorEmail string

const (
	ProvedorGmail   ProvedorEmail = "GMAIL"
	ProvedorOutlook ProvedorEmail = "OUTLOOK"
	ProvedorOutro   ProvedorEmail = "OUTRO"
)

var RotuloProvedor = map[ProvedorEmail]string{
	ProvedorGmail:   "Gmail / Google Workspace",
	ProvedorOutlook: "Outlook / Microsoft 365",
	ProvedorOutro:   "Outro (servidor próprio)",
}

type ServidorSMTP struct {
	Host  string
	Porta int
}

// ServidorPadrao evita que o almoxarife precise procurar "smtp do gmail" na internet — só
// digita e-mail e senha de aplicativo. OUTRO libera host/porta pra e-mail próprio da empresa.
var ServidorPadrao = map[ProvedorEmail]ServidorSMTP{
	ProvedorGmail:   {Host: "smtp.gmail.com", Porta: 587},
	ProvedorOutlook: {Host: "smtp.office365.com", Porta: 587},
	ProvedorOutro:   {Host: "", Porta: 587},
}

// ComoObterSenha é o passo a passo pra pegar a senha de aplicativo — os provedores bloqueiam
// a senha normal da conta desde que passaram a exigir verificação em duas etapas.
var ComoObterSenha = map[ProvedorEmail][]string{
	ProvedorGmail: {
		"A conta precisa ter a verificação em duas etapas LIGADA.",
		"Acesse myaccount.google.com/apppasswords",
		`Crie uma senha de aplicativo com o nome "Almoxarifado".`,
		"Copie os 16 caracteres que aparecem e cole no campo Senha aqui.",
	},
	ProvedorOutlook: {
		"A conta precisa ter a verificação em duas etapas LIGADA.",
		"Acesse account.microsoft.com/security → Opções de segurança avançadas.",
		`Em "Senhas de aplicativo", crie uma nova.`,
		"Copie a senha gerada e cole no campo Senha aqui.",
		"Em conta corporativa, o administrador precisa permitir SMTP AUTH.",
	},
	ProvedorOutro: {
		"Peça ao responsável pelo e-mail da empresa o endereço do servidor de saída (SMTP),",
		"a porta (geralmente 587) e uma conta com permissão para enviar.",
	},
}

// SenhaMascarada é o marcador que a tela mostra no lugar da senha salva — a senha real nunca
// volta ao navegador (ficaria no HTML da página, ao alcance de extensão/print de tela).
const SenhaMascarada = "••••••••"

// ConfiguracaoEmail é linha única (id fixo "unica"): quem configura é o almoxarife pela
// tela, não um arquivo .env do servidor.
type ConfiguracaoEmail struct {
	ID                     string
	Provedor               ProvedorEmail
	Host                   string
	Porta                  int
	Usuario                string
	Senha                  string
	Remetente              *string
	DestinatarioPadrao     *string
	CopiaPara              *string
	EnviarAutomatico       bool
	LimiteAprovacaoCompra  float64
	LimiteAjusteInventario float64
	Ativo                  bool
	TestadoEm              *time.Time
	AtualizadoEm           time.Time
}
