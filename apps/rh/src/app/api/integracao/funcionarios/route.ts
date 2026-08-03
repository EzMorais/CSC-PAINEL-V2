import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao'
import { STATUS } from '@/lib/dominio/constantes'

export const dynamic = 'force-dynamic'

/**
 * Lista de funcionários para os outros módulos: o Almoxarifado monta o "quem recebeu" da
 * entrega de EPI, o Alojamentos monta o "quem vai morar aqui".
 *
 * Devolve o mínimo necessário para identificar a pessoa na tela — nome, matrícula, cargo,
 * obra, setor, nível de obra e foto. Sem CPF, salário, endereço ou telefone: quem aloca um
 * quarto precisa saber quem é a pessoa, não a vida dela, e um endereço que devolve dado
 * pessoal é um endereço que vaza dado pessoal quando alguém errar a configuração.
 *
 * Setor, nível e foto entram porque são justamente o que distingue as pessoas numa lista de
 * duzentas: sem eles, alocar alguém vira procurar um nome numa lista sem contexto nenhum.
 *
 * Desligado não entra: entregar EPI ou dar quarto a quem não trabalha mais é sempre erro.
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
        nivelObra: true,
        foto: true,
        cargo: { select: { nome: true } },
        obra: { select: { codigo: true } },
        departamento: { select: { nome: true, pai: { select: { nome: true } } } },
      },
    })

    return Response.json({
      funcionarios: funcionarios.map((f) => ({
        id: f.id,
        nome: f.nome,
        matricula: f.matricula,
        cargo: f.cargo?.nome ?? null,
        obraCodigo: f.obra?.codigo ?? null,
        departamentoNome: f.departamento?.nome ?? null,
        departamentoRamo: f.departamento?.pai?.nome ?? null,
        nivelObra: f.nivelObra,
        foto: f.foto,
      })),
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao listar funcionários.'
    return Response.json({ erro }, { status: 500 })
  }
}
