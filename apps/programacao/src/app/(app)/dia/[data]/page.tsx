import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, ImageDown, PlugZap } from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { podeLancar } from '@/lib/dominio/cargos'
import { frentesAtivas, funcoesAtivas, programacaoDoDia, ultimaProgramacaoAntesDe } from '@/queries/programacao'
import { funcionariosDoRh, veiculosDaFrota, maquinasDoPortal } from '@/lib/clientes'
import { prisma } from '@/lib/prisma'
import { conferirQuadro } from '@/lib/dominio/conflitos'
import { deIso, diaUtc, paraIso, tituloDoDia, STATUS_PROGRAMACAO } from '@/lib/dominio/constantes'
import { Quadro } from '@/components/quadro/quadro'
import { BarraDoDia } from '@/components/quadro/barra-do-dia'
import { caminhoPublico } from '@/lib/url-publica'

export const dynamic = 'force-dynamic'

// A seta principal sai do módulo e retorna ao hub unificado. Os controles à direita
// continuam responsáveis apenas por trocar o dia exibido.
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3010'

export async function generateMetadata({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params
  const d = deIso(data)
  return { title: d ? `${tituloDoDia(d)} — Programação` : 'Programação' }
}

export default async function DiaPage({ params }: { params: Promise<{ data: string }> }) {
  const sessao = await exigirSessao()
  const { data: iso } = await params
  const dataBruta = deIso(iso)
  if (!dataBruta) notFound()
  const data = diaUtc(dataBruta)

  const [programacao, frentes, funcoes, anterior, rh, frota, portal, funcionariosLocais, veiculosLocais] = await Promise.all([
    programacaoDoDia(data),
    frentesAtivas(),
    funcoesAtivas(),
    ultimaProgramacaoAntesDe(data),
    funcionariosDoRh(),
    veiculosDaFrota(),
    maquinasDoPortal(),
    prisma.funcionario.findMany({ where: { ativo: true, ausente: false }, orderBy: { nome: 'asc' } }),
    prisma.veiculo.findMany({ where: { ativo: true }, orderBy: { modelo: 'asc' } }),
  ])

  const escalas = programacao?.escalas ?? []
  const recursos = programacao?.recursos ?? []

  const conflitos = conferirQuadro(
    escalas.map((e) => ({ id: e.id, frenteId: e.frenteId, nome: e.nome, funcaoSigla: e.funcaoSigla })),
    recursos.map((r) => ({
      id: r.id, frenteId: r.frenteId, tipo: r.tipo,
      placa: r.placa, descricao: r.descricao, motoristaNome: r.motoristaNome,
    })),
    frentes.map((f) => ({ id: f.id, nome: f.nome })),
    frota.ok ? frota.dados : [],
  )

  const anteriorIso = anterior ? paraIso(anterior.data) : null
  const podeEditar = podeLancar(sessao.cargo)
  const ontem = new Date(data.getTime() - 86_400_000)
  const amanha = new Date(data.getTime() + 86_400_000)

  const foraDoAr = [
    !rh.ok ? `RH (${rh.erro})` : null,
    !frota.ok ? `Frota (${frota.erro})` : null,
    !portal.ok ? `Portal (${portal.erro})` : null,
  ].filter(Boolean) as string[]

  const obrasDoQuadro = new Set(
    frentes.map((frente) => frente.obraCodigo).filter((codigo): codigo is string => Boolean(codigo)),
  )
  const rhDisponiveis = rh.ok
    ? rh.dados
      .filter((funcionario) => funcionario.status === 'ATIVO' && funcionario.obraCodigo)
      .filter((funcionario) => obrasDoQuadro.size === 0 || obrasDoQuadro.has(funcionario.obraCodigo!))
    : []

  return (
    <div className="mx-auto max-w-[1900px] space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center gap-4">
        <Link href={URL_PORTAL} className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground" aria-label="Voltar ao painel principal">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{tituloDoDia(data)}</h1>
          <p className="text-xs text-muted-foreground">
            {escalas.length} {escalas.length === 1 ? 'pessoa' : 'pessoas'} ·{' '}
            {recursos.length} {recursos.length === 1 ? 'veículo/máquina' : 'veículos/máquinas'}
            {programacao?.status === STATUS_PROGRAMACAO.PUBLICADA && programacao.publicadaPor && (
              <> · publicada por {programacao.publicadaPor}</>
            )}
          </p>
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href={`/dia/${paraIso(ontem)}`} aria-label="Dia anterior"
            className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link
            href={`/dia/${paraIso(amanha)}`} aria-label="Dia seguinte"
            className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted"
          >
            <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      <BarraDoDia
        data={iso}
        temConteudo={escalas.length > 0 || recursos.length > 0}
        anteriorIso={anteriorIso}
        anteriorTitulo={anterior ? tituloDoDia(anterior.data) : null}
        publicada={programacao?.status === STATUS_PROGRAMACAO.PUBLICADA}
        podeEditar={podeEditar}
      />

      {foraDoAr.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          <PlugZap className="mt-0.5 size-4 shrink-0" />
          <span>
            Sem resposta de: {foraDoAr.join(', ')}. O quadro continua funcionando — só a lista
            de sugestões desses sistemas fica vazia, e dá para digitar avulso.
          </span>
        </p>
      )}

      <Quadro
        data={iso}
        frentes={frentes.map((f) => ({ id: f.id, nome: f.nome, cor: f.cor, logo: f.logo }))}
        escalas={escalas.map((e) => ({
          id: e.id, frenteId: e.frenteId, nome: e.nome,
          funcaoSigla: e.funcaoSigla, funcionarioId: e.funcionarioId,
        }))}
        recursos={recursos.map((r) => ({
          id: r.id, frenteId: r.frenteId, tipo: r.tipo, descricao: r.descricao,
          motoristaNome: r.motoristaNome, destaque: r.destaque, placa: r.placa,
        }))}
        disponiveis={[
          ...rhDisponiveis.map((f) => ({
            id: f.id, nome: f.nome, cargo: f.cargo, obraCodigo: f.obraCodigo, origem: 'RH' as const,
            foto: f.foto,
          })),
          // Cadastro local: quem não está no RH (a maioria). `cargo` aqui já é a sigla.
          ...funcionariosLocais.map((f) => ({
            id: f.id, nome: f.nome, cargo: f.funcaoSigla, obraCodigo: null,
            origem: 'LOCAL' as const, foto: f.foto,
          })),
        ]}
        veiculos={frota.ok ? frota.dados.map((v) => ({
          placa: v.placa, nome: v.nome, motorista: v.motorista, emManutencao: v.emManutencao,
        })) : []}
        maquinas={portal.ok ? portal.dados.map((m) => ({ id: m.id, nome: m.nome, codigo: m.codigo })) : []}
        veiculosCadastrados={veiculosLocais.map((v) => ({
          id: v.id, modelo: v.modelo, placa: v.placa, motoristaNome: v.motoristaNome,
        }))}
        funcoes={funcoes.map((f) => ({ sigla: f.sigla, nome: f.nome, cargoRh: f.cargoRh, cor: f.cor }))}
        conflitos={conflitos}
        podeEditar={podeEditar}
      />

      {(escalas.length > 0 || recursos.length > 0) && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ImageDown className="size-4 text-muted-foreground" /> Imagem para o grupo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mesmo formato da planilha de hoje. Baixe e mande no grupo da programação.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG gerado sob demanda pela rota, sem dimensão fixa conhecida aqui */}
          <img
            src={caminhoPublico(`/api/imagem/${iso}`)} alt={`Programação de ${tituloDoDia(data)}`}
            className="mt-4 w-full rounded-xl border border-border/70 bg-white shadow-sm"
          />
        </section>
      )}
    </div>
  )
}
