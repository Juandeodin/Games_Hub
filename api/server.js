'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-token-inseguro';
const CATEGORIAS_VALIDAS = new Set(['suave', 'fiesta', 'picante']);

app.use(express.json());

// ── Rate limit para sugerencias ──────────────────────────────────────
const sugerenciasLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera un minuto.' },
});

// ── Middleware de autenticación admin ────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

// ── Fisher-Yates shuffle ─────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════

// GET /frases?categorias=suave,fiesta
app.get('/frases', (req, res) => {
  const raw = (req.query.categorias || '').split(',').map(c => c.trim().toLowerCase());
  const cats = raw.filter(c => CATEGORIAS_VALIDAS.has(c));

  if (cats.length === 0) {
    return res.status(400).json({ error: 'Indica al menos una categoría válida: suave, fiesta, picante.' });
  }

  const placeholders = cats.map(() => '?').join(',');
  const frases = db
    .prepare(`SELECT id, texto, categoria FROM frases WHERE estado='aprobada' AND categoria IN (${placeholders})`)
    .all(...cats);

  res.json(shuffle(frases));
});

// POST /sugerencias
app.post('/sugerencias', sugerenciasLimit, (req, res) => {
  const { texto, categoria } = req.body || {};

  if (typeof texto !== 'string' || texto.trim().length < 5 || texto.trim().length > 200) {
    return res.status(400).json({ error: 'La frase debe tener entre 5 y 200 caracteres.' });
  }
  if (!CATEGORIAS_VALIDAS.has(categoria)) {
    return res.status(400).json({ error: 'Categoría no válida.' });
  }

  db.prepare(`INSERT INTO frases (texto, categoria, estado) VALUES (?, ?, 'pendiente')`).run(texto.trim(), categoria);
  res.status(201).json({ ok: true, mensaje: '¡Frase recibida! Juan la revisará pronto.' });
});

// ═══════════════════════════════════════════════════════════════════
// RUTAS DE MODERACIÓN (requieren token de admin)
// ═══════════════════════════════════════════════════════════════════

// GET /admin/sugerencias
app.get('/admin/sugerencias', requireAdmin, (req, res) => {
  const pendientes = db
    .prepare(`SELECT id, texto, categoria, creada FROM frases WHERE estado='pendiente' ORDER BY creada ASC`)
    .all();
  res.json(pendientes);
});

// POST /admin/sugerencias/:id/aprobar
app.post('/admin/sugerencias/:id/aprobar', requireAdmin, (req, res) => {
  const info = db
    .prepare(`UPDATE frases SET estado='aprobada' WHERE id=? AND estado='pendiente'`)
    .run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'No encontrada o ya procesada.' });
  res.json({ ok: true });
});

// POST /admin/sugerencias/:id/rechazar
app.post('/admin/sugerencias/:id/rechazar', requireAdmin, (req, res) => {
  const info = db
    .prepare(`UPDATE frases SET estado='rechazada' WHERE id=? AND estado='pendiente'`)
    .run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'No encontrada o ya procesada.' });
  res.json({ ok: true });
});

// ── Arranque ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en :${PORT}`);
  console.log(`ADMIN_TOKEN: ${ADMIN_TOKEN === 'dev-token-inseguro' ? '⚠️  usando token por defecto (solo desarrollo)' : '✅ configurado'}`);
});
