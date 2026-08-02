import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { CARGO, type Modulo } from '@/lib/dominio/cargos'

/**
 * O mesmo nome de cookie dos outros módulos — não troque.
 *
 * Cookie não separa por porta, só por host. É isto, junto com o AUTH_SECRET compartilhado,
 * que faz quem entra aqui já chegar autenticado no RH, no Almoxarifado e no Painel. O
 * Portal é quem EMITE o crachá; os outros só conferem a assinatura.
 */
const COOKIE = 'locacao_sessao'
const DIAS = 7

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Todos os módulos precisam do MESMO valor — ' +
        'é ele que faz o login do Portal valer nos outros sistemas.',
    )
  }
  return new TextEncoder().encode(s)
}

export type Sessao = {
  id: string
  nome: string
  email: string
  cargo: string
  modulos: string[]
  /**
   * Mantido só para os módulos antigos que ainda leem `papel`.
   *
   * Enquanto algum deles não tiver sido migrado para `cargo`, remover este campo faria a
   * sessão parecer válida e o usuário aparecer sem permissão nenhuma lá dentro — uma falha
   * silenciosa, que é a pior de achar.
   */
  papel: string
}

/**
 * O crachá carrega o cargo e os módulos.
 *
 * Vai dentro do token, e não numa consulta ao banco do Portal, porque os outros módulos têm
 * bancos separados: se precisassem perguntar, o Almoxarifado pararia de funcionar toda vez
 * que o Portal caísse. O preço é que mudar o cargo de alguém só vale no próximo login —
 * documentado na tela de usuários.
 */
export async function criarSessao(u: Sessao) {
  const token = await new SignJWT({ ...u })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(segredo())

  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Sem HTTPS o cookie `secure` nunca é enviado, e o sistema roda em rede local por HTTP.
    // Fica atrás de uma variável para quem colocar um proxy TLS na frente.
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
      cargo: String(payload.cargo ?? payload.papel ?? CARGO.CONSULTA),
      modulos: Array.isArray(payload.modulos) ? payload.modulos.map(String) : [],
      papel: String(payload.papel ?? payload.cargo ?? CARGO.CONSULTA),
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
 * Precisa ser um hash *válido*: com um valor inventado o bcrypt rejeita o formato na hora, e
 * a diferença de tempo que este campo existe para eliminar continuaria denunciando quais
 * e-mails estão cadastrados. Não é segredo — não abre nenhuma conta.
 */
const HASH_ISCA = '$2b$10$m49xnZxxbkiPAH.XVggfuekBiWQuoFwVADM1GjTNAVYKbRHxJiYAa'

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const limpo = email.toLowerCase().trim()
  const u = await prisma.usuario.findUnique({
    where: { email: limpo },
    include: { acessos: { select: { modulo: true } } },
  })

  // Compara mesmo sem usuário: ver comentário do HASH_ISCA.
  const confere = await bcrypt.compare(senha, u?.senhaHash ?? HASH_ISCA)

  if (!u || !u.ativo || !confere) {
    await registrar(limpo, u?.nome ?? null, false, !u ? 'e-mail não cadastrado' : !u.ativo ? 'usuário inativo' : 'senha incorreta')
    return null
  }

  await registrar(limpo, u.nome, true, null)
  await prisma.usuario.update({ where: { id: u.id }, data: { ultimoAcesso: new Date() } })

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cargo: u.cargo,
    modulos: u.acessos.map((a) => a.modulo),
    papel: u.cargo,
  }
}

/** O registro de acesso nunca derruba o login: falhar em anotar não é motivo para barrar quem tem senha certa. */
async function registrar(email: string, nome: string | null, sucesso: boolean, motivo: string | null) {
  try {
    await prisma.registroAcesso.create({ data: { email, nome, sucesso, motivo } })
  } catch {
    // Sem o registro o login continua valendo.
  }
}

/**
 * Piso de toda escrita e de toda leitura protegida.
 *
 * Redireciona em vez de lançar erro próprio: quando a sessão expira com a tela aberta, o
 * clique leva de volta ao login em vez de estourar uma tela de erro. `redirect()` interrompe
 * a execução, então toda chamada fica FORA do `try` das actions — dentro, o catch engoliria
 * o sinal e devolveria `{ ok: false }` em vez de redirecionar.
 */
export async function exigirSessao(): Promise<Sessao> {
  const s = await lerSessao()
  if (!s) redirect('/entrar')
  return s
}

export async function exigirAdmin(): Promise<Sessao> {
  const s = await exigirSessao()
  if (s.cargo !== CARGO.ADMIN) redirect('/')
  return s
}

export function temAcesso(sessao: Sessao, modulo: Modulo): boolean {
  // ADMIN e DIRETORIA enxergam tudo por definição do cargo — listar módulo por módulo para
  // eles seria só uma chance a mais de alguém esquecer de marcar uma caixa.
  if (sessao.cargo === CARGO.ADMIN || sessao.cargo === CARGO.DIRETORIA) return true
  return sessao.modulos.includes(modulo)
}
