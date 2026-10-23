// "Mis datos y privacidad": exportar todo lo que la API guarda de un alumno y eliminar su cuenta.
//
// Eliminar borra lo privado (respuestas, notificaciones, conversaciones...) y anonimiza lo que otras
// personas ven y que no pertenece solo al alumno (publicaciones, comentarios, resenas a tutores,
// lo compartido en grupos). Las boletas se conservan sin vinculo a la persona por obligacion contable.
// Cada paso es idempotente y la cuenta se borra al final: si algo falla a medias, se puede reintentar.
import { COL, get, set, patch, del, query } from '../data/repo.js';

export const DELETED_NAME = 'Usuario eliminado';
export const DELETED_INITIALS = '?';

// Campos del documento de usuario que nunca salen en el export (secretos o duplicados internos).
const USER_PRIVATE_FIELDS = ['passwordHash', 'resetToken', 'emailLower'];
// Colecciones con una fila por actividad del alumno, enlazadas por `userId`.
const OWN_ROWS = ['answers', 'skillMastery', 'notifications', 'medalLedger', 'practiceSessions', 'corrections',
  'subscriptions', 'invoices', 'benefitRedemptions', 'tutorRequests', 'tutorReviews'];

const byUser = (col, userId) => query(COL[col], [['userId', '==', userId]]);
const strip = (row, fields) => { const out = { ...row }; for (const f of fields) delete out[f]; return out; };

/** Todo lo que se guarda de [u], listo para descargar. No incluye contrasenas, tokens ni datos de otras personas. */
export async function exportUserData(u) {
  const rows = {};
  for (const name of OWN_ROWS) rows[name] = await byUser(name, u.id);

  const devices = (await byUser('devices', u.id)).map((d) => strip(d, ['pushToken']));
  const likes = (await byUser('likes', u.id)).map((l) => l.postId);
  const reposts = (await byUser('reposts', u.id)).map((r) => r.postId);
  const posts = await query(COL.posts, [['authorId', '==', u.id]]);
  const comments = await query(COL.comments, [['authorId', '==', u.id]]);

  // Grupos: solo el nombre y el rol del alumno; la lista de miembros pertenece a otras personas.
  const groups = [];
  for (const m of await byUser('groupMembers', u.id)) {
    const g = await get(COL.groups, m.groupId);
    if (g) groups.push({ id: g.id, name: g.name, subject: g.subject, role: m.role, score: m.score });
  }

  // Conversaciones con tutores, con sus mensajes (los suyos y las respuestas del tutor).
  const conversations = [];
  for (const c of await byUser('conversations', u.id)) {
    const messages = (await query(COL.messages, [['conversationId', '==', c.id]]))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    conversations.push({ ...c, messages });
  }

  return {
    format: 1,
    exportedAt: new Date().toISOString(),
    profile: strip(u, USER_PRIVATE_FIELDS),
    ...rows,
    devices, likes, reposts, posts, comments, groups, conversations,
  };
}

/** Saca a [userId] de un grupo: la propiedad pasa al miembro mas antiguo y, si no queda nadie, el grupo se elimina. */
export async function leaveGroup(g, member) {
  await del(COL.groupMembers, member.id);
  const remaining = await query(COL.groupMembers, [['groupId', '==', g.id]]);
  if (!remaining.length) {
    for (const s of await query(COL.groupShared, [['groupId', '==', g.id]])) await del(COL.groupShared, s.id);
    for (const i of await query(COL.groupInvitations, [['groupId', '==', g.id]])) await del(COL.groupInvitations, i.id);
    await del(COL.groups, g.id);
    return { deleted: true };
  }
  if (g.ownerId === member.userId) {
    const heir = remaining[0];
    await set(COL.groups, g.id, { ...g, ownerId: heir.userId });
    await set(COL.groupMembers, heir.id, { ...heir, role: 'owner' });
  }
  return { deleted: false };
}

async function dropPostReaction(col, userId) {
  for (const row of await byUser(col, userId)) {
    const p = await get(COL.posts, row.postId);
    if (p) {
      const field = col === 'likes' ? 'likes' : 'reposts';
      await patch(COL.posts, p.id, { [field]: Math.max(0, (p[field] || 0) - 1) });
    }
    await del(COL[col], row.id);
  }
}

/** Elimina la cuenta de [u] y los datos asociados (ver el encabezado del archivo). */
export async function eraseUser(u) {
  // Datos privados: se borran.
  for (const name of ['answers', 'skillMastery', 'notifications', 'devices', 'medalLedger', 'practiceSessions',
    'corrections', 'subscriptions', 'benefitRedemptions', 'tutorRequests']) {
    for (const row of await byUser(name, u.id)) await del(COL[name], row.id);
  }
  await dropPostReaction('likes', u.id);
  await dropPostReaction('reposts', u.id);
  for (const c of await byUser('conversations', u.id)) {
    for (const m of await query(COL.messages, [['conversationId', '==', c.id]])) await del(COL.messages, m.id);
    await del(COL.conversations, c.id);
  }
  for (const email of new Set([u.email, u.emailLower].filter(Boolean))) {
    for (const i of await query(COL.groupInvitations, [['email', '==', email]])) await del(COL.groupInvitations, i.id);
  }

  // Grupos: salir de todos; en los que siguen existiendo, anonimizar lo que compartio.
  const survivors = [];
  for (const m of await byUser('groupMembers', u.id)) {
    const g = await get(COL.groups, m.groupId);
    if (!g) { await del(COL.groupMembers, m.id); continue; }
    if (!(await leaveGroup(g, m)).deleted) survivors.push(g.id);
  }
  for (const groupId of survivors) {
    for (const s of await query(COL.groupShared, [['groupId', '==', groupId]])) {
      if (s.sharedById === u.id || (!s.sharedById && s.sharedBy === u.name)) {
        await patch(COL.groupShared, s.id, { sharedBy: DELETED_NAME, sharedById: null });
      }
    }
  }

  // Lo publico o ajeno: se conserva sin vinculo a la persona.
  for (const p of await query(COL.posts, [['authorId', '==', u.id]])) await patch(COL.posts, p.id, { authorId: null, authorName: DELETED_NAME });
  for (const c of await query(COL.comments, [['authorId', '==', u.id]])) await patch(COL.comments, c.id, { authorId: null, authorName: DELETED_NAME });
  for (const r of await byUser('tutorReviews', u.id)) {
    await patch(COL.tutorReviews, r.id, { userId: null, userName: DELETED_NAME, userInitials: DELETED_INITIALS });
  }
  for (const inv of await byUser('invoices', u.id)) await patch(COL.invoices, inv.id, { userId: null });

  await del(COL.users, u.id);
}
