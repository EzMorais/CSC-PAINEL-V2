import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'EPIs — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="EPIs"
      descricao="Entrega, troca, devolução e estoque"
      itens={['Cadastro com CA e validade', 'Ficha de entrega com assinatura', 'Controle de estoque e alerta de CA vencido', 'Histórico por funcionário']}
    />
  )
}
