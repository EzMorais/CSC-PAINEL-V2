import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  ClipboardCheck,
  Building2,
  Truck,
  BarChart3,
  Settings,
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
    { href: "/materiais", rotulo: "Materiais", Icone: Package },
    { href: "/movimentacoes", rotulo: "Movimentações", Icone: ArrowLeftRight },
    { href: "/solicitacoes", rotulo: "Compras", Icone: ShoppingCart },
    { href: "/aprovacoes", rotulo: "Aprovações", Icone: ClipboardCheck },
    { href: "/obras", rotulo: "Obras", Icone: Building2 },
    { href: "/fornecedores", rotulo: "Fornecedores", Icone: Truck },
    { href: "/relatorios", rotulo: "Relatórios", Icone: BarChart3 },
    { href: "/configuracoes", rotulo: "Configurações", Icone: Settings },
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
        atual="ESTOQUE"
      />
    </div>
  );
}
