import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/auth';
import { Casca } from '@/components/Casca';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/entrar');
  return <Casca usuario={{ nome: sessao.nome, papel: sessao.papel }}>{children}</Casca>;
}
