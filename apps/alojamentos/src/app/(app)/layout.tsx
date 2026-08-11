import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  House,
  BedDouble,
  ClipboardList,
  CalendarDays,
  Bus,
  Building2,
  MessageCircle,
} from "lucide-react";
import { lerSessao } from "@/lib/auth";
import { HudProgramacao } from "@/components/layout/hud-programacao";
import { HubNavegacao } from "@/components/layout/hub-navegacao";

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
export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");

  const itens = [
    { href: "/", rotulo: "Dashboard", Icone: LayoutDashboard },
    { href: "/alojamentos", rotulo: "Alojamentos", Icone: House },
    { href: "/moradores", rotulo: "Moradores", Icone: BedDouble },
    { href: "/pedidos", rotulo: "Pedidos", Icone: ClipboardList },
    { href: "/programacao", rotulo: "Programação", Icone: CalendarDays },
    { href: "/rotas", rotulo: "Ônibus", Icone: Bus },
    { href: "/obras", rotulo: "Obras", Icone: Building2 },
    {
      href: "/configuracoes/whatsapp",
      rotulo: "WhatsApp",
      Icone: MessageCircle,
    },
  ];

  return (
    <div className="min-h-dvh">
      <HudProgramacao
        usuario={{
          nome: sessao.nome,
          email: sessao.email,
          cargo: sessao.cargo,
        }}
        itens={itens}
      />
      <main className="min-w-0">{children}</main>
      <HubNavegacao
        cargo={sessao.cargo}
        modulos={sessao.modulos}
        atual="ALOJAMENTOS"
      />
    </div>
  );
}
