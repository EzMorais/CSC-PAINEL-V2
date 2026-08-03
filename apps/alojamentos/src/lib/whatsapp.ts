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
