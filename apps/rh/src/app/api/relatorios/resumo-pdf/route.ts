import { format } from 'date-fns'
import { gerarResumoPdf } from '@/lib/relatorios/exportar-resumo-pdf'
import { lerSessao } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Ver comentário em api/relatorios/funcionarios: layout não cobre rota de API.
  if (!(await lerSessao())) {
    return new Response('Não autenticado', { status: 401 })
  }

  try {
    const buffer = await gerarResumoPdf()
    const nome = `resumo-sst-${format(new Date(), 'yyyy-MM-dd')}.pdf`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar o PDF'
    return new Response(JSON.stringify({ erro }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
