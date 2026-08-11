'use client'

import { useState } from 'react'

export function LogoCliente({
  src, nome, cor, grande = false,
}: {
  src?: string | null
  nome: string
  cor: string
  grande?: boolean
}) {
  const [falhou, setFalhou] = useState(false)
  const iniciais = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'C'

  if (!src || falhou) {
    return (
      <span
        aria-hidden
        className={`${grande ? 'size-14 text-sm' : 'size-10 text-[11px]'} grid shrink-0 place-items-center rounded-xl font-bold text-slate-800`}
        style={{ backgroundColor: `${cor}55` }}
      >
        {iniciais}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URI otimizada pelo servidor
    <img
      src={src}
      alt={`Logo de ${nome}`}
      onError={() => setFalhou(true)}
      className={`${grande ? 'max-h-14 max-w-24' : 'max-h-10 max-w-16'} shrink-0 object-contain`}
    />
  )
}
