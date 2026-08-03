import Link from 'next/link'
import {
  MessageCircle, QrCode, CircleCheck, CircleAlert, PlugZap, TriangleAlert, ArrowDown, ArrowUp, RefreshCw,
} from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { estadoWhatsapp, listarGruposWhatsapp } from '@/lib/cliente-whatsapp'
import { prisma } from '@/lib/prisma'
import { ultimasMensagens, cadastroDeTelefones } from '@/queries/whatsapp'
import { VinculoGrupos } from '@/components/whatsapp/vinculo-grupos'
import { GATILHOS } from '@/lib/dominio/conversa-whatsapp'

export const metadata = { title: 'WhatsApp' }
export const dynamic = 'force-dynamic'

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export default async function WhatsappPage() {
  await exigirSessao()

  const [estado, mensagens, cadastro, alojamentos] = await Promise.all([
    estadoWhatsapp(), ultimasMensagens(), cadastroDeTelefones(),
    prisma.alojamento.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, grupoWhatsappId: true },
    }),
  ])

  const conectado = estado.ok && estado.dados.conectado
  const qr = estado.ok ? estado.dados.qr : null

  // A lista de grupos só existe com o número pareado — antes disso não há o que consultar.
  const grupos = conectado ? await listarGruposWhatsapp() : null
  const vinculados = alojamentos.filter((a) => a.grupoWhatsappId).length

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageCircle className="size-6 text-primary" /> WhatsApp
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os moradores abrem pedido mandando mensagem, e recebem aviso quando ele anda
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Conexão</h2>

        {!estado.ok ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <PlugZap className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">O serviço de WhatsApp não respondeu</p>
              <p className="mt-0.5 text-muted-foreground">{estado.erro}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Ele roda separado do Alojamentos, na pasta <code>apps/whatsapp</code>. Ligue com{' '}
                <code>npm start</code> lá dentro e recarregue esta página.
              </p>
            </div>
          </div>
        ) : conectado ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-ativa/40 bg-status-ativa/10 p-3 text-sm">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-status-ativa" />
            <div>
              <p className="font-medium">Conectado</p>
              <p className="mt-0.5 text-muted-foreground">
                Número {estado.dados.numero ?? '—'}
                {estado.dados.desde && ` · desde ${DATA_HORA.format(new Date(estado.dados.desde))}`}
                {estado.dados.naFila > 0 && ` · ${estado.dados.naFila} na fila de envio`}
              </p>
            </div>
          </div>
        ) : qr ? (
          <div className="mt-3 space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="size-4" /> Leia o código no celular corporativo
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada pelo serviço, sem host para o next/image otimizar */}
            <img src={qr} alt="QR code para parear o WhatsApp" className="rounded-lg border border-border bg-white p-2" width={320} height={320} />
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Abra o WhatsApp no celular corporativo</li>
              <li>Toque nos três pontinhos → <strong>Aparelhos conectados</strong></li>
              <li>Toque em <strong>Conectar um aparelho</strong> e aponte para o código</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              O código muda a cada poucos segundos — se expirar, recarregue a página.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-atencao/40 bg-status-atencao/10 p-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-status-atencao" />
            <div>
              <p className="font-medium">Desconectado</p>
              <p className="mt-0.5 text-muted-foreground">
                {estado.dados.ultimoErro ?? 'Aguardando o código de pareamento. Recarregue em alguns segundos.'}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Grupos dos alojamentos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quem escreve <code className="rounded bg-muted px-1">{GATILHOS[0]}</code> num grupo
          vinculado abre um pedido no alojamento correspondente. O resto da conversa é
          ignorado, e grupo sem vínculo é ignorado por inteiro.
        </p>

        {!conectado ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Pareie o celular acima para o sistema conseguir listar os grupos.
          </p>
        ) : !grupos?.ok ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Não foi possível listar os grupos: {grupos?.erro ?? 'erro desconhecido'}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              <span className="text-2xl font-semibold tabular">{vinculados}</span>
              <span className="text-muted-foreground">
                {' '}de {alojamentos.length} alojamentos com grupo vinculado
              </span>
            </p>
            <VinculoGrupos grupos={grupos.dados} alojamentos={alojamentos} />
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Moradores com WhatsApp cadastrado</h2>
        <p className="mt-2 text-sm">
          <span className="text-2xl font-semibold tabular">{cadastro.comTelefone}</span>
          <span className="text-muted-foreground"> de {cadastro.total} moradores ativos</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Isto vale para quem manda mensagem <strong>no privado</strong>, onde o número é a
          única forma de saber quem é. <strong>No grupo não é preciso</strong>: o grupo já diz
          o alojamento, e o nome vem do próprio WhatsApp.
          {cadastro.semTelefone > 0 && (
            <>
              {' '}
              <Link href="/moradores" className="text-primary underline underline-offset-2">
                Cadastrar em Moradores
              </Link>
            </>
          )}
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Últimas mensagens</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Serve para conferir quando alguém disser que mandou e ninguém viu.
        </p>

        {mensagens.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm" data-testid="mensagens-whatsapp">
            {mensagens.map((m) => (
              <li key={m.id} className="flex items-start gap-2 border-b border-border/50 pb-1.5 last:border-0">
                {m.direcao === 'RECEBIDA'
                  ? <ArrowDown className="mt-0.5 size-3.5 shrink-0 text-status-ativa" />
                  : <ArrowUp className={`mt-0.5 size-3.5 shrink-0 ${m.erro ? 'text-destructive' : 'text-muted-foreground'}`} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.texto}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="tabular">{m.telefone}</span> · {DATA_HORA.format(m.criadoEm)}
                    {m.erro && <span className="text-destructive"> · não enviada: {m.erro}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex items-start gap-2 rounded-lg border border-status-atencao/40 bg-status-atencao/10 p-4 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-atencao" />
        <div className="space-y-2">
          <p className="font-medium">Sobre este recurso, para quem for administrar</p>
          <p className="text-muted-foreground">
            A ligação usa o mesmo mecanismo do WhatsApp Web: o número continua funcionando
            normalmente no celular, e este sistema aparece em <strong>Aparelhos conectados</strong>.
            A biblioteca é não-oficial e o uso contraria os termos do WhatsApp — a Meta pode
            banir o número.
          </p>
          <p className="text-muted-foreground">
            O que mais causa banimento é disparo em massa para quem não pediu. Por isso o
            sistema <strong>só responde a quem escreveu primeiro</strong> e{' '}
            <strong>só avisa quem tem pedido em aberto</strong>. Não vale a pena afrouxar isso
            para mandar recado geral — use a Programação para avisos.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="size-3.5" />
            A conexão cai de vez em quando; quando cair, esta tela mostra um QR novo para
            parear de novo.
          </p>
        </div>
      </section>
    </div>
  )
}
