'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { criarUsuario, editarUsuario } from '@/actions/usuarios'
import { dataBR } from '@/lib/dominio/formato'
import type { UsuarioListado } from '@/queries/usuarios'

const CAMPO =
  'rounded-md border border-input bg-background px-2 py-1 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const PAPEIS = ['ADMIN', 'OPERADOR'] as const

function LinhaUsuario({ usuario, souEu }: { usuario: UsuarioListado; souEu: boolean }) {
  const [papel, setPapel] = useState(usuario.papel)
  const [ativo, setAtivo] = useState(usuario.ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar(proximoPapel: string, proximoAtivo: boolean) {
    setErro(null)
    iniciar(async () => {
      const r = await editarUsuario(usuario.id, { papel: proximoPapel, ativo: proximoAtivo })
      if (!r.ok) setErro(r.erro)
    })
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 ${!ativo ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <span className="font-medium">{usuario.nome}</span>
        {souEu && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
        <span className="block text-xs text-muted-foreground">{usuario.email} · desde {dataBR(usuario.criadoEm)}</span>
      </div>
      <select
        value={papel} disabled={pendente || souEu} className={CAMPO}
        onChange={(e) => { setPapel(e.target.value); salvar(e.target.value, ativo) }}
      >
        {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativo} disabled={pendente || souEu}
          onChange={(e) => { setAtivo(e.target.checked); salvar(papel, e.target.checked) }}
        />
        {ativo ? 'Ativo' : 'Inativo'}
      </label>
      {erro && <p className="basis-full text-xs text-destructive">{erro}</p>}
    </li>
  )
}

export function ListaUsuarios({ usuarios, meuId }: { usuarios: UsuarioListado[]; meuId: string }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState<(typeof PAPEIS)[number]>('OPERADOR')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function criar() {
    setErro(null)
    iniciar(async () => {
      const r = await criarUsuario({ nome, email, senha, papel })
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      setNome(''); setEmail(''); setSenha('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Usuários</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Novo usuário
          </button>
        )}
      </div>

      {criando && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoFocus className={CAMPO} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className={CAMPO} />
            <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha (8+ caracteres)" type="password" className={CAMPO} />
            <select value={papel} onChange={(e) => setPapel(e.target.value as (typeof PAPEIS)[number])} className={CAMPO}>
              {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button" onClick={criar} disabled={pendente || !nome.trim() || !email.trim() || senha.length < 8}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {usuarios.map((u) => <LinhaUsuario key={u.id} usuario={u} souEu={u.id === meuId} />)}
      </ul>
    </div>
  )
}
