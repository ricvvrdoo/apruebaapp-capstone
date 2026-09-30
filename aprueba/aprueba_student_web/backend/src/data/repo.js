// Repositorio unificado. Selecciona el driver segun DATA_DRIVER y expone
// una API simple que usan las rutas. Las subcolecciones del modelo Firestore
// se representan como colecciones raiz con un campo de referencia al padre
// (p. ej. answers.userId, groupMembers.groupId). Ver MODELO_CAMBIOS.md.
import { randomUUID } from 'crypto';
import { memoryDriver } from './memory.js';

const DRIVER = process.env.DATA_DRIVER || 'memory';
let driver = memoryDriver;
if (DRIVER === 'firestore') {
  const { firestoreDriver } = await import('./firestore.js');
  driver = firestoreDriver;
}

export const COL = {
  users: 'users',
  answers: 'answers',
  skillMastery: 'skillMastery',
  notifications: 'notifications',
  devices: 'devices',
  medalLedger: 'medalLedger',
  practiceSessions: 'practiceSessions',
  tests: 'tests',
  skills: 'skills',
  questions: 'questions',
  corrections: 'corrections',
  groups: 'groups',
  groupMembers: 'groupMembers',
  groupInvitations: 'groupInvitations',
  groupShared: 'groupShared',
  posts: 'posts',
  comments: 'comments',
  likes: 'likes',
  plans: 'plans',
  features: 'features',
  subscriptions: 'subscriptions',
  invoices: 'invoices',
  sponsors: 'sponsors',
  benefits: 'benefits',
  benefitRedemptions: 'benefitRedemptions',
  // Marketplace de tutores (administrado desde la consola admin; el alumno solo lee).
  tutors: 'tutors',
  tutorReviews: 'tutorReviews',
  tutorRequests: 'tutorRequests',
  conversations: 'conversations',
  messages: 'messages',
  reposts: 'reposts',
};

export const genId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

export const list = (col) => driver.list(col);
export const get = (col, id) => driver.get(col, id);
export const set = (col, id, data) => driver.set(col, id, data);
export const patch = (col, id, partial) => driver.patch(col, id, partial);
export const del = (col, id) => driver.del(col, id);
export const reset = (seedData) => driver.reset(seedData);
// Escritura masiva: cada doc debe traer `id`. En Firestore va en lotes.
export const bulkSet = (col, docs) => driver.bulkSet(col, docs);
export const driverName = DRIVER;

// add con id autogenerado opcional
export async function add(col, data, idPrefix = 'doc') {
  const id = data.id || genId(idPrefix);
  return set(col, id, { ...data, id });
}

// query: consulta con filtros nativos del driver, [campo, operador, valor] con
// operador '==' | 'in' | '>=' | '<'. En Firestore solo se leen (y cobran) los
// documentos que cumplen. `refine` aplica en memoria condiciones que Firestore no
// expresa bien (!==, campos ausentes) sobre el resultado ya acotado.
// Un filtro con valor undefined o un 'in' vacio no puede coincidir con nada:
// devuelve [] sin consultar (Firestore lanzaria error con undefined).
export async function query(col, filters, refine = null, opts = {}) {
  for (const [field, op, value] of filters) {
    if (value === undefined) return [];
    if (op === 'in') {
      if (!Array.isArray(value)) throw new Error(`query(${col}): 'in' en ${field} requiere un arreglo`);
      if (value.length === 0) return [];
      if (value.length > 30) throw new Error(`query(${col}): 'in' en ${field} admite hasta 30 valores`);
    }
  }
  const rows = await driver.query(col, filters, opts);
  return refine ? rows.filter(refine) : rows;
}

export async function queryOne(col, filters, refine = null) {
  // Con refine no se puede limitar a 1 en el driver: el primero podria no cumplirlo.
  const rows = await query(col, filters, refine, refine ? {} : { limit: 1 });
  return rows[0] || null;
}

// where/findOne: filtro por predicado en memoria sobre la coleccion COMPLETA.
// En Firestore lee (y cobra) todos los documentos: usar solo en catalogos
// pequenos y acotados (tests, plans, benefits, tutors). Para colecciones que
// crecen con el uso, usar query/queryOne.
export async function where(col, predicate) {
  const all = await list(col);
  return all.filter(predicate);
}

export async function findOne(col, predicate) {
  const all = await list(col);
  return all.find(predicate) || null;
}
