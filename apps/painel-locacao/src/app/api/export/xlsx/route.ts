import { format } from 'date-fns'
import { gerarPlanilha } from '@/lib/planilha/exportar-xlsx'
import { lerSessao } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Rotas de API não passam pelo layout de `(app)`: sem esta linha, este endereço
  // entregaria a planilha inteira — custo por obra e valor por fornecedor — a quem
  // digitasse a URL sem sessão nenhuma.
  if (!(await lerSessao())) {
    return new Response('Não autenticado', { status: 401 })
  }

  try {
    const buffer = await gerarPlanilha()
    const nome = `locacoes-sc-${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar a planilha'
    return new Response(JSON.stringify({ erro }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
