# Taller: invocar programas desde un bot de Telegram

Un bot de Telegram (Node.js + Telegraf) que ejecuta un `.exe` y un script de
Python, envia archivos y atiende botones (callback queries).

## Arranque rapido

1. En Telegram habla con @BotFather, crea un bot con `/newbot` y copia el token.
2. Copia `.env.example` como `.env` y pega el token en `BOT_TOKEN=`.
3. `npm install` y luego `npm start` (o doble clic en `iniciar.bat`).
4. Abre tu bot en Telegram y envia `/start`.

Requisitos: Node.js 18 o mayor, Python 3 y Windows para `calculadora.exe`
(si falta, ejecuta `compilar-exe.bat`).

## Comandos

| Comando | Que hace |
|---|---|
| `/sumar 2 3`, `/multiplicar 4 2.5` | Operan con `python/calculadora.py` |
| `/exe sumar 7 5` | Invoca `bin/calculadora.exe` |
| `/calcular 7 5` | Muestra botones: operacion y motor (Python o .exe) |
| `/pdf`, `/imagen` | Envian los archivos de `datos/paraEnviar/` |
| `/id` | Muestra tu id de Telegram |

Tambien puedes enviarle un documento o una foto (maximo 10 MB).

## Reglas para invocar programas de forma segura

- `execFile(programa, [args])`: programa y argumentos separados, nunca una cadena.
- Lista blanca de operaciones y validacion de los numeros antes de ejecutar.
- `timeout` y `maxBuffer` en cada proceso.
- Un boton tambien es entrada del usuario: se valida igual que un comando.
- `USUARIOS_PERMITIDOS` en `.env` limita quien puede usar el bot.
- El token vive en `.env` (que no se comparte) y no se imprime en los logs.
- Un archivo recibido se guarda, nunca se ejecuta.

## Estructura

- `index.js`: Telegraf, middleware, comandos, botones y archivos.
- `lib/procesos.js`: validacion y llamadas a procesos.
- `lib/archivos.js`: descarga y seguridad de archivos.
- `bin/`, `python/`: programas de ejemplo.
