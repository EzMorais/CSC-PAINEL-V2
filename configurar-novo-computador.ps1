# Prepara um Windows novo do zero para rodar o CSC-PAINEL: programas, extensoes do VS Code
# e os tres apps (Painel de Locacao, RH, Frota) instalados e com banco pronto.
#
# So texto sem acento neste arquivo, de proposito: Windows PowerShell 5.1 sem um BOM no
# arquivo le como ANSI da maquina, e um acento vira lixo que quebra o script no meio.
#
# Seguro rodar mais de uma vez: cada etapa confere se ja foi feita antes de tentar de novo.

$ErrorActionPreference = 'Stop'

function Write-Titulo($texto) {
  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host " $texto" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor Cyan
}

function Test-Comando($nome) {
  return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

# Depois de um winget install, o PATH novo so existe no Registro -- esta janela nao sabe
# dele ate reabrir. Isto rele o PATH do Registro e atualiza a sessao atual, para nao
# precisar fechar e abrir o script de novo a cada programa instalado.
function Atualizar-Path {
  $maquina = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $usuario = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$maquina;$usuario"
}

function Instalar-Winget($id, $nomeAmigavel, $comandoParaConferir) {
  if (Test-Comando $comandoParaConferir) {
    Write-Host "  OK   $nomeAmigavel ja esta instalado." -ForegroundColor Green
    return
  }
  Write-Host "  ...  Instalando $nomeAmigavel (pode levar alguns minutos)" -ForegroundColor Yellow
  winget install --id $id -e --accept-source-agreements --accept-package-agreements --silent
  Atualizar-Path
  if (Test-Comando $comandoParaConferir) {
    Write-Host "  OK   $nomeAmigavel instalado." -ForegroundColor Green
  } else {
    Write-Host "  !!   $nomeAmigavel foi instalado, mas ainda nao aparece nesta janela." -ForegroundColor Yellow
    Write-Host "       Feche esta janela, abra 'configurar-novo-computador.bat' de novo e rode de novo -- e seguro repetir." -ForegroundColor Yellow
  }
}

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

Write-Titulo "1/6 - Conferindo o Windows Package Manager (winget)"
if (-not (Test-Comando 'winget')) {
  Write-Host "  winget nao foi encontrado. Em um Windows 10/11 atualizado ele ja vem instalado." -ForegroundColor Red
  Write-Host "  Abra a Microsoft Store, procure por 'App Installer', instale, e rode este arquivo de novo." -ForegroundColor Red
  Read-Host "Aperte Enter para fechar"
  exit 1
}
Write-Host "  OK   winget encontrado." -ForegroundColor Green

Write-Titulo "2/6 - Instalando os programas necessarios"
Instalar-Winget 'OpenJS.NodeJS.LTS' 'Node.js (LTS)' 'node'
Instalar-Winget 'Git.Git' 'Git' 'git'
Instalar-Winget 'Microsoft.VisualStudioCode' 'Visual Studio Code' 'code'
Instalar-Winget 'GitHub.cli' 'GitHub CLI' 'gh'
Atualizar-Path

Write-Titulo "3/6 - Instalando o Claude Code (assistente de linha de comando)"
if (Test-Comando 'claude') {
  Write-Host "  OK   Claude Code ja esta instalado." -ForegroundColor Green
} elseif (Test-Comando 'npm') {
  npm install -g '@anthropic-ai/claude-code'
  Atualizar-Path
  if (Test-Comando 'claude') {
    Write-Host "  OK   Claude Code instalado." -ForegroundColor Green
  } else {
    Write-Host "  !!   Instalei, mas 'claude' ainda nao aparece nesta janela. Reabra o script depois." -ForegroundColor Yellow
  }
} else {
  Write-Host "  !!   'npm' nao esta disponivel ainda -- pulando esta etapa. Rode o script de novo depois do Node instalar." -ForegroundColor Yellow
}

Write-Titulo "4/6 - Instalando as extensoes do VS Code para este projeto"
if (Test-Comando 'code') {
  $arquivoExtensoes = Join-Path $raiz '.vscode\extensions.json'
  if (Test-Path $arquivoExtensoes) {
    $extensoes = (Get-Content $arquivoExtensoes -Raw | ConvertFrom-Json).recommendations
    foreach ($ext in $extensoes) {
      Write-Host "  ...  $ext"
      code --install-extension $ext --force | Out-Null
    }
    Write-Host "  OK   Extensoes instaladas." -ForegroundColor Green
  } else {
    Write-Host "  !!   Nao achei .vscode\extensions.json -- pulando." -ForegroundColor Yellow
  }
} else {
  Write-Host "  !!   'code' nao esta disponivel nesta janela ainda." -ForegroundColor Yellow
  Write-Host "       Feche esta janela, abra 'configurar-novo-computador.bat' de novo para completar esta etapa." -ForegroundColor Yellow
}

# Mesmo segredo nos dois: quem loga no Painel de Locacao ja entra logado no RH tambem
# (cookie de sessao nao separa por porta -- ver README.md).
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$script:AuthSecret = [Convert]::ToBase64String($bytes)

function Preparar-App($pasta, $porta, $gerarPlanilhaExemplo) {
  $caminho = Join-Path $raiz "apps\$pasta"
  if (-not (Test-Path $caminho)) {
    Write-Host "  !!   Pasta apps\$pasta nao encontrada, pulando." -ForegroundColor Yellow
    return
  }
  if (-not (Test-Comando 'npm')) {
    Write-Host "  !!   'npm' nao disponivel nesta janela -- pulando $pasta. Rode o script de novo depois." -ForegroundColor Yellow
    return
  }

  Push-Location $caminho
  try {
    Write-Host "  [$pasta] Instalando dependencias (pode levar alguns minutos)..." -ForegroundColor Cyan
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install terminou com erro (codigo $LASTEXITCODE)" }

    if (-not (Test-Path '.env')) {
      Write-Host "  [$pasta] Criando .env..." -ForegroundColor Cyan
      $conteudo = "DATABASE_URL=`"file:./dev.db`"`nAUTH_SECRET=`"$script:AuthSecret`"`n"
      [System.IO.File]::WriteAllText((Join-Path $caminho '.env'), $conteudo, (New-Object System.Text.UTF8Encoding($false)))
    } else {
      Write-Host "  [$pasta] .env ja existe -- nao mexi nele." -ForegroundColor Gray
    }

    # Passo obrigatorio, nao opcional: o npm 11 bloqueia scripts de instalacao de pacote
    # por padrao, entao o postinstall do Prisma -- que normalmente geraria o cliente
    # sozinho -- nao roda. Sem isto, um computador novo instala tudo "com sucesso" e so
    # quebra depois, no primeiro comando que toca o banco, com a mensagem
    # "@prisma/client did not initialize yet".
    Write-Host "  [$pasta] Gerando o cliente do banco de dados..." -ForegroundColor Cyan
    npx prisma generate
    if ($LASTEXITCODE -ne 0) { throw "prisma generate terminou com erro (codigo $LASTEXITCODE)" }

    Write-Host "  [$pasta] Aplicando o banco de dados..." -ForegroundColor Cyan
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy terminou com erro (codigo $LASTEXITCODE)" }

    Write-Host "  [$pasta] Cadastrando dados de exemplo..." -ForegroundColor Cyan
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { throw "db:seed terminou com erro (codigo $LASTEXITCODE)" }

    if ($gerarPlanilhaExemplo) {
      Write-Host "  [$pasta] Gerando planilha de teste..." -ForegroundColor Cyan
      npm run gerar:exemplo
    }

    Write-Host "  OK   [$pasta] pronto -- depois rode 'npm run dev' nesta pasta (http://localhost:$porta)." -ForegroundColor Green
  } catch {
    Write-Host "  !!   [$pasta] alguma coisa falhou: $_" -ForegroundColor Red
    Write-Host "       Veja a mensagem acima. Os passos manuais estao no README.md / COMECE-AQUI.md." -ForegroundColor Red
  } finally {
    Pop-Location
  }
}

Write-Titulo "5/6 - Preparando o Painel de Locacao, o RH e o Almoxarifado"
Preparar-App 'painel-locacao' 3000 $true
Preparar-App 'rh' 3002 $false
# O Almoxarifado conversa com o RH pela API de integracao, e os dois so se reconhecem se o
# AUTH_SECRET for o mesmo -- que e o que este script garante, usando um valor unico para
# todos os modulos.
Preparar-App 'estoque' 3003 $false

Write-Titulo "6/6 - Frota"
$instaladorFrota = Join-Path $raiz 'apps\frota\instalar.bat'
if (Test-Path $instaladorFrota) {
  Write-Host "  A Frota tem instalador proprio -- abrindo ele agora." -ForegroundColor Cyan
  & $instaladorFrota
} else {
  Write-Host "  !!   apps\frota\instalar.bat nao encontrado, pulando." -ForegroundColor Yellow
}

Write-Titulo "Tudo pronto"
if (Test-Comando 'code') {
  Write-Host "Abrindo o projeto no VS Code..." -ForegroundColor Cyan
  code $raiz
}

Write-Host ""
Write-Host "Para USAR cada sistema, abra um terminal na pasta dele e rode 'npm run dev':" -ForegroundColor White
Write-Host "  apps\painel-locacao  -> http://localhost:3000" -ForegroundColor White
Write-Host "  apps\rh              -> http://localhost:3002" -ForegroundColor White
Write-Host "  apps\estoque         -> http://localhost:3003" -ForegroundColor White
Write-Host "  apps\frota           -> de duplo clique em iniciar.bat dentro da pasta" -ForegroundColor White
Write-Host ""
Write-Host "Entrega de EPI: o Almoxarifado precisa do RH LIGADO para buscar a lista de" -ForegroundColor White
Write-Host "funcionarios e mandar a ficha. Se o RH estiver desligado na hora, a saida do" -ForegroundColor White
Write-Host "material acontece do mesmo jeito e a ficha fica marcada como pendente, para" -ForegroundColor White
Write-Host "reenviar depois na tela de Movimentacoes." -ForegroundColor White
Write-Host ""
Write-Host "Login do Painel, do RH e do Almoxarifado: admin@siqueiracampos.com.br / locacao2026" -ForegroundColor White
Write-Host "Login da Frota:                           admin@siqueiracampos.com.br / frota2026" -ForegroundColor White
Write-Host ""
Write-Host "Mais detalhes e solucao de problemas: README.md e COMECE-AQUI.md na pasta do projeto." -ForegroundColor White
Write-Host ""
Read-Host "Aperte Enter para fechar"
