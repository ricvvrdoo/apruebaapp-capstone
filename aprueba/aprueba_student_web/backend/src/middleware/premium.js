// Gating de plan de pago. El wireframe marca con "⭐ Premium" el contacto a
// tutores y el analisis de falencias; ambos responden 403 PLAN_REQUIRED en free.
import { fail } from '../lib/envelope.js';

export function isPremium(user) {
  return !!user && !!user.plan && user.plan !== 'free';
}

export function premiumRequired(req, res, next) {
  if (!req.user) return fail(res, 401, 'AUTH_REQUIRED', 'Falta el token de acceso');
  if (!isPremium(req.user)) {
    return fail(res, 403, 'PLAN_REQUIRED', 'Esta funcion requiere un plan de pago', {
      details: [{ upgradeTo: ['uni', 'all'] }],
    });
  }
  next();
}
