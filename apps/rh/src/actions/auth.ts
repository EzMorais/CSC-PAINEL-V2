'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { autenticar, criarSessao, encerrarSessao } from '@/lib/auth'

export type EstadoLogin = { erro: string } | null

const esquema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

export async function entrar(_estado: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  const parsed = esquema.safeParse({
    email: fd.get('email'),
    senha: fd.get('senha'),
  })
  if (!parsed.success) {
    return { erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  const sessao = await autenticar(parsed.data.email, parsed.data.senha)

  // Uma mensagem só para e-mail inexistente e senha errada: dizer qual dos dois falhou
  // entrega a lista de quem tem conta.
  if (!sessao) return { erro: 'E-mail ou senha não conferem.' }

  await criarSessao(sessao)
  redirect('/')
}

export async function sair() {
  await encerrarSessao()
  redirect('/entrar')
}
