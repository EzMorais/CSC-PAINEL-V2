import { PreviewImportacao } from '@/components/importar/preview-importacao'

export const metadata = { title: 'Importar planilha — Painel de Locação SC' }

export default function ImportarPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie a planilha de controle. Você verá o que o sistema entendeu antes de qualquer
          gravação, e reimportar não duplica registros existentes.
        </p>
      </header>
      <PreviewImportacao />
    </div>
  )
}
