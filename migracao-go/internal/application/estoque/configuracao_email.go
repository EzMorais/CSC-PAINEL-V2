package estoque

import (
	"context"
	"strings"

	"siqueiracampos/servidor/internal/domain/comum"
	dominio "siqueiracampos/servidor/internal/domain/estoque"
	identidade "siqueiracampos/servidor/internal/domain/identidade"
)

type GerenciadorConfiguracaoEmail struct {
	Configuracao   dominio.ConfiguracaoEmailRepositorio
	EmailRemetente dominio.EmailRemetente
}

type EntradaConfiguracaoEmail struct {
	Provedor, Host, Porta, Usuario, Senha, Remetente, DestinatarioPadrao, CopiaPara string
	EnviarAutomatico                                                                bool
}

// ConfiguracaoTela é a configuração pronta pra tela — SEM a senha real (ver
// COMPORTAMENTO.md §7: devolvê-la colocaria a senha no HTML da página).
type ConfiguracaoTela struct {
	Existe                                                            bool
	Provedor, Host, Usuario, Remetente, DestinatarioPadrao, CopiaPara string
	Porta                                                             int
	Senha                                                             string
	EnviarAutomatico, Ativo                                           bool
	TestadoEm                                                         string
}

func (g *GerenciadorConfiguracaoEmail) Carregar(ctx context.Context) (*ConfiguracaoTela, error) {
	c, err := g.Configuracao.Obter(ctx)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return &ConfiguracaoTela{Provedor: string(dominio.ProvedorGmail), EnviarAutomatico: true}, nil
	}
	tela := &ConfiguracaoTela{
		Existe: true, Provedor: string(c.Provedor), Host: c.Host, Porta: c.Porta, Usuario: c.Usuario,
		Senha: dominio.SenhaMascarada, Remetente: strPtrVal(c.Remetente), DestinatarioPadrao: strPtrVal(c.DestinatarioPadrao),
		CopiaPara: strPtrVal(c.CopiaPara), EnviarAutomatico: c.EnviarAutomatico, Ativo: c.Ativo,
	}
	if c.TestadoEm != nil {
		tela.TestadoEm = comum.DataLocalBR(*c.TestadoEm)
	}
	return tela, nil
}

// Salvar espelha `salvarConfiguracaoEmail` — provedor conhecido manda no servidor
// (host/porta fixos); só OUTRO libera edição manual. Ver COMPORTAMENTO.md §7.
func (g *GerenciadorConfiguracaoEmail) Salvar(ctx context.Context, sess identidade.Sessao, e EntradaConfiguracaoEmail) error {
	if !identidade.PodeAdministrar(sess.Cargo) {
		return erroValidacao("Só o administrador do sistema mexe nas configurações.")
	}

	provedor := dominio.ProvedorEmail(e.Provedor)
	if _, ok := dominio.RotuloProvedor[provedor]; !ok {
		return erroValidacao("Provedor inválido.")
	}
	usuario := strings.TrimSpace(e.Usuario)
	if !strings.Contains(usuario, "@") {
		return erroValidacao("Informe o e-mail da conta que vai enviar.")
	}
	senha := e.Senha
	if senha == "" {
		return erroValidacao("Informe a senha de aplicativo.")
	}

	padrao := dominio.ServidorPadrao[provedor]
	host, porta := padrao.Host, padrao.Porta
	if provedor == dominio.ProvedorOutro {
		host = strings.TrimSpace(e.Host)
		porta = parsePortaOpcional(e.Porta, 587)
	}
	if host == "" {
		return erroValidacao("Informe o endereço do servidor de saída (SMTP).")
	}

	atual, err := g.Configuracao.Obter(ctx)
	if err != nil {
		return err
	}
	// A tela devolve o marcador quando ninguém mexeu na senha — gravá-lo por cima apagaria a
	// senha boa e quebraria o envio sem ninguém ter mudado nada de propósito.
	if senha == dominio.SenhaMascarada && atual != nil {
		senha = atual.Senha
	}

	c := &dominio.ConfiguracaoEmail{
		Provedor: provedor, Host: host, Porta: porta, Usuario: usuario, Senha: senha,
		Remetente: ponteiro(e.Remetente), DestinatarioPadrao: ponteiro(e.DestinatarioPadrao),
		CopiaPara: ponteiro(e.CopiaPara), EnviarAutomatico: e.EnviarAutomatico, Ativo: true,
		LimiteAprovacaoCompra: 1000, LimiteAjusteInventario: 10,
	}
	if atual != nil {
		c.LimiteAprovacaoCompra = atual.LimiteAprovacaoCompra
		c.LimiteAjusteInventario = atual.LimiteAjusteInventario
	}
	return g.Configuracao.Salvar(ctx, c)
}

func parsePortaOpcional(v string, padrao int) int {
	n := int(parseFloatOpcional(v))
	if n <= 0 {
		return padrao
	}
	return n
}

type ResultadoTeste struct{ EnviadoPara string }

// TestarEnvio faz dois passos (conectar + mandar e-mail de teste) porque aceitar login não
// é o mesmo que conseguir entregar. Ver COMPORTAMENTO.md §7.
func (g *GerenciadorConfiguracaoEmail) TestarEnvio(ctx context.Context, sess identidade.Sessao) (*ResultadoTeste, error) {
	if !identidade.PodeAdministrar(sess.Cargo) {
		return nil, erroValidacao("Só o administrador do sistema mexe nas configurações.")
	}
	config, err := g.Configuracao.Obter(ctx)
	if err != nil {
		return nil, err
	}
	if config == nil {
		return nil, erroValidacao("Salve a configuração antes de testar.")
	}

	cfg := dominio.EmailConfig{Host: config.Host, Porta: config.Porta, Usuario: config.Usuario, Senha: config.Senha, Remetente: strPtrVal(config.Remetente)}
	if err := g.EmailRemetente.TestarConexao(cfg); err != nil {
		return nil, erroValidacao(g.EmailRemetente.TraduzirErro(err))
	}

	destino := config.Usuario
	if config.DestinatarioPadrao != nil && *config.DestinatarioPadrao != "" {
		destino = *config.DestinatarioPadrao
	}
	msg := dominio.EmailMensagem{
		Para: destino, Assunto: "Teste de envio — Almoxarifado Siqueira Campos",
		Corpo: "Este é um e-mail de teste do sistema de Almoxarifado.\n\n" +
			"Se você recebeu esta mensagem, as solicitações de compra vão sair normalmente por esta conta.\n\nNão é preciso responder.",
	}
	if err := g.EmailRemetente.Enviar(cfg, msg); err != nil {
		return nil, erroValidacao(g.EmailRemetente.TraduzirErro(err))
	}
	if err := g.Configuracao.MarcarTestada(ctx); err != nil {
		return nil, err
	}
	return &ResultadoTeste{EnviadoPara: destino}, nil
}

func (g *GerenciadorConfiguracaoEmail) Desativar(ctx context.Context, sess identidade.Sessao) error {
	if !identidade.PodeAdministrar(sess.Cargo) {
		return erroValidacao("Só o administrador do sistema mexe nas configurações.")
	}
	return g.Configuracao.AtualizarAtivo(ctx, false)
}
