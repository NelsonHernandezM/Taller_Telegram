'use strict';
 
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');

const proc = require('./lib/procesos');
const { descargar } = require('./lib/archivos');

// --- 1. Configuracion -------------------------------------------------------

// Lee .env sin dependencias externas: una linea KEY=VALOR por variable.
function cargarEnv() {
  const ruta = path.join(__dirname, '.env');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
cargarEnv();

const TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(TOKEN || 'sin-token');

if (!TOKEN) {
  console.error('[AVISO] Falta BOT_TOKEN: copia .env.example a .env y pega el token.');
}

bot.use((ctx, next) => {
  // No registrar ctx completo ni el texto: pueden incluir datos privados y el token.
  const mensaje = ctx.message;
  const tipo = mensaje?.text ? 'texto'
    : mensaje?.photo ? 'foto'
    : mensaje?.document ? 'documento'
    : ctx.updateType;
  console.log(`[update] ${ctx.updateType}: ${tipo}`);
  return next();
});


// --- 2. Utilidades del bot --------------------------------------------------

const AYUDA =
  'Comandos del taller:\n\n' +
  '/sumar 2 3            suma usando Python\n' +
  '/multiplicar 4 2.5    multiplica usando Python\n' +
  '/exe sumar 7 5        invoca calculadora.exe directamente\n' +
  '/pdf                  envia el PDF de ejemplo\n' +
  '/imagen               envia la imagen de ejemplo\n\n' +
  'Tambien puedes enviarme un documento o una foto.';

/** Responde sin romper el bot si algo falla. */
async function responder(ctx, texto) {
  try {
    await ctx.reply(texto, { disable_web_page_preview: true });
  } catch (e) {
    console.error('No se pudo responder:', e.message);
  }
}

/** Extrae dos numeros del texto; devuelve null si no son validos. */
function leerDosNumeros(texto) {
  const partes = String(texto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length !== 2) return null;
  const nums = partes.map(Number);
  return nums.every(Number.isFinite) ? nums : null;
}

/** Formatea un error de proceso para el usuario. */
function textoError(e) {
  if (e.code === 'ENOENT') {
    return 'No se encontró el programa. Revisa que "python" esté en el PATH ' +
           'y que bin/calculadora.exe exista (ejecuta compilar-exe.bat).';
  }
  if (e.killed || e.signal) {
    return 'El proceso tardó demasiado y se canceló.';
  }
  return 'Error al ejecutar: ' + (e.detalle || e.message);
}

/**
 * Envia un documento a Telegram con reintentos usando axios.
 * Esto evita el error "socket hang up" nativo de Telegraf en Node moderno.
 */
async function enviarDocumentoResistente(ctx, buffer, nombreArchivo, caption = '') {
  const url = `https://api.telegram.org/bot${TOKEN}/sendDocument`;

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const form = new FormData();
      form.append('chat_id', String(ctx.chat.id));
      if (caption) {
        form.append('caption', caption);
      }
      
      form.append('document', buffer, {
        filename: nombreArchivo,
        contentType: nombreArchivo.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      });

      await axios.post(url, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000, 
      });

      return true; 
    } catch (err) {
      const detalle = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`[AVISO] Error al enviar el archivo (intento ${intento}/3): ${detalle}`);
      if (intento < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await responder(ctx, '⚠️ No se pudo enviar el archivo después de varios intentos.');
  return false;
}

/**
 * Envia una imagen a Telegram usando axios para evitar cortes de red.
 */
async function enviarFotoResistente(ctx, buffer, nombreArchivo, caption = '') {
  const url = `https://api.telegram.org/bot${TOKEN}/sendPhoto`;

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const form = new FormData();
      form.append('chat_id', String(ctx.chat.id));
      if (caption) {
        form.append('caption', caption);
      }
      
      form.append('photo', buffer, {
        filename: nombreArchivo,
        contentType: 'image/jpeg', 
      });

      await axios.post(url, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000, 
      });

      return true; 
    } catch (err) {
      const detalle = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`[AVISO] Error al enviar la imagen (intento ${intento}/3): ${detalle}`);
      if (intento < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await responder(ctx, '⚠️ No se pudo enviar la imagen después de varios intentos.');
  return false;
}

// --- 3. Comandos basicos ----------------------------------------------------

bot.start((ctx) => responder(ctx, 'Hola 👋 Soy el bot.\n\n' + AYUDA));
bot.help((ctx) => responder(ctx, AYUDA));

// /sumar y /multiplicar usan el script de Python.
for (const operacion of ['sumar', 'multiplicar']) {
  bot.command(operacion, async (ctx) => {
    const nums = leerDosNumeros(ctx.payload);
    if (!nums) {
      return responder(ctx, 'Uso: /' + operacion + ' <numero> <numero>\nEjemplo: /' + operacion + ' 2 3');
    }
    try {
      const { stdout } = await proc.ejecutarPython(operacion, nums[0], nums[1]);
      await responder(ctx, '🐍 ' + stdout);
    } catch (e) {
      await responder(ctx, textoError(e));
    }
  });
}

// /exe invoca el binario de consola directamente.
bot.command('exe', async (ctx) => {
  const partes = String(ctx.payload || '').trim().split(/\s+/).filter(Boolean);
  const operacion = (partes.shift() || '').toLowerCase();

  if (!proc.OPERACIONES.includes(operacion)) {
    return responder(ctx, 'Uso: /exe <sumar|multiplicar> <numero> <numero>\nEjemplo: /exe sumar 7 5');
  }

  const nums = leerDosNumeros(partes.join(' '));
  if (!nums) {
    return responder(ctx, 'Faltan los dos numeros. Ejemplo: /exe sumar 7 5');
  }

  try {
    const { stdout } = await proc.ejecutarExe(operacion, nums[0], nums[1]);
      await responder(ctx, '⚙️ calculadora.exe respondió:\n' + stdout);
  } catch (e) {
    await responder(ctx, textoError(e));
  }
});


// --- Enviar archivos locales ---

bot.command('pdf', async (ctx) => {
  const rutaPdf = path.join(__dirname, 'datos', 'paraEnviar', 'ejemplo.pdf');
  
  if (!fs.existsSync(rutaPdf)) {
    return responder(ctx, '⚠️ El PDF no se encuentra en el servidor. Revisa la carpeta datos/paraEnviar/');
  }

  try {
    const archivoBuffer = fs.readFileSync(rutaPdf);
    
    await enviarDocumentoResistente(
      ctx,
      archivoBuffer,
      'ejemplo.pdf',
      '📄 Aquí tienes el PDF que solicitaste.'
    );
  } catch (e) {
    await responder(ctx, 'Error al enviar el PDF: ' + e.message);
  }
});

bot.command('imagen', async (ctx) => {
  const rutaImg = path.join(__dirname, 'datos', 'paraEnviar', 'ejemplo.jpg');
  
  if (!fs.existsSync(rutaImg)) {
    return responder(ctx, '⚠️ La imagen no se encuentra en el servidor. Revisa la carpeta datos/paraEnviar/');
  }

  try {
    const archivoBuffer = fs.readFileSync(rutaImg);

    await enviarFotoResistente(
      ctx,
      archivoBuffer,
      'ejemplo.jpg',
      '🖼️ Aquí tienes la imagen solicitada.'
    );
  } catch (e) {
    await responder(ctx, 'Error al enviar la imagen: ' + e.message);
  }
});

// --- 4. Documentos e imagenes ----------------------------------------------

bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  try {
      const info = await descargar(ctx, doc.file_id, doc.file_name, doc.file_size);
    await responder(
      ctx,
      '📄 Documento guardado\n' +
      'Nombre: ' + (doc.file_name || 'sin nombre') + '\n' +
      'Tipo: ' + (doc.mime_type || 'desconocido') + '\n' +
      'Tamaño: ' + info.bytes + ' bytes\n' +
      'Archivo local: ' + path.basename(info.ruta) + '\n' +
      'SHA-256: ' + info.sha256.slice(0, 20) + '...'
    );
  } catch (e) {
    await responder(ctx, 'No pude descargar el documento: ' + e.message);
  }
});

bot.on('photo', async (ctx) => {
  // Telegram manda varias resoluciones; la última es la más grande.
  const foto = ctx.message.photo[ctx.message.photo.length - 1];
  try {
    const nombre = 'foto_' + foto.width + 'x' + foto.height + '.jpg';
    const info = await descargar(ctx, foto.file_id, nombre, foto.file_size);
    await responder(
      ctx,
      '🖼️ Imagen guardada\n' +
      'Resolucion: ' + foto.width + ' x ' + foto.height + '\n' +
      'Tamano: ' + info.bytes + ' bytes\n' +
      'Archivo local: ' + path.basename(info.ruta)
    );
  } catch (e) {
    await responder(ctx, 'No pude descargar la imagen: ' + e.message);
  }
});

// --- 5. Fallback y arranque -------------------------------------------------

// Se registra al final: cualquier texto que no sea comando cae aqui.
bot.on('text', (ctx) => responder(ctx, 'No reconozco ese mensaje.\n\n' + AYUDA));

bot.catch((err, ctx) => {
  console.error('Error en', ctx.updateType, ':', err.message);
});

// Permite importar el bot desde pruebas sin arrancar el polling.
module.exports = bot;

// --- Arranque ---------------------------------------------------------------
if (require.main === module) {
  if (!TOKEN) {
    console.error('No se puede arrancar sin BOT_TOKEN.');
    process.exit(1);
  }

  bot.launch().then(() => {
    console.log('Bot del taller listo. Abre Telegram y envia /start.');
    console.log('Python:', proc.PYTHON, '| Exe:', proc.EXE);
  });

  // Apagado limpio con Ctrl+C.
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
