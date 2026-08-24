'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const JUEGO_POR_DEFECTO = 'yo-nunca';
const TOKEN_MIN = 12;

/**
 * Valida el token recibido por entorno antes de fiarse de él.
 *
 * El caso peligroso no es que falte, sino que llegue SIN INTERPOLAR: hay
 * interfaces (la de CasaOS, entre otras) que no leen el fichero .env, y
 * entonces la variable vale literalmente "${ADMIN_TOKEN:-}". Como esa
 * cadena no está vacía, un simple `if (!token)` daría el panel por
 * configurado y lo dejaría abierto con una contraseña que está publicada
 * en el repositorio. También se descartan los placeholders del ejemplo y
 * cualquier cosa demasiado corta.
 */
function tokenDeEntorno() {
  const bruto = (process.env.ADMIN_TOKEN || '').trim();
  if (!bruto) return { token: '', motivo: 'no está definido' };
  if (bruto.includes('${') || bruto.includes('$(')) {
    return { token: '', motivo: `llegó sin interpolar ("${bruto}") — la interfaz que lanza el stack no está leyendo el .env; escribe el valor literal` };
  }
  // Valores de ejemplo o publicados que nunca deben valer como contraseña,
  // incluido el default inseguro que traía la versión anterior de la API.
  if (/^(cambia|changeme|tu-token|token|password|admin|secret|dev-token|pon-aqui|ponaqui)/i.test(bruto)) {
    return { token: '', motivo: 'es un valor de ejemplo o conocido, cámbialo' };
  }
  if (bruto.length < TOKEN_MIN) {
    return { token: '', motivo: `es demasiado corto (${bruto.length} caracteres, mínimo ${TOKEN_MIN})` };
  }
  return { token: bruto, motivo: null };
}

const { token: ADMIN_TOKEN, motivo: MOTIVO_SIN_TOKEN } = tokenDeEntorno();

// nginx va por delante; sin esto req.ip sería la IP del contenedor nginx
// y el rate limit saldría global en vez de por visitante.
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));

store.sembrarSiFalta();

// ── Fisher-Yates shuffle ─────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Resuelve el juego pedido; cae a Yo Nunca si falta o no existe, lo que
 *  mantiene vivo el healthcheck y los frontends con el JS aún cacheado. */
function resolverJuego(q) {
  return (typeof q === 'string' && store.existe(q)) ? q : JUEGO_POR_DEFECTO;
}

// ═══════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════

// GET /frases?juego=yo-nunca&categorias=suave,fiesta
app.get('/frases', (req, res) => {
  const juego = resolverJuego(req.query.juego);
  const doc = store.leer(juego);
  if (!doc) return res.status(503).json({ error: 'Contenido no disponible.' });

  const validas = new Set(doc.categorias.map(c => c.id));
  const pedidas = (req.query.categorias || '').split(',').map(c => c.trim().toLowerCase());
  const cats = pedidas.filter(c => validas.has(c));

  if (cats.length === 0) {
    return res.status(400).json({
      error: `Indica al menos una categoría válida para "${juego}": ${[...validas].join(', ')}.`,
    });
  }

  const frases = doc.frases
    .filter(f => cats.includes(f.categoria))
    .map((f, i) => ({ id: i, texto: f.texto, categoria: f.categoria }));

  res.json(shuffle(frases));
});

// GET /config?juego=yo-nunca — categorías para pintar los toggles
app.get('/config', (req, res) => {
  const juego = resolverJuego(req.query.juego);
  const doc = store.leer(juego);
  if (!doc) return res.status(503).json({ error: 'Contenido no disponible.' });
  res.json({ juego, categorias: doc.categorias });
});

// ═══════════════════════════════════════════════════════════════════
// RUTAS DE ADMINISTRACIÓN
// ═══════════════════════════════════════════════════════════════════

// Limita los intentos de token: antes las rutas admin admitían fuerza
// bruta ilimitada.
const adminLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un minuto.' },
});

/** Comparación en tiempo constante, tolerante a longitudes distintas. */
function tokenValido(recibido) {
  const a = Buffer.from(recibido);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  // Fail closed: sin token configurado el panel queda cerrado, en vez de
  // caer a un valor por defecto conocido como hacía la versión anterior.
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: `Administración deshabilitada: ADMIN_TOKEN ${MOTIVO_SIN_TOKEN}.` });
  }
  const auth = req.headers['authorization'] || '';
  const recibido = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!recibido || !tokenValido(recibido)) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

app.use('/admin', adminLimit, requireAdmin);

// GET /admin/juegos — juegos editables
app.get('/admin/juegos', (req, res) => {
  res.json(store.listar());
});

// GET /admin/juego/:id — documento completo
app.get('/admin/juego/:id', (req, res) => {
  const doc = store.leer(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Juego no encontrado.' });
  res.json(doc);
});

// PUT /admin/juego/:id — validar y guardar
app.put('/admin/juego/:id', (req, res) => {
  if (!store.existe(req.params.id)) {
    return res.status(404).json({ error: 'Juego no encontrado.' });
  }
  try {
    const guardado = store.guardar(req.params.id, req.body);
    res.json({
      ok: true,
      categorias: guardado.categorias.length,
      frases: guardado.frases.length,
    });
  } catch (err) {
    if (err instanceof store.ErrorValidacion) {
      return res.status(400).json({ error: 'El contenido no es válido.', problemas: err.problemas });
    }
    console.error('Error al guardar:', err);
    res.status(500).json({ error: 'No se ha podido guardar.' });
  }
});

// ── Arranque ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en :${PORT}`);
  console.log(`Datos en: ${store.DATA_DIR} (${store.listar().join(', ') || 'vacío'})`);
  console.log(ADMIN_TOKEN
    ? 'ADMIN_TOKEN: ✅ configurado'
    : `ADMIN_TOKEN: ⚠️  ${MOTIVO_SIN_TOKEN} — /admin deshabilitado (503)`);
});
