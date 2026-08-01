import { redirect } from 'next/navigation'
import { lerSessao } from '@/lib/auth'
import { FormularioLogin } from '@/components/entrar/formulario-login'

export const metadata = { title: 'Entrar — Painel de Locação SC' }

export default async function EntrarPage() {
  // Quem já tem sessão não vê o formulário de novo.
  if (await lerSessao()) redirect('/')
  return <FormularioLogin />
}
