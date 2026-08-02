import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { HubNavegacao } from '@/components/layout/hub-navegacao'

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão — e sem a navegação em volta. Toda rota dentro de `(app)/` herda a proteção só
 * por estar na pasta.
 *
 * Isto cobre páginas, não Server Actions nem rotas de API: layouts não são executados
 * para nenhum dos dois. Cada action chama `exigirSessao()` por conta própria.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao()
  if (!sessao) redirect('/entrar')

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar usuario={{ nome: sessao.nome, email: sessao.email }} />
      <main className="min-w-0 flex-1">{children}</main>
      <HubNavegacao cargo={sessao.cargo} modulos={sessao.modulos} atual="ESTOQUE" />
    </div>
  )
}
