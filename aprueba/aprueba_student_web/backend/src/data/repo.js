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

// add con id autogenerado opcional
export async function add(col, data, idPrefix = 'doc') {
  const id = data.id || genId(idPrefix);
  return set(col, id, { ...data, id });
}

// where: lista filtrada por predicado en memoria (suficiente para este dominio)
export async function where(col, predicate) {
  const all = await list(col);
  return all.filter(predicate);
}

export async function findOne(col, predicate) {
  const all = await list(col);
  return all.find(predicate) || null;
}
