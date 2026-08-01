import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * O nome é o do painel de propósito — não troque para `rh_sessao`.
 *
 * É isto, junto com o mesmo AUTH_SECRET, que faz o login valer nos dois sistemas: cookie
 * não é separado por porta, só por host. Quem entra no painel em :3000 chega aqui em
 * :3002 já autenticado. Renomear aqui não quebra nada de imediato — só faz o usuário
 * passar a logar duas vezes, sem erro nenhum apontando a causa.
 */
const COOKIE = 'locacao_sessao'
const DIAS = 7

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

export type Sessao = { id: string; nome: string; email: string; papel: string }

export async function criarSessao(u: Sessao) {
  const token = await new SignJWT({ ...u })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(segredo())

  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Sem HTTPS o cookie `secure` nunca é enviado, e o sistema roda em rede local por
    // HTTP. Fica atrás de uma variável para quem colocar um proxy TLS na frente.
    secure: process.env.NODE_ENV === 'production' && process.env.FORCA_HTTPS === '1',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  })
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, segredo())
    return {
      id: String(payload.id),
      nome: String(payload.nome),
      email: String(payload.email),
      papel: String(payload.papel),
    }
  } catch {
    // Assinatura inválida, expirado ou adulterado — tudo vira "não autenticado".
    return null
  }
}

export async function encerrarSessao() {
  ;(await cookies()).delete(COOKIE)
}

/**
 * Hash real de uma string aleatória descartada, usado quando o e-mail não existe.
 *
 * Precisa ser um hash *válido*: com um valor inventado o bcrypt rejeita o formato na
 * hora (medido: 0 ms contra 72 ms de um hash de verdade), e a diferença de tempo que
 * este campo existe para eliminar continuaria denunciando quais e-mails estão
 * cadastrados. Não é segredo — não abre nenhuma conta.
 */
const HASH_ISCA = '$2b$10$m49xnZxxbkiPAH.XVggfuekBiWQuoFwVADM1GjTNAVYKbRHxJiYAa'

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const u = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } })

  // Compara mesmo sem usuário: ver comentário do HASH_ISCA.
  const confere = await bcrypt.compare(senha, u?.senhaHash ?? HASH_ISCA)

  if (!u || !u.ativo || !confere) return null
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel }
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
