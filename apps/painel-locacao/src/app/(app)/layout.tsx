import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão — e sem a navegação em volta. Toda rota dentro de `(app)/` herda a proteção só
 * por estar na pasta, sem precisar lembrar de nada.
 *
 * Isto cobre páginas, não Server Actions nem rotas de API: layouts não são executados
 * para nenhum dos dois. Cada action chama `exigirSessao()` por conta própria, e as rotas
 * em `api/export/` também.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao()
  if (!sessao) redirect('/entrar')

  return (
    // min-h-dvh no contêiner: sem ele o flex encolhe até o conteúdo e a
    // borda direita da navegação para no meio da página.
    <div className="min-h-dvh lg:flex">
      <Sidebar usuario={{ nome: sessao.nome, email: sessao.email }} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
