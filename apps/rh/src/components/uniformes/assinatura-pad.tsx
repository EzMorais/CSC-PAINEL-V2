'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Assinatura desenhada com o dedo/mouse, gravada como PNG (data URI) num input escondido.
 *
 * O fundo é pintado de branco no próprio canvas — não por CSS. `toDataURL()` só captura o
 * que foi desenhado nos pixels; um fundo por `background: white` no elemento não entra na
 * imagem exportada, e a assinatura sairia com fundo transparente (ruim no tema escuro, onde
 * o traço escuro sumiria contra o fundo do card).
 *
 * Um canvas em branco também gera um `toDataURL()` válido e não-vazio — por isso a presença
 * de traço é controlada por um estado próprio (`assinou`), não inferida da string gerada.
 */
export function AssinaturaPad({ name = 'assinatura' }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const desenhando = useRef(false)
  // Tamanho em pixel CSS (não device pixel): depois do ctx.scale(dpr), é essa a unidade que
  // os desenhos (e o preenchimento de fundo) usam.
  const tamanho = useRef({ largura: 0, altura: 0 })
  const [assinou, setAssinou] = useState(false)

  function pintarFundo() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tamanho.current.largura, tamanho.current.altura)
  }

  // Redimensiona o canvas para a largura real do card e escala pelo devicePixelRatio, para
  // o traço sair nítido em tela de celular. Setar width/height limpa o canvas, por isso o
  // fundo é pintado de novo logo em seguida.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    tamanho.current = { largura: rect.width, altura: rect.height }
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx?.scale(dpr, dpr)
    pintarFundo()
  }, [])

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(e.pointerId)
    desenhando.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posicao(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function desenhar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posicao(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y)
    ctx.stroke()
    setAssinou(true)
  }

  function soltar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    desenhando.current = false
    // Sem isto, a captura do ponteiro (setPointerCapture no início do traço) sobrevive ao
    // gesto: o próximo clique do usuário fora do canvas — por exemplo, no botão Registrar —
    // ainda chega aqui como se fosse um evento do canvas, disparando este handler de novo
    // com `assinou` de um fechamento desatualizado.
    canvasRef.current?.releasePointerCapture(e.pointerId)
    if (inputRef.current && canvasRef.current) {
      inputRef.current.value = assinou ? canvasRef.current.toDataURL('image/png') : ''
    }
  }

  function limpar() {
    pintarFundo()
    setAssinou(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Assinatura de recebimento *</label>
      <canvas
        ref={canvasRef}
        data-testid="assinatura-canvas"
        className="h-32 w-full touch-none rounded-md border border-input bg-white"
        onPointerDown={iniciar}
        onPointerMove={desenhar}
        onPointerUp={soltar}
        onPointerLeave={soltar}
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">O funcionário assina acima para confirmar o recebimento.</p>
        <button type="button" onClick={limpar} className="text-xs text-muted-foreground underline">
          Limpar
        </button>
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  )
}
