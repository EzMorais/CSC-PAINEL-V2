# Sobe o projeto inteiro para demonstracao local: o binario unico em Go (Portal + Painel de
# Locacao + Almoxarifado + RH + Compras + Alojamentos, porta 3010) e todos os apps Next.js
# complementares/legados em portas proprias. Cada app Prisma usa seu proprio SQLite de
# preview; compartilhar portal.db entre Go e Next quebra por incompatibilidade de schema.
# So inicia o que ainda nao estiver rodando - seguro rodar de novo com tudo ja de pe.
#
# Chamado pelo atalho "Abrir Projeto CSC.bat" na Area de Trabalho.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$segredoAuth = if ($env:AUTH_SECRET -and $env:AUTH_SECRET.Length -ge 32) { $env:AUTH_SECRET } else { 'bk/f+v0L7piz5YNU1j0k7AFVLfWeQ5m/ca02em7LpdjiuJQmegE9mKSZ8fwJOnia' }
$segredoFrota = if ($env:FROTA_AUTH_SECRET -and $env:FROTA_AUTH_SECRET.Length -ge 32) { $env:FROTA_AUTH_SECRET } else { 'frota-preview-2026-0123456789-abcdef' }

function Test-PortaOcupada($porta) {
    $null -ne (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

function Wait-Porta($porta, $timeoutSegundos) {
    $limite = (Get-Date).AddSeconds($timeoutSegundos)
    while ((Get-Date) -lt $limite) {
        if (Test-PortaOcupada $porta) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
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
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PORTAL','http://localhost:3010','Process')",
        "[Environment]::SetEnvironmentVariable('URL_PORTAL','http://localhost:3010','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PROGRAMACAO','http://localhost:3007','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_PAINEL','http://localhost:3001','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_RH','http://localhost:3002','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_ESTOQUE','http://localhost:3003','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_ALOJAMENTOS','http://localhost:3005','Process')",
        "[Environment]::SetEnvironmentVariable('NEXT_PUBLIC_URL_FROTA','http://localhost:3000','Process')"
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
if (Test-PortaOcupada 3010) {
    Write-Host "[Go 3010] ja esta no ar." -ForegroundColor DarkGray
} else {
    Write-Host "[Go 3010] compilando e iniciando..." -ForegroundColor Yellow
    Push-Location "$raiz\migracao-go"
    & go build -o servidor.exe .\cmd\servidor
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Go 3010] falha ao compilar - veja o erro acima." -ForegroundColor Red
    } else {
        Start-Process powershell -WindowStyle Minimized -ArgumentList @(
            '-NoExit', '-Command',
            "cd '$raiz\migracao-go'; `$env:DATABASE_PATH='servidor.db'; `$env:AUTH_SECRET='$segredoAuth'; `$env:PORTA='3010'; .\servidor.exe"
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
    @{ nome = 'Portal';            pasta = 'portal';          porta = 3004; banco = (&$bancoPreview 'portal');        comando = 'npm run dev'; extraEnv = @{} },
    @{ nome = 'Frota';             pasta = 'frota';            porta = 3000; banco = 'file:./frota-preview.db';       comando = 'npm run dev -- -p 3000'; extraEnv = @{ AUTH_SECRET = $segredoFrota; PORT = '3000' } },
    @{ nome = 'Painel de Locacao'; pasta = 'painel-locacao';   porta = 3001; banco = (&$bancoPreview 'painel-locacao'); comando = 'npm run dev -- -p 3001'; extraEnv = @{} },
    @{ nome = 'RH e SST';          pasta = 'rh';                porta = 3002; banco = (&$bancoPreview 'rh');           comando = 'npm run dev'; extraEnv = @{} },
    @{ nome = 'Almoxarifado';      pasta = 'estoque';           porta = 3003; banco = (&$bancoPreview 'estoque');      comando = 'npm run dev'; extraEnv = @{} },
    @{ nome = 'Alojamentos';       pasta = 'alojamentos';      porta = 3005; banco = (&$bancoPreview 'alojamentos'); comando = 'npm run dev'; extraEnv = @{} },
    @{ nome = 'Programacao';       pasta = 'programacao';      porta = 3007; banco = (&$bancoPreview 'programacao'); comando = 'npm run dev'; extraEnv = @{} },
    @{ nome = 'WhatsApp';          pasta = 'whatsapp';         porta = 3006; banco = '';                              comando = 'npm run dev'; extraEnv = @{ PORTA_WHATSAPP = '3006'; URL_ALOJAMENTOS = 'http://localhost:3005' } }
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

foreach ($app in $apps) {
    if (Test-PortaOcupada $app.porta) {
        Write-Host ("[{0} {1}] ja esta no ar." -f $app.nome, $app.porta) -ForegroundColor DarkGray
        continue
    }
    Iniciar-AppNode $app
}

# -- Espera o essencial responder e abre o hub unico ----------------------------------------
Write-Host "Aguardando Portal (3004), WhatsApp (3006), Programacao (3007) e Go (3010)..." -ForegroundColor Cyan
$portalOk = Wait-Porta 3004 60
$whatsappOk = Wait-Porta 3006 60
$programacaoOk = Wait-Porta 3007 60
$goOk = Wait-Porta 3010 60

if (-not $portalOk) { Write-Host "Portal (3004) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }
if (-not $whatsappOk) { Write-Host "WhatsApp (3006) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }
if (-not $programacaoOk) { Write-Host "Programacao (3007) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }
if (-not $goOk) { Write-Host "Binario Go (3010) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }

if ($goOk -and $env:ABRIR_NAVEGADOR -eq '1') { Start-Process "http://localhost:3010" }

Write-Host "== Pronto. Hub: http://localhost:3010 | WhatsApp: http://localhost:3006/saude ==" -ForegroundColor Cyan
