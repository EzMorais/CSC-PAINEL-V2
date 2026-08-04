/**
 * Ilustrações de cada módulo, desenhadas à mão em SVG nas cores da marca.
 *
 * SVG e não foto: a arte precisa acompanhar o tema claro/escuro, escalar sem borrar no
 * cartão e não pesar no carregamento. `currentColor` fica de fora de propósito — cada cena
 * tem cor própria, e é ela que dá a identidade do módulo no relance.
 */

const AZUL = '#202868'
const AZUL_MEDIO = '#2d3a86'
const AZUL_CLARO = '#4557b0'
const VERMELHO = '#d02030'
const VERMELHO_CLARO = '#e8434f'
const CINZA = '#9aa3b8'
const CINZA_CLARO = '#c9cfdd'
const AMARELO = '#f0b429'

type Props = { className?: string }

/** Painel de Locação — martelete rompedor, o equipamento alugado mais típico da obra. */
export function IlustracaoLocacao({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Martelete rompedor">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />
      <rect x="46" y="20" width="30" height="34" rx="6" fill={AZUL} />
      <rect x="51" y="26" width="20" height="9" rx="2" fill={AZUL_CLARO} />
      <rect x="40" y="30" width="9" height="16" rx="3" fill={VERMELHO} />
      <path d="M76 30h12a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5H76z" fill={AZUL_MEDIO} />
      <rect x="86" y="24" width="5" height="10" rx="2.5" fill={CINZA} />
      <rect x="52" y="54" width="18" height="20" rx="4" fill={AZUL_MEDIO} />
      <rect x="56" y="74" width="10" height="26" rx="2" fill={CINZA} />
      <path d="M56 100h10l-5 12z" fill={CINZA_CLARO} />
      <path d="M30 104h60" stroke={AZUL} strokeWidth="4" strokeLinecap="round" opacity="0.25" />
      <circle cx="61" cy="112" r="3" fill={VERMELHO_CLARO} opacity="0.5" />
    </svg>
  )
}

/** RH e SST — as duas frentes do módulo: administrativo e segurança do trabalho. */
export function IlustracaoRh({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Colaboradora de escritório e trabalhador com capacete e colete">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />

      {/* Escritório */}
      <circle cx="41" cy="42" r="12" fill="#e8b48f" />
      <path d="M29 42a12 12 0 0 1 24 0c0-9-4-14-12-14s-12 5-12 14z" fill="#4a3728" />
      <path d="M31 44c-1 8-2 12-2 12h24s-1-4-2-12z" fill="#4a3728" opacity="0.9" />
      <path d="M41 54c-11 0-19 7-19 17v27h38V71c0-10-8-17-19-17z" fill={AZUL_MEDIO} />
      <path d="M41 54l-7 5 7 9 7-9z" fill="#f4f6fb" />
      <rect x="37" y="66" width="8" height="32" fill="#f4f6fb" />

      {/* Obra */}
      <circle cx="79" cy="44" r="12" fill="#c98b62" />
      <path d="M64 40a15 15 0 0 1 30 0v3H64z" fill="#f4f6fb" />
      <path d="M62 43h34a2 2 0 0 1 0 5H62a2 2 0 0 1 0-5z" fill="#dde2ee" />
      <path d="M79 56c-11 0-19 7-19 17v25h38V73c0-10-8-17-19-17z" fill={AZUL} />
      <path d="M79 56c-6 0-11 2-14 6v36h28V62c-3-4-8-6-14-6z" fill={AMARELO} />
      <path d="M65 74h28v6H65z" fill="#f4f6fb" opacity="0.85" />
      <path d="M65 84h28v5H65z" fill={CINZA_CLARO} opacity="0.6" />
    </svg>
  )
}

/** Almoxarifado — prateleira com caixas, o que a pessoa vê ao abrir a porta. */
export function IlustracaoEstoque({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Prateleiras com caixas">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />
      <rect x="18" y="20" width="6" height="84" rx="2" fill={AZUL} />
      <rect x="96" y="20" width="6" height="84" rx="2" fill={AZUL} />
      <rect x="18" y="48" width="84" height="6" rx="2" fill={AZUL_MEDIO} />
      <rect x="18" y="76" width="84" height="6" rx="2" fill={AZUL_MEDIO} />
      <rect x="18" y="98" width="84" height="6" rx="2" fill={AZUL_MEDIO} />

      <rect x="27" y="26" width="24" height="22" rx="2" fill={VERMELHO} />
      <path d="M27 34h24" stroke="#fff" strokeWidth="3" opacity="0.55" />
      <rect x="56" y="30" width="18" height="18" rx="2" fill={AMARELO} />
      <path d="M56 36h18" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <rect x="78" y="24" width="20" height="24" rx="2" fill={AZUL_CLARO} />
      <path d="M78 32h20" stroke="#fff" strokeWidth="3" opacity="0.5" />

      <rect x="24" y="58" width="20" height="18" rx="2" fill={AMARELO} />
      <path d="M24 64h20" stroke="#fff" strokeWidth="2.5" opacity="0.6" />
      <rect x="49" y="54" width="26" height="22" rx="2" fill={AZUL_CLARO} />
      <path d="M49 62h26" stroke="#fff" strokeWidth="3" opacity="0.5" />
      <rect x="80" y="60" width="18" height="16" rx="2" fill={VERMELHO_CLARO} />
      <path d="M80 66h18" stroke="#fff" strokeWidth="2.5" opacity="0.55" />

      <rect x="27" y="84" width="28" height="14" rx="2" fill={AZUL_CLARO} />
      <path d="M27 89h28" stroke="#fff" strokeWidth="2.5" opacity="0.5" />
      <rect x="60" y="82" width="22" height="16" rx="2" fill={VERMELHO} />
      <path d="M60 88h22" stroke="#fff" strokeWidth="2.5" opacity="0.55" />
    </svg>
  )
}

/** Frota — os três tipos que a empresa controla: caminhão, van e caminhonete. */
export function IlustracaoFrota({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Caminhão, van e caminhonete">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />

      {/* Caminhão ao fundo */}
      <rect x="20" y="26" width="42" height="24" rx="3" fill={AZUL_CLARO} />
      <path d="M62 32h14l10 10v8H62z" fill={AZUL} />
      <path d="M65 35h9l6 6h-15z" fill="#cfe0f5" />
      <circle cx="34" cy="52" r="6" fill="#33383f" />
      <circle cx="34" cy="52" r="2.5" fill={CINZA_CLARO} />
      <circle cx="76" cy="52" r="6" fill="#33383f" />
      <circle cx="76" cy="52" r="2.5" fill={CINZA_CLARO} />

      {/* Van no meio */}
      <path d="M24 62h44a8 8 0 0 1 8 6l3 12H24z" fill={VERMELHO} />
      <path d="M60 66h10l5 9H60z" fill="#cfe0f5" />
      <rect x="30" y="66" width="24" height="9" rx="2" fill="#f4f6fb" opacity="0.9" />
      <circle cx="37" cy="82" r="6" fill="#33383f" />
      <circle cx="37" cy="82" r="2.5" fill={CINZA_CLARO} />
      <circle cx="70" cy="82" r="6" fill="#33383f" />
      <circle cx="70" cy="82" r="2.5" fill={CINZA_CLARO} />

      {/* Caminhonete na frente */}
      <path d="M30 92h20l6-6h12l5 6h13a4 4 0 0 1 4 4v6H30z" fill={AZUL} />
      <path d="M52 88h11l4 4H52z" fill="#cfe0f5" />
      <circle cx="45" cy="103" r="6.5" fill="#33383f" />
      <circle cx="45" cy="103" r="2.8" fill={CINZA_CLARO} />
      <circle cx="82" cy="103" r="6.5" fill="#33383f" />
      <circle cx="82" cy="103" r="2.8" fill={CINZA_CLARO} />
    </svg>
  )
}

/** Alojamentos — o conjunto de casas onde os funcionários moram. */
export function IlustracaoAlojamentos({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Conjunto de casas">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />

      {/* Casa da esquerda */}
      <path d="M12 56l20-16 20 16v42H12z" fill={AZUL_MEDIO} />
      <path d="M8 57l24-19 24 19-3 4-21-17-21 17z" fill={VERMELHO} />
      <rect x="20" y="66" width="10" height="10" rx="1.5" fill="#cfe0f5" />
      <rect x="36" y="66" width="9" height="10" rx="1.5" fill="#cfe0f5" />
      <rect x="26" y="82" width="12" height="16" rx="1.5" fill={AMARELO} />

      {/* Casa do meio, maior */}
      <path d="M40 62l24-20 24 20v36H40z" fill={AZUL} />
      <path d="M35 63l29-24 29 24-3.5 4.5L64 46 38.5 67.5z" fill={VERMELHO} />
      <rect x="50" y="72" width="11" height="11" rx="1.5" fill="#cfe0f5" />
      <rect x="68" y="72" width="11" height="11" rx="1.5" fill="#cfe0f5" />
      <rect x="57" y="86" width="14" height="12" rx="1.5" fill={AMARELO} />

      {/* Casa da direita */}
      <path d="M78 68l16-13 16 13v30H78z" fill={AZUL_MEDIO} />
      <path d="M74 69l20-16 20 16-3 4-17-13.5L77 73z" fill={VERMELHO_CLARO} />
      <rect x="84" y="77" width="9" height="9" rx="1.5" fill="#cfe0f5" />
      <rect x="97" y="77" width="8" height="9" rx="1.5" fill="#cfe0f5" />

      <path d="M6 98h108" stroke={AZUL} strokeWidth="4" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}

/** Programação diária — o quadro de quem vai para qual frente amanhã. */
export function IlustracaoProgramacao({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Quadro de programação com colunas">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />
      <rect x="16" y="26" width="88" height="70" rx="5" fill="#f4f6fb" stroke={AZUL} strokeWidth="2.5" />

      <rect x="22" y="32" width="24" height="7" rx="2" fill={VERMELHO} />
      <rect x="49" y="32" width="24" height="7" rx="2" fill={AZUL_CLARO} />
      <rect x="76" y="32" width="22" height="7" rx="2" fill={AMARELO} />

      <rect x="22" y="44" width="24" height="6" rx="1.5" fill={CINZA_CLARO} />
      <rect x="22" y="53" width="24" height="6" rx="1.5" fill={CINZA_CLARO} />
      <rect x="22" y="62" width="24" height="6" rx="1.5" fill={CINZA_CLARO} />

      <rect x="49" y="44" width="24" height="6" rx="1.5" fill={CINZA_CLARO} />
      <rect x="49" y="53" width="24" height="6" rx="1.5" fill={AZUL_CLARO} opacity="0.55" />

      <rect x="76" y="44" width="22" height="6" rx="1.5" fill={CINZA_CLARO} />
      <rect x="76" y="53" width="22" height="6" rx="1.5" fill={CINZA_CLARO} />
      <rect x="76" y="62" width="22" height="6" rx="1.5" fill={CINZA_CLARO} />

      {/* Faixa de veículo no pé, como no quadro de verdade */}
      <rect x="22" y="80" width="24" height="8" rx="2" fill={VERMELHO} opacity="0.75" />
      <rect x="49" y="80" width="24" height="8" rx="2" fill={VERMELHO} opacity="0.75" />
      <rect x="76" y="80" width="22" height="8" rx="2" fill={AMARELO} />
    </svg>
  )
}

/** Cadastros — as fichas que alimentam todos os outros módulos. */
export function IlustracaoCadastros({ className }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Fichário de cadastros">
      <circle cx="60" cy="60" r="56" fill={AZUL} opacity="0.08" />
      <rect x="24" y="34" width="66" height="16" rx="4" fill={CINZA_CLARO} transform="rotate(-6 57 42)" />
      <rect x="26" y="52" width="66" height="16" rx="4" fill={AZUL_CLARO} transform="rotate(-2 59 60)" />
      <rect x="26" y="72" width="66" height="16" rx="4" fill={VERMELHO} transform="rotate(3 59 80)" />
      <circle cx="38" cy="41" r="4" fill={AZUL} opacity="0.6" />
      <circle cx="39" cy="60" r="4" fill="#fff" opacity="0.85" />
      <circle cx="40" cy="80" r="4" fill="#fff" opacity="0.85" />
      <path d="M50 40h30" stroke={AZUL} strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <path d="M50 59h30" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      <path d="M51 80h30" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      <path d="M20 98h80" stroke={AZUL} strokeWidth="5" strokeLinecap="round" opacity="0.3" />
    </svg>
  )
}
