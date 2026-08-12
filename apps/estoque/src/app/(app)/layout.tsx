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
    { href: "/", rotulo: "Dashboard", icone: <LayoutDashboard className="size-4" /> },
    { href: "/materiais", rotulo: "Materiais", icone: <Package className="size-4" /> },
    { href: "/movimentacoes", rotulo: "Movimentações", icone: <ArrowLeftRight className="size-4" /> },
    { href: "/solicitacoes", rotulo: "Compras", icone: <ShoppingCart className="size-4" /> },
    { href: "/aprovacoes", rotulo: "Aprovações", icone: <ClipboardCheck className="size-4" /> },
    { href: "/obras", rotulo: "Obras", icone: <Building2 className="size-4" /> },
    { href: "/fornecedores", rotulo: "Fornecedores", icone: <Truck className="size-4" /> },
    { href: "/relatorios", rotulo: "Relatórios", icone: <BarChart3 className="size-4" /> },
    { href: "/configuracoes", rotulo: "Configurações", icone: <Settings className="size-4" /> },
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
