// Driver Firestore (opcional). Modela cada coleccion como coleccion raiz.
import { initFirestore } from '../config/firebase.js';

let db = null;
async function ready() { if (!db) ({ db } = await initFirestore()); return db; }
const withId = (doc) => ({ id: doc.id, ...doc.data() });

export const firestoreDriver = {
  async list(name) { const s = await (await ready()).collection(name).get(); return s.docs.map(withId); },
  // Consulta resuelta por Firestore: solo se leen (y cobran) los documentos que cumplen.
  async query(name, filters, { orderBy, limit } = {}) {
    let q = (await ready()).collection(name);
    for (const [f, op, v] of filters) q = q.where(f, op, v);
    if (orderBy) q = q.orderBy(orderBy[0], orderBy[1] || 'asc');
    if (limit) q = q.limit(limit);
    const s = await q.get();
    return s.docs.map(withId);
  },
  async get(name, id) { const s = await (await ready()).collection(name).doc(id).get(); return s.exists ? withId(s) : null; },
  async set(name, id, data) { await (await ready()).collection(name).doc(id).set({ ...data }, { merge: false }); return this.get(name, id); },
  async patch(name, id, partial) {
    const ref = (await ready()).collection(name).doc(id);
    const s = await ref.get(); if (!s.exists) return null;
    await ref.set({ ...partial }, { merge: true }); return this.get(name, id);
  },
  async del(name, id) { await (await ready()).collection(name).doc(id).delete(); },
  async reset(seedData) {
    const d = await ready();
    for (const [col, docs] of Object.entries(seedData)) {
      for (const [id, doc] of Object.entries(docs)) {
        await d.collection(col).doc(id).set(doc);
      }
    }
  },
};
