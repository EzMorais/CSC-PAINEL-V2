'use client'

import { chamarAction } from '@/lib/chamar-action'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Copy, Check, Mail, TriangleAlert, Send, Zap } from 'lucide-react'
import { mudarStatusSolicitacao, dispararEmailDaSolicitacao } from '@/actions/solicitacoes'
import { montarLinks } from '@/lib/dominio/email-solicitacao'
import { STATUS_SOLICITACAO } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type FornecedorContato = { id: string; nome: string; email: string | null }

/**
 * Envio do pedido por e-mail.
 *
 * Abre o compositor do Gmail/Outlook já preenchido, em vez de o sistema enviar sozinho. O
 * sistema não tem servidor de e-mail configurado, e montar um exigiria senha de aplicativo,
 * SMTP e alguém para manter isso funcionando. Abrindo o compositor, o pedido sai da conta
 * real da pessoa — fica na "Enviados" dela, o fornecedor responde para ela, e não há
 * credencial nenhuma guardada no servidor.
 */
export type EnvioAutomatico = {
  /** Há conta de e-mail vinculada e ativa. */
  vinculado: boolean
  enviadoPara: string | null
  enviadoEm: Date | null
  erro: string | null
}

export function EnviarEmail({
  solicitacaoId, status, assunto, corpo, fornecedores, envio,
}: {
  solicitacaoId: string
  status: string
  assunto: string
  corpo: string
  fornecedores: FornecedorContato[]
  envio: EnvioAutomatico
}) {
  const [destinatario, setDestinatario] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [enviando, iniciarEnvio] = useTransition()

  const links = montarLinks(destinatario, assunto, corpo)
  const comEmail = fornecedores.filter((f) => f.email)

  function dispararAgora() {
    setErro(null)
    setAviso(null)
    iniciarEnvio(async () => {
      const r = await chamarAction(dispararEmailDaSolicitacao(solicitacaoId, destinatario || null))
      if (!r.ok) return setErro(r.erro)
      setAviso(`Pedido enviado para ${r.dados.enviadoPara}.`)
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${assunto}\n\n${corpo}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('O navegador não permitiu copiar. Abra "Ver o texto do e-mail" abaixo e copie à mão.')
    }
  }

  function marcarEnviada() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(mudarStatusSolicitacao(solicitacaoId, STATUS_SOLICITACAO.ENVIADA))
      if (!r.ok) setErro(r.erro)
    })
  }

  const BOTAO_LINK =
    'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent'

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Enviar por e-mail</h2>

      {envio.enviadoEm && (
        <p className="flex items-start gap-2 rounded-md border border-status-ativa/40 bg-status-ativa/10 p-2 text-xs">
          <Check className="mt-0.5 size-3.5 shrink-0 text-status-ativa" />
          <span>
            Já enviado para <strong>{envio.enviadoPara}</strong> em {dataBR(envio.enviadoEm)}.
            Enviar de novo manda o mesmo pedido outra vez.
          </span>
        </p>
      )}

      {envio.erro && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <span>
            O envio automático falhou: {envio.erro}
            {' '}Corrija em <Link href="/configuracoes" className="underline">Configurações</Link> e
            use o botão abaixo, ou mande pelos botões do Gmail/Outlook.
          </span>
        </p>
      )}

      <div>
        <label htmlFor="destinatario" className="mb-1 block text-sm font-medium">Para</label>
        <input
          id="destinatario" type="email" value={destinatario} data-testid="destinatario"
          onChange={(e) => setDestinatario(e.target.value)}
          placeholder="compras@fornecedor.com.br" className={CAMPO}
        />
        {comEmail.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="self-center text-xs text-muted-foreground">Fornecedores:</span>
            {comEmail.map((f) => (
              <button
                key={f.id} type="button" onClick={() => setDestinatario(f.email!)}
                className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
              >
                {f.nome}
              </button>
            ))}
          </div>
        )}
        {comEmail.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Nenhum fornecedor tem e-mail cadastrado — preencha o endereço acima, ou cadastre o
            e-mail em Fornecedores para ele aparecer como atalho aqui.
          </p>
        )}
      </div>

      {envio.vinculado ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <button
            type="button" onClick={dispararAgora} disabled={enviando} data-testid="disparar-email"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Zap className="size-4" />
            {enviando ? 'Enviando…' : envio.enviadoEm ? 'Enviar de novo' : 'Enviar agora pelo sistema'}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Sai pela conta vinculada, sem abrir o navegador.
            {destinatario ? ` Vai para ${destinatario}.` : ' Deixe o campo acima vazio para ir ao comprador padrão.'}
          </p>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma conta de e-mail vinculada — os botões abaixo abrem o e-mail já escrito, e
          você aperta enviar. Para o pedido sair sozinho ao ser criado, vincule uma conta em{' '}
          <Link href="/configuracoes" className="text-primary underline">Configurações</Link>.
        </p>
      )}

      {aviso && <p role="status" className="rounded-md border border-border bg-muted/40 p-2 text-xs">{aviso}</p>}

      <div className="flex flex-wrap gap-2">
        <a
          href={links.gmail} target="_blank" rel="noreferrer" data-testid="link-gmail"
          className={`${BOTAO_LINK} ${!destinatario ? 'pointer-events-none opacity-50' : ''}`}
        >
          <Mail className="size-4" /> Abrir no Gmail
        </a>
        <a
          href={links.outlook} target="_blank" rel="noreferrer" data-testid="link-outlook"
          className={`${BOTAO_LINK} ${!destinatario ? 'pointer-events-none opacity-50' : ''}`}
        >
          <Mail className="size-4" /> Abrir no Outlook
        </a>
        <a
          href={links.padrao} data-testid="link-mailto"
          className={`${BOTAO_LINK} ${!destinatario ? 'pointer-events-none opacity-50' : ''}`}
        >
          <Mail className="size-4" /> Meu app de e-mail
        </a>
        <button type="button" onClick={copiar} className={BOTAO_LINK} data-testid="copiar-email">
          {copiado ? <Check className="size-4 text-status-ativa" /> : <Copy className="size-4" />}
          {copiado ? 'Copiado' : 'Copiar texto'}
        </button>
      </div>

      {!destinatario && (
        <p className="text-xs text-muted-foreground">Informe o destinatário para liberar os botões.</p>
      )}

      {links.longoDemais && (
        <p className="flex items-start gap-2 rounded-md border border-status-atencao/40 bg-status-atencao/10 p-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-status-atencao" />
          <span>
            Este pedido é grande e pode chegar cortado se aberto pelos botões acima — os
            navegadores limitam o tamanho do endereço. Use <strong>Copiar texto</strong> e cole
            no e-mail.
          </span>
        </p>
      )}

      {status === STATUS_SOLICITACAO.RASCUNHO && (
        <div className="border-t border-border pt-3">
          <button
            type="button" onClick={marcarEnviada} disabled={pendente} data-testid="marcar-enviada"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-4" /> {pendente ? 'Marcando…' : 'Marcar como enviada'}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Abrir o compositor não confirma o envio — o sistema não tem como saber se você
            apertou &quot;enviar&quot; lá dentro. Marque aqui depois de mandar de verdade.
          </p>
        </div>
      )}

      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Ver o texto do e-mail</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
          {corpo}
        </pre>
      </details>
    </div>
  )
}
