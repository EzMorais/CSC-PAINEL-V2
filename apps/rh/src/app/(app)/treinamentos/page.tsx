import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Treinamentos — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Treinamentos"
      descricao="NRs, integração, reciclagens e certificados"
      itens={['Cadastro de turmas com carga horária, instrutor e validade', 'Vínculo com as normas (NR-10, NR-18, NR-33, NR-35)', 'Upload de certificado', 'Alerta automático de reciclagem vencendo']}
    />
  )
}
