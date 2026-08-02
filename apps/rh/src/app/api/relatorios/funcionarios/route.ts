import { format } from 'date-fns'
import { gerarPlanilhaFuncionarios } from '@/lib/relatorios/exportar-funcionarios'
import { lerSessao } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Rota de API não passa pelo layout de `(app)`: sem esta checagem, o endereço entregaria
  // CPF e dados de contrato de todo mundo a quem digitasse a URL sem sessão nenhuma.
  if (!(await lerSessao())) {
    return new Response('Não autenticado', { status: 401 })
  }

  const modelo = new URL(request.url).searchParams.get('modelo') === '1'

  try {
    const buffer = await gerarPlanilhaFuncionarios(!modelo)
    const nome = modelo ? 'funcionarios-modelo.xlsx' : `funcionarios-rh-sc-${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar a planilha'
    return new Response(JSON.stringify({ erro }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
