import jwt from 'jsonwebtoken';

// En produccion el secreto es obligatorio: con el valor por defecto (publico en
// el repositorio) cualquiera podria firmar tokens validos para cualquier usuario.
const PLACEHOLDERS = ['dev-secret', 'cambia-esto-en-produccion'];
function resolveSecret() {
  const s = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!s || PLACEHOLDERS.includes(s) || s.length < 32) {
      throw new Error('JWT_SECRET falta, es un valor de ejemplo o tiene menos de 32 caracteres (ver .env.example)');
    }
    return s;
  }
  if (!s) console.warn('[jwt] JWT_SECRET no definido: se usa un secreto de desarrollo. No usar asi en produccion.');
  return s || 'dev-secret';
}
const SECRET = resolveSecret();
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 2592000);
// Token corto que acredita "este telefono fue verificado"; se canjea en
// /auth/register, /auth/social o PATCH /me/phone.
const PHONE_TTL = Number(process.env.JWT_PHONE_TTL || 900);

export function signAccess(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, role: user.role || 'student', plan: user.plan || 'free', typ: 'access' },
    SECRET, { expiresIn: ACCESS_TTL });
}
export function signRefresh(user) {
  return jwt.sign({ sub: user.id, typ: 'refresh' }, SECRET, { expiresIn: REFRESH_TTL });
}
export function signPhone({ phone, country, language, firebaseUid, provider }) {
  return jwt.sign(
    { sub: phone, country, language, firebaseUid, provider, typ: 'phone' },
    SECRET, { expiresIn: PHONE_TTL });
}
// Devuelve el payload del phoneToken o null si es invalido/expirado o no es de tipo phone.
export function verifyPhone(token) {
  try {
    const payload = jwt.verify(token, SECRET);
    return payload.typ === 'phone' ? payload : null;
  } catch {
    return null;
  }
}
export function verify(token) { return jwt.verify(token, SECRET); }
export const accessTtl = ACCESS_TTL;
export const phoneTtl = PHONE_TTL;
