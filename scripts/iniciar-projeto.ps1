# Sobe o projeto inteiro para demonstracao local: o binario unico em Go (Portal + Painel de
# Locacao + Almoxarifado + RH, porta 3010) e os apps Next.js que ainda nao migraram (Frota,
# Painel de Locacao antigo, RH antigo, Estoque antigo, Portal antigo, Alojamentos,
# Programacao). So inicia o que ainda nao estiver rodando - seguro rodar de novo com tudo ja
# de pe, ou so com parte.
#
# Chamado pelo atalho "Abrir Projeto CSC.bat" na Area de Trabalho.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$segredoAuth = 'bk/f+v0L7piz5YNU1j0k7AFVLfWeQ5m/ca02em7LpdjiuJQmegE9mKSZ8fwJOnia'

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

Write-Host "== CSC Painel - subindo o projeto completo ==" -ForegroundColor Cyan

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

# -- Apps Next.js - so o que ainda nao migrou para o binario Go -----------------------------
$apps = @(
    @{ nome = 'Portal';            pasta = 'portal';          porta = 3004; comando = 'npm run dev' },
    @{ nome = 'Frota';             pasta = 'frota';            porta = 3000; comando = 'npm run dev -- -p 3000' },
    @{ nome = 'Painel de Locacao'; pasta = 'painel-locacao';   porta = 3001; comando = 'npm run dev -- -p 3001' },
    @{ nome = 'RH e SST';          pasta = 'rh';                porta = 3002; comando = 'npm run dev' },
    @{ nome = 'Almoxarifado';      pasta = 'estoque';           porta = 3003; comando = 'npm run dev' },
    @{ nome = 'Alojamentos';       pasta = 'alojamentos';      porta = 3005; comando = 'npm run dev' },
    @{ nome = 'Programacao';       pasta = 'programacao';      porta = 3007; comando = 'npm run dev' }
)

foreach ($app in $apps) {
    if (Test-PortaOcupada $app.porta) {
        Write-Host ("[{0} {1}] ja esta no ar." -f $app.nome, $app.porta) -ForegroundColor DarkGray
        continue
    }
    $pasta = "$raiz\apps\$($app.pasta)"
    if (-not (Test-Path $pasta)) {
        Write-Host ("[{0}] pasta nao encontrada: {1}" -f $app.nome, $pasta) -ForegroundColor Red
        continue
    }
    Write-Host ("[{0} {1}] iniciando..." -f $app.nome, $app.porta) -ForegroundColor Yellow
    Start-Process powershell -WindowStyle Minimized -ArgumentList @(
        '-NoExit', '-Command', "cd '$pasta'; $($app.comando)"
    )
}

# -- Espera o essencial responder e abre o navegador -----------------------------------------
Write-Host "Aguardando Portal (3004) e binario Go (3010) responderem..." -ForegroundColor Cyan
$portalOk = Wait-Porta 3004 60
$goOk = Wait-Porta 3010 60

if ($goOk) { Start-Process "http://localhost:3010" }
if ($portalOk) { Start-Process "http://localhost:3004" }

if (-not $portalOk) { Write-Host "Portal (3004) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }
if (-not $goOk) { Write-Host "Binario Go (3010) nao respondeu a tempo - confira a janela dele." -ForegroundColor Red }

Write-Host "== Pronto. Cada app abriu numa janela do PowerShell minimizada - feche a janela para parar aquele app. ==" -ForegroundColor Cyan
