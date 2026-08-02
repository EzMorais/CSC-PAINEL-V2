import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormSolicitacao } from '@/components/solicitacoes/form-solicitacao'

export const metadata = { title: 'Nova solicitação — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default function NovaSolicitacaoPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/solicitacoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Solicitações
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nova solicitação de compra</h1>
      </header>

      <FormSolicitacao />
    </div>
  )
}
