package identidade

import (
	"fmt"
	"net/http"
	"strings"

	aplicacao "siqueiracampos/servidor/internal/application/identidade"
	dominio "siqueiracampos/servidor/internal/domain/identidade"
	tpl "siqueiracampos/servidor/templates/identidade"
)

type overrideLinha struct {
	aberta   bool
	mensagem string
	erro     string
}

func textoSistemas(u dominio.Usuario) string {
	if u.Cargo == dominio.CargoAdmin || u.Cargo == dominio.CargoDiretoria {
		return "todos os sistemas"
	}
	if len(u.Modulos) == 0 {
		return "nenhum sistema"
	}
	rotulos := make([]string, len(u.Modulos))
	for i, m := range u.Modulos {
		rotulos[i] = dominio.RotuloModulo[m]
	}
	return strings.Join(rotulos, ", ")
}

func modulosString(modulos []dominio.Modulo) []string {
	s := make([]string, len(modulos))
	for i, m := range modulos {
		s[i] = string(m)
	}
	return s
}

// renderUsuarios monta a tela inteira de /usuarios. `overrideID`+`override` deixam uma
// linha específica pré-aberta com mensagem de sucesso ou erro — usado tanto no redirect
// pós-sucesso (via query string) quanto na resposta direta de uma falha de validação.
func (h *Handlers) renderUsuarios(w http.ResponseWriter, r *http.Request, admin dominio.Sessao, criacao tpl.FormCriacao, overrideID string, override overrideLinha) {
	usuariosDB, err := h.Usuarios.Listar(r.Context())
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}

	linhas := make([]tpl.LinhaUsuario, len(usuariosDB))
	for i, u := range usuariosDB {
		linha := tpl.LinhaUsuario{
			ID: u.ID, Nome: u.Nome, Email: u.Email,
			Cargo: string(u.Cargo), RotuloCargo: dominio.RotuloCargo[u.Cargo],
			Ativo:               u.Ativo,
			SistemasTexto:       textoSistemas(u),
			ModulosSelecionados: modulosString(u.Modulos),
			SouEu:               u.ID == admin.ID,
		}
		if u.ID == overrideID {
			linha.Aberta = override.aberta
			linha.Mensagem = override.mensagem
			linha.Erro = override.erro
		}
		linhas[i] = linha
	}

	acessosDB, err := h.Registros.Ultimos(r.Context(), 15)
	if err != nil {
		http.Error(w, "erro interno", http.StatusInternalServerError)
		return
	}
	acessos := make([]tpl.LinhaAcesso, len(acessosDB))
	for i, a := range acessosDB {
		nomeOuEmail := a.Email
		if a.Nome != nil && *a.Nome != "" {
			nomeOuEmail = *a.Nome
		}
		motivo := ""
		if a.Motivo != nil {
			motivo = *a.Motivo
		}
		acessos[i] = tpl.LinhaAcesso{
			Sucesso: a.Sucesso, NomeOuEmail: nomeOuEmail, Motivo: motivo,
			DataHora: a.Ocorrido.Local().Format("02/01/2006 15:04"),
		}
	}

	total := fmt.Sprintf("%d usuário", len(linhas))
	if len(linhas) != 1 {
		total += "s"
	}

	tpl.Usuarios(linhas, criacao, acessos, opcoesCargo(), opcoesModulo(), total).Render(r.Context(), w)
}

func (h *Handlers) UsuariosListar(w http.ResponseWriter, r *http.Request) {
	admin, ok := h.Sessoes.ExigirAdmin(w, r)
	if !ok {
		return
	}

	overrideID, override := "", overrideLinha{}
	if id := r.URL.Query().Get("editado"); id != "" {
		overrideID = id
		override = overrideLinha{aberta: true, mensagem: "Salvo. O novo cargo vale no próximo login desta pessoa."}
	} else if id := r.URL.Query().Get("senha"); id != "" {
		overrideID = id
		override = overrideLinha{aberta: true, mensagem: "Senha redefinida. Passe a nova senha para a pessoa."}
	}

	h.renderUsuarios(w, r, *admin, tpl.FormCriacao{}, overrideID, override)
}

func (h *Handlers) UsuariosCriar(w http.ResponseWriter, r *http.Request) {
	admin, ok := h.Sessoes.ExigirAdmin(w, r)
	if !ok {
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	entrada := aplicacao.EntradaCriarUsuario{
		Nome: r.PostFormValue("nome"), Email: r.PostFormValue("email"), Senha: r.PostFormValue("senha"),
		Cargo: r.PostFormValue("cargo"), Telefone: r.PostFormValue("telefone"),
		Modulos: r.PostForm["modulos"],
	}

	if _, err := h.Gerenciador.Criar(r.Context(), entrada); err != nil {
		criacao := tpl.FormCriacao{
			Aberto: true, Erro: err.Error(),
			Nome: entrada.Nome, Email: entrada.Email, Telefone: entrada.Telefone, Cargo: entrada.Cargo,
			Modulos: entrada.Modulos,
		}
		h.renderUsuarios(w, r, *admin, criacao, "", overrideLinha{})
		return
	}

	http.Redirect(w, r, "/usuarios", http.StatusSeeOther)
}

func (h *Handlers) UsuariosEditar(w http.ResponseWriter, r *http.Request) {
	admin, ok := h.Sessoes.ExigirAdmin(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	entrada := aplicacao.EntradaEditarUsuario{
		Cargo: r.PostFormValue("cargo"), Ativo: r.PostFormValue("ativo") == "1",
		Modulos: r.PostForm["modulos"],
	}

	if err := h.Gerenciador.Editar(r.Context(), *admin, id, entrada); err != nil {
		h.renderUsuarios(w, r, *admin, tpl.FormCriacao{}, id, overrideLinha{aberta: true, erro: err.Error()})
		return
	}

	http.Redirect(w, r, "/usuarios?editado="+id, http.StatusSeeOther)
}

func (h *Handlers) UsuariosRedefinirSenha(w http.ResponseWriter, r *http.Request) {
	admin, ok := h.Sessoes.ExigirAdmin(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := r.ParseForm(); err != nil {
		http.Error(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	if err := h.Gerenciador.RedefinirSenha(r.Context(), id, r.PostFormValue("senha")); err != nil {
		h.renderUsuarios(w, r, *admin, tpl.FormCriacao{}, id, overrideLinha{aberta: true, erro: err.Error()})
		return
	}

	http.Redirect(w, r, "/usuarios?senha="+id, http.StatusSeeOther)
}
