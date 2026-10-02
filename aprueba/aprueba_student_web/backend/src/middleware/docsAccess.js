// Acceso a la documentacion de la API (/api/docs y /api/v1/openapi.json).
//
// La API es privada (la consumen la web, la app y la consola admin), asi que
// su documentacion no se expone abierta en produccion. API_DOCS:
//   off        -> 404, como si no existiera. Por defecto en produccion.
//   protected  -> HTTP Basic con API_DOCS_USER y API_DOCS_PASSWORD. Si falta
//                 alguna credencial, se comporta como off (falla cerrado).
//   public     -> abierta. Por defecto fuera de produccion.
// Se lee en cada peticion, para poder cambiarla sin reiniciar en pruebas.
import { createHash, timingSafeEqual } from 'crypto';
import { fail } from '../lib/envelope.js';

export function docsMode() {
  const mode = String(process.env.API_DOCS || '').toLowerCase();
  if (['off', 'protected', 'public'].includes(mode)) return mode;
  return process.env.NODE_ENV === 'production' ? 'off' : 'public';
}

// Compara en tiempo constante: los hash tienen siempre el mismo largo.
const sameSecret = (a, b) => timingSafeEqual(
  createHash('sha256').update(String(a)).digest(),
  createHash('sha256').update(String(b)).digest(),
);

function credentials(req) {
  const [scheme, value] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Basic' || !value) return null;
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  return i < 0 ? null : { user: decoded.slice(0, i), password: decoded.slice(i + 1) };
}

const notFound = (req, res) => fail(res, 404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`);

export function docsAccess(req, res, next) {
  const mode = docsMode();
  if (mode === 'off') return notFound(req, res);
  res.set('X-Robots-Tag', 'noindex, nofollow');

  if (mode === 'protected') {
    const { API_DOCS_USER: user, API_DOCS_PASSWORD: password } = process.env;
    if (!user || !password) return notFound(req, res);
    const given = credentials(req);
    // Ambas comparaciones siempre, para no revelar cual fallo por el tiempo de respuesta.
    const userOk = sameSecret(given?.user ?? '', user);
    const passOk = sameSecret(given?.password ?? '', password);
    if (!given || !userOk || !passOk) {
      res.set('WWW-Authenticate', 'Basic realm="Aprueba API docs", charset="UTF-8"');
      return fail(res, 401, 'AUTH_REQUIRED', 'Credenciales de la documentacion requeridas');
    }
    res.set('Cache-Control', 'no-store');
  }
  return next();
}
