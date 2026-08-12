import { redirect } from 'next/navigation';
import { Truck, Wrench, Fuel, Bell } from 'lucide-react';
import { lerSessaoBase, temAcessoFrota, urlDeLogin } from '@/lib/auth';
import { HudProgramacao } from '@/components/layout/hud-programacao';
import { HubNavegacao } from '@/components/layout/hub-navegacao';

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

  const itens = [
    { href: '/veiculos', rotulo: 'Veículos', icone: <Truck size={16} strokeWidth={1.8} /> },
    { href: '/manutencoes', rotulo: 'Manutenções', icone: <Wrench size={16} strokeWidth={1.8} /> },
    { href: '/abastecimento', rotulo: 'Abastecimento', icone: <Fuel size={16} strokeWidth={1.8} /> },
    { href: '/alertas', rotulo: 'Alertas', icone: <Bell size={16} strokeWidth={1.8} /> },
  ];

  return (
    <div className="min-h-dvh bg-concreto text-grafite">
      <HudProgramacao usuario={{ nome: base.nome, email: base.email, cargo: base.cargo }} itens={itens} />
      <main className="pb-8">{children}</main>
      <HubNavegacao cargo={base.cargo} modulos={base.modulos} atual="FROTA" />
    </div>
  );
}
