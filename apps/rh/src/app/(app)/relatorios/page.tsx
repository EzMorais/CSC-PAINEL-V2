import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Relatórios — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Relatórios"
      descricao="Exportação em PDF e Excel"
      itens={['Efetivo por obra', 'Vencimentos de treinamento e ASO', 'Indicadores de SST']}
    />
  )
}
