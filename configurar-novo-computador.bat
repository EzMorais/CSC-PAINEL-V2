@echo off
chcp 65001 >nul
title Configurar computador - CSC PAINEL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-novo-computador.ps1"
