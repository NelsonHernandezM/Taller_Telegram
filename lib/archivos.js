'use strict';

// ===========================================================================
//  Descarga de documentos e imagenes de Telegram
//  ---------------------------------------------------------------------------
//  Telegram no manda el archivo dentro del mensaje: manda un file_id.
//  El flujo es:
//      file_id  ->  getFileLink()  ->  URL temporal  ->  fetch  ->  disco
//
//  Seguridad: el nombre que llega desde fuera NUNCA se usa tal cual.
//  Lo pasamos por path.basename y limpiamos caracteres raros para evitar
//  rutas como ../../algo.exe  (path traversal).
// ===========================================================================

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const CARPETA = path.join(__dirname, '..', 'datos', 'descargas');
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Deja solo letras, numeros, punto, guion y guion bajo. */
function nombreSeguro(nombre) {
  const base = path.basename(String(nombre || 'archivo'));
  const limpio = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  return limpio || 'archivo';
}

/**
 * Descarga un archivo de Telegram a datos/descargas.
 * @returns {{ruta:string, bytes:number, sha256:string}}
 */
async function descargar(ctx, fileId, nombreSugerido, tamanoInformado) {
  if (Number.isFinite(tamanoInformado) && tamanoInformado > TAMANO_MAXIMO) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }

  // 1. URL temporal (caduca en ~1 hora, por eso se descarga al momento).
  const enlace = await ctx.telegram.getFileLink(fileId);
  const url = enlace.href || enlace.toString();

  // 2. Descarga en memoria (fetch es nativo desde Node 18).
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error('Telegram respondio HTTP ' + respuesta.status);
  }
  const tamano = Number(respuesta.headers.get('content-length'));
  if (Number.isFinite(tamano) && tamano > TAMANO_MAXIMO) {
    throw new Error('El archivo supera el límite de 10 MB.');
  }
  const partes = [];
  let bytesRecibidos = 0;
  const lector = respuesta.body.getReader();
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    bytesRecibidos += value.length;
    if (bytesRecibidos > TAMANO_MAXIMO) {
      await lector.cancel();
      throw new Error('El archivo supera el límite de 10 MB.');
    }
    partes.push(Buffer.from(value));
  }
  const contenido = Buffer.concat(partes, bytesRecibidos);

  // 3. Guardado con nombre unico.
  await fs.mkdir(CARPETA, { recursive: true });
  const destino = path.join(CARPETA, Date.now() + '-' + nombreSeguro(nombreSugerido));
  await fs.writeFile(destino, contenido);

  return {
    ruta: destino,
    bytes: contenido.length,
    sha256: crypto.createHash('sha256').update(contenido).digest('hex'),
  };
}

module.exports = { CARPETA, TAMANO_MAXIMO, nombreSeguro, descargar };
