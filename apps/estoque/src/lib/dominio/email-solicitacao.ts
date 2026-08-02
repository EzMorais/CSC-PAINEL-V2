import { brl, dataBR } from './formato'

export type ItemEmail = {
  codigo: string
  nome: string
  unidade: string
  quantidade: number
  saldoNaEpoca: number
  minimoNaEpoca: number
  precoEstimado: number | null
}

export type SolicitacaoEmail = {
  numero: string
  criadoEm: Date
  observacao: string | null
  registradoPor: string | null
  itens: ItemEmail[]
}

export function assuntoDoEmail(s: SolicitacaoEmail): string {
  return `Solicitação de compra ${s.numero} — Construtora Siqueira Campos`
}

/**
 * O corpo do pedido em texto puro.
 *
 * Texto e não HTML de propósito: o corpo viaja dentro de uma URL para abrir o Gmail ou o
 * Outlook, e HTML dentro de URL vira uma sopa de escape que quebra em algum cliente. Texto
 * alinhado com espaços é legível em qualquer lugar, inclusive no celular do fornecedor.
 */
export function corpoDoEmail(s: SolicitacaoEmail): string {
  const linhas: string[] = []

  linhas.push(`Solicitação de compra ${s.numero}`)
  linhas.push(`Emitida em ${dataBR(s.criadoEm)}${s.registradoPor ? ` por ${s.registradoPor}` : ''}`)
  linhas.push('')
  linhas.push('Bom dia,')
  linhas.push('')
  linhas.push('Por favor, cotar os itens abaixo:')
  linhas.push('')

  let total = 0
  for (const [i, item] of s.itens.entries()) {
    const subtotal = item.precoEstimado != null ? item.precoEstimado * item.quantidade : null
    if (subtotal != null) total += subtotal

    linhas.push(`${i + 1}. ${item.nome} (${item.codigo})`)
    linhas.push(`   Quantidade: ${item.quantidade} ${item.unidade}`)
    if (item.precoEstimado != null) {
      // "Referência" e não "preço": é o último valor que a construtora pagou, serve para
      // conferir a proposta, não para dizer ao fornecedor quanto ele deve cobrar.
      linhas.push(`   Referência da última compra: ${brl(item.precoEstimado)} por ${item.unidade}`)
    }
    linhas.push('')
  }

  if (total > 0) {
    linhas.push(`Estimativa pela última compra: ${brl(total)}`)
    linhas.push('(valor apenas de referência interna, não é proposta)')
    linhas.push('')
  }

  if (s.observacao) {
    linhas.push('Observações:')
    linhas.push(s.observacao)
    linhas.push('')
  }

  linhas.push('Aguardo retorno com prazo de entrega e condição de pagamento.')
  linhas.push('')
  linhas.push('Atenciosamente,')
  linhas.push('Almoxarifado — Construtora Siqueira Campos')

  return linhas.join('\n')
}

/**
 * Limite prático de tamanho de URL.
 *
 * Não existe um número oficial: cada navegador e cada serviço corta num ponto diferente. 8k
 * é conservador o bastante para passar em todos, e o que importa é que o sistema PERCEBA
 * quando passou — um pedido grande que abre o Gmail com metade dos itens seria pior do que
 * um aviso dizendo para copiar o texto.
 */
export const LIMITE_URL = 8000

export type LinksEmail = {
  gmail: string
  outlook: string
  padrao: string
  /** Verdadeiro quando o pedido é grande demais para caber numa URL — a tela oferece copiar. */
  longoDemais: boolean
}

export function montarLinks(destinatario: string, assunto: string, corpo: string): LinksEmail {
  const para = encodeURIComponent(destinatario.trim())
  const su = encodeURIComponent(assunto)
  const body = encodeURIComponent(corpo)

  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${para}&su=${su}&body=${body}`
  // Endereço do Outlook para conta corporativa (Microsoft 365). Quem usa conta pessoal
  // (@outlook.com, @hotmail.com) é redirecionado pela própria Microsoft ao abrir.
  const outlook = `https://outlook.office.com/mail/deeplink/compose?to=${para}&subject=${su}&body=${body}`
  const padrao = `mailto:${para}?subject=${su}&body=${body}`

  return {
    gmail,
    outlook,
    padrao,
    longoDemais: Math.max(gmail.length, outlook.length, padrao.length) > LIMITE_URL,
  }
}
