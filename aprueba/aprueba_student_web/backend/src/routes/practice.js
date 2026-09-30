// 1.3 Practica: next, question, answer, explanation, skill
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { createHash } from 'crypto';
import { COL, get, set, add, create, query, list } from '../data/repo.js';
import { quotaMax, ensureQuotaDay, isUnlimited, BASE_QUOTA } from '../lib/quota.js';
import { award } from '../lib/medals.js';

const r = Router();
r.use(authRequired);
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const save = (u) => set(COL.users, u.id, u);
const publicQuestion = (q) => ({
  id: q.id, testId: q.testId, axis: q.axis, difficulty: q.difficulty,
  statement: q.statement, options: q.options,
});

// Seleccion aleatoria sin leer el banco completo. Cada pregunta trae `rand`, un
// numero aleatorio fijo asignado al importarla: se elige un punto al azar y se
// leen hasta WINDOW preguntas desde ahi (dando la vuelta si no alcanza), y solo
// se consultan las respuestas del alumno para esas preguntas. Coste por
// pregunta servida: ~2*WINDOW lecturas, en vez de todo el banco + todo el
// historial. Si el alumno ya respondio toda la ventana, se permite repetir.
const WINDOW = 20;
async function pickQuestion(userId, testIds) {
  const base = [['published', '==', true], ['testId', 'in', testIds]];
  const byRand = { orderBy: ['rand', 'asc'] };
  const pivot = Math.random();
  let pool = await query(COL.questions, [...base, ['rand', '>=', pivot]], null, { ...byRand, limit: WINDOW });
  if (pool.length < WINDOW) {
    pool = pool.concat(await query(COL.questions, [...base, ['rand', '<', pivot]], null, { ...byRand, limit: WINDOW - pool.length }));
  }
  if (!pool.length) return null;
  const answered = new Set((await query(COL.answers, [['userId', '==', userId], ['questionId', 'in', pool.map((q) => q.id)]]))
    .map((a) => a.questionId));
  const candidates = pool.filter((q) => !answered.has(q.id));
  const from = candidates.length ? candidates : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// GET /practice/next
r.get('/practice/next', wrap(async (req, res) => {
  const u = req.user; ensureQuotaDay(u);
  const max = quotaMax(u);
  if (!isUnlimited(u) && u.quota.used >= max) {
    if (u.quota.used >= 20) return fail(res, 422, 'QUOTA_DAILY_LIMIT', 'Se alcanzo el limite diario; requiere plan de pago');
    return fail(res, 422, 'QUOTA_BASE_REACHED', 'Se alcanzo la cuota; se puede desbloquear +5');
  }
  const prefs = u.selectedTests?.length ? u.selectedTests : (await list(COL.tests)).map((t) => t.id);
  const forced = req.query.testId;
  const q = await pickQuestion(u.id, forced ? [forced] : prefs);
  if (!q) return fail(res, 404, 'NO_QUESTIONS_AVAILABLE', 'No quedan preguntas para los filtros actuales');
  const sessionTotal = 10;
  const current = (u.quota.used % sessionTotal) + 1;
  return ok(res, { ...publicQuestion(q), progress: { current, total: sessionTotal } }, 200, { quota: { used: u.quota.used, max } });
}));

// GET /questions/:id
r.get('/questions/:id', wrap(async (req, res) => {
  const q = await get(COL.questions, req.params.id);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'La pregunta no existe');
  return ok(res, publicQuestion(q));
}));

// POST /questions/:id/answer
r.post('/questions/:id/answer', wrap(async (req, res) => {
  const { selected, elapsedMs, sessionId } = req.body || {};
  const q = await get(COL.questions, req.params.id);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'La pregunta no existe');
  const idx = LETTERS.indexOf(String(selected || '').toUpperCase());
  if (idx < 0 || idx >= q.options.length) return fail(res, 400, 'INVALID_OPTION', 'La alternativa enviada no existe en la pregunta');
  const u = req.user; ensureQuotaDay(u);
  const existing = await query(COL.answers, [['userId', '==', u.id], ['questionId', '==', q.id]], (a) => a.sessionId === (sessionId || null));
  if (existing.length) return fail(res, 409, 'ALREADY_ANSWERED', 'La pregunta ya fue respondida en esta sesion');
  if (!isUnlimited(u) && u.quota.used >= quotaMax(u)) return fail(res, 422, 'QUOTA_DAILY_LIMIT', 'Cuota diaria agotada');

  const correct = idx === q.correctIndex;
  // La respuesta se registra primero y de forma atomica: su id deriva de
  // (alumno, pregunta, sesion) y create() falla si ya existe. La consulta de
  // arriba no basta: dos envios simultaneos (doble clic, reintento de red) la
  // pasaban ambos y quedaban respuestas duplicadas. Solo quien gana la
  // creacion descuenta cuota y entrega medalla.
  const answerId = `ans_${createHash('sha1').update(`${u.id}|${q.id}|${sessionId || ''}`).digest('hex').slice(0, 20)}`;
  const answer = await create(COL.answers, answerId, {
    userId: u.id, questionId: q.id, testId: q.testId, selected: LETTERS[idx], correct,
    elapsedMs: elapsedMs || 0, sessionId: sessionId || null, createdAt: new Date().toISOString(),
  });
  if (!answer) return fail(res, 409, 'ALREADY_ANSWERED', 'La pregunta ya fue respondida en esta sesion');
  u.quota.used += 1;
  let medalAwarded = null;
  if (correct) { award(u.medals, 'bronze', 1); medalAwarded = { tier: 'bronze', amount: 1 }; }
  await save(u);
  if (correct) await add(COL.medalLedger, { userId: u.id, tier: 'bronze', amount: 1, reason: 'correct_answer', createdAt: new Date().toISOString() }, 'mdl');
  const cohortPercentile = Math.max(5, Math.min(99, 100 - Math.floor((elapsedMs || 18000) / 600)));
  return created(res, {
    correct, correctAnswer: LETTERS[q.correctIndex], shortExplanation: q.shortExplanation || q.explanation?.slice(0, 160),
    cohortPercentile, medalAwarded, quota: { used: u.quota.used, max: quotaMax(u) }, answerId: answer.id,
  });
}));

// GET /questions/:id/explanation
r.get('/questions/:id/explanation', wrap(async (req, res) => {
  const q = await get(COL.questions, req.params.id);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'La pregunta no existe');
  if (q.explanationDetailed) return ok(res, q.explanationDetailed);
  // Generar a partir del texto disponible.
  return ok(res, {
    title: `Explicacion`, subject: `${q.testLabel || q.testId} · ${q.axis || ''}`.trim(),
    steps: [{ label: 'Planteamiento', body: q.statement }, { label: 'Resolucion', body: q.explanation || q.shortExplanation || '' }],
    verification: '', keyConcept: q.habilidad || '',
  });
}));

// GET /questions/:id/skill
r.get('/questions/:id/skill', wrap(async (req, res) => {
  const q = await get(COL.questions, req.params.id);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'La pregunta no existe');
  const skill = q.skillId ? await get(COL.skills, q.skillId) : null;
  const u = req.user;
  const answers = await query(COL.answers, [['userId', '==', u.id], ['testId', '==', q.testId]]);
  const total = answers.length; const correct = answers.filter((a) => a.correct).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const base = skill || { id: 'skl_generic', name: q.habilidad || 'Habilidad evaluada', test: q.testId, level: 2, maxLevel: 4, prerequisites: [], resources: [] };
  return ok(res, {
    skill: { id: base.id, name: base.name, test: base.test || q.testId, level: base.level || 2, maxLevel: base.maxLevel || 4 },
    mastery: { percent, correct, total, status: percent >= 80 ? 'mastered' : (total ? 'in_progress' : 'not_started') },
    prerequisites: base.prerequisites?.length ? base.prerequisites : [
      { name: 'Conocimientos previos', status: 'done' },
      { name: base.name, status: 'active' },
      { name: 'Nivel avanzado', status: 'locked' },
    ],
    resources: base.resources?.length ? base.resources : [
      { type: 'video', title: 'Repaso del tema', duration: '8 min', source: 'Khan Academy', url: 'https://www.khanacademy.org' },
      { type: 'pdf', title: 'Ficha de ejercicios', url: '#' },
    ],
  });
}));

export default r;
