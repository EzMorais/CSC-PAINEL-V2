import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/auth'
import { Cabecalho } from '@/components/layout/cabecalho'
import { CARGO } from '@/lib/dominio/cargos'

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão. Isto cobre páginas, não Server Actions: cada action chama `exigirSessao()` por
 * conta própria.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao()
  if (!sessao) redirect('/entrar')

  return (
    <div className="min-h-dvh">
      <Cabecalho
        usuario={{ nome: sessao.nome, email: sessao.email, cargo: sessao.cargo }}
        ehAdmin={sessao.cargo === CARGO.ADMIN}
      />
      <main>{children}</main>
    </div>
  )
}
