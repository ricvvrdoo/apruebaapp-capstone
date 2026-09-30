// 2. Planes/pagos: checkout sessions, webhook (stub demo)
// Los pagos estan fuera del alcance del MVP: sin Stripe integrado, activar un
// plan sin pagar solo se permite en modo demo (ver lib/demo.js).
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { COL, get, set, add, query, genId } from '../data/repo.js';
import { demoMode } from '../lib/demo.js';

const r = Router();

function paymentsDisabled(res) {
  return fail(res, 503, 'PAYMENTS_DISABLED', 'Los pagos aun no estan habilitados');
}

// POST /checkout/sessions
r.post('/checkout/sessions', authRequired, wrap(async (req, res) => {
  if (!demoMode()) return paymentsDisabled(res);
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

// POST /webhooks/stripe
// Deshabilitado siempre, incluso en modo demo: sin verificar la firma de Stripe,
// cualquiera podia enviar un checkout.session.completed falso y activarse un
// plan pagado. En demo, el plan se activa con /checkout/sessions/:id/confirm.
// Al integrar Stripe: validar la firma con stripe.webhooks.constructEvent sobre
// el cuerpo crudo (express.raw), con el secreto del endpoint.
r.post('/webhooks/stripe', (_req, res) => paymentsDisabled(res));

// Endpoint de conveniencia para la demo: confirma el pago de una sesion
// (equivale a recibir checkout.session.completed desde Stripe).
r.post('/checkout/sessions/:id/confirm', authRequired, wrap(async (req, res) => {
  if (!demoMode()) return paymentsDisabled(res);
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
