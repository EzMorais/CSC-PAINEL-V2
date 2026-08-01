@echo off
chcp 65001 >nul
title Frota - Iniciar com o Windows
cd /d "%~dp0"

net session >nul 2>nul
if errorlevel 1 (
    echo  Rode este arquivo como Administrador.
    echo  ^(botao direito ^> Executar como administrador^)
    pause
    exit /b 1
)

echo.
echo  Registrando o sistema de frota para iniciar junto com o Windows...
echo.

schtasks /Create /TN "FrotaSiqueiraCampos" /TR "\"%~dp0iniciar.bat\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
if errorlevel 1 (
    echo  Nao foi possivel registrar a tarefa.
    pause
    exit /b 1
)

echo.
echo  Pronto. O sistema sobe sozinho quando o servidor ligar.
echo.
echo   Iniciar agora:  schtasks /Run /TN "FrotaSiqueiraCampos"
echo   Remover:        schtasks /Delete /TN "FrotaSiqueiraCampos" /F
echo.
pause
