// Package clienterh chama o módulo de RH pela rede — ver estoque/COMPORTAMENTO.md §6. O RH
// ainda roda em Next.js separado enquanto não migra pra este binário, então esta chamada
// cruza processo mesmo depois do Almoxarifado estar em Go (mesma situação transitória que o
// Portal teve enquanto convivia com os apps ainda não migrados).
package clienterh

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"siqueiracampos/servidor/internal/domain/estoque"
	"siqueiracampos/servidor/internal/services/integracao"
)

// timeout curto de propósito: o almoxarife está esperando na tela; se o RH não responde, a
// saída do material segue e fica marcada pendente — nunca trava a operação local por causa
// de um sistema vizinho fora do ar.
const timeout = 5 * time.Second

type Cliente struct {
	URLRH      string
	Integracao *integracao.Servico
	HTTP       *http.Client
}

func Novo(urlRH string, servicoIntegracao *integracao.Servico) *Cliente {
	return &Cliente{
		URLRH:      urlRH,
		Integracao: servicoIntegracao,
		HTTP:       &http.Client{Timeout: timeout},
	}
}

// EnviarFichaEpi manda a ficha de entrega de EPI pro RH — nunca lança pro chamador (o
// contrato é `estoque.ResultadoRH`, não `error`, de propósito: o chamador nunca deve tratar
// isto como exceção que desfaz a movimentação já gravada, ver COMPORTAMENTO.md §5). Satisfaz
// a porta estoque.ClienteRH.
func (c *Cliente) EnviarFichaEpi(ctx context.Context, ficha estoque.FichaEpi) estoque.ResultadoRH {
	token, err := c.Integracao.Assinar("estoque")
	if err != nil {
		return estoque.ResultadoRH{Erro: "Falha ao assinar o token: " + err.Error(), Permanente: true}
	}

	corpo, err := json.Marshal(ficha)
	if err != nil {
		return estoque.ResultadoRH{Erro: err.Error(), Permanente: true}
	}

	ctx, cancela := context.WithTimeout(ctx, timeout)
	defer cancela()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URLRH+"/api/integracao/entregas-epi", bytes.NewReader(corpo))
	if err != nil {
		return estoque.ResultadoRH{Erro: err.Error(), Permanente: true}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return estoque.ResultadoRH{Erro: fmt.Sprintf("O RH não respondeu em %ds.", int(timeout.Seconds())), Permanente: false}
		}
		return estoque.ResultadoRH{Erro: fmt.Sprintf("Não foi possível falar com o RH em %s. Ele está ligado?", c.URLRH), Permanente: false}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var corpo struct {
			Erro string `json:"erro"`
		}
		b, _ := io.ReadAll(resp.Body)
		_ = json.Unmarshal(b, &corpo)
		erro := corpo.Erro
		if erro == "" {
			erro = fmt.Sprintf("RH respondeu %d.", resp.StatusCode)
		}
		return estoque.ResultadoRH{Erro: erro, Permanente: resp.StatusCode >= 400 && resp.StatusCode < 500}
	}

	return estoque.ResultadoRH{OK: true}
}
