import { redirect } from 'next/navigation';
import { lerSessaoBase, temAcessoFrota, urlDeLogin } from '@/lib/auth';
import { Casca } from '@/components/Casca';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const base = await lerSessaoBase();
  if (!base) redirect(urlDeLogin('/veiculos'));

  if (!temAcessoFrota(base)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-barra px-4 text-center">
        <div className="max-w-sm border-2 border-black/20 bg-superficie p-6 shadow-[8px_8px_0_rgb(18_22_28_/_0.16)]">
          <p>
            Você está autenticado como <strong>{base.nome}</strong>, mas o módulo Frota não
            está liberado para sua conta. Peça ao administrador para liberar no Portal.
          </p>
        </div>
      </main>
    );
  }

  const admin = base.cargo === 'ADMIN' || base.cargo === 'DIRETORIA';
  return <Casca usuario={{ nome: base.nome, papel: admin ? 'ADMIN' : 'OPERADOR' }}>{children}</Casca>;
}
