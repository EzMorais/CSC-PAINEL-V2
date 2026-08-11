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
}

func Carregar() Config {
	return Config{
		Porta:          getenv("PORTA", "3004"),
		CaminhoBanco:   getenv("DATABASE_PATH", "portal.db"),
		AuthSecret:     os.Getenv("AUTH_SECRET"),
		ForcaHTTPS:     os.Getenv("FORCA_HTTPS") == "1",
		URLPainel:      getenv("URL_PAINEL", "http://localhost:3001"),
		URLRH:          getenv("URL_RH", "http://localhost:3002"),
		URLEstoque:     getenv("URL_ESTOQUE", "http://localhost:3003"),
		URLAlojamentos: getenv("URL_ALOJAMENTOS", "http://localhost:3005"),
		URLFrota:       getenv("URL_FROTA", "http://localhost:3000"),
		URLPortal:      getenv("URL_PORTAL", "http://localhost:3004"),
		PastaUploads:   getenv("PASTA_UPLOADS", "dados"),
	}
}

func getenv(chave, padrao string) string {
	if v := os.Getenv(chave); v != "" {
		return v
	}
	return padrao
}
