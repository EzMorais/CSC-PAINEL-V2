// Package config carrega a configuração do processo a partir de variáveis de ambiente.
package config

import "os"

type Config struct {
	Porta          string
	CaminhoBanco   string
	AuthSecret     string
	ForcaHTTPS     bool
	URLPainel      string
	URLRH          string
	URLEstoque     string
	URLAlojamentos string
	URLFrota       string
	// URLPortal aponta pro Portal Next.js legado — só usada hoje pela tela de Cadastros
	// (obras/casas/veículos/máquinas/materiais), que ainda não migrou pro binário Go.
	URLPortal    string
	PastaUploads string
	// Endereços privados dos processos que ainda não migraram e do conector WhatsApp.
	// Nunca vão para o navegador: o binário os expõe sob /frota, /cadastros, /programacao e /whatsapp.
	FrotaUpstream       string
	CadastrosUpstream   string
	ProgramacaoUpstream string
	WhatsAppUpstream    string
}

func Carregar() Config {
	return Config{
		Porta:               getenv("PORTA", "3004"),
		CaminhoBanco:        getenv("DATABASE_PATH", "portal.db"),
		AuthSecret:          os.Getenv("AUTH_SECRET"),
		ForcaHTTPS:          os.Getenv("FORCA_HTTPS") == "1",
		URLPainel:           getenv("URL_PAINEL", "/painel"),
		URLRH:               getenv("URL_RH", "/rh"),
		URLEstoque:          getenv("URL_ESTOQUE", "/almoxarifado"),
		URLAlojamentos:      getenv("URL_ALOJAMENTOS", "/alojamentos"),
		URLFrota:            getenv("URL_FROTA", "/frota"),
		URLPortal:           getenv("URL_PORTAL", "/cadastros"),
		PastaUploads:        getenv("PASTA_UPLOADS", "dados"),
		FrotaUpstream:       getenv("FROTA_UPSTREAM", "http://localhost:3000"),
		CadastrosUpstream:   getenv("CADASTROS_UPSTREAM", "http://localhost:3004"),
		ProgramacaoUpstream: getenv("PROGRAMACAO_UPSTREAM", "http://localhost:3007"),
		WhatsAppUpstream:    getenv("WHATSAPP_UPSTREAM", "http://localhost:3006"),
	}
}

func getenv(chave, padrao string) string {
	if v := os.Getenv(chave); v != "" {
		return v
	}
	return padrao
}
