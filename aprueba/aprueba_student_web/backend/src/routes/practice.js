// 1.3 Practica: next, question, answer, explanation, skill
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, get, set, add, where, list } from '../data/repo.js';
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
  const answered = new Set((await where(COL.answers, (a) => a.userId === u.id)).map((a) => a.questionId));
  let pool = await where(COL.questions, (q) => q.published !== false && (forced ? q.testId === forced : prefs.includes(q.testId)));
  let candidates = pool.filter((q) => !answered.has(q.id));
  if (candidates.length === 0) candidates = pool; // permite repetir si ya respondio todo
  if (candidates.length === 0) return fail(res, 404, 'NO_QUESTIONS_AVAILABLE', 'No quedan preguntas para los filtros actuales');
  const q = candidates[Math.floor(Math.random() * candidates.length)];
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
  const existing = await where(COL.answers, (a) => a.userId === u.id && a.questionId === q.id && a.sessionId === (sessionId || null));
  if (existing.length) return fail(res, 409, 'ALREADY_ANSWERED', 'La pregunta ya fue respondida en esta sesion');
  if (!isUnlimited(u) && u.quota.used >= quotaMax(u)) return fail(res, 422, 'QUOTA_DAILY_LIMIT', 'Cuota diaria agotada');

  const correct = idx === q.correctIndex;
  u.quota.used += 1;
  let medalAwarded = null;
  if (correct) { award(u.medals, 'bronze', 1); medalAwarded = { tier: 'bronze', amount: 1 }; }
  await save(u);
  const answer = await add(COL.answers, {
    userId: u.id, questionId: q.id, testId: q.testId, selected: LETTERS[idx], correct,
    elapsedMs: elapsedMs || 0, sessionId: sessionId || null, createdAt: new Date().toISOString(),
  }, 'ans');
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
  const answers = await where(COL.answers, (a) => a.userId === u.id && a.testId === q.testId);
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
