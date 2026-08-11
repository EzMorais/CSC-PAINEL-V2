import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  GraduationCap,
  HardHat,
  Shirt,
  Stethoscope,
  FileText,
  ClipboardCheck,
  TriangleAlert,
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
    { href: "/funcionarios", rotulo: "Funcionários", Icone: Users },
    { href: "/obras", rotulo: "Obras", Icone: Building2 },
    { href: "/treinamentos", rotulo: "Treinamentos", Icone: GraduationCap },
    { href: "/epis", rotulo: "EPIs", Icone: HardHat },
    { href: "/uniformes", rotulo: "Uniformes", Icone: Shirt },
    { href: "/exames", rotulo: "Exames", Icone: Stethoscope },
    { href: "/documentos", rotulo: "Documentos", Icone: FileText },
    { href: "/auditorias", rotulo: "Auditorias", Icone: ClipboardCheck },
    {
      href: "/nao-conformidades",
      rotulo: "Não conformidades",
      Icone: TriangleAlert,
    },
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
      <HubNavegacao cargo={sessao.cargo} modulos={sessao.modulos} atual="RH" />
    </div>
  );
}
