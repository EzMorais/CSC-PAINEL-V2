import { FileText } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FormDocumentoEmpresa } from '@/components/documentos/form-documento-empresa'
import { ListaDocumentosEmpresa } from '@/components/documentos/lista-documentos-empresa'
import { ChecklistPessoal } from '@/components/documentos/checklist-pessoal'
import {
  contarDocumentosVencendo, documentosPessoaisDoFuncionario, funcionariosParaDocumento,
  listarDocumentosEmpresa, obrasParaSelecao,
} from '@/queries/documentos'

export const metadata = { title: 'Documentos — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; categoria?: string; funcionarioId?: string }> }

export default async function DocumentosPage({ searchParams }: Props) {
  const filtros = await searchParams
  const funcionarioId = filtros.funcionarioId ?? ''

  const [documentos, obras, funcionarios, alertas, documentosPessoaisMap] = await Promise.all([
    listarDocumentosEmpresa(filtros),
    obrasParaSelecao(),
    funcionariosParaDocumento(),
    contarDocumentosVencendo(),
    funcionarioId ? documentosPessoaisDoFuncionario(funcionarioId) : Promise.resolve(new Map()),
  ])

  const documentosPorCategoria = Object.fromEntries(
    [...documentosPessoaisMap.entries()].map(([categoria, doc]) => [
      categoria,
      { id: doc.id, arquivo: doc.arquivo, criadoEm: doc.criadoEm.toISOString(), versao: doc.versao },
    ]),
  )

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">PGR, PCMSO, LTCAT, ASO, APR, PT, FISPQ, ART — e admissão por funcionário</p>
        </div>
        <FormDocumentoEmpresa obras={obras} />
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Documento vencido" valor={String(alertas.vencidos)}
          tom={alertas.vencidos > 0 ? 'vencida' : 'neutro'}
          icone={FileText}
        />
        <KpiCard
          rotulo="Vencendo em 30 dias" valor={String(alertas.vencendo)}
          tom={alertas.vencendo > 0 ? 'atencao' : 'neutro'}
          icone={FileText}
        />
        <KpiCard rotulo="Documentos da empresa" valor={String(documentos.length)} />
      </section>

      <ListaDocumentosEmpresa linhas={documentos} />

      <ChecklistPessoal funcionarios={funcionarios} funcionarioId={funcionarioId} documentosPorCategoria={documentosPorCategoria} />
    </div>
  )
}
