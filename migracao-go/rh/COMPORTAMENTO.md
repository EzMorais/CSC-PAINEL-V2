# RH e SST — comportamento mapeado do Next.js

Fonte: `apps/rh` (Next.js 16 + Prisma + SQLite próprio). Este documento descreve o
comportamento observável que a implementação Go precisa reproduzir, mesmo padrão de
`portal/COMPORTAMENTO.md`, `painel/COMPORTAMENTO.md` e `estoque/COMPORTAMENTO.md`.

Diferente dos três módulos anteriores, o RH **não tem nenhuma suíte Playwright hoje**
(`apps/rh/e2e/` só tem `apoio.ts` — credenciais, reset/seed de `teste.db`, contagens
esperadas do seed; nenhum `*.spec.ts`). Este documento é, por enquanto, a única fonte de
verdade sobre o que é comportamento crítico — a suíte de referência (`*.go.spec.ts`) é
escrita a partir dele, não o contrário.

## §1 Autenticação e autorização

Mesmo mecanismo dos outros módulos: cookie `locacao_sessao` assinado com `AUTH_SECRET`
compartilhado. Quatro guardas em `lib/auth.ts`, cada action chama a que precisa (o layout
`(app)/layout.tsx` só protege páginas — Server Actions são endpoints POST alcançáveis
diretamente, então cada uma se protege de novo):

- `exigirSessao` — piso de leitura.
- `exigirLancamento` — cria/edita. `PodeLancar`: ADMIN, OPERACIONAL, GERENTE. Usada em
  praticamente todas as 26 server actions de escrita.
- `exigirAprovacao` — `PodeAprovar`: ADMIN, GERENTE, DIRETORIA. **Definida mas não usada em
  nenhuma action hoje** — o RH não tem fluxo de aprovação (diferente do Almoxarifado). Não
  implementar nenhum fluxo de aprovação aqui: reproduzir a ausência, não inventar um.
- `exigirAdministracao` — só ADMIN. Usada num único lugar: `excluirFuncionario`. A página
  `/configuracoes` (edição de Cargo) usa `exigirLancamento`, apesar do nome sugerir
  administração — reproduzir exatamente essa permissão, não "corrigir" para administração.

As duas rotas de relatório (`/api/relatorios/funcionarios`, `/api/relatorios/resumo-pdf`) não
passam pelo layout — checam `lerSessao()` manualmente e devolvem 401 texto puro se ausente.
As três rotas de integração usam token de máquina, nunca cookie (§6).

## §2 Modelo de dados

`Obra` é réplica local simples (`id, codigo @unique, cliente, descricao, responsavel?, ativa,
criadoEm`) — **sem** o campo `abaOrigem` que existe no Painel de Locação, mesmo formato do
Almoxarifado. Sem FK entre bancos, ligação só por `codigo`. RH não tem tela de criar/editar
Obra (`/obras` é só leitura) — Obra só nasce como efeito colateral da importação de planilha
ou do seed.

Os outros 14 modelos, por bloco:

- **Cargo** — a profissão (`nome @unique`, `cbo?`, `risco` default NORMAL/INSALUBRE/
  PERICULOSO, `ativo`). Editável em `/configuracoes`. **Não confundir com `NivelObra`** (ver
  abaixo) nem com o cargo de sistema do Portal (ADMIN/GERENTE/...).
- **Departamento** — organograma de dois níveis por auto-relação (`paiId`): ramo (sem pai) →
  setor (com pai). `nome @unique` **global** — ramo e setor competem pelo mesmo namespace. Os
  dois níveis são regra só de action (`departamentos.ts`), o schema aceitaria profundidade
  arbitrária — não adicionar essa trava no schema em Go também, replicar a validação na
  camada de aplicação.
- **Funcionario** — entidade central, ~30 campos em blocos (identificação, pessoais, contato,
  endereço, contrato, bancário, vestuário). `matricula @unique` formato `SC-0001`, `cpf
  @unique` (só dígitos). `status` é **campo gravado, não derivado** (ATIVO/AFASTADO/FERIAS/
  DESLIGADO). `obraId?/cargoId?/departamentoId?` opcionais; `nivelObra?` (string livre, um dos
  7 valores de `NIVEL_OBRA`, só para quem trabalha em canteiro — é o campo que o módulo
  Alojamentos usa pra achar quem mora em alojamento).
- **Dependente** — `nome, parentesco (FILHO|CONJUGE|OUTRO), dataNascimento?, cpf?, irrf,
  salarioFamilia`. Cascade delete com Funcionario.
- **EntregaUniforme** — recibo append-only. `peca (CAMISA|CALCA|CALCADO|OUTRO), tamanho,
  quantidade default 1, motivo (ADMISSAO|REPOSICAO|TROCA|DANIFICADO), entregueEm,
  assinatura?` (PNG desenhado em canvas), `registradoPor?` (texto, não FK).
- **Treinamento** — a turma/sessão. `norma (NR_10|NR_18|NR_33|NR_35|OUTRA), realizadoEm,
  validadeEm?` — **`validadeEm` é digitado por quem registra, nunca calculado a partir da
  norma** (prazos de reciclagem variam por NR; cravar isso em código arriscaria informar
  prazo errado). Sem `validadeEm` = válido pra sempre (ex.: integração). Reproduzir essa
  ausência de cálculo automático.
- **TreinamentoParticipante** — join table, `certificado?` por participante (não por turma).
  `@@unique([treinamentoId, funcionarioId])`.
- **EntregaEpi** — ver §6. **Nunca criada pelo RH**, só recebida via integração.
- **Exame** — o ASO. `tipo (ADMISSIONAL|PERIODICO|RETORNO_TRABALHO|DEMISSIONAL|
  MUDANCA_FUNCAO), realizadoEm, validadeEm?, resultado (APTO|INAPTO|APTO_COM_RESTRICAO),
  restricoes?, arquivo?`.
- **Documento** — cobre dois casos com o mesmo model: regulatório de empresa/obra
  (`funcionarioId = null`) OU pessoal de admissão (`funcionarioId` preenchido) — exatamente
  um dos dois vínculos preenchido, nunca os dois nem nenhum. `categoria` vem de duas listas
  diferentes conforme o caso (`CATEGORIA_DOCUMENTO_EMPRESA` de 8 valores /
  `CATEGORIA_DOCUMENTO_PESSOAL` de 13 valores). `versao` default 1, **incrementa por
  título+categoria+obra** — reenviar não sobrescreve, cria versão nova (§4).
- **Auditoria** — `titulo, norma?, realizadaEm, responsavel?`, opcionalmente ligada a `Obra`.
- **AuditoriaItem** — `descricao, situacao (CONFORME|NAO_CONFORME|NAO_SE_APLICA), evidencia?`.
  Relação opcional 1:1 com `NaoConformidade` (sentido NC→Item — um item pode nunca reprovar).
- **NaoConformidade** — pode nascer solta ou a partir de item reprovado
  (`auditoriaItemId? @unique`). `gravidade (BAIXA|MEDIA|ALTA), status default ABERTA
  (ABERTA|EM_ANDAMENTO|RESOLVIDA), evidenciaAntes?, evidenciaDepois?`.
- **Evento** — timeline append-only, "fonte da verdade" do histórico do funcionário. `tipo`
  um dos 10 valores de `EVENTO` (ADMISSAO/MUDANCA_CARGO/MUDANCA_OBRA/AFASTAMENTO/RETORNO/
  FERIAS/ADVERTENCIA/PROMOCAO/DESLIGAMENTO/OBSERVACAO), `ocorridoEm` (quando aconteceu) +
  `registradoEm` (quando foi digitado, pode ser depois). **Nunca editado/apagado** quando o
  cadastro muda — ver §3.

Anexos (`foto`, `assinatura`, `certificado`, `arquivo` em Exame/Documento) são todos `data:`
URI em coluna de texto — **nenhum storage de arquivo separado, nenhum disco, nenhum S3**. A
foto do funcionário é reduzida no **cliente** antes de enviar (canvas, 480px no lado maior,
JPEG qualidade 0.82, `lib/imagem-cliente.ts`) porque aparece em toda listagem; os demais
anexos são lidos via `FileReader.readAsDataURL` sem redimensionar. Em Go, o handler recebe a
string já pronta — não há processamento de imagem do lado do servidor em nenhum dos dois
lados hoje; só validar o prefixo `data:image/` quando o campo for imagem.

## §3 Regras puras de domínio

- **CPF**: dígito verificador completo (`lib/dominio/cpf.ts`) — soma ponderada dos 9
  primeiros dígitos com pesos 10..2, resto `(soma*10) % 11` vira 0 se resultar 10 ou 11 (regra
  da Receita), confere contra o dígito 10; repete para os 10 primeiros com pesos 11..2 contra
  o dígito 11. Rejeita sequências repetidas (`\d\1{10}`, ex. `00000000000`). Gravado só com
  dígitos — unicidade não depende de máscara.
- **Matrícula**: `SC-{sequência com 4 dígitos}` (`SC-0001`), gerada a partir do **maior número
  existente + 1** (`queries/funcionarios.ts` e `importar-funcionarios.ts`) — nunca por
  `COUNT`, para não colidir depois de uma exclusão.
- **Timeline automática** (`editarFuncionario`, `actions/funcionarios.ts:186-261`): compara
  antes/depois e só gera `Evento` para o que **de fato mudou**, numa única transação com o
  próprio update (se a gravação dos eventos falhar, a timeline não pode mentir sobre uma
  mudança que "aconteceu"):
  - `obraId` mudou → `MUDANCA_OBRA`, descrição `"Obra: {código antigo|"sem obra"} → {código
    novo|"sem obra"}"`.
  - `cargoId` mudou → `MUDANCA_CARGO`, mesmo formato com nome do cargo.
  - `status` mudou → tipo por mapa fixo: ATIVO→RETORNO, AFASTADO→AFASTAMENTO, FERIAS→FERIAS,
    DESLIGADO→DESLIGAMENTO. Descrição `"Situação: {rótulo antigo} → {rótulo novo}"`.
  - Nenhuma mudança nesses três campos → nenhum evento, mesmo que outros campos tenham mudado.
  - `criarFuncionario` sempre gera o evento `ADMISSAO` (a timeline não pode nascer vazia para
    alguém que, por definição, foi admitido) — descrição inclui a obra se houver.
  - `registrarEvento` permite lançamento manual (tipo livre, inclui ADVERTENCIA/PROMOCAO/
    OBSERVACAO) — `ocorridoEm` escolhido pelo usuário, `registradoEm` é sempre agora.
- **Datas de calendário sempre meia-noite UTC** (`Date.UTC(ano, mês-1, dia)`) — nunca horário
  local, para o fuso de Brasília (UTC-3) não fazer o "dia" mudar perto da meia-noite.
  Formatação usa `timeZone: 'UTC'` explicitamente. Carimbos de instante real (ex.: "emitido
  em") usam hora local, não meia-noite UTC — são dois formatadores diferentes no Next.js
  (`dataBR` vs `dataLocalBR'), não confundir os dois em Go.
- **Vencimento — janela fixa de 30 dias**, mesmo padrão em treinamento/exame/documento
  (`queries/treinamentos.ts`, `queries/exames.ts`, `queries/documentos.ts`): "vencendo" =
  `validadeEm <= hoje+30dias AND validadeEm != null`; "vencido" = `validadeEm < hoje`.
  Registro sem `validadeEm` **nunca** aparece como pendência. Sem tela de configuração desse
  prazo hoje — não adicionar uma em Go, reproduzir o fixo.
- **Cargo.risco e NivelObra não têm validação automática** — `risco` (NORMAL/INSALUBRE/
  PERICULOSO) só ordena/destaca a lista "sem EPI" (cargo de risco aparece no topo), não força
  exigência de EPI ou exame nenhum apesar do comentário no schema sugerir isso como intenção
  futura. `NIVEL_OBRA` é lista fixa em código (não tabela), a ORDEM do array é a hierarquia
  (`GERENTE_DE_OBRAS > ENGENHEIRO > MESTRE_DE_OBRAS > ENCARREGADO > OFICIAL > MEIO_OFICIAL >
  SERVENTE_AJUDANTE`) — eixo independente de `Cargo` (uma pessoa é Pedreiro DE PROFISSÃO e
  Oficial DE NÍVEL).
- **Documento — versionamento**: `versao` incrementa contando quantos documentos já existem
  com o mesmo `titulo` + `categoria` + `obraId` (ou `funcionarioId`, conforme o caso), nunca
  sobrescreve o anterior — histórico de versões fica todo na tabela.
- **Auditoria → Não Conformidade automática**: um `AuditoriaItem` com `situacao =
  NAO_CONFORME` gera (ou pode gerar, conforme a tela) uma `NaoConformidade` vinculada por
  `auditoriaItemId` — mapear o exato ponto de criação em `actions/auditorias.ts` ao
  implementar, o relacionamento no schema (`@unique`) garante no máximo uma NC por item.

## §4 Exclusão de funcionário

Só `ADMIN` (`exigirAdministracao`). Fluxo em duas etapas na UI: `vinculosDoFuncionario(id)`
primeiro conta o que está pendurado, a tela mostra antes de perguntar se confirma; só depois
chama `excluirFuncionario(id)`.

**Bloqueada se `entregasEpi + entregasUniforme + exames + treinamentos + documentos > 0`** —
mensagem lista quantos de cada tipo existem e recomenda registrar desligamento (`status =
DESLIGADO`) em vez de excluir. Motivo: esses cinco tipos são prova legal (NR-6 pra EPI, ASO
pra fiscalização) — apagar a pessoa apagaria a prova.

**`Evento` e `Dependente` não contam para o bloqueio** (gerados pelo próprio sistema/família,
não são prova legal) mas são apagados junto, numa transação, se a exclusão prosseguir —
`evento.deleteMany` + `dependente.deleteMany` + `funcionario.delete`, nessa ordem, na mesma
`$transaction`.

## §5 Importação de funcionários

Fluxo em duas etapas (`actions/importar-funcionarios.ts`): `gerarPrevia()` só lê e mostra o
que vai acontecer, não grava nada; `importar()` relê o arquivo do zero (a planilha **não fica
em disco nem em sessão** entre as duas chamadas — decisão explícita de segurança: reler custa
menos que arriscar um arquivo esquecido no disco com o CPF do quadro inteiro).

- Parser (`lib/planilha/funcionarios.ts`) reconhece coluna por **apelido normalizado**, não
  por posição fixa (diferente do parser do Painel de Locação) — procura a linha de cabeçalho
  nas primeiras 10 linhas (aceita título/logo acima). Aceita data em formato Excel nativo ou
  texto BR/ISO. Valida CPF e detecta duplicata **dentro da própria planilha**.
- Quem já existe por CPF é **sempre pulado, nunca sobrescrito** — mesmo que a planilha traga
  dado diferente (protege telefone/foto/endereço já atualizados manualmente contra um reimport
  desatualizado).
- Cargos e obras citados que não existem são criados automaticamente **antes** do laço de
  pessoas — evita criar a mesma obra duas vezes na mesma leva.
- Limite de 8 MB no arquivo.
- Linha sem data de admissão entra com a data de hoje (não rejeita a pessoa inteira por isso).
- Matrícula: usa a da planilha se vier preenchida, senão gera sequencial (mesma regra do §3).

## §6 Entrega de EPI — integração com o Almoxarifado

**O RH nunca cria `EntregaEpi` por conta própria.** Quem dá baixa no estoque é o Almoxarifado
(`apps/estoque`), que chama `POST /api/integracao/entregas-epi` no RH quando um EPI sai para
alguém — evita duas fontes de verdade (o mesmo capacete registrado duas vezes, ou saindo do
estoque sem nunca virar ficha). A tela `/epis` do RH é **só leitura + link externo** para
`${NEXT_PUBLIC_URL_ESTOQUE}/movimentacoes` — não existe formulário de entrega local.

**Autenticação de máquina** (`lib/integracao.ts`, mesmo padrão em todos os módulos, cada um
com sua própria lista de emissores válidos — a do RH é `['estoque', 'rh', 'painel-locacao',
'alojamentos', 'portal', 'programacao']`, **sem** `whatsapp`): JWT HS256, `{origem, tipo:
'integracao'}`, validade 60s, mesmo `AUTH_SECRET` do SSO. `verificarTokenIntegracao` rejeita
qualquer token sem `tipo === 'integracao'` — um cookie de sessão de usuário comum não serve
como credencial de máquina.

`POST /api/integracao/entregas-epi`:
- 401 sem token válido.
- 400 corpo inválido (Zod).
- 422 se `funcionarioId` não existe no RH.
- **Idempotente por `movimentacaoId`** (id da movimentação no Almoxarifado, `@unique` no RH):
  reenvio do mesmo `movimentacaoId` devolve 200 com `duplicada: true` em vez de duplicar a
  ficha — protege contra reenvio em timeout/retry do lado do Almoxarifado.
- 201 ao criar.

**CA vencido continua sendo contado mesmo depois da entrega feita** (`queries/epis.ts`,
`indicadoresEpi`) — é o equipamento que está vencido, não a entrega em si; a ficha já emitida
não muda esse indicador.

`GET /api/integracao/funcionarios` (consumida pelo Almoxarifado e pelos Alojamentos): lista
quem não está `DESLIGADO`, devolvendo **só** nome, matrícula, cargo, código de obra,
setor+ramo, nível de obra, foto — **propositalmente sem CPF, salário, endereço, telefone**
(minimização de dado pessoal entre módulos).

`GET /api/integracao/resumo` (consumida pelo Portal para o dashboard central): indicadores já
formatados (rótulo+valor+tom), mesma autenticação de máquina.

## §7 Relatórios

`GET /api/relatorios/funcionarios` — Excel (exceljs) com todos os campos, ou modelo vazio via
`?modelo=1` (mesma função gera os dois, garantindo que as colunas nunca divirjam entre
relatório real e modelo de importação). Checa sessão manualmente (401 texto puro).

`GET /api/relatorios/resumo-pdf` — PDF de página única (pdfkit) com KPIs de efetivo (ativos/
afastados/férias) e SST (treinamentos/exames vencendo em 30 dias, NCs abertas/vencidas, total
de auditorias). Mesma checagem manual de sessão.

Em Go, reaproveitar `internal/infrastructure/planilha` e `internal/infrastructure/relatorio`
(já existem para o Painel de Locação) em vez de recriar geração de Excel/PDF do zero.

## §8 Consultas / dashboard

`/` (dashboard): KPIs (ativos, afastados, férias, admissões-desligamentos do mês, cadastros
incompletos, obras ativas, desligados, total), gráfico de admissões por mês, efetivo por obra,
últimas 8 movimentações da timeline geral (todos os funcionários, não só um).

Indicador "sem EPI" (`epis/page.tsx`) ordena com cargo de risco no topo (único uso real de
`Cargo.risco`, ver §3).

## §9 Padrão de interação de UI

Sem drawer/modal, mesma decisão dos módulos anteriores: navegação servidor-renderizada de
verdade. Funcionário/Treinamento/Auditoria têm página de detalhe própria
(`/rh/funcionarios/{id}` etc.); ações pontuais (registrar evento, adicionar dependente) via
formulário próprio na página de detalhe, não modal.

O formulário de funcionário é o maior do sistema: 6 abas, ~30 campos — provável candidato a
página própria em vez de um único template gigante no Go.

## §10 Seed

Seguir as contagens já fixadas em `apps/rh/e2e/apoio.ts` (`ESPERADO`), para o seed do Go poder
reaproveitar os mesmos números caso a suíte de referência (§ próxima etapa) se apoie neles: 5
obras, 10 cargos, 14 funcionários (11 ativos, 1 férias, 1 afastado, 1 desligado; 1 sem obra e 1
sem cargo). Cobrir pelo menos: um treinamento vencido e um vencendo em breve, um exame vencido
e um vencendo, um documento de cada categoria de vencimento, uma auditoria com item reprovado
gerando NC, e uma `EntregaEpi` de exemplo (simulando o que o Almoxarifado teria enviado).
