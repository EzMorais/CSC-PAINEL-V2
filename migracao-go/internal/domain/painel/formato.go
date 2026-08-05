package painel

import "siqueiracampos/servidor/internal/domain/comum"

// BRL, DataBR, DataLocalBR e ParseDataBR moraram aqui originalmente; agora vivem em
// internal/domain/comum (compartilhado com o Almoxarifado). Aliases mantidos para não
// obrigar o resto do pacote painel a trocar de nome.
var (
	BRL         = comum.BRL
	DataBR      = comum.DataBR
	DataLocalBR = comum.DataLocalBR
	ParseDataBR = comum.ParseDataBR
)
