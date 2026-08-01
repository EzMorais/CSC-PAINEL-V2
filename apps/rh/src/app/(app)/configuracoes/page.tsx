import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Configurações — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Configurações"
      descricao="Cargos, tipos de documento e parâmetros"
      itens={['Cadastro de cargos e riscos', 'Prazos de alerta', 'Usuários e permissões']}
    />
  )
}
