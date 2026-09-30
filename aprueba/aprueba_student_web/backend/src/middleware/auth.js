// Autenticacion por JWT Bearer para el alumno.
import { verify } from '../lib/jwt.js';
import { fail } from '../lib/envelope.js';
import { get, COL } from '../data/repo.js';

export async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 401, 'AUTH_REQUIRED', 'Falta el token de acceso');
  try {
    const payload = verify(token);
    if (payload.typ !== 'access') return fail(res, 401, 'AUTH_INVALID', 'Tipo de token invalido');
    const user = await get(COL.users, payload.sub);
    if (!user) return fail(res, 401, 'AUTH_INVALID', 'Usuario no encontrado');
    if (user.state === 'suspended') return fail(res, 403, 'ACCOUNT_SUSPENDED', 'La cuenta esta suspendida');
    req.user = user;
    next();
  } catch (e) {
    return fail(res, 401, 'AUTH_INVALID', 'Token invalido o expirado');
  }
}
