// 2. Planes/pagos: checkout sessions, webhook (stub demo)
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, get, set, add, query, genId } from '../data/repo.js';

const r = Router();

// POST /checkout/sessions
r.post('/checkout/sessions', authRequired, wrap(async (req, res) => {
  const { plan, billingCycle, successUrl } = req.body || {};
  if (!['uni', 'all'].includes(plan) || !['monthly', 'yearly'].includes(billingCycle)) {
    return fail(res, 400, 'INVALID_PLAN', 'El plan o ciclo indicado no existe');
  }
  const planDoc = await get(COL.plans, plan);
  if (!planDoc) return fail(res, 400, 'INVALID_PLAN', 'El plan no existe');
  const active = await query(COL.subscriptions, [['userId', '==', req.user.id], ['status', '==', 'active'], ['plan', '==', plan]]);
  if (active.length) return fail(res, 409, 'ALREADY_SUBSCRIBED', 'El usuario ya tiene una suscripcion activa a ese plan');
  const amount = billingCycle === 'yearly' ? planDoc.price * 10 : planDoc.price;
  const sessionId = `cs_${genId('').slice(1)}`;
  // Guardamos la sesion pendiente; el "pago" se confirma desde el webhook simulado.
  await add(COL.subscriptions, {
    userId: req.user.id, plan, billingCycle, status: 'incomplete', checkoutSessionId: sessionId,
    amount, currency: 'USD', successUrl: successUrl || null, createdAt: new Date().toISOString(),
  }, 'sub');
  return created(res, {
    checkoutSessionId: sessionId, clientSecret: `${sessionId}_secret_demo`, amount, currency: 'USD', plan, billingCycle,
  });
}));

// POST /webhooks/stripe  (en demo: activa la suscripcion por checkoutSessionId)
r.post('/webhooks/stripe', wrap(async (req, res) => {
  const evt = req.body || {};
  if (!evt.type) return fail(res, 400, 'WEBHOOK_MALFORMED', 'Evento sin tipo');
  if (evt.type === 'checkout.session.completed') {
    const csid = evt.data?.object?.id;
    const sub = (await query(COL.subscriptions, [['checkoutSessionId', '==', csid]]))[0];
    if (sub) {
      sub.status = 'active';
      sub.currentPeriodEnd = new Date(Date.now() + (sub.billingCycle === 'yearly' ? 365 : 30) * 864e5).toISOString().slice(0, 10);
      sub.paymentMethod = { brand: 'visa', last4: '4242' };
      await set(COL.subscriptions, sub.id, sub);
      const u = await get(COL.users, sub.userId);
      if (u) { u.plan = sub.plan; await set(COL.users, u.id, u); }
      await add(COL.invoices, { userId: sub.userId, amount: sub.amount, currency: 'USD', status: 'paid', paidAt: new Date().toISOString().slice(0, 10), pdfUrl: '#' }, 'in');
    }
  }
  return res.json({ received: true });
}));

// Endpoint de conveniencia para la demo web: confirma el pago de una sesion
// (equivale a recibir checkout.session.completed desde Stripe).
r.post('/checkout/sessions/:id/confirm', authRequired, wrap(async (req, res) => {
  const sub = (await query(COL.subscriptions, [['checkoutSessionId', '==', req.params.id], ['userId', '==', req.user.id]]))[0];
  if (!sub) return fail(res, 404, 'NOT_FOUND', 'Sesion de pago no encontrada');
  sub.status = 'active';
  sub.cancelAtPeriodEnd = false;
  sub.currentPeriodEnd = new Date(Date.now() + (sub.billingCycle === 'yearly' ? 365 : 30) * 864e5).toISOString().slice(0, 10);
  sub.paymentMethod = { brand: 'visa', last4: '4242' };
  await set(COL.subscriptions, sub.id, sub);
  const u = req.user; u.plan = sub.plan; await set(COL.users, u.id, u);
  await add(COL.invoices, { userId: u.id, amount: sub.amount, currency: 'USD', status: 'paid', paidAt: new Date().toISOString().slice(0, 10), pdfUrl: '#' }, 'in');
  return ok(res, { id: sub.id, plan: sub.plan, billingCycle: sub.billingCycle, status: 'active', currentPeriodEnd: sub.currentPeriodEnd });
}));

export default r;
