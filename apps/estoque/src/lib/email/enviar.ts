import 'server-only'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string }

/** A configuração salva, ou null se ninguém configurou ainda. */
export async function configuracaoEmail() {
  return prisma.configuracaoEmail.findUnique({ where: { id: 'unica' } })
}

export type ConfiguracaoEmail = NonNullable<Awaited<ReturnType<typeof configuracaoEmail>>>

/**
 * Traduz o erro do servidor de e-mail para uma frase que diz o que fazer.
 *
 * A mensagem crua do nodemailer ("535 5.7.8 Username and Password not accepted") não ajuda
 * quem só quer mandar um pedido de cimento — e o erro mais comum, de longe, é usar a senha
 * normal da conta em vez da senha de aplicativo.
 */
function traduzirErro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e)

  if (/invalid login|535|Username and Password not accepted|authentication failed/i.test(bruto)) {
    return (
      'O servidor recusou o usuário ou a senha. Lembre: aqui vai a SENHA DE APLICATIVO, ' +
      'não a senha que você usa para entrar no e-mail. Veja as instruções na tela.'
    )
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(bruto)) {
    return 'Não encontrei o servidor de e-mail. Confira o endereço do servidor e a conexão com a internet.'
  }
  if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(bruto)) {
    return 'O servidor de e-mail não respondeu. Pode ser a porta bloqueada pelo antivírus ou pelo firewall da empresa.'
  }
  if (/self.signed|certificate/i.test(bruto)) {
    return 'O certificado do servidor de e-mail não foi aceito. Confira o endereço e a porta.'
  }
  return bruto
}

function montarTransporte(config: ConfiguracaoEmail) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.porta,
    // 465 é a porta que já começa criptografada; 587 começa aberta e sobe para TLS no
    // meio da conversa (STARTTLS). Trocar isso faz o servidor recusar a conexão.
    secure: config.porta === 465,
    auth: { user: config.usuario, pass: config.senha },
  })
}

/** Confere se a conta aceita a conexão, sem mandar e-mail para ninguém. */
export async function testarConexao(config: ConfiguracaoEmail): Promise<ResultadoEnvio> {
  try {
    await montarTransporte(config).verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) }
  }
}

export type Mensagem = {
  para: string
  assunto: string
  corpo: string
  copiaPara?: string | null
}

export async function enviarEmail(msg: Mensagem): Promise<ResultadoEnvio> {
  const config = await configuracaoEmail()
  if (!config || !config.ativo) {
    return {
      ok: false,
      erro: 'Nenhuma conta de e-mail configurada. Vá em Configurações e vincule uma conta.',
    }
  }

  try {
    await montarTransporte(config).sendMail({
      from: config.remetente || config.usuario,
      to: msg.para,
      cc: msg.copiaPara || config.copiaPara || undefined,
      subject: msg.assunto,
      text: msg.corpo,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) }
  }
}
