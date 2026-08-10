# System Design

Adaptado para a stack deste repositório (Next.js 16 + React 19 + Tailwind CSS v4, 5 apps
independentes em `apps/*`, sem workspace compartilhado — cada app tem sua própria cópia dos
tokens e componentes de base). Onde o sistema original referenciava HTMX ou um pipeline de
build em Go, a intenção foi adaptada para React/Next abaixo (ver §7 e §12).

## 1. Filosofia

Operacional, denso, legível, previsível. Referências: Stripe Dashboard, Linear, Notion,
Anytype, Discord.

**Cada elemento tem função clara.** Sem decoração. Animação máxima 260ms.

**Proibido:**

- **glow** (halo difuso) — usar `brightness()`, border ou inset shadow
- glassmorphism, neomorphism, gradients exagerados
- sombras fortes fora da escala `--shadow-xs/sm/md/lg`

## 2. Layout

```
Sidebar fixa esquerda (sempre escura, mesmo em tema claro)
Header superior        (ações da página + theme toggle)
Área conteúdo central  (cards/blocos)
```

Sidebar **colapsável** (64px compact mode, persistida em `localStorage`, chave
`sidebar-colapsada`). No mobile (≤ 720px) vira drawer com backdrop — comportamento
separado do collapse de desktop.

## 3. Cores — neutro + acento colorido (estilo Anytype/Notion/Discord)

A base é uma escala **neutra de verdade** (croma quase zero) para fundo, texto, bordas e
cartões — nada de neutros puxados pra azul. A cor entra só como **acento**: botão primário,
link ativo, tile de ícone, badge. Cada app mantém sua identidade de cor (é o que já
diferenciava os 5 sistemas antes desta reforma), só ficou mais saturada/viva:

App | Acento | Hue (OKLCH)
---|---|---
Portal | azul | 255
Painel de Locação | índigo | 288
RH e SST | verde-azulado | 172
Almoxarifado | terracota | 45
Alojamentos | âmbar | 85

A sidebar é **sempre escura** (near-black, ligeiramente mais escura que o `--background` do
tema escuro) — não muda com o toggle de tema. É o mesmo truque do Discord/Notion/Linear: a
"casca" do produto tem cor própria, o conteúdo segue o tema do usuário.

### Tokens (por app, em `src/app/globals.css`)

Família | Onde
---|---
`--background/foreground/card/muted/border/input` (neutro, croma ~0.001–0.008) | `:root` + `.dark`
`--primary/ring/accent/destructive` (acento do app + destrutivo) | `:root` + `.dark`
`--sidebar*` (sempre escura, fora do `.dark`) | `:root` (fixo)
`--color-success/warning/info/purple` + `*-soft` (semânticas genéricas) | `:root` + `.dark`
`--ic-{cor}-1/2/grad` (8 cores de tile: blue/purple/cyan/orange/green/red/yellow/pink) | `:root` + `.dark`
`--money` (alias de success) | `:root` + `.dark`
`--tile-shadow` (drop shadow neutro + inset highlight, zero glow) | `:root` + `.dark`
`--duration-fast/base/slow` (120/180/260ms) | `:root`

Espaçamento, raio e sombra usam a escala nativa do Tailwind v4 (`p-4`, `rounded-lg`,
`shadow-sm` etc.) — não duplicamos uma segunda escala em paralelo.

## 4. Tipografia

**Inter** e **JetBrains Mono**, via `next/font/google` (self-hosted automaticamente pelo
Next no build — mesmo resultado do `@font-face` manual do sistema original, sem gerenciar
`.woff2` à mão). Substitui a Geist que os apps usavam antes.

| Uso | Peso |
|---|---|
| Título principal | 700 |
| Título de seção | 600 |
| Labels | 500 |
| Texto padrão | 400 |

**Mono:** JetBrains Mono (serial, IDs, valores fiscais, números tabulares).

## 5. Componentes

- **Botões:** primary (acento do app + `brightness(1.08)` no hover), secondary (superfície
  elevada), danger (vermelho — descartar/remover), ghost (inline). Sempre com
  `:focus-visible` 2px na cor do acento. Ver `src/components/ui/button.tsx` em cada app.
- **Inputs:** altura consistente, `--border`, foco `--ring` + ring. Nunca borda invisível.
- **Tabelas:** hover por linha, headers sticky, números à direita (`.tabular`), ações à
  direita.
- **Badges:** fundo `*-soft`, texto saturado, `rounded-full`, ícone opcional.
- **Ícone tiles ("soft 3D minimal"):** gradiente 140°, inset highlight, `--tile-shadow`.
  Zero glow. Usado em KPIs, atalhos, sidebar. Ver `src/components/ui/icon-tile.tsx`.
- **Cards:** `bg-card`, `border-border`, `rounded-lg`, header opcional.
- **Toasts:** canto inferior direito, ícone semântico, auto-dismiss 4s.

**Money color:** todo `R$ ...` usa a classe `text-money` (alias de success).

## 6. Sidebar sempre escura + colapsável

Item ativo: fundo `sidebar-accent`, texto `sidebar-accent-foreground`, barra de 2px na cor
`--primary` do app à esquerda do ícone — é o único lugar onde a cor de identidade do app
aparece dentro da casca escura. Colapsado (64px): só ícones, com `title` fazendo de
tooltip nativo.

## 7. Feedback e carregamento (adaptado de HTMX para React)

O sistema original usa HTMX (`hx-swap`, `hx-headers`) porque o backend é Go. Aqui a
intenção equivalente é feita com primitivas React:

- estado de carregamento: `useTransition`/`useActionState` (Server Actions já usam isso —
  ver `pendente` em `formulario-login.tsx`) — spinner ou skeleton, nunca UI travada sem
  feedback
- toasts para sucesso/erro/validação: componente cliente próprio (`--duration-fast` na
  entrada/saída)
- CSRF: Server Actions do Next já validam origem via header `Origin`/`Sec-Fetch-Site`
  nativamente — não há necessidade do middleware manual do sistema original

## 8. Acessibilidade

Contraste AA mínimo · `:focus-visible` em todo interativo · labels associadas via
`for/id` ou `aria-label` · alvos ≥ 32×32 px · `aria-current="page"` na sidebar ·
`aria-live="polite"` em toasts.

## 9. Navegação

Sidebar com no máximo 2 níveis. Labels PT-BR, ícones Lucide (`lucide-react`, já usado nos 5
apps). Active link computado client-side via `usePathname()` (Next não tem o equivalente
direto do "server-side active link" do sistema Go sem reescrever a navegação como Server
Component puro — o custo de JS é desprezível, já é `'use client'`).

## 10. Ícones

**Lucide Icons** via `lucide-react` (componente React, não SVG inline manual — já é o
padrão dos 5 apps). `stroke="currentColor"` herda cor do pai.

## 11. Responsividade

Desktop-first. Mínimo: 1366×768, 1920×1080, 1024×768 (tablet grande). Em ≤720px sidebar
vira drawer com backdrop, grids 2-col colapsam para 1-col. Mobile não é prioridade.

## 12. Build (adaptado do pipeline Go para Next/Tailwind)

O sistema original tem um pipeline Go próprio (`cmd/build/main.go`, `tdewolff/minify`,
versionamento por content-hash). Aqui o Next.js + Tailwind v4 já fazem o equivalente
nativamente: Tailwind gera só o CSS usado (JIT), Next divide em bundles por rota e
versiona os assets por content-hash automaticamente, com `Cache-Control: immutable` nos
arquivos hashados. Não há necessidade de replicar o pipeline manual.

## Onde estão os tokens

Cada app tem seu próprio `src/app/globals.css` (não é um pacote compartilhado — os 5 apps
rodam sem workspace). Os tokens têm o mesmo nome e a mesma fórmula em todos; só o hue do
acento muda. Componentes de base (`Button`, `Badge`, `IconTile`) ficam em
`src/components/ui/` em cada app, mesmo conteúdo replicado.

**`migracao-go`** (Portal/Identidade + Painel de Locação + Almoxarifado, já unificados num
único binário) implementa a mesma casca server-side, sem React/Tailwind: um único
`static/estilo.css` com os mesmos tokens (mesmos valores OKLCH), e a cor de acento troca por
atributo `[data-modulo="identidade|painel|almoxarifado"]` em vez de por app/porta — decidido
em `static/app.js` a partir de `location.pathname`, no mesmo script bloqueante que evita flash
de tema. Sidebar/header/hub-flutuante ficam em `templates/layout/` (Templ); ícones são SVG do
Lucide inlinados à mão (sem bundler). RH, Alojamentos e Frota continuam como processos Next.js
separados até migrarem — o hub flutuante do Go linka pra eles via `cfg.URLRH`/
`cfg.URLAlojamentos` (`internal/config/config.go`).
