// Zona horaria del alumno: define cuando empieza "el dia" para la cuota diaria, la racha,
// el premio por iniciar sesion y el limite de regalos.
const DEFAULT_TZ = 'America/Santiago';
const COUNTRY_TZ = { CL: 'America/Santiago', UK: 'Europe/London' };

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
}

// Zona efectiva: la que eligio el alumno; si no hay (o es invalida), la de su pais.
export function tzOf(user) {
  if (isValidTimeZone(user?.timezone)) return user.timezone;
  return COUNTRY_TZ[String(user?.country || '').toUpperCase()] || DEFAULT_TZ;
}

const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) formatters.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return formatters.get(tz);
}

// Dia calendario de `date` en `tz`, como 'YYYY-MM-DD'.
export function dayKey(date, tz) {
  return formatter(tz).format(date);
}

// Suma `days` (puede ser negativo) a un dia 'YYYY-MM-DD'.
export function shiftDay(key, days) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Primer instante del dia siguiente en `tz`. Busqueda binaria sobre el cambio de dayKey:
// sirve aunque el dia dure 23 o 25 horas por el cambio de hora.
export function nextMidnight(tz, now = new Date()) {
  const today = dayKey(now, tz);
  let lo = now.getTime();
  let hi = lo + 49 * 3600e3; // un dia dura entre 23 y 25 h: en 49 h siempre cambia
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKey(new Date(mid), tz) === today) lo = mid; else hi = mid;
  }
  return new Date(hi);
}
