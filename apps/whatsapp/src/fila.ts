/**
 * Fila de envio com espaçamento entre mensagens.
 *
 * Existe por um motivo só: disparo rápido em sequência é o padrão que o WhatsApp usa para
 * identificar robô de spam, e o preço aqui é o número da empresa ser banido. Espaçar não
 * atrasa nada que importe — ninguém está esperando um aviso de pedido no mesmo segundo.
 *
 * O intervalo tem variação aleatória de propósito: um envio a cada exatos 3.000ms é tão
 * artificial quanto não ter intervalo nenhum.
 */
const INTERVALO_BASE_MS = 3000
const VARIACAO_MS = 2000

type Tarefa = {
  executar: () => Promise<void>
  resolver: () => void
  rejeitar: (e: unknown) => void
}

export class FilaDeEnvio {
  private fila: Tarefa[] = []
  private rodando = false

  /** Aceita a tarefa e resolve quando ela de fato saiu — quem chama sabe se deu certo. */
  enfileirar(executar: () => Promise<void>): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      this.fila.push({ executar, resolver, rejeitar })
      void this.girar()
    })
  }

  get tamanho() {
    return this.fila.length
  }

  private async girar() {
    if (this.rodando) return
    this.rodando = true

    while (this.fila.length > 0) {
      const tarefa = this.fila.shift()!
      try {
        await tarefa.executar()
        tarefa.resolver()
      } catch (e) {
        // Uma mensagem que falhou não pode derrubar a fila: as outras continuam.
        tarefa.rejeitar(e)
      }
      if (this.fila.length > 0) await esperar(INTERVALO_BASE_MS + Math.random() * VARIACAO_MS)
    }

    this.rodando = false
  }
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
