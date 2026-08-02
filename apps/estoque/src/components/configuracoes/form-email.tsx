'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Mail, Send, TriangleAlert } from 'lucide-react'
import { salvarConfiguracaoEmail, testarEnvioEmail, desativarEnvioEmail } from '@/actions/configuracao-email'
import { PROVEDOR_EMAIL, ROTULO_PROVEDOR, SERVIDOR_PADRAO, COMO_OBTER_SENHA, type ProvedorEmail } from '@/lib/email/provedores'
import { dataBR } from '@/lib/dominio/formato'
import type { ConfiguracaoEmailTela } from '@/queries/configuracao'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormEmail({ config }: { config: ConfiguracaoEmailTela }) {
  const router = useRouter()
  const [provedor, setProvedor] = useState<ProvedorEmail>(
    (config?.provedor as ProvedorEmail) ?? PROVEDOR_EMAIL.GMAIL,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, iniciarSalvar] = useTransition()
  const [testando, iniciarTeste] = useTransition()

  const ehOutro = provedor === PROVEDOR_EMAIL.OUTRO
  const servidor = SERVIDOR_PADRAO[provedor]

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    setAviso(null)
    iniciarSalvar(async () => {
      const r = await chamarAction(salvarConfiguracaoEmail({
        ...Object.fromEntries(fd.entries()),
        enviarAutomatico: fd.get('enviarAutomatico') === 'on',
      }))
      if (!r.ok) return setErro(r.erro)
      setAviso('Configuração salva. Agora clique em "Enviar e-mail de teste" para confirmar que funciona.')
      router.refresh()
    })
  }

  function testar() {
    setErro(null)
    setAviso(null)
    iniciarTeste(async () => {
      const r = await chamarAction(testarEnvioEmail())
      if (!r.ok) return setErro(r.erro)
      setAviso(`E-mail de teste enviado para ${r.dados.enviadoPara}. Confira a caixa de entrada.`)
      router.refresh()
    })
  }

  function desativar() {
    setErro(null)
    iniciarTeste(async () => {
      const r = await chamarAction(desativarEnvioEmail())
      if (!r.ok) return setErro(r.erro)
      setAviso('Envio automático desativado. Os botões de Gmail e Outlook continuam funcionando.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {config?.ativo && config.testadoEm && (
        <p className="flex items-center gap-2 rounded-md border border-status-ativa/40 bg-status-ativa/10 p-3 text-sm">
          <Check className="size-4 shrink-0 text-status-ativa" />
          Conta vinculada e testada em {dataBR(config.testadoEm)}. As solicitações saem por
          <strong> {config.usuario}</strong>.
        </p>
      )}
      {config?.ativo && !config.testadoEm && (
        <p className="flex items-start gap-2 rounded-md border border-status-atencao/40 bg-status-atencao/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-atencao" />
          <span>
            A conta está salva mas <strong>ainda não foi testada</strong>. Clique em &quot;Enviar
            e-mail de teste&quot; — só assim dá para saber se os pedidos vão sair de verdade.
          </span>
        </p>
      )}

      <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="provedor" className="mb-1 block text-sm font-medium">Provedor de e-mail *</label>
            <select
              id="provedor" name="provedor" required value={provedor}
              onChange={(e) => setProvedor(e.target.value as ProvedorEmail)} className={CAMPO}
            >
              {Object.values(PROVEDOR_EMAIL).map((p) => (
                <option key={p} value={p}>{ROTULO_PROVEDOR[p]}</option>
              ))}
            </select>
            {!ehOutro && (
              <p className="mt-1 text-xs text-muted-foreground">
                Servidor preenchido sozinho: {servidor.host}, porta {servidor.porta}.
              </p>
            )}
          </div>

          {ehOutro && (
            <>
              <div>
                <label htmlFor="host" className="mb-1 block text-sm font-medium">Servidor de saída (SMTP) *</label>
                <input id="host" name="host" defaultValue={config?.host ?? ''} placeholder="smtp.suaempresa.com.br" className={CAMPO} />
              </div>
              <div>
                <label htmlFor="porta" className="mb-1 block text-sm font-medium">Porta</label>
                <input id="porta" name="porta" type="number" defaultValue={config?.porta ?? 587} className={CAMPO} />
              </div>
            </>
          )}

          <div>
            <label htmlFor="usuario" className="mb-1 block text-sm font-medium">E-mail que vai enviar *</label>
            <input
              id="usuario" name="usuario" type="email" required data-testid="email-usuario"
              defaultValue={config?.usuario ?? ''} placeholder="almoxarifado@siqueiracampos.com.br" className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha de aplicativo *</label>
            <input
              id="senha" name="senha" type="password" required data-testid="email-senha"
              defaultValue={config?.senha ?? ''} className={CAMPO}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {config ? 'Deixe como está para manter a senha atual.' : 'Não é a senha normal do e-mail — veja abaixo.'}
            </p>
          </div>

          <div>
            <label htmlFor="destinatarioPadrao" className="mb-1 block text-sm font-medium">
              E-mail do comprador
            </label>
            <input
              id="destinatarioPadrao" name="destinatarioPadrao" type="email" data-testid="email-comprador"
              defaultValue={config?.destinatarioPadrao ?? ''} placeholder="compras@siqueiracampos.com.br" className={CAMPO}
            />
            <p className="mt-1 text-xs text-muted-foreground">Para quem a solicitação vai automaticamente.</p>
          </div>

          <div>
            <label htmlFor="copiaPara" className="mb-1 block text-sm font-medium">Cópia para</label>
            <input
              id="copiaPara" name="copiaPara" type="email"
              defaultValue={config?.copiaPara ?? ''} placeholder="opcional" className={CAMPO}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox" name="enviarAutomatico" data-testid="enviar-automatico"
            defaultChecked={config?.enviarAutomatico ?? true} className="mt-0.5"
          />
          <span>
            Enviar sozinho assim que uma solicitação for criada
            <span className="block text-xs text-muted-foreground">
              Desligado, o pedido é criado como rascunho e você envia quando quiser.
            </span>
          </span>
        </label>

        {erro && (
          <p role="alert" data-testid="erro-email" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">{aviso}</p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="submit" disabled={salvando} data-testid="salvar-email"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Mail className="mr-2 inline size-4" />
            {salvando ? 'Salvando…' : config ? 'Salvar alterações' : 'Vincular conta'}
          </button>
          {config && (
            <>
              <button
                type="button" onClick={testar} disabled={testando} data-testid="testar-email"
                className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                <Send className="mr-2 inline size-4" />
                {testando ? 'Testando…' : 'Enviar e-mail de teste'}
              </button>
              {config.ativo && (
                <button type="button" onClick={desativar} disabled={testando} className="rounded-md border border-border px-4 py-2 text-sm text-destructive">
                  Desativar envio
                </button>
              )}
            </>
          )}
        </div>
      </form>

      <div className="rounded-lg border border-dashed border-border p-4">
        <h3 className="text-sm font-medium">Como conseguir a senha de aplicativo</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {COMO_OBTER_SENHA[provedor].map((passo) => <li key={passo}>{passo}</li>)}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          A senha de aplicativo vale só para enviar e-mail e pode ser cancelada a qualquer
          momento, sem mexer na senha da conta. É por isso que ela é usada aqui em vez da
          senha normal — que, aliás, os dois provedores já não aceitam mais.
        </p>
      </div>
    </div>
  )
}
