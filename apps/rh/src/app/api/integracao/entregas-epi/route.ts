import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao'
import { revalidarTelas } from '@/lib/revalidar'

export const dynamic = 'force-dynamic'

const dataIso = z.string().trim().min(1).transform((v) => new Date(v))

const esquema = z.object({
  movimentacaoId: z.string().trim().min(1),
  funcionarioId: z.string().trim().min(1),
  materialCodigo: z.string().trim().min(1),
  materialNome: z.string().trim().min(1),
  unidade: z.string().trim().min(1),
  quantidade: z.number().positive(),
  ca: z.string().trim().optional().nullable(),
  validadeCA: z.union([dataIso, z.null()]).optional(),
  entregueEm: dataIso,
  entreguePor: z.string().trim().optional().nullable(),
  observacao: z.string().trim().optional().nullable(),
})

/**
 * Recebe do Almoxarifado a ficha de entrega de um EPI.
 *
 * É IDEMPOTENTE por `movimentacaoId`: reenviar a mesma entrega devolve a ficha que já
 * existe, com 200, em vez de criar uma segunda. Isso é o que permite ao almoxarifado
 * reenviar sem medo quando a primeira tentativa falhou na rede — sem idempotência, a única
 * escolha seria "reenviar e arriscar duplicar" ou "não reenviar e arriscar perder", e as
 * duas produzem uma ficha errada num documento que a fiscalização lê.
 */
export async function POST(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição não é JSON válido.' }, { status: 400 })
  }

  const parsed = esquema.safeParse(corpo)
  if (!parsed.success) {
    return Response.json(
      { erro: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      { status: 400 },
    )
  }
  const d = parsed.data

  try {
    const jaExiste = await prisma.entregaEpi.findUnique({
      where: { movimentacaoId: d.movimentacaoId },
      select: { id: true },
    })
    if (jaExiste) {
      return Response.json({ id: jaExiste.id, duplicada: true }, { status: 200 })
    }

    const funcionario = await prisma.funcionario.findUnique({
      where: { id: d.funcionarioId },
      select: { id: true, nome: true },
    })
    if (!funcionario) {
      // 422 e não 404: o endereço existe, o que não existe é a pessoa. O almoxarifado
      // precisa distinguir "endereço errado" de "funcionário que sumiu do RH" — no segundo
      // caso, reenviar não adianta, alguém tem de corrigir o cadastro.
      return Response.json({ erro: 'Funcionário não encontrado no RH.' }, { status: 422 })
    }

    const entrega = await prisma.entregaEpi.create({
      data: {
        movimentacaoId: d.movimentacaoId,
        funcionarioId: d.funcionarioId,
        materialCodigo: d.materialCodigo,
        materialNome: d.materialNome,
        unidade: d.unidade,
        quantidade: d.quantidade,
        ca: d.ca ?? null,
        validadeCA: d.validadeCA ?? null,
        entregueEm: d.entregueEm,
        entreguePor: d.entreguePor ?? null,
        observacao: d.observacao ?? null,
      },
    })

    revalidarTelas('/epis', '/', `/funcionarios/${d.funcionarioId}`)
    return Response.json({ id: entrega.id, duplicada: false }, { status: 201 })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao registrar a entrega de EPI.'
    return Response.json({ erro }, { status: 500 })
  }
}
