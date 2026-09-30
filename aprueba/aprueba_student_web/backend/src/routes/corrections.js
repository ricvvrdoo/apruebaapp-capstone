// 1.3 Recorrecciones del alumno
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, get, add, where } from '../data/repo.js';

const r = Router();
r.use(authRequired);
const REASONS = ['wrong_answer', 'ambiguous', 'typo', 'bad_explanation', 'other'];

// POST /corrections
r.post('/corrections', wrap(async (req, res) => {
  const { questionId, reason, comment } = req.body || {};
  if (!questionId || !REASONS.includes(reason)) return fail(res, 400, 'VALIDATION_ERROR', 'questionId y reason validos son obligatorios');
  const q = await get(COL.questions, questionId);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'La pregunta no existe');
  const open = await where(COL.corrections, (c) => c.userId === req.user.id && c.questionId === questionId && c.status === 'pending');
  if (open.length) return fail(res, 409, 'CORRECTION_ALREADY_OPEN', 'Ya existe una solicitud abierta tuya para esta pregunta');
  const expectedReviewBy = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const c = await add(COL.corrections, {
    userId: req.user.id, questionId, reason, comment: comment || '', status: 'pending',
    expectedReviewBy, createdAt: new Date().toISOString(),
  }, 'cor');
  return created(res, { id: c.id, status: 'pending', expectedReviewBy, potentialReward: { tier: 'bronze', amount: 250 } });
}));

// GET /corrections
r.get('/corrections', wrap(async (req, res) => {
  const items = (await where(COL.corrections, (c) => c.userId === req.user.id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return ok(res, items.map((c) => ({
    id: c.id, questionId: c.questionId, reason: c.reason, status: c.status,
    rewardGranted: c.status === 'confirmed' ? { tier: 'bronze', amount: 250 } : null,
  })));
}));

// GET /corrections/:id
// La pantalla `recorreccion` consulta el veredicto mientras el estado es pending.
r.get('/corrections/:id', wrap(async (req, res) => {
  const c = await get(COL.corrections, req.params.id);
  if (!c || c.userId !== req.user.id) return fail(res, 404, 'NOT_FOUND', 'La solicitud no existe');
  const q = await get(COL.questions, c.questionId);
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  return ok(res, {
    id: c.id,
    questionId: c.questionId,
    question: q ? {
      id: q.id, testId: q.testId, testLabel: q.testLabel, axis: q.axis || null, difficulty: q.difficulty,
      statement: q.statement, officialAnswer: LETTERS[q.correctIndex],
    } : null,
    reason: c.reason,
    comment: c.comment || '',
    status: c.status,
    resolution: c.resolution || null,
    reviewerNote: c.reviewerNote || null,
    expectedReviewBy: c.expectedReviewBy || null,
    resolvedAt: c.resolvedAt || null,
    potentialReward: { tier: 'bronze', amount: 250 },
    rewardGranted: c.status === 'confirmed' ? { tier: 'bronze', amount: c.rewardAmount || 250 } : null,
    createdAt: c.createdAt,
  });
}));

export default r;
