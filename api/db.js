const Database = require('better-sqlite3');
const path = require('path');
const seed = require('./frases-seed');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'frases.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS frases (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    texto     TEXT    NOT NULL,
    categoria TEXT    NOT NULL CHECK(categoria IN ('suave','fiesta','picante')),
    estado    TEXT    NOT NULL DEFAULT 'aprobada' CHECK(estado IN ('aprobada','pendiente','rechazada')),
    creada    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Sembrar frases iniciales solo si la tabla está vacía
const count = db.prepare('SELECT COUNT(*) AS n FROM frases').get().n;
if (count === 0) {
  const insert = db.prepare(
    `INSERT INTO frases (texto, categoria, estado) VALUES (@texto, @categoria, 'aprobada')`
  );
  const insertMany = db.transaction(frases => frases.forEach(f => insert.run(f)));
  insertMany(seed);
  console.log(`BD sembrada con ${seed.length} frases.`);
}

module.exports = db;
