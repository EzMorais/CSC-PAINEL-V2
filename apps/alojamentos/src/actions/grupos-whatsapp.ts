'use server'

import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/**
 * Liga (ou desliga) um grupo de WhatsApp a um alojamento.
 *
 * `grupoId` vazio desfaz o vínculo. Sem vínculo, as mensagens daquele grupo passam a ser
 * ignoradas — que é o comportamento certo para um grupo que não é de alojamento.
 */
export async function vincularGrupo(alojamentoId: string, grupoId: string): Promise<Resultado> {
  await exigirLancamento()

  const id = grupoId.trim() || null

  try {
    // Tira o grupo de quem o tivesse antes. Sem isto, o índice único recusaria a troca com
    // um erro de banco em vez de simplesmente mover o vínculo — que é o que quem está na
    // tela quis fazer ao escolher outro alojamento para o mesmo grupo.
    if (id) {
      await prisma.alojamento.updateMany({
        where: { grupoWhatsappId: id, NOT: { id: alojamentoId } },
        data: { grupoWhatsappId: null },
      })
    }

    await prisma.alojamento.update({ where: { id: alojamentoId }, data: { grupoWhatsappId: id } })
    revalidarTelas('/configuracoes/whatsapp', '/alojamentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao vincular o grupo.' }
  }
}
