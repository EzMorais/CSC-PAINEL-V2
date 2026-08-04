import 'server-only'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CARGO, podeLancar, podeAprovar, podeAdministrar } from '@/lib/dominio/cargos'

/**
 * O nome do cookie é o mesmo em todos os módulos de propósito — não troque.
 *
 * É isto, junto com o mesmo AUTH_SECRET, que faz o login do Portal valer aqui: cookie não é
 * separado por porta, só por host. Renomear não quebra nada de imediato — só faz o usuário
 * passar a logar de novo, sem erro nenhum apontando a causa.
 */
const COOKIE = 'locacao_sessao'

/** Onde o Portal responde. É ele quem tem a tela de login. */
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3004'

/**
 * O segredo é lido a cada uso, não no carregamento do módulo.
 *
 * Ler no topo faria o build quebrar em qualquer máquina sem `.env` — inclusive no
 * `next build`, que importa este módulo só para analisar as rotas. Falhar na chamada
 * mantém o erro no lugar onde ele significa alguma coisa.
 */
function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Defina uma string de 32+ caracteres no .env — ' +
        'sem ela qualquer um forjaria um cookie de sessão.',
    )
  }
  return new TextEncoder().encode(s)
}

export type Sessao = {
  id: string
  nome: string
  email: string
  /** Vem do Portal, dentro do crachá. Ver `lib/dominio/cargos.ts`. */
  cargo: string
  /** Módulos liberados para a pessoa no Portal — usado pelo hub de navegação rápida. */
  modulos: string[]
}

/**
 * Lê o crachá emitido pelo Portal.
 *
 * Este módulo não emite sessão nem guarda usuários: quem cadastra gente e assina o crachá é
 * o Portal. Aqui só se confere a assinatura e se lê o cargo de dentro — sem consultar banco
 * nenhum, o que faz o Alojamentos continuar funcionando mesmo com o Portal fora do ar.
 */
export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, segredo())
    return {
      id: String(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      // `papel` é o nome antigo do campo. Aceitar os dois evita que um crachá emitido antes
      // desta mudança derrube a pessoa para o cargo mais fraco sem nenhum aviso.
      cargo: String(payload.cargo ?? payload.papel ?? CARGO.CONSULTA),
      modulos: Array.isArray(payload.modulos) ? payload.modulos.map(String) : [],
    }
  } catch {
    // Assinatura inválida, expirado ou adulterado — tudo vira "não autenticado".
    return null
  }
}

export async function encerrarSessao() {
  ;(await cookies()).delete(COOKIE)
}

/** Manda para o login do Portal, guardando para onde a pessoa queria ir. */
export function urlDeLogin(destino = '/'): string {
  return `${URL_PORTAL}/entrar?destino=${encodeURIComponent(destino)}`
}

/**
 * Piso de toda escrita e de toda leitura protegida.
 *
 * Server Actions são endpoints POST que o Next expõe por um id estável: proteger só o
 * layout deixaria as ações alcançáveis por quem chamasse o endereço direto, sem passar
 * por tela nenhuma. Por isso toda action chama isto antes de tocar no banco.
 *
 * Redireciona em vez de lançar um erro próprio. Duas razões:
 *
 * 1. Página e layout renderizam em paralelo. `obras/page.tsx` chama `listarObras()` no
 *    render, então a guarda dispara antes de o redirect do layout terminar — com um
 *    `throw` comum isso enchia o log de "NAO_AUTENTICADO" a cada visita deslogada.
 * 2. Quando a sessão expira com a tela aberta, o clique leva de volta ao login em vez
 *    de estourar uma tela de erro.
 *
 * `redirect()` interrompe a execução (lança NEXT_REDIRECT internamente), então nada
 * abaixo da chamada roda — inclusive num POST direto ao endpoint da action. Por isso
 * toda chamada fica FORA do `try` das actions: dentro, o catch engoliria o sinal e
 * devolveria `{ ok: false }` em vez de redirecionar.
 */
export async function exigirSessao(): Promise<Sessao> {
  const s = await lerSessao()
  if (!s) redirect('/entrar')
  return s
}

/**
 * Piso de toda ESCRITA. Quem só consulta não passa daqui.
 *
 * Separado de `exigirSessao` de propósito: estar logado e poder alterar são coisas
 * diferentes desde que existem cargos. Sem esta guarda, o cargo Consulta seria só um rótulo
 * na tela — as Server Actions continuariam alcançáveis por quem chamasse o endereço direto,
 * sem passar por botão nenhum.
 */
export async function exigirLancamento(): Promise<Sessao> {
  const s = await exigirSessao()
  if (!podeLancar(s.cargo)) {
    throw new Error(
      'Seu cargo permite apenas consultar. Para lançar nos alojamentos, peça ao ' +
        'administrador para mudar seu cargo no Portal.',
    )
  }
  return s
}

/** Piso das aprovações. Quem lança não aprova — ver `lib/dominio/cargos.ts`. */
export async function exigirAprovacao(): Promise<Sessao> {
  const s = await exigirSessao()
  if (!podeAprovar(s.cargo)) {
    throw new Error('Só gerência ou diretoria aprova. Seu cargo permite lançar, não aprovar.')
  }
  return s
}

/**
 * Piso das configurações do sistema.
 *
 * Mais restrito que lançar porque aqui mora credencial: a senha da conta de e-mail que
 * guarda contato de morador e responsável.
 */
export async function exigirAdministracao(): Promise<Sessao> {
  const s = await exigirSessao()
  if (!podeAdministrar(s.cargo)) {
    throw new Error('Só o administrador do sistema mexe nas configurações.')
  }
  return s
}
