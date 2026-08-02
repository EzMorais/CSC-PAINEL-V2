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
  const parsed = esquema.safeParse({ email: fd.get('email'), senha: fd.get('senha') })
  if (!parsed.success) {
    return { erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  const sessao = await autenticar(parsed.data.email, parsed.data.senha)

  // Uma mensagem só para e-mail inexistente, senha errada e conta inativa: dizer qual dos
  // três falhou entregaria a lista de quem tem conta na empresa.
  if (!sessao) return { erro: 'E-mail ou senha não conferem.' }

  await criarSessao(sessao)

  // O destino vem de um campo escondido no formulário, para quem clicou num link de módulo
  // e caiu no login voltar para onde queria ir. Só caminho relativo é aceito — um endereço
  // completo aqui deixaria qualquer um mandar um link que loga a pessoa e a joga em outro
  // site parecido com este.
  const destino = String(fd.get('destino') ?? '')
  redirect(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/')
}

export async function sair() {
  await encerrarSessao()
  redirect('/entrar')
}
