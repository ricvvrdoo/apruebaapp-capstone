// Cuota diaria de preguntas. Base 10, +5 por colegio, +5 por direccion, max 20.
// Planes de pago => ilimitada.
export const BASE_QUOTA = 10;
export const MAX_QUOTA = 20;

export function isUnlimited(user) {
  return user.plan && user.plan !== 'free';
}

export function quotaMax(user) {
  if (isUnlimited(user)) return 999999;
  const b = user.bonuses || {};
  let max = BASE_QUOTA;
  if (b.school) max += 5;
  if (b.address) max += 5;
  return Math.min(max, MAX_QUOTA);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Reinicia el contador si cambio el dia.
export function ensureQuotaDay(user) {
  const today = todayKey();
  if (!user.quota || user.quota.day !== today) {
    user.quota = { day: today, used: 0 };
  }
  return user.quota;
}

export function resetsAt() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0); // proxima medianoche UTC (aprox. reinicio)
  return d.toISOString();
}
