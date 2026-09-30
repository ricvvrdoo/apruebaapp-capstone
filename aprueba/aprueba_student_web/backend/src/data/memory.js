// Driver de datos en memoria con persistencia en disco (./.data/db.json).
// Permite ejecutar el backend sin Firebase. Cada coleccion es un objeto { id: doc }.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let store = {};

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[memory] no se pudo leer db.json:', e.message);
    store = {};
  }
}
function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.warn('[memory] no se pudo escribir db.json:', e.message);
  }
}
load();

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const colObj = (name) => (store[name] ||= {});

// Emula los operadores de Firestore que usa repo.query. Igual que Firestore, un
// documento sin el campo no cumple ningun filtro.
function matches(value, op, expected) {
  if (value === undefined) return false;
  switch (op) {
    case '==': return value === expected;
    case 'in': return expected.includes(value);
    case '>=': return value >= expected;
    case '<': return value < expected;
    default: throw new Error(`[memory] operador no soportado: ${op}`);
  }
}

export const memoryDriver = {
  async list(name) {
    return Object.values(colObj(name)).map(clone);
  },
  async query(name, filters, { orderBy, limit } = {}) {
    let rows = Object.values(colObj(name)).filter((d) => filters.every(([f, op, v]) => matches(d[f], op, v)));
    if (orderBy) {
      const [field, dir = 'asc'] = orderBy;
      const sign = dir === 'desc' ? -1 : 1;
      rows = rows.filter((d) => d[field] !== undefined)
        .sort((a, b) => (a[field] < b[field] ? -sign : a[field] > b[field] ? sign : 0));
    }
    if (limit) rows = rows.slice(0, limit);
    return rows.map(clone);
  },
  async get(name, id) {
    const d = colObj(name)[id];
    return d ? clone(d) : null;
  },
  async set(name, id, data) {
    colObj(name)[id] = { ...clone(data), id };
    persist();
    return clone(colObj(name)[id]);
  },
  async patch(name, id, partial) {
    const cur = colObj(name)[id];
    if (!cur) return null;
    colObj(name)[id] = { ...cur, ...clone(partial), id };
    persist();
    return clone(colObj(name)[id]);
  },
  async del(name, id) {
    delete colObj(name)[id];
    persist();
  },
  async bulkSet(name, docs) {
    for (const doc of docs) colObj(name)[doc.id] = clone(doc);
    persist();
    return docs.length;
  },
  async reset(seedData) {
    store = clone(seedData);
    persist();
  },
};
