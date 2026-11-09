@echo off
REM =====================================================================
REM  Arranca el bot del taller.
REM   - Instala dependencias si falta node_modules
REM   - Compila el .exe de ejemplo si falta
REM   - Lanza node index.js
REM =====================================================================
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
)

if not exist "bin\calculadora.exe" (
  echo Compilando el ejecutable de ejemplo...
  call compilar-exe.bat nopausa
)

if not exist ".env" (
  echo.
  echo [AVISO] No existe .env
  echo Copia .env.example a .env y pega el token de @BotFather.
  echo.
)

node index.js
goto :eof

:error
echo.
echo [ERROR] No se pudieron instalar las dependencias.
pause
