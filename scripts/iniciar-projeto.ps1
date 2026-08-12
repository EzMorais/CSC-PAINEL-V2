# Sobe o projeto inteiro para demonstracao local por uma unica entrada publica (porta 3010).
# O binario Go atende Portal, Painel de Locacao, Almoxarifado, RH, Compras, Alojamentos,
# Financeiro; ele encaminha /frota, /cadastros, /programacao e /whatsapp aos quatro processos
# que ainda nao migraram. As portas internas existem apenas entre os processos locais.
#
# Chamado pelo atalho "Abrir Projeto CSC.bat" na Area de Trabalho.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$segredoAuth = if ($env:AUTH_SECRET -and $env:AUTH_SECRET.Length -ge 32) { $env:AUTH_SECRET } else { 'bk/f+v0L7piz5YNU1j0k7AFVLfWeQ5m/ca02em7LpdjiuJQmegE9mKSZ8fwJOnia' }
# NEXT_PUBLIC_URL_* vao dentro do JS que o navegador baixa - se o acesso for de outro
# computador (ex.: via Tailscale), precisam apontar pro host da rede, nao "localhost",
# senao os links entre modulos abrem o localhost de quem esta clicando. Defina
# $env:CSC_HOST (ex.: "meu-pc.tailXXXXX.ts.net") antes de rodar o atalho para isso.
$hostPublico = if ($env:CSC_HOST) { $env:CSC_HOST } else { 'localhost' }
$urlPublica = "http://${hostPublico}:3010"
# Frota e Programação continuam em Next.js atrás do gateway. As portas internas não são
# públicas: quem usa o ERP sempre entra por $urlPublica/frota ou $urlPublica/programacao.
$portaFrotaInterna = 3008
$portaProgramacaoInterna = 3007

function Test-PortaOcupada($porta) {
    $null -ne (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

function Test-ServicoHTTP([string]$url) {
    $resposta = $null
    try {
        $requisicao = [System.Net.HttpWebRequest][System.Net.WebRequest]::Create($url)
        $requisicao.Method = 'GET'
        $requisicao.AllowAutoRedirect = $false
        # O primeiro acesso a uma rota do `next dev` compila a página; 3s classificava um
        # módulo saudável como conflito de porta durante essa compilação inicial.
        $requisicao.Timeout = 15000
        $requisicao.ReadWriteTimeout = 15000
        $resposta = $requisicao.GetResponse()
        $codigo = [int]$resposta.StatusCode
        return $codigo -ge 200 -and $codigo -lt 400
    } catch [System.Net.WebException] {
        $resposta = $_.Exception.Response
        if ($null -eq $resposta) { return $false }
        $codigo = [int]$resposta.StatusCode
        return $codigo -ge 200 -and $codigo -lt 400
    } catch {
        return $false
    } finally {
        if ($null -ne $resposta) { $resposta.Close() }
    }
}

function Esperar-Servicos($servicos, $timeoutSegundos) {
    $limite = (Get-Date).AddSeconds($timeoutSegundos)
    do {
        $pendentes = @($servicos | Where-Object { -not (Test-ServicoHTTP $_.url) })
        if ($pendentes.Count -eq 0) {
            return @{ Pronto = $true; Pendentes = @() }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $limite)

    return @{ Pronto = $false; Pendentes = $pendentes }
}

function Preparar-BancosPreview {
    $script = Join-Path $raiz 'scripts\preparar-bancos-preview.mjs'
    if (-not (Test-Path -LiteralPath $script)) { throw "Script de banco ausente: $script" }
    Push-Location $raiz
    try {
        & node $script
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar os bancos SQLite de preview.' }
    } finally {
        Pop-Location
    }
}

function Iniciar-AppNode($app) {
    $pasta = Join-Path $raiz "apps\$($app.pasta)"
    if (-not (Test-Path -LiteralPath $pasta)) {
        Write-Host ("[{0}] pasta nao encontrada: {1}" -f $app.nome,$pasta) -ForegroundColor Red
        return
    }
    if (-not (Test-Path -LiteralPath (Join-Path $pasta 'node_modules'))) {
        Write-Host ("[{0}] instalando dependencias..." -f $app.nome) -ForegroundColor Yellow
        Push-Location $pasta
        try {
            & npm.cmd ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "npm ci falhou para $($app.nome)" }
        } finally {
            Pop-Location
        }
    }

    # A Programação precisa começar com o mesmo cadastro complementar do repositório de
    # referência. Os dois comandos são idempotentes e deixam o preview local utilizável
    # mesmo quando o banco acabou de ser criado pelo preparador de migrations.
    if ($app.pasta -eq 'programacao') {
        Push-Location $pasta
        try {
            $env:AUTH_SECRET = $segredoAuth
            $env:DATABASE_URL = $app.banco
            & npm.cmd run --if-present db:seed
            if ($LASTEXITCODE -ne 0) { throw 'Falha ao semear as frentes e funções da Programação.' }
            & npm.cmd run --if-present db:import-cadastro
            if ($LASTEXITCODE -ne 0) { throw 'Falha ao importar o cadastro da Programação.' }
        } finally {
            Pop-Location
        }
    }

    $atribuicoes = @(
        "[Environment]::SetEnvironmentVariable('AUTH_SECRET','$segredoAuth','Process')",
        "[Environment]::SetEnvironmentVariable('DATABASE_URL','$($app.banco)','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PORTAL','$urlPublica','Process')",
        "[Environment]::SetEnvironmentVariable('URL_PORTAL','$urlPublica','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PROGRAMACAO','$urlPublica/programacao','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_CADASTROS','$urlPublica/cadastros','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PAINEL','$urlPublica/painel','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_RH','$urlPublica/rh','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_ESTOQUE','$urlPublica/almoxarifado','Process')",
		"[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_ALOJAMENTOS','$urlPublica/alojamentos','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_FROTA','$urlPublica/frota','Process')"
    )
    if ($app.extraEnv) {
        foreach ($item in $app.extraEnv.GetEnumerator()) {
            $atribuicoes += "[Environment]::SetEnvironmentVariable('$($item.Key)','$($item.Value)','Process')"
        }
    }
    $comandoFilho = ($atribuicoes -join '; ') + "; Set-Location -LiteralPath '$pasta'; $($app.comando)"
    Start-Process powershell -WindowStyle Hidden -ArgumentList @('-NoProfile','-Command',$comandoFilho)
    Write-Host ("[{0} {1}] iniciado." -f $app.nome,$app.porta) -ForegroundColor Yellow
}

# -- Login automatico do administrador --------------------------------------------------------
# A sessao e um so cookie (`locacao_sessao`) compartilhado por todos os apps - Next.js e o
# binario Go leem o mesmo cookie, assinado com o mesmo AUTH_SECRET (ver README "Login unico").
# Guarda so o necessario pra logar sozinho: e-mail em texto puro (nao e segredo) e a senha
# criptografada com DPAPI (ConvertFrom-SecureString sem -Key) - so o Windows deste usuario,
# neste computador, consegue decifrar. Nunca fica em texto puro em disco.
$pastaCredenciais = Join-Path $env:APPDATA 'CSCPainelV2'
$arquivoCredenciais = Join-Path $pastaCredenciais 'admin.cred'

function Obter-CredencialAdmin {
    if (Test-Path $arquivoCredenciais) {
        $linhas = Get-Content $arquivoCredenciais
        try {
            return @{ Email = $linhas[0]; SenhaSegura = ($linhas[1] | ConvertTo-SecureString) }
        } catch {
            Write-Host "Credencial salva nao pode ser lida neste Windows/usuario - vou pedir de novo." -ForegroundColor Yellow
        }
    }
    Write-Host ""
    Write-Host "Login automatico do administrador - informe uma vez; fica salvo so neste Windows." -ForegroundColor Cyan
    Write-Host "(senha criptografada pela conta do Windows; pra trocar depois, apague $arquivoCredenciais)" -ForegroundColor DarkGray
    $email = Read-Host "E-mail do administrador"
    $senhaSegura = Read-Host "Senha" -AsSecureString
    New-Item -ItemType Directory -Force -Path $pastaCredenciais | Out-Null
    Set-Content -Path $arquivoCredenciais -Value $email
    Add-Content -Path $arquivoCredenciais -Value ($senhaSegura | ConvertFrom-SecureString)
    return @{ Email = $email; SenhaSegura = $senhaSegura }
}

# Abre o navegador ja autenticado: gera uma paginazinha local com um formulario que se
# auto-envia (POST de verdade, nao fetch/AJAX - por isso nao esbarra em CORS/CSRF) pro
# /entrar do binario Go. O cookie de sessao que volta vale pra qualquer porta do localhost
# (cookie nao tem porta no escopo), entao autentica Go e todos os apps Next.js de uma vez.
function Abrir-Autenticado($urlEntrar) {
    $cred = Obter-CredencialAdmin
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.SenhaSegura)
    $senhaPlana = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    Add-Type -AssemblyName System.Web
    $arquivoTemp = Join-Path $env:TEMP ("csc-login-" + [guid]::NewGuid().ToString('N') + '.html')
    @"
<!doctype html><html><body>
<form id="f" method="POST" action="$urlEntrar">
<input type="hidden" name="email" value="$([System.Web.HttpUtility]::HtmlEncode($cred.Email))">
<input type="hidden" name="senha" value="$([System.Web.HttpUtility]::HtmlEncode($senhaPlana))">
<input type="hidden" name="destino" value="/">
</form>
<script>document.getElementById('f').submit()</script>
</body></html>
"@ | Set-Content -Path $arquivoTemp -Encoding UTF8
    $senhaPlana = $null

    Start-Process $arquivoTemp
    # Apaga o arquivo temporario (que teve a senha em texto puro por instantes) assim que o
    # navegador teve tempo de sobra pra ler e enviar o formulario.
    Start-Job -ScriptBlock {
        param($caminho)
        Start-Sleep -Seconds 8
        Remove-Item -Path $caminho -Force -ErrorAction SilentlyContinue
    } -ArgumentList $arquivoTemp | Out-Null
}

Write-Host "== CSC Painel - subindo o projeto completo ==" -ForegroundColor Cyan

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host "Go nao encontrado no PATH." -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

# -- Binario unico em Go (migracao-go) - porta 3010 -----------------------------------------
$servicoGo = @{ nome = 'Nucleo ERP Go'; porta = 3010; url = 'http://localhost:3010/healthz' }
if (Test-ServicoHTTP $servicoGo.url) {
    Write-Host "[Go 3010] ja esta respondendo." -ForegroundColor DarkGray
} elseif (Test-PortaOcupada $servicoGo.porta) {
    Write-Host "[Go 3010] porta ocupada, mas /healthz nao responde. Pare o processo conflitante e rode novamente." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[Go 3010] compilando e iniciando..." -ForegroundColor Yellow
    Push-Location "$raiz\migracao-go"
    # O binário não cria usuários de acesso sozinho. O seed é idempotente e garante que um
    # checkout novo consiga autenticar antes de abrir os módulos Next.js e a Programação.
    $env:DATABASE_PATH = 'servidor.db'
    $env:AUTH_SECRET = $segredoAuth
    & go run .\cmd\seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Go 3010] falha ao preparar o banco/seed - veja o erro acima." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    & go build -o servidor.exe .\cmd\servidor
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Go 3010] falha ao compilar - veja o erro acima." -ForegroundColor Red
        Pop-Location
        exit 1
    } else {
        Start-Process powershell -WindowStyle Hidden -ArgumentList @(
            '-NoProfile', '-Command',
            "cd '$raiz\migracao-go'; `$env:DATABASE_PATH='servidor.db'; `$env:AUTH_SECRET='$segredoAuth'; `$env:PORTA='3010'; `$env:URL_RH='$urlPublica/rh'; `$env:URL_ESTOQUE='$urlPublica/almoxarifado'; `$env:URL_ALOJAMENTOS='$urlPublica/alojamentos'; `$env:URL_FROTA='$urlPublica/frota'; `$env:URL_PORTAL='$urlPublica/cadastros'; `$env:FROTA_UPSTREAM='http://localhost:$portaFrotaInterna'; `$env:CADASTROS_UPSTREAM='http://localhost:3004'; `$env:PROGRAMACAO_UPSTREAM='http://localhost:$portaProgramacaoInterna'; `$env:WHATSAPP_UPSTREAM='http://localhost:3006'; .\servidor.exe"
        )
    }
    Pop-Location
}

# -- Apps Next.js - cada banco e cada porta ficam isolados ----------------------------------
$bancoPreview = {
    param($pasta)
    "file:$raiz/apps/$pasta/prisma/preview.db".Replace('\','/')
}

$apps = @(
    @{ nome = 'Cadastros (Portal legado)'; pasta = 'portal';   porta = 3004; url = 'http://localhost:3004/cadastros'; banco = (&$bancoPreview 'portal'); comando = 'npm run dev'; extraEnv = @{ NEXT_PUBLIC_URL_APP = $urlPublica } },
    @{ nome = 'Frota';                     pasta = 'frota';    porta = $portaFrotaInterna; url = "http://localhost:$portaFrotaInterna/frota/veiculos"; banco = 'file:./frota-preview.db'; comando = "npm run dev -- -p $portaFrotaInterna"; extraEnv = @{ PORT = "$portaFrotaInterna"; NEXT_PUBLIC_BASE_PATH = '/frota'; NEXT_PUBLIC_URL_APP = "$urlPublica/frota" } },
    @{ nome = 'Programação (legado)';      pasta = 'programacao'; porta = $portaProgramacaoInterna; url = "http://localhost:$portaProgramacaoInterna/programacao/dia/2026-08-13"; banco = (&$bancoPreview 'programacao'); comando = 'npm run dev'; extraEnv = @{ NEXT_PUBLIC_BASE_PATH = '/programacao'; NEXT_PUBLIC_URL_APP = "$urlPublica/programacao"; URL_RH = $urlPublica; URL_FROTA = "$urlPublica/frota" } },
    @{ nome = 'WhatsApp';                  pasta = 'whatsapp'; porta = 3006; url = 'http://localhost:3006/saude';     banco = ''; comando = 'npm run dev'; extraEnv = @{ PORTA_WHATSAPP = '3006'; URL_ALOJAMENTOS = "$urlPublica/alojamentos" } }
)

# Cria/atualiza _prisma_migrations e aplica os SQL versionados antes de subir as telas.
$frotaDependencias = Join-Path $raiz 'apps\frota\node_modules'
if (-not (Test-Path -LiteralPath $frotaDependencias)) {
    Write-Host '[Frota] instalando a dependencia SQLite usada pelo preparador de bancos...' -ForegroundColor Yellow
    Push-Location (Join-Path $raiz 'apps\frota')
    try {
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm ci falhou para a Frota.' }
    } finally {
        Pop-Location
    }
}
Preparar-BancosPreview

$conflitosPorta = @()
foreach ($app in $apps) {
    if (Test-ServicoHTTP $app.url) {
        Write-Host ("[{0} {1}] ja esta respondendo." -f $app.nome, $app.porta) -ForegroundColor DarkGray
        continue
    }
    if (Test-PortaOcupada $app.porta) {
        $conflitosPorta += $app
        Write-Host ("[{0} {1}] porta ocupada, mas {2} nao responde." -f $app.nome, $app.porta, $app.url) -ForegroundColor Red
        continue
    }
    Iniciar-AppNode $app
}

# -- Espera todos os modulos responderem antes de declarar sucesso ---------------------------
if ($conflitosPorta.Count -gt 0) {
    $nomesConflitantes = $conflitosPorta | ForEach-Object { "$($_.nome) ($($_.porta))" }
    Write-Host ("Inicio interrompido por portas conflitantes: {0}." -f ($nomesConflitantes -join ', ')) -ForegroundColor Red
    exit 1
}

$todosServicos = @($servicoGo) + $apps
Write-Host "Aguardando todos os modulos responderem..." -ForegroundColor Cyan
$verificacao = Esperar-Servicos $todosServicos 90
if (-not $verificacao.Pronto) {
    $nomesPendentes = $verificacao.Pendentes | ForEach-Object { "$($_.nome) ($($_.porta))" }
    Write-Host ("Falha ao iniciar: {0}. O projeto nao esta pronto para teste." -f ($nomesPendentes -join ', ')) -ForegroundColor Red
    exit 1
}

if ($env:ABRIR_NAVEGADOR -eq '1') { Start-Process "http://localhost:3010" }

Write-Host "== Pronto. Entrada unica: $urlPublica ==" -ForegroundColor Cyan
Write-Host "   Ramificacoes: /painel /almoxarifado /rh /alojamentos /compras /financeiro /programacao /frota /cadastros /whatsapp/saude" -ForegroundColor DarkGray
