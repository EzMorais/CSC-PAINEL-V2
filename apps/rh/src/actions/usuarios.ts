'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquemaCriacao = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  email: z.string().trim().email('E-mail inválido.'),
  senha: z.string().min(8, 'Senha precisa de pelo menos 8 caracteres.'),
  papel: z.enum(['ADMIN', 'OPERADOR']),
})

export async function criarUsuario(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirSessao()

  const parsed = esquemaCriacao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome: d.nome,
        email: d.email.toLowerCase(),
        senhaHash: bcrypt.hashSync(d.senha, 10),
        papel: d.papel,
      },
    })
    revalidarTelas('/configuracoes')
    return { ok: true, dados: { id: usuario.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Já existe um usuário com esse e-mail.' : 'Falha ao criar o usuário.'
    return { ok: false, erro: msg }
  }
}

const esquemaEdicao = z.object({
  papel: z.enum(['ADMIN', 'OPERADOR']),
  ativo: z.coerce.boolean(),
})

/** Inativar em vez de excluir: os registros que essa pessoa criou (eventos, entregas...) guardam o nome dela em texto, não uma referência — apagar o usuário não apagaria histórico nenhum, mas inativar já impede novo login sem perder o rastro de quem é quem. */
export async function editarUsuario(id: string, entrada: unknown): Promise<Resultado> {
  const sessao = await exigirSessao()
  if (id === sessao.id) return { ok: false, erro: 'Você não pode alterar o próprio usuário por aqui.' }

  const parsed = esquemaEdicao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.usuario.update({ where: { id }, data: parsed.data })
    revalidarTelas('/configuracoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o usuário.' }
  }
}
