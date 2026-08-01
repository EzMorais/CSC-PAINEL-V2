import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Exames — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Exames"
      descricao="ASO: admissional, periódico, retorno, demissional"
      itens={['Agenda e histórico por funcionário', 'Restrições registradas no ASO', 'Alerta de periódico vencendo']}
    />
  )
}
