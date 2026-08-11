import { redirect } from "next/navigation";
import { lerSessao, temAcesso } from "@/lib/auth";
import { LayoutDashboard, FolderKanban, Users } from "lucide-react";
import { HudProgramacao } from "@/components/layout/hud-programacao";
import { HubNavegacao } from "@/components/layout/hub-navegacao";
import { CARGO, MODULO, ROTULO_CARGO, type Cargo } from "@/lib/dominio/cargos";

/**
 * Porta de entrada de tudo que exige sessão.
 *
 * A checagem vive aqui, e não no layout raiz, porque `/entrar` precisa renderizar sem
 * sessão. Isto cobre páginas, não Server Actions: cada action chama `exigirSessao()` por
 * conta própria.
 */
export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");

  const itens = [
    { href: "/dashboard", rotulo: "Dashboard", Icone: LayoutDashboard },
    {
      href: "/cadastros",
      rotulo: "Cadastros",
      Icone: FolderKanban,
      visivel: temAcesso(sessao, MODULO.CADASTROS),
    },
    {
      href: "/usuarios",
      rotulo: "Usuários",
      Icone: Users,
      visivel: sessao.cargo === CARGO.ADMIN,
    },
  ].filter((item) => item.visivel !== false);

  return (
    <div className="min-h-dvh">
      <HudProgramacao
        usuario={{
          nome: sessao.nome,
          email: sessao.email,
          cargo: ROTULO_CARGO[sessao.cargo as Cargo] ?? sessao.cargo,
        }}
        itens={itens}
        subtitulo="Portal corporativo"
      />
      <main>{children}</main>
      <HubNavegacao
        cargo={sessao.cargo}
        modulos={sessao.modulos}
        atual="PORTAL"
      />
    </div>
  );
}
