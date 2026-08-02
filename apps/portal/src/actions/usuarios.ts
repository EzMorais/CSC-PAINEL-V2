'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirAdmin } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { CARGO, MODULO } from '@/lib/dominio/cargos'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const cargos = Object.values(CARGO) as [string, ...string[]]
const modulos = Object.values(MODULO) as [string, ...string[]]

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquemaCriacao = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  email: z.string().trim().email('E-mail inválido.'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'),
  cargo: z.enum(cargos),
  telefone: opcional,
  observacao: opcional,
  modulos: z.array(z.enum(modulos)).default([]),
})

export async function criarUsuario(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirAdmin()

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
        cargo: d.cargo,
        telefone: d.telefone ?? null,
        observacao: d.observacao ?? null,
        acessos: { create: d.modulos.map((modulo) => ({ modulo })) },
      },
    })
    revalidarTelas('/usuarios')
    return { ok: true, dados: { id: usuario.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Já existe um usuário com esse e-mail.'
      : 'Falha ao cadastrar o usuário.'
    return { ok: false, erro: msg }
  }
}

const esquemaEdicao = z.object({
  cargo: z.enum(cargos),
  ativo: z.coerce.boolean(),
  modulos: z.array(z.enum(modulos)).default([]),
})

export async function editarUsuario(id: string, entrada: unknown): Promise<Resultado> {
  const admin = await exigirAdmin()

  // Ninguém tira o próprio acesso. Sem esta trava, um administrador distraído se rebaixa
  // para Consulta e não existe mais quem consiga desfazer — a recuperação exigiria mexer
  // no banco à mão.
  if (id === admin.id) {
    return { ok: false, erro: 'Você não pode mudar o próprio cargo nem se desativar. Peça a outro administrador.' }
  }

  const parsed = esquemaEdicao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    // Apaga e recria os acessos numa transação só: se apagar der certo e criar falhar, a
    // pessoa ficaria sem módulo nenhum sem ninguém ter pedido isso.
    await prisma.$transaction([
      prisma.usuario.update({ where: { id }, data: { cargo: d.cargo, ativo: d.ativo } }),
      prisma.acessoModulo.deleteMany({ where: { usuarioId: id } }),
      prisma.acessoModulo.createMany({ data: d.modulos.map((modulo) => ({ usuarioId: id, modulo })) }),
    ])
    revalidarTelas('/usuarios')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o usuário.' }
  }
}

const esquemaSenha = z.object({
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'),
})

export async function redefinirSenha(id: string, entrada: unknown): Promise<Resultado> {
  await exigirAdmin()

  const parsed = esquemaSenha.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.usuario.update({
      where: { id },
      data: { senhaHash: bcrypt.hashSync(parsed.data.senha, 10) },
    })
    revalidarTelas('/usuarios')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao redefinir a senha.' }
  }
}
