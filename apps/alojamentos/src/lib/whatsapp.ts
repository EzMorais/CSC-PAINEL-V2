/**
 * Link de conversa do WhatsApp — o gancho por onde a integração vai entrar.
 *
 * Hoje monta só o endereço `wa.me`, que abre o aplicativo com a mensagem já escrita e
 * espera alguém apertar enviar. Não dispara nada sozinho, e é justamente por isso que
 * funciona sem conta de API, sem aprovação de modelo de mensagem e sem custo.
 *
 * O envio automático (WhatsApp Business API) entra aqui depois, como uma segunda função —
 * com este arquivo já sendo o único lugar que sabe formatar telefone e montar mensagem,
 * trocar o meio de envio não vai obrigar a mexer em tela nenhuma.
 */

/** DDI do Brasil. Número guardado sem ele é o caso normal — ninguém digita +55 no cadastro. */
const DDI_BRASIL = '55'

/**
 * Normaliza para o formato que o WhatsApp aceita: só dígitos, com país na frente.
 *
 * Devolve null quando o número não dá para usar, em vez de montar um link quebrado que
 * abriria o WhatsApp numa conversa vazia com um erro genérico.
 */
export function telefoneParaWhatsapp(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')

  // 10 (fixo com DDD) ou 11 (celular com DDD) dígitos: falta o país.
  if (digitos.length === 10 || digitos.length === 11) return `${DDI_BRASIL}${digitos}`
  // 12 ou 13: já veio com o 55 na frente.
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith(DDI_BRASIL)) return digitos

  return null
}

/** Endereço que abre a conversa com a mensagem pronta. Null se o telefone não servir. */
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = telefoneParaWhatsapp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

/**
 * As formas em que o MESMO celular brasileiro pode aparecer.
 *
 * O WhatsApp entrega números do Brasil ora com o nono dígito, ora sem — depende de quando a
 * linha foi habilitada. Um cadastro digitado como "(62) 99999-1234" pode chegar como
 * `556299991234` ou `5562999991234`, e comparar texto com texto erra a pessoa em metade dos
 * casos. Por isso a busca é feita contra todas as variantes.
 *
 * Devolve lista vazia quando o número não dá para usar.
 */
export function variantesDoNumero(telefone: string | null | undefined): string[] {
  const cheio = telefoneParaWhatsapp(telefone)
  if (!cheio) return []

  const semDdi = cheio.slice(DDI_BRASIL.length)
  const ddd = semDdi.slice(0, 2)
  const resto = semDdi.slice(2)

  const restos = new Set<string>([resto])
  // 9 dígitos começando com 9: existe a forma antiga, de 8, sem ele.
  if (resto.length === 9 && resto.startsWith('9')) restos.add(resto.slice(1))
  // 8 dígitos: existe a forma nova, com o 9 na frente.
  if (resto.length === 8) restos.add(`9${resto}`)

  return [...restos].map((r) => `${DDI_BRASIL}${ddd}${r}`)
}
