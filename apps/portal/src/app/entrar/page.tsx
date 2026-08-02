import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/auth'
import { FormularioLogin } from '@/components/entrar/formulario-login'

export const metadata = { title: 'Entrar — Portal Siqueira Campos' }

type Props = { searchParams: Promise<{ destino?: string }> }

export default async function EntrarPage({ searchParams }: Props) {
  // Quem já tem sessão não vê o formulário de novo.
  if (await lerSessao()) redirect('/')

  const { destino } = await searchParams
  // Só caminho relativo passa adiante — ver o comentário em `actions/auth.ts`.
  const seguro = destino?.startsWith('/') && !destino.startsWith('//') ? destino : ''

  return <FormularioLogin destino={seguro} />
}
