@echo off
chcp 65001 >nul
title Frota - Siqueira Campos
cd /d "%~dp0"

if not exist ".next\standalone\server.js" (
    echo  Sistema ainda nao instalado. Rode instalar.bat primeiro.
    pause
    exit /b 1
)

:: O banco fica em dados\ e sempre com caminho absoluto, para nao depender
:: de onde o servidor foi iniciado.
if not exist "dados" mkdir dados
if exist "frota.db" if not exist "dados\frota.db" move /Y "frota.db" "dados\frota.db" >nul

set DATABASE_URL=file:%~dp0dados\frota.db
set PASTA_ANEXOS=%~dp0.next\standalone\public\anexos
set PORT=3000
set HOSTNAME=0.0.0.0

echo.
echo  Frota rodando. Deixe esta janela aberta.
echo.
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%j in ("%%i") do echo   Acesse:  http://%%j:3000
)
echo.
echo  Para parar: feche esta janela ou aperte Ctrl+C.
echo.

node ".next\standalone\server.js"
pause
