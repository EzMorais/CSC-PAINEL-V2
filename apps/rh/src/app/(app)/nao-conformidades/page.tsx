import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Não Conformidades — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Não Conformidades"
      descricao="Registro, tratativa e evidências"
      itens={['Gravidade, responsável e prazo', 'Evidência antes e depois', 'Vínculo com a auditoria de origem']}
    />
  )
}
