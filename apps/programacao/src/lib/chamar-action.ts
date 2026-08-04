export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/**
 * Chama uma Server Action e transforma exceção em `{ ok: false }`.
 *
 * As guardas de cargo (`exigirLancamento`, `exigirAprovacao`) LANÇAM em vez de devolver um
 * resultado — é o que garante que nada abaixo delas execute, inclusive num POST direto ao
 * endpoint. Só que uma exceção vira promessa rejeitada no cliente, e um `await` sem
 * tratamento simplesmente abandona o resto da função: o formulário fecha, nenhuma mensagem
 * aparece, e a pessoa vai embora achando que gravou. Foi exatamente isso que aconteceu com
 * o cargo Consulta antes deste wrapper existir.
 *
 * Aqui a rejeição vira erro visível, com o mesmo formato de todo o resto do sistema.
 */
export async function chamarAction<T>(promessa: Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await promessa
  } catch (e) {
    const bruto = e instanceof Error ? e.message : String(e)
    // O Next embrulha o erro do servidor em produção e devolve um texto genérico com um
    // digest. Nesse caso a mensagem original não chega ao navegador de propósito (para não
    // vazar detalhe interno), então vale mais orientar do que repetir o texto inútil.
    const generico = /an error occurred in the server|digest/i.test(bruto)
    return {
      ok: false,
      erro: generico
        ? 'O servidor recusou a operação. O motivo mais comum é o seu cargo não permitir esta ação — confira com o administrador no Portal.'
        : bruto,
    }
  }
}
