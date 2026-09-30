// Catalogos: /countries, /countries/:code/grades, /tests (Bearer),
// /plans (publico), /benefits (Bearer)
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, list, get, add, set, query } from '../data/repo.js';
import { genId } from '../data/repo.js';
import {
  COUNTRIES, GRADE_GROUPS, SUBJECT_SETS, TEST_LABELS_EN,
  findCountry, findGrade, loc,
} from '../data/catalog.js';

const r = Router();

const langOf = (req) => (String(req.query.lang || req.user?.language || req.user?.locale || 'es') === 'en' ? 'en' : 'es');

// GET /countries  (publico: se consulta antes de tener cuenta)
r.get('/countries', wrap(async (req, res) => {
  const lang = langOf(req);
  return ok(res, COUNTRIES.map((c) => ({
    code: c.code, name: loc(c.name, lang), dialCode: c.dialCode, flag: c.flag,
    languages: c.languages, defaultLanguage: c.defaultLanguage, currency: c.currency,
  })));
}));

// GET /countries/:code/grades  (publico)
r.get('/countries/:code/grades', wrap(async (req, res) => {
  const country = findCountry(req.params.code);
  if (!country) return fail(res, 404, 'NOT_FOUND', 'Pais no soportado');
  const lang = langOf(req);
  const groups = (GRADE_GROUPS[country.code] || []).map((g) => ({
    key: g.key,
    label: loc(g.label, lang),
    items: g.items.map((it) => ({ id: it.id, label: loc(it.label, lang), kind: it.kind })),
  }));
  return ok(res, groups, 200, { country: country.code });
}));

// Resuelve las asignaturas de un grado. Para pruebas nacionales tipo PAES usa la
// coleccion `tests` (la que trae preguntas reales); para el resto, el catalogo.
async function subjectsForGrade(gradeId, lang) {
  const testsCol = (await list(COL.tests)).sort((a, b) => (a.order || 0) - (b.order || 0));
  const fromTests = () => testsCol.map((t) => ({
    id: t.id,
    label: lang === 'en' ? (TEST_LABELS_EN[t.id] || t.label) : t.label,
    color: t.color,
    hasQuestions: true,
  }));
  if (!gradeId) return fromTests();
  const grade = findGrade(gradeId);
  if (!grade) return null;
  const subjectSet = SUBJECT_SETS[grade.subjectSet];
  if (subjectSet == null) return fromTests();
  return subjectSet.map((s) => ({ id: s.id, label: loc(s.label, lang), color: s.color, hasQuestions: false }));
}

// GET /tests?gradeId=&lang=
r.get('/tests', authRequired, wrap(async (req, res) => {
  const lang = langOf(req);
  const gradeId = req.query.gradeId || req.user.gradeId || null;
  const subjects = await subjectsForGrade(gradeId, lang);
  if (subjects === null) return fail(res, 404, 'NOT_FOUND', 'El grado indicado no existe', { field: 'gradeId' });
  return ok(res, subjects, 200, { gradeId: gradeId || null, country: req.user.country || null });
}));

// GET /plans  (publico)
r.get('/plans', wrap(async (_req, res) => {
  const plans = (await list(COL.plans)).filter((p) => p.id !== 'free').sort((a, b) => (a.price || 0) - (b.price || 0));
  const out = plans.map((p) => ({
    id: p.id, name: p.name, popular: !!p.popular, features: p.featuresText || [],
    price: { monthly: p.price, yearly: p.price * 10 }, limits: p.limits,
  }));
  return ok(res, out);
}));

const REQUIRED_PLATINUM = 5;
const publicBenefit = (b, unlocked) => ({
  id: b.id, name: b.name, description: b.description, costPlatinum: b.costPlatinum || REQUIRED_PLATINUM,
  unlocked, sponsor: b.sponsor, stock: b.stock ?? null, terms: b.terms || null,
});

// GET /benefits
r.get('/benefits', authRequired, wrap(async (req, res) => {
  const benefits = await list(COL.benefits);
  const platinum = req.user.medals?.platinum || 0;
  const unlocked = platinum >= REQUIRED_PLATINUM;
  return ok(res, benefits.map((b) => publicBenefit(b, unlocked)), 200, {
    platinum, requiredPlatinum: REQUIRED_PLATINUM,
  });
}));

// GET /benefits/:id
r.get('/benefits/:id', authRequired, wrap(async (req, res) => {
  const benefit = await get(COL.benefits, req.params.id);
  if (!benefit) return fail(res, 404, 'NOT_FOUND', 'El beneficio no existe');
  const platinum = req.user.medals?.platinum || 0;
  const redemptions = await query(COL.benefitRedemptions, [['userId', '==', req.user.id], ['benefitId', '==', benefit.id]]);
  return ok(res, {
    ...publicBenefit(benefit, platinum >= REQUIRED_PLATINUM),
    platinum,
    requiredPlatinum: REQUIRED_PLATINUM,
    myRedemptions: redemptions.map((x) => ({ id: x.id, couponCode: x.couponCode, createdAt: x.createdAt })),
  });
}));

// POST /benefits/:id/redeem
r.post('/benefits/:id/redeem', authRequired, wrap(async (req, res) => {
  const benefit = await get(COL.benefits, req.params.id);
  if (!benefit) return fail(res, 404, 'NOT_FOUND', 'El beneficio no existe');
  if ((req.user.medals?.platinum || 0) < REQUIRED_PLATINUM) return fail(res, 422, 'INSUFFICIENT_MEDALS', 'Necesitas 5 medallas de Platino');
  if (benefit.stock != null && benefit.stock <= 0) return fail(res, 409, 'BENEFIT_OUT_OF_STOCK', 'El beneficio se agoto');
  req.user.medals.platinum -= REQUIRED_PLATINUM;
  await set(COL.users, req.user.id, req.user);
  if (benefit.stock != null) { benefit.stock -= 1; await set(COL.benefits, benefit.id, benefit); }
  const couponCode = `APRUEBA-${genId('').slice(1, 5).toUpperCase()}`;
  const red = await add(COL.benefitRedemptions, {
    userId: req.user.id, benefitId: benefit.id, benefit: benefit.name, couponCode,
    platinumSpent: REQUIRED_PLATINUM, createdAt: new Date().toISOString(),
  }, 'rdm');
  return created(res, { redemptionId: red.id, benefit: benefit.name, couponCode, platinumSpent: REQUIRED_PLATINUM });
}));

export default r;
