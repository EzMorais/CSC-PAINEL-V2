import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Auditorias — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Auditorias"
      descricao="Checklists de campo e planos de ação"
      itens={['Checklist por norma', 'Registro fotográfico', 'Abertura de não conformidade a partir do item reprovado']}
    />
  )
}
