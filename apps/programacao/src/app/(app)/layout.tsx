import { redirect } from 'next/navigation'
import { CalendarDays, Columns3, Users, Truck } from 'lucide-react'
import { lerSessao } from '@/lib/auth'
import { HudProgramacao } from '@/components/layout/hud-programacao'

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão. Isto cobre páginas, não Server Actions: cada action chama `exigirLancamento()`
 * por conta própria.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao()
  if (!sessao) redirect('/entrar')

  const itens = [
    { href: '/', rotulo: 'Dias', icone: <CalendarDays className="size-4" /> },
    { href: '/frentes', rotulo: 'Clientes', icone: <Columns3 className="size-4" /> },
    { href: '/funcionarios', rotulo: 'Funcionários', icone: <Users className="size-4" /> },
    { href: '/veiculos', rotulo: 'Veículos', icone: <Truck className="size-4" /> },
  ]

  return (
    <div className="min-h-dvh">
      <HudProgramacao
        usuario={{ nome: sessao.nome, email: sessao.email, cargo: sessao.cargo }}
        itens={itens}
      />

      <main>{children}</main>
    </div>
  )
}
