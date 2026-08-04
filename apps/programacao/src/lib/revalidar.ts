import { revalidatePath } from 'next/cache'

/**
 * Invalida o cache das telas informadas. Chame sempre DEPOIS que a gravação terminou.
 *
 * O try/catch é essencial, não defensivo por hábito: fora de uma requisição do Next — em
 * script de verificação, teste E2E ou seed — `revalidatePath` lança
 * "Invariant: static generation store missing". Sem o catch, esse erro sobe até o catch da
 * server action e ela devolve `{ ok: false }` para uma operação que JÁ foi persistida.
 * O usuário veria "falhou", tentaria de novo, e registraria a mesma entrega de EPI duas vezes.
 *
 * Não há o que perder engolindo o erro aqui: sem contexto de requisição não existe cache
 * a invalidar.
 */
export function revalidarTelas(...caminhos: string[]) {
  try {
    for (const caminho of caminhos) revalidatePath(caminho)
  } catch {
    // Fora de requisição: nada a invalidar.
  }
}
