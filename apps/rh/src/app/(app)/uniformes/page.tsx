import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Uniformes — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Uniformes"
      descricao="Entrega, troca e reposição"
      itens={['Entrega por tamanho já cadastrado no funcionário', 'Histórico de reposições', 'Assinatura de recebimento']}
    />
  )
}
