'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, KeyRound } from 'lucide-react'
import { criarUsuario, editarUsuario, redefinirSenha } from '@/actions/usuarios'
import {
  CARGO, ROTULO_CARGO, DESCRICAO_CARGO, TOM_CARGO,
  MODULO, ROTULO_MODULO, type Cargo, type Modulo,
} from '@/lib/dominio/cargos'
import type { UsuarioListado } from '@/queries/usuarios'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

/** ADMIN e DIRETORIA veem tudo por definição do cargo — marcar módulo para eles não muda nada. */
function acessoTotal(cargo: string) {
  return cargo === CARGO.ADMIN || cargo === CARGO.DIRETORIA
}

function LinhaUsuario({ usuario, souEu }: { usuario: UsuarioListado; souEu: boolean }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [cargo, setCargo] = useState(usuario.cargo)
  const [ativo, setAtivo] = useState(usuario.ativo)
  const [modulos, setModulos] = useState<string[]>(usuario.acessos.map((a) => a.modulo))
  const [novaSenha, setNovaSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar() {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await editarUsuario(usuario.id, { cargo, ativo, modulos })
      if (!r.ok) return setErro(r.erro)
      setAviso('Salvo. O novo cargo vale no próximo login desta pessoa.')
      router.refresh()
    })
  }

  function trocarSenha() {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await redefinirSenha(usuario.id, { senha: novaSenha })
      if (!r.ok) return setErro(r.erro)
      setNovaSenha('')
      setAviso('Senha redefinida. Passe a nova senha para a pessoa.')
    })
  }

  function alternarModulo(m: Modulo) {
    setModulos((atuais) => (atuais.includes(m) ? atuais.filter((x) => x !== m) : [...atuais, m]))
  }

  return (
    <li className={`px-3 py-2 ${!usuario.ativo ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {usuario.nome}
            {souEu && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
        </div>

        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[TOM_CARGO[usuario.cargo as Cargo] ?? 'devolvida']}`}>
          {ROTULO_CARGO[usuario.cargo as Cargo] ?? usuario.cargo}
        </span>

        <span className="shrink-0 text-xs text-muted-foreground">
          {acessoTotal(usuario.cargo)
            ? 'todos os sistemas'
            : usuario.acessos.length === 0
              ? 'nenhum sistema'
              : usuario.acessos.map((a) => ROTULO_MODULO[a.modulo as Modulo] ?? a.modulo).join(', ')}
        </span>

        {!usuario.ativo && <span className="shrink-0 text-xs text-destructive">inativo</span>}

        <button
          type="button" onClick={() => setAberto((v) => !v)} disabled={souEu}
          data-testid={`editar-${usuario.email}`}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40"
          title={souEu ? 'Você não pode alterar o próprio acesso' : undefined}
        >
          {aberto ? 'Fechar' : 'Editar'}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Cargo</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} className={CAMPO}>
                {Object.values(CARGO).map((c) => (
                  <option key={c} value={c}>{ROTULO_CARGO[c]}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{DESCRICAO_CARGO[cargo as Cargo]}</p>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Sistemas que acessa</p>
              {acessoTotal(cargo) ? (
                <p className="text-xs text-muted-foreground">
                  {ROTULO_CARGO[cargo as Cargo]} enxerga todos os sistemas por definição do
                  cargo — não é preciso marcar nada.
                </p>
              ) : (
                <div className="space-y-1">
                  {Object.values(MODULO).map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={modulos.includes(m)} onChange={() => alternarModulo(m)} />
                      {ROTULO_MODULO[m]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Usuário ativo
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={salvar} disabled={pendente}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          <div className="border-t border-border pt-3">
            <label className="mb-1 block text-sm font-medium">Redefinir senha</label>
            <div className="flex flex-wrap gap-2">
              <input
                type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha (8+ caracteres)" className={`${CAMPO} max-w-xs`}
              />
              <button
                type="button" onClick={trocarSenha} disabled={pendente || novaSenha.length < 8}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <KeyRound className="size-3.5" /> Redefinir
              </button>
            </div>
          </div>

          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          {aviso && <p role="status" className="text-xs text-muted-foreground">{aviso}</p>}
        </div>
      )}
    </li>
  )
}

export function ListaUsuarios({ usuarios, meuId }: { usuarios: UsuarioListado[]; meuId: string }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [cargo, setCargo] = useState<string>(CARGO.OPERACIONAL)
  const [modulos, setModulos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    iniciar(async () => {
      const r = await criarUsuario({ ...Object.fromEntries(fd.entries()), cargo, modulos })
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      setModulos([])
      setCargo(CARGO.OPERACIONAL)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{usuarios.length} usuário{usuarios.length === 1 ? '' : 's'}</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="novo-usuario"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Novo usuário
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={aoSubmeter} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome completo *</label>
              <input id="nome" name="nome" required autoFocus className={CAMPO} />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail *</label>
              <input id="email" name="email" type="email" required className={CAMPO} />
            </div>
            <div>
              <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha inicial *</label>
              <input id="senha" name="senha" type="password" required minLength={8} className={CAMPO} />
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres. A pessoa troca depois.</p>
            </div>
            <div>
              <label htmlFor="telefone" className="mb-1 block text-sm font-medium">Telefone</label>
              <input id="telefone" name="telefone" className={CAMPO} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Cargo *</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)} className={CAMPO}>
                {Object.values(CARGO).map((c) => (
                  <option key={c} value={c}>{ROTULO_CARGO[c]}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{DESCRICAO_CARGO[cargo as Cargo]}</p>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Sistemas que acessa</p>
              {acessoTotal(cargo) ? (
                <p className="text-xs text-muted-foreground">
                  {ROTULO_CARGO[cargo as Cargo]} enxerga todos por definição do cargo.
                </p>
              ) : (
                <div className="space-y-1">
                  {Object.values(MODULO).map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox" checked={modulos.includes(m)}
                        onChange={() =>
                          setModulos((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]))
                        }
                      />
                      {ROTULO_MODULO[m]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {erro && <p role="alert" data-testid="erro-usuario" className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-usuario"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar usuário'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border" data-testid="lista-usuarios">
        {usuarios.map((u) => <LinhaUsuario key={u.id} usuario={u} souEu={u.id === meuId} />)}
      </ul>
    </div>
  )
}
