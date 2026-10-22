// Busqueda global del alumno: sus grupos, las pruebas y las preguntas que ya respondio.
// No busca en el banco completo: permitiria ver preguntas sin gastar la cuota diaria.
// Pensada para el plan gratuito de Firestore: pocas lecturas por busqueda.
import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, get, query } from '../data/repo.js';
import { TEST_LABELS_EN } from '../data/catalog.js';
import { langOf, getTests, testLabel } from '../lib/lang.js';

const r = Router();
r.use(authRequired);

const MIN_CHARS = 2;
const MAX_LIMIT = 10;
const MAX_QUESTION_READS = 20; // tope de lecturas por busqueda en preguntas
const RATE_MAX = 30;           // busquedas por usuario por ventana
const RATE_WINDOW_MS = 60_000;

// Sin tildes ni mayusculas: "Algebra" encuentra "álgebra".
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const has = (text, needle) => norm(text).includes(needle);

// Limite por usuario. En serverless cada instancia lleva su propia cuenta, asi
// que frena rafagas pero no es un limite estricto (ver docs/seguridad-pendiente.md).
const hits = new Map();
function rateLimited(userId, now = Date.now()) {
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  return recent.length > RATE_MAX;
}

// Una prueba coincide con su nombre en espanol o en ingles, sin importar el idioma activo:
// quien navega en ingles puede escribir "maths" o "matematica".
const testMatches = (t, q) => has(t.label, q) || has(TEST_LABELS_EN[t.id], q);

const SEARCHERS = {
  async groups(user, q, limit, lang) {
    const mine = await query(COL.groupMembers, [['userId', '==', user.id]]);
    const groups = (await Promise.all(mine.map((m) => get(COL.groups, m.groupId)))).filter(Boolean);
    const byId = new Map((await getTests()).map((t) => [t.id, t]));
    return groups
      .filter((g) => {
        const t = byId.get(g.subjectTestId);
        return has(g.name, q) || has(g.subject, q) || (t && testMatches(t, q));
      })
      .slice(0, limit)
      .map((g) => {
        const t = byId.get(g.subjectTestId);
        return { id: g.id, name: g.name, subject: t ? testLabel(t, lang) : g.subject };
      });
  },

  async topics(_user, q, limit, lang) {
    return (await getTests())
      .filter((t) => testMatches(t, q))
      .slice(0, limit)
      .map((t) => ({ testId: t.id, label: testLabel(t, lang) }));
  },

  async questions(user, q, limit) { // enunciados: el banco solo existe en espanol
    const answers = (await query(COL.answers, [['userId', '==', user.id]]))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const ids = [...new Set(answers.map((a) => a.questionId))].slice(0, MAX_QUESTION_READS);
    const found = (await Promise.all(ids.map((id) => get(COL.questions, id)))).filter(Boolean);
    return found
      .filter((x) => has(x.statement, q) || has(x.habilidad, q))
      .slice(0, limit)
      // Nunca se devuelve la respuesta correcta ni las alternativas.
      .map((x) => ({ id: x.id, testId: x.testId, statement: String(x.statement).slice(0, 140) }));
  },
};

// GET /search?q=algebra&types=groups,topics,questions&limit=5
r.get('/search', wrap(async (req, res) => {
  const q = norm(req.query.q);
  if (q.length < MIN_CHARS) {
    return fail(res, 400, 'VALIDATION_ERROR', `q debe tener al menos ${MIN_CHARS} caracteres`, { field: 'q' });
  }
  if (rateLimited(req.user.id)) {
    return fail(res, 429, 'RATE_LIMITED', 'Demasiadas busquedas; espera un momento');
  }
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, MAX_LIMIT));
  const wanted = String(req.query.types || Object.keys(SEARCHERS).join(','))
    .split(',').map((t) => t.trim()).filter((t) => Object.hasOwn(SEARCHERS, t));
  if (!wanted.length) {
    return fail(res, 400, 'VALIDATION_ERROR', `types debe incluir: ${Object.keys(SEARCHERS).join(', ')}`, { field: 'types' });
  }
  const lang = langOf(req);
  const out = {};
  await Promise.all(wanted.map(async (t) => { out[t] = await SEARCHERS[t](req.user, q, limit, lang); }));
  return ok(res, out, 200, { q: String(req.query.q).trim() });
}));

export default r;
