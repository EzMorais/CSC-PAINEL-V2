import { prisma } from '@/lib/prisma'

/** As últimas mensagens, para conferir o que entrou e o que saiu. */
export async function ultimasMensagens(limite = 30) {
  return prisma.mensagemWhatsapp.findMany({ orderBy: { criadoEm: 'desc' }, take: limite })
}

export type MensagemListada = Awaited<ReturnType<typeof ultimasMensagens>>[number]

/**
 * Quantos moradores ativos ainda estão sem WhatsApp.
 *
 * É o número que decide se a integração serve para alguma coisa: com metade do pessoal sem
 * telefone, metade das mensagens que chegarem cai no "não reconheci o seu número".
 */
export async function cadastroDeTelefones() {
  const [total, comTelefone] = await Promise.all([
    prisma.alocacao.count({ where: { status: 'ATIVA' } }),
    prisma.alocacao.count({ where: { status: 'ATIVA', telefone: { not: null } } }),
  ])
  return { total, comTelefone, semTelefone: total - comTelefone }
}
