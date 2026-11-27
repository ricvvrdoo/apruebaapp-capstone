// Limite de intentos con contador compartido en la base de datos.
//
// En Vercel cada instancia tiene su propia memoria y se reinicia sin aviso, asi
// que un contador en memoria no frena a quien reparte sus intentos entre
// instancias. Aqui cada contador es un documento de la coleccion rateLimits,
// actualizado con una transaccion (repo.transact).
//
// Ventana fija: el primer intento abre una ventana de `windowSec` segundos; si en
// ella se llega a `max`, se bloquea hasta que la ventana termina. El id del
// documento es un hash de la clave (correo, IP o usuario), para no guardar esos
// datos en claro. El campo expiresAt permite configurar una politica TTL en
// Firestore que borre los contadores vencidos.
import { createHash } from 'crypto';
import { COL, get, del, transact } from '../data/repo.js';

const MIN = 60;
export const LIMITS = {
  // Fallos de inicio de sesion: por correo y, mas holgado, por IP (un colegio
  // puede compartir una IP publica).
  loginEmail: { scope: 'login-email', max: 5, windowSec: 15 * MIN },
  loginIp: { scope: 'login-ip', max: 20, windowSec: 15 * MIN },
  // Solicitudes de recuperacion de contrasena.
  forgotEmail: { scope: 'forgot-email', max: 5, windowSec: 15 * MIN },
  forgotIp: { scope: 'forgot-ip', max: 20, windowSec: 15 * MIN },
  // Exportaciones de datos por alumno (cada una lee todas sus colecciones).
  dataExport: { scope: 'export', max: 5, windowSec: 60 * MIN },
};

const docId = (limit, key) => `${limit.scope}_${createHash('sha256').update(String(key).trim().toLowerCase()).digest('hex').slice(0, 40)}`;
const vigente = (doc, limit, now) => doc && now - doc.windowStart < limit.windowSec * 1000;
const espera = (doc, limit, now) => Math.max(1, Math.ceil((doc.windowStart + limit.windowSec * 1000 - now) / 1000));

// Segundos que faltan para poder intentar de nuevo, o 0 si no esta bloqueado.
export async function blockedFor(limit, key, now = Date.now()) {
  const doc = await get(COL.rateLimits, docId(limit, key));
  return vigente(doc, limit, now) && doc.count >= limit.max ? espera(doc, limit, now) : 0;
}

// Suma un intento. Devuelve { count, retryAfter }: retryAfter > 0 si con este
// intento se supero el maximo.
export async function hit(limit, key, now = Date.now()) {
  const doc = await transact(COL.rateLimits, docId(limit, key), (cur) => (vigente(cur, limit, now)
    ? { ...cur, count: cur.count + 1 }
    : { scope: limit.scope, count: 1, windowStart: now, expiresAt: new Date(now + limit.windowSec * 1000) }));
  return { count: doc.count, retryAfter: doc.count > limit.max ? espera(doc, limit, now) : 0 };
}

// Olvida los intentos (por ejemplo, tras un inicio de sesion correcto).
export async function clear(limit, key) {
  await del(COL.rateLimits, docId(limit, key));
}

// IP del cliente. Detras del proxy de Vercel, Express la toma de X-Forwarded-For
// solo si 'trust proxy' esta activo (ver index.js).
export const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'desconocida';
