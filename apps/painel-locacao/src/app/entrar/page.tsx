import { redirect } from 'next/navigation'
import { lerSessao, urlDeLogin } from '@/lib/auth'

export const metadata = { title: 'Entrar — Painel de Locação' }
export const dynamic = 'force-dynamic'

/**
 * Este módulo não tem mais tela de login própria.
 *
 * Quem cadastra gente e confere senha é o Portal — ter uma segunda tela aqui significaria
 * uma segunda lista de usuários para manter em dia, que foi exatamente o problema que o
 * Portal veio resolver.
 */
export default async function EntrarPage() {
  if (await lerSessao()) redirect('/')
  redirect(urlDeLogin('/'))
}
