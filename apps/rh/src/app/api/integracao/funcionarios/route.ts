import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao'
import { STATUS } from '@/lib/dominio/constantes'

export const dynamic = 'force-dynamic'

/**
 * Lista de funcionários para o Almoxarifado montar o "quem recebeu" da entrega de EPI.
 *
 * Devolve o mínimo necessário para identificar a pessoa na tela — nome, matrícula, cargo e
 * obra. Sem CPF, salário, endereço ou telefone: o almoxarife precisa saber para quem está
 * entregando a bota, não a vida da pessoa, e um endereço que devolve dado pessoal é um
 * endereço que vaza dado pessoal quando alguém errar a configuração.
 *
 * Desligado não entra: entregar EPI a quem não trabalha mais é sempre erro de digitação.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  try {
    const funcionarios = await prisma.funcionario.findMany({
      where: { status: { not: STATUS.DESLIGADO } },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cargo: { select: { nome: true } },
        obra: { select: { codigo: true } },
      },
    })

    return Response.json({
      funcionarios: funcionarios.map((f) => ({
        id: f.id,
        nome: f.nome,
        matricula: f.matricula,
        cargo: f.cargo?.nome ?? null,
        obraCodigo: f.obra?.codigo ?? null,
      })),
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao listar funcionários.'
    return Response.json({ erro }, { status: 500 })
  }
}
