@echo off
REM =====================================================================
REM  Arranca el bot del taller.
REM =====================================================================
setlocal
cd /d "%~dp0"

title Bot de Telegram - Taller

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install --no-audit --no-fund
    if errorlevel 1 goto :error
)

 

if not exist ".env" (
    echo.
    echo [AVISO] No existe .env
    echo Copia .env.example a .env y configura el token.
    echo.
)

echo.
echo ==========================================
echo Iniciando bot de Telegram...
echo ==========================================
echo.

node index.js

echo.
echo ==========================================
echo El bot ha terminado su ejecucion.
echo Codigo de salida: %errorlevel%
echo ==========================================
pause
goto :eof

:error
echo.
echo [ERROR] No se pudieron instalar las dependencias.
pause
