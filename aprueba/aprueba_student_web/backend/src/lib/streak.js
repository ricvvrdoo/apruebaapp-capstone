// Racha de practica: dias consecutivos (en la zona horaria del alumno) en que respondio al menos
// una pregunta. Iniciar sesion no cuenta. Se guarda `streak` y `lastPracticeDay`; si falta
// lastPracticeDay (cuentas anteriores a esta regla) la racha se considera 0.
import { dayKey, shiftDay, tzOf } from './tz.js';

// Lo que se muestra: { streak, status }
//   done_today: ya practico hoy
//   at_risk:    practico ayer y la racha sigue viva, pero hoy aun no practico
//   none:       sin racha (nunca practico o ya vencio)
export function streakView(user, now = new Date()) {
  const today = dayKey(now, tzOf(user));
  const last = user.lastPracticeDay;
  if (!last) return { streak: 0, status: 'none' };
  // `>=` cubre un dia futuro (el alumno cambio a una zona que va atrasada): cuenta como hoy.
  if (last >= today) return { streak: user.streak || 0, status: 'done_today' };
  if (last === shiftDay(today, -1)) return { streak: user.streak || 0, status: 'at_risk' };
  return { streak: 0, status: 'none' };
}

// Registra una practica. Devuelve true si cambio la racha (primera practica del dia).
export function recordPractice(user, now = new Date()) {
  const today = dayKey(now, tzOf(user));
  const last = user.lastPracticeDay;
  if (last && last >= today) return false;
  user.streak = last === shiftDay(today, -1) ? (user.streak || 0) + 1 : 1;
  user.lastPracticeDay = today;
  return true;
}
