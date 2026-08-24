'use strict';

/* ================================================================
   STORE — contenido en ficheros JSON, uno por juego.

   Sustituye a la antigua BD SQLite. Los ficheros viven en DATA_DIR,
   que en producción es un bind mount a una carpeta del servidor: así
   el contenido queda fuera de la imagen y sobrevive a los despliegues.
   ================================================================ */

const fs = require('fs');
const path = require('path');
const porDefecto = require('./datos-por-defecto');

const DATA_DIR = process.env.DATA_DIR || '/data';

const SLUG = /^[a-z0-9-]+$/;
const TEXTO_MIN = 5;
const TEXTO_MAX = 200;

function ruta(juego, ext = '.json') {
  return path.join(DATA_DIR, `${juego}${ext}`);
}

/** Error de validación: lleva la lista de problemas para mostrarla tal cual. */
class ErrorValidacion extends Error {
  constructor(problemas) {
    super(problemas.join(' '));
    this.name = 'ErrorValidacion';
    this.problemas = problemas;
  }
}

// ── Validación ───────────────────────────────────────────────────
/**
 * Comprueba la forma del documento y devuelve una copia normalizada.
 * Lanza ErrorValidacion con TODOS los problemas encontrados, no solo
 * el primero: en un editor de JSON crudo es más útil verlos de golpe.
 */
function validar(doc) {
  const p = [];

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new ErrorValidacion(['El documento debe ser un objeto JSON.']);
  }
  if (!Array.isArray(doc.categorias)) p.push('Falta el array "categorias".');
  if (!Array.isArray(doc.frases))     p.push('Falta el array "frases".');
  if (p.length) throw new ErrorValidacion(p);

  // ── Categorías ──
  const ids = new Set();
  doc.categorias.forEach((c, i) => {
    const dónde = `Categoría #${i + 1}`;
    if (c === null || typeof c !== 'object' || Array.isArray(c)) {
      p.push(`${dónde}: debe ser un objeto.`);
      return;
    }
    if (typeof c.id !== 'string' || !SLUG.test(c.id)) {
      p.push(`${dónde}: "id" debe ser minúsculas, números o guiones (recibido: ${JSON.stringify(c.id)}).`);
    } else if (ids.has(c.id)) {
      p.push(`${dónde}: el id "${c.id}" está repetido.`);
    } else {
      ids.add(c.id);
    }
    for (const campo of ['name', 'emoji', 'desc']) {
      if (typeof c[campo] !== 'string' || !c[campo].trim()) {
        p.push(`${dónde} ("${c.id}"): falta "${campo}".`);
      }
    }
  });

  if (doc.categorias.length === 0) p.push('Debe haber al menos una categoría.');

  // ── Frases ──
  const huérfanas = new Map(); // categoria inexistente -> [textos]
  doc.frases.forEach((f, i) => {
    const dónde = `Frase #${i + 1}`;
    if (f === null || typeof f !== 'object' || Array.isArray(f)) {
      p.push(`${dónde}: debe ser un objeto.`);
      return;
    }
    if (typeof f.texto !== 'string') {
      p.push(`${dónde}: falta "texto".`);
    } else {
      const t = f.texto.trim();
      if (t.length < TEXTO_MIN || t.length > TEXTO_MAX) {
        p.push(`${dónde}: "texto" debe tener entre ${TEXTO_MIN} y ${TEXTO_MAX} caracteres (tiene ${t.length}).`);
      }
    }
    if (typeof f.categoria !== 'string') {
      p.push(`${dónde}: falta "categoria".`);
    } else if (!ids.has(f.categoria)) {
      // Se acumulan para dar UN mensaje por categoría borrada en vez de
      // uno por frase: es el caso típico al eliminar una categoría.
      if (!huérfanas.has(f.categoria)) huérfanas.set(f.categoria, []);
      huérfanas.get(f.categoria).push(f.texto);
    }
  });

  for (const [cat, textos] of huérfanas) {
    const muestra = textos.slice(0, 3).map(t => `«${t}»`).join(', ');
    const resto = textos.length > 3 ? ` (y ${textos.length - 3} más)` : '';
    p.push(
      `${textos.length} frase${textos.length === 1 ? '' : 's'} apunta${textos.length === 1 ? '' : 'n'} ` +
      `a la categoría "${cat}", que no existe: ${muestra}${resto}. ` +
      `Bórralas o cámbiales la categoría.`
    );
  }

  if (p.length) throw new ErrorValidacion(p);

  return {
    categorias: doc.categorias.map(c => ({
      id: c.id, name: c.name.trim(), emoji: c.emoji.trim(), desc: c.desc.trim(),
    })),
    frases: doc.frases.map(f => ({ texto: f.texto.trim(), categoria: f.categoria })),
  };
}

// ── Lectura ──────────────────────────────────────────────────────
function listar() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -'.json'.length))
    .sort();
}

function existe(juego) {
  return SLUG.test(juego) && fs.existsSync(ruta(juego));
}

/** Para el diagnóstico de /health: ¿se puede escribir en DATA_DIR? */
function esEscribible() {
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Lee el documento de un juego. Sin caché a propósito: los ficheros son
 * de unos pocos KB y así una edición hecha a mano por SSH surte efecto
 * de inmediato, sin nada que invalidar.
 */
function leer(juego) {
  if (!SLUG.test(juego)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta(juego), 'utf8'));
  } catch (_) {
    return null;
  }
}

// ── Escritura ────────────────────────────────────────────────────
/**
 * Valida y guarda. La escritura es atómica (fichero temporal + rename)
 * para que un corte a mitad no deje un JSON truncado: un fichero
 * corrupto dejaría el juego entero sin frases.
 */
function guardar(juego, doc) {
  if (!SLUG.test(juego)) throw new ErrorValidacion(['Identificador de juego no válido.']);

  const limpio = validar(doc);
  const destino = ruta(juego);
  const tmp = ruta(juego, '.json.tmp');

  // Copia de seguridad de la versión anterior antes de pisarla
  if (fs.existsSync(destino)) {
    fs.copyFileSync(destino, ruta(juego, '.bak'));
  }

  fs.writeFileSync(tmp, JSON.stringify(limpio, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, destino);

  return limpio;
}

// ── Sembrado ─────────────────────────────────────────────────────
/**
 * Crea los ficheros que aún no existan a partir de datos-por-defecto.
 * NUNCA sobrescribe uno existente — es lo que garantiza que desplegar
 * una versión nueva no borre las frases añadidas desde el panel.
 */
function sembrarSiFalta() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  for (const [juego, doc] of Object.entries(porDefecto)) {
    if (fs.existsSync(ruta(juego))) continue;
    const limpio = validar(doc);
    fs.writeFileSync(ruta(juego), JSON.stringify(limpio, null, 2) + '\n', 'utf8');
    console.log(`Sembrado "${juego}": ${limpio.categorias.length} categorías, ${limpio.frases.length} frases.`);
  }
}

module.exports = { DATA_DIR, ErrorValidacion, listar, existe, esEscribible, leer, guardar, validar, sembrarSiFalta };
