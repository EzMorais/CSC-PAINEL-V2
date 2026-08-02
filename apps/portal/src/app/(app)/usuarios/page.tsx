import { ListaUsuarios } from '@/components/usuarios/lista-usuarios'
import { listarUsuarios, ultimosAcessos } from '@/queries/usuarios'
import { exigirAdmin } from '@/lib/auth'

export const metadata = { title: 'Usuários — Portal Siqueira Campos' }
export const dynamic = 'force-dynamic'

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export default async function UsuariosPage() {
  const sessao = await exigirAdmin()
  const [usuarios, acessos] = await Promise.all([listarUsuarios(), ultimosAcessos()])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Um cadastro só para os quatro sistemas
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Cadastre a pessoa uma vez.</p>
        <p className="mt-1">
          O cargo e os sistemas definidos aqui valem no Painel de Locação, no RH, no
          Almoxarifado e na Frota. Mudanças de cargo passam a valer no{' '}
          <strong>próximo login</strong> da pessoa — o crachá de sessão carrega o cargo dentro
          dele, e é justamente isso que permite os outros sistemas funcionarem mesmo com este
          Portal fora do ar.
        </p>
      </div>

      <ListaUsuarios usuarios={usuarios} meuId={sessao.id} />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Últimos acessos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Inclui as tentativas que falharam — é onde uma senha sendo adivinhada apareceria.
        </p>
        {acessos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm" data-testid="ultimos-acessos">
            {acessos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                <span className={a.sucesso ? '' : 'text-destructive'}>
                  {a.sucesso ? 'entrou' : 'falhou'} · {a.nome ?? a.email}
                  {!a.sucesso && a.motivo && <span className="text-muted-foreground"> ({a.motivo})</span>}
                </span>
                <span className="shrink-0 text-xs tabular text-muted-foreground">
                  {DATA_HORA.format(a.ocorrido)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
