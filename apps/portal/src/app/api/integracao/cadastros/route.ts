import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao-recebida'
import { ehTipoValido } from '@/lib/dominio/cadastros'

export const dynamic = 'force-dynamic'

/**
 * O catálogo do Portal para os outros módulos — hoje, as máquinas que a Programação escala
 * no pé de cada frente (retroescavadeira, bob-cat).
 *
 * Só itens ATIVOS: um item desativado continua existindo para o histórico, mas oferecer uma
 * máquina baixada na lista de escala é oferecer o que não existe mais no pátio.
 */
export async function GET(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  const tipo = new URL(request.url).searchParams.get('tipo')
  if (tipo && !ehTipoValido(tipo)) {
    return Response.json({ erro: `Tipo desconhecido: ${tipo}` }, { status: 400 })
  }

  try {
    const itens = await prisma.itemCadastro.findMany({
      where: { ativo: true, ...(tipo ? { tipo } : {}) },
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
      select: {
        id: true, tipo: true, codigo: true, nome: true,
        detalhe: true, identificador: true, unidade: true,
      },
    })
    return Response.json({ itens })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao listar o catálogo.'
    return Response.json({ erro }, { status: 500 })
  }
}
