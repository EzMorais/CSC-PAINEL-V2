export type DestinoAba = {
  /** Código da obra que recebe os itens desta aba. */
  obraPrincipal: string
  /** Códigos de obra que dividem esta aba. Vazio = aba exclusiva. */
  obrasCompartilhando: string[]
}

export type MapaAbas = Record<string, DestinoAba>

/**
 * Monta o mapa a partir das obras cadastradas, usando o campo `abaOrigem`.
 *
 * É assim que a importação funciona para qualquer planilha, não só a da Siqueira Campos:
 * quem cadastra as obras informa de qual aba cada uma vem, e quando duas obras apontam para
 * a mesma aba o sistema sabe que ela é compartilhada. Nesse caso não há como saber a qual
 * obra cada item pertence, então eles entram na primeira com `obraAConfirmar`, para
 * reclassificação em lote pela interface.
 *
 * A ordem das obras define qual é a principal — passe-as ordenadas por código para o
 * resultado ser estável entre execuções.
 */
export function construirMapa(obras: { codigo: string; abaOrigem: string }[]): MapaAbas {
  const porAba = new Map<string, string[]>()
  for (const o of obras) {
    const lista = porAba.get(o.abaOrigem) ?? []
    lista.push(o.codigo)
    porAba.set(o.abaOrigem, lista)
  }

  const mapa: MapaAbas = {}
  for (const [aba, codigos] of porAba) {
    mapa[aba] = {
      obraPrincipal: codigos[0],
      obrasCompartilhando: codigos.length > 1 ? codigos : [],
    }
  }
  return mapa
}

/** Abas que existem no arquivo mas não contêm locações. */
export const ABAS_IGNORADAS = new Set(['RESUMO'])
