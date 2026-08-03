import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormAlocacao } from '@/components/moradores/form-alocacao'
import { exigirSessao } from '@/lib/auth'
import { listarFuncionariosDoRh } from '@/lib/cliente-rh'
import { opcoesAlojamento } from '@/queries/alojamentos'
import { funcionariosJaAlocados } from '@/queries/moradores'
import { hojeUtc } from '@/queries/dashboard'

export const metadata = { title: 'Alocar morador' }
export const dynamic = 'force-dynamic'

export default async function NovoMoradorPage() {
  await exigirSessao()

  const [rh, opcoes, alocados] = await Promise.all([
    listarFuncionariosDoRh(),
    opcoesAlojamento(),
    funcionariosJaAlocados(),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/moradores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Moradores
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Alocar morador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A lista de pessoas vem do cadastro do RH — quem já tem cama não aparece aqui.
        </p>
      </header>

      <FormAlocacao
        funcionarios={rh.ok ? rh.dados : []}
        erroRh={rh.ok ? null : rh.erro}
        jaAlocados={[...alocados]}
        opcoes={{ alojamentos: opcoes.alojamentos, rotas: opcoes.rotas }}
        hoje={hojeUtc().toISOString().slice(0, 10)}
      />
    </div>
  )
}
