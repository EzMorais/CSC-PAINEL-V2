package emailenvio

import (
	"siqueiracampos/servidor/internal/domain/estoque"
)

// Adaptador satisfaz a porta estoque.EmailRemetente sobre as funções de pacote acima —
// existe pra camada de aplicação depender só da interface de domínio, nunca deste pacote.
type Adaptador struct{}

func NovoAdaptador() *Adaptador { return &Adaptador{} }

func paraConfig(c estoque.EmailConfig) Config {
	return Config{Host: c.Host, Porta: c.Porta, Usuario: c.Usuario, Senha: c.Senha, Remetente: c.Remetente}
}

func (Adaptador) Enviar(cfg estoque.EmailConfig, msg estoque.EmailMensagem) error {
	return Enviar(paraConfig(cfg), Mensagem{Para: msg.Para, Assunto: msg.Assunto, Corpo: msg.Corpo, CopiaPara: msg.CopiaPara})
}

func (Adaptador) TestarConexao(cfg estoque.EmailConfig) error {
	return TestarConexao(paraConfig(cfg))
}

func (Adaptador) TraduzirErro(err error) string {
	return TraduzirErro(err)
}
