@echo off
chcp 65001 >nul
title Frota - Instalacao
cd /d "%~dp0"

echo.
echo  ============================================================
echo   INSTALACAO DO SISTEMA DE FROTA - SIQUEIRA CAMPOS
echo  ============================================================
echo.

:: --- 1. a pasta precisa estar extraida, nao pode rodar de dentro do zip ---
echo "%~dp0" | findstr /i "\\Temp\\" >nul
if not errorlevel 1 (
    echo  ERRO: voce esta rodando de dentro do arquivo compactado.
    echo.
    echo  O Windows abre o ZIP numa pasta temporaria e apaga depois,
    echo  entao a instalacao nao se mantem.
    echo.
    echo  Extraia o ZIP primeiro ^(botao direito ^> Extrair Tudo^),
    echo  por exemplo para C:\frota, e rode o instalar.bat de la.
    echo.
    pause
    exit /b 1
)

:: --- 2. Node.js presente e com versao suficiente ---
where node >nul 2>nul
if errorlevel 1 (
    echo  ERRO: Node.js nao encontrado.
    echo.
    echo  Instale a versao LTS em https://nodejs.org
    echo  Marque "Add to PATH" durante a instalacao.
    echo  Depois rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
for /f "tokens=1 delims=v." %%a in ("%NODEVER%") do set NODEMAJOR=%%a

if %NODEMAJOR% LSS 22 (
    echo  ERRO: Node.js %NODEVER% e antigo demais.
    echo.
    echo  O sistema usa o modulo sqlite embutido, que existe a partir
    echo  do Node 22.5. Instale o Node 24 LTS em https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node.js encontrado: %NODEVER%
echo.

node -e "require('node:sqlite')" 2>nul
if errorlevel 1 (
    echo  ERRO: este Node nao tem o modulo node:sqlite.
    echo  Instale o Node 24 LTS em https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo  Criando arquivo de configuracao...
    powershell -NoProfile -Command ^
      "$b=[byte[]]::new(48); [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s=[Convert]::ToBase64String($b); (Get-Content '.env.example' -Raw) -replace 'troque-este-segredo-em-producao-com-uma-string-longa-aleatoria', $s | Set-Content '.env' -NoNewline -Encoding UTF8"
    echo  Arquivo .env criado com uma chave de sessao unica.
    echo.
)

echo  Instalando dependencias... isso leva alguns minutos.
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo  Instalando ferramentas de build...
call npm install --no-audit --no-fund
if errorlevel 1 goto erro

echo.
echo  Compilando o sistema...
call npm run build
if errorlevel 1 goto erro

echo.
echo  Preparando o banco de dados...
call npm run seed
if errorlevel 1 goto erro

echo.
echo  ============================================================
echo   INSTALACAO CONCLUIDA
echo  ============================================================
echo.
echo   Para iniciar agora:            iniciar.bat
echo   Para subir junto com Windows:  instalar-servico.bat
echo.
echo   Acesso pela rede/VPN:  http://SEU-IP:3000
echo   Login: admin@siqueiracampos.com.br
echo   Senha: frota2026   ^(troque depois do primeiro acesso^)
echo.
pause
exit /b 0

:erro
echo.
echo  A instalacao falhou. Veja a mensagem acima.
echo.
pause
exit /b 1
