// Cuota diaria de preguntas. Base 10, +5 por colegio, +5 por direccion, max 20.
// Planes de pago => ilimitada.
import { dayKey, nextMidnight, tzOf } from './tz.js';

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

// Dia actual del alumno ('YYYY-MM-DD') en su zona horaria (ver lib/tz.js).
export function todayKey(user, now = new Date()) {
  return dayKey(now, tzOf(user));
}

// Reinicia el contador si cambio el dia.
export function ensureQuotaDay(user) {
  const today = todayKey(user);
  if (!user.quota || user.quota.day !== today) {
    user.quota = { day: today, used: 0 };
  }
  return user.quota;
}

// Proxima medianoche del alumno, cuando se reinicia la cuota.
export function resetsAt(user, now = new Date()) {
  return nextMidnight(tzOf(user), now).toISOString();
}
