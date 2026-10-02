// Cliente HTTP del API del alumno. Maneja el envelope {data,error,meta},
// el token Bearer y el refresh automatico. Persiste tokens en localStorage.
// La API vive en su propio dominio: VITE_API_URL (p. ej. https://aprueba-api.vercel.app)
// se fija al compilar. Sin ella, ruta relativa: en desarrollo la atiende el proxy de Vite.
const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api/v1`;
const LS = 'aprueba_tokens';

let accessToken = null;
let refreshToken = null;
let onAuthFail = null;

(function restore() {
  try { const t = JSON.parse(localStorage.getItem(LS) || 'null'); if (t) { accessToken = t.a; refreshToken = t.r; } } catch {}
})();

export function setTokens(a, r) {
  accessToken = a; refreshToken = r;
  if (a) localStorage.setItem(LS, JSON.stringify({ a, r }));
  else localStorage.removeItem(LS);
}
export function clearTokens() { setTokens(null, null); }
export function hasSession() { return !!accessToken; }
export function setAuthFailHandler(fn) { onAuthFail = fn; }

async function raw(method, path, body, retry = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { data: null, meta: null };
  const json = await res.json().catch(() => ({ error: { code: 'PARSE', message: 'Respuesta invalida' } }));
  if (!res.ok) {
    if (res.status === 401 && retry && refreshToken && !path.startsWith('/auth/')) {
      const ok = await tryRefresh();
      if (ok) return raw(method, path, body, false);
      clearTokens();
      if (onAuthFail) onAuthFail();
    }
    const err = new Error(json.error?.message || 'Error');
    err.code = json.error?.code; err.status = res.status; err.field = json.error?.field;
    throw err;
  }
  return json;
}

async function tryRefresh() {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch { return false; }
}

export const api = {
  get: (path) => raw('GET', path),
  post: (path, body) => raw('POST', path, body),
  put: (path, body) => raw('PUT', path, body),
  patch: (path, body) => raw('PATCH', path, body),
  del: (path, body) => raw('DELETE', path, body),
};
