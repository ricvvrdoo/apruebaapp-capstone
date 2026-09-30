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
  // Escritura masiva en lotes (Firestore admite hasta 500 operaciones por lote).
  // Cada documento se reemplaza completo, como set().
  async bulkSet(name, docs) {
    const d = await ready();
    for (let i = 0; i < docs.length; i += 400) {
      const batch = d.batch();
      for (const doc of docs.slice(i, i + 400)) batch.set(d.collection(name).doc(doc.id), { ...doc });
      await batch.commit();
    }
    return docs.length;
  },
  // No borra colecciones: sobrescribe los documentos del seed y deja el resto.
  async reset(seedData) {
    for (const [col, docs] of Object.entries(seedData)) {
      await this.bulkSet(col, Object.entries(docs).map(([id, doc]) => ({ ...doc, id })));
    }
  },
};
