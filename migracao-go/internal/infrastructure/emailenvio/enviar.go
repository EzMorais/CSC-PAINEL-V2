// Package emailenvio manda e-mail via SMTP com a conta configurada pelo almoxarife — ver
// estoque/COMPORTAMENTO.md §7. Usa net/smtp (stdlib) de propósito: é só autenticação
// usuário/senha de aplicativo + STARTTLS/TLS implícito, não precisa de dependência extra.
package emailenvio

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"regexp"
	"strconv"
	"strings"
)

type Config struct {
	Host      string
	Porta     int
	Usuario   string
	Senha     string
	Remetente string // se vazio, usa Usuario
}

type Mensagem struct {
	Para      string
	Assunto   string
	Corpo     string
	CopiaPara string
}

// TraduzirErro troca a mensagem crua do servidor SMTP por uma frase que diz o que fazer — o
// erro mais comum, de longe, é usar a senha normal da conta em vez da senha de aplicativo.
func TraduzirErro(err error) string {
	if err == nil {
		return ""
	}
	bruto := err.Error()

	switch {
	case matchAny(bruto, `(?i)invalid login|535|username and password not accepted|authentication failed`):
		return "O servidor recusou o usuário ou a senha. Lembre: aqui vai a SENHA DE APLICATIVO, " +
			"não a senha que você usa para entrar no e-mail. Veja as instruções na tela."
	case matchAny(bruto, `(?i)no such host|lookup .* :|dns`):
		return "Não encontrei o servidor de e-mail. Confira o endereço do servidor e a conexão com a internet."
	case matchAny(bruto, `(?i)timeout|connection refused|i/o timeout`):
		return "O servidor de e-mail não respondeu. Pode ser a porta bloqueada pelo antivírus ou pelo firewall da empresa."
	case matchAny(bruto, `(?i)certificate|x509`):
		return "O certificado do servidor de e-mail não foi aceito. Confira o endereço e a porta."
	default:
		return bruto
	}
}

func matchAny(texto, padrao string) bool {
	ok, _ := regexp.MatchString(padrao, texto)
	return ok
}

func conectar(cfg Config) (*smtp.Client, error) {
	endereco := net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Porta))

	// 465 já começa criptografado; 587 (e demais) começam abertos e sobem para TLS no meio
	// da conversa (STARTTLS). Trocar isso faz o servidor recusar a conexão.
	if cfg.Porta == 465 {
		conn, err := tls.Dial("tcp", endereco, &tls.Config{ServerName: cfg.Host})
		if err != nil {
			return nil, err
		}
		cliente, err := smtp.NewClient(conn, cfg.Host)
		if err != nil {
			conn.Close()
			return nil, err
		}
		return cliente, nil
	}

	conn, err := net.Dial("tcp", endereco)
	if err != nil {
		return nil, err
	}
	cliente, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if ok, _ := cliente.Extension("STARTTLS"); ok {
		if err := cliente.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
			cliente.Close()
			return nil, err
		}
	}
	return cliente, nil
}

// TestarConexao confere se a conta aceita a conexão, sem mandar e-mail para ninguém.
func TestarConexao(cfg Config) error {
	cliente, err := conectar(cfg)
	if err != nil {
		return err
	}
	defer cliente.Close()

	auth := smtp.PlainAuth("", cfg.Usuario, cfg.Senha, cfg.Host)
	if err := cliente.Auth(auth); err != nil {
		return err
	}
	return cliente.Quit()
}

func Enviar(cfg Config, msg Mensagem) error {
	cliente, err := conectar(cfg)
	if err != nil {
		return err
	}
	defer cliente.Close()

	auth := smtp.PlainAuth("", cfg.Usuario, cfg.Senha, cfg.Host)
	if err := cliente.Auth(auth); err != nil {
		return err
	}

	remetente := cfg.Remetente
	if remetente == "" {
		remetente = cfg.Usuario
	}
	if err := cliente.Mail(remetente); err != nil {
		return err
	}
	destinatarios := []string{msg.Para}
	if msg.CopiaPara != "" {
		destinatarios = append(destinatarios, msg.CopiaPara)
	}
	for _, d := range destinatarios {
		if err := cliente.Rcpt(d); err != nil {
			return err
		}
	}

	escritor, err := cliente.Data()
	if err != nil {
		return err
	}
	var corpo strings.Builder
	fmt.Fprintf(&corpo, "From: %s\r\nTo: %s\r\n", remetente, msg.Para)
	if msg.CopiaPara != "" {
		fmt.Fprintf(&corpo, "Cc: %s\r\n", msg.CopiaPara)
	}
	fmt.Fprintf(&corpo, "Subject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\n\r\n%s",
		msg.Assunto, msg.Corpo)
	if _, err := escritor.Write([]byte(corpo.String())); err != nil {
		return err
	}
	if err := escritor.Close(); err != nil {
		return err
	}
	return cliente.Quit()
}
