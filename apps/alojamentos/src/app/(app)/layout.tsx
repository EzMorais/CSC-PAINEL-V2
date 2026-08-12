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
    { href: "/", rotulo: "Dashboard", icone: <LayoutDashboard className="size-4" /> },
    { href: "/alojamentos", rotulo: "Alojamentos", icone: <House className="size-4" /> },
    { href: "/moradores", rotulo: "Moradores", icone: <BedDouble className="size-4" /> },
    { href: "/pedidos", rotulo: "Pedidos", icone: <ClipboardList className="size-4" /> },
    { href: "/programacao", rotulo: "Programação", icone: <CalendarDays className="size-4" /> },
    { href: "/rotas", rotulo: "Ônibus", icone: <Bus className="size-4" /> },
    { href: "/obras", rotulo: "Obras", icone: <Building2 className="size-4" /> },
    {
      href: "/configuracoes/whatsapp",
      rotulo: "WhatsApp",
      icone: <MessageCircle className="size-4" />,
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
