import { EmConstrucao } from '@/components/em-construcao'

export const metadata = { title: 'Documentos — RH e SST' }

export default function Pagina() {
  return (
    <EmConstrucao
      titulo="Documentos"
      descricao="PGR, PCMSO, LTCAT, ASO, APR, PT, FISPQ, ART"
      itens={['Upload com versionamento', 'Controle de vencimento', 'Busca e download']}
    />
  )
}
