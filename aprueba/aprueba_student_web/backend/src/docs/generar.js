// Genera src/docs/openapi.json (OpenAPI 3.1) a partir del codigo.
//
//   PAES_DIR=<carpeta con "PAES Chile *"> npm run openapi:generar
//
// 1. Analisis estatico de src/routes/*.js: rutas, sesion y plan requeridos,
//    parametros, campos del body, estado de exito y errores (fail(...)).
// 2. Respuestas reales: corre el smoke test contra el driver en memoria y
//    captura cada respuesta JSON; de ahi salen los esquemas y los ejemplos.
// 3. Combina con contrato-api.json (Aprueba_API_Backend.docx) y anotaciones.js.
//
// No editar openapi.json a mano: se regenera con este script.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { TAGS, RESUMENES, EXTRA, NOTAS } from './anotaciones.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(DIR, '..');
const contrato = JSON.parse(fs.readFileSync(path.join(DIR, 'contrato-api.json'), 'utf8'));

// ── 1. Analisis estatico ────────────────────────────────────────────────
const ROUTE = /^r\.(get|post|put|patch|delete)\('([^']+)',([^\n]*)$/gm;
const FAIL = /fail\(\s*res,\s*(\d{3}),\s*'([A-Z_]+)',\s*(['`])((?:(?!\3).)*)\3/gs;

function failsIn(text) {
  const out = [];
  for (const m of text.matchAll(FAIL)) out.push({ status: +m[1], code: m[2], message: m[4].replace(/\$\{[^}]+\}/g, '…') });
  return out;
}
const MW = {
  auth: failsIn(fs.readFileSync(path.join(SRC, 'middleware/auth.js'), 'utf8')),
  premium: failsIn(fs.readFileSync(path.join(SRC, 'middleware/premium.js'), 'utf8')),
};

function destructured(text, source) {
  const names = new Set();
  for (const m of text.matchAll(new RegExp(`const\\s*\\{([^}]+)\\}\\s*=\\s*req\\.${source}`, 'g'))) {
    for (const part of m[1].split(',')) {
      const name = part.split(/[:=]/)[0].trim();
      if (/^[a-zA-Z_]\w*$/.test(name)) names.add(name);
    }
  }
  for (const m of text.matchAll(new RegExp(`req\\.${source}\\??\\.([a-zA-Z_]\\w*)`, 'g'))) names.add(m[1]);
  return [...names];
}

// Auxiliares de archivo que leen la peticion, como `const langOf = (req) => ...req.query.lang...`:
// las rutas que los llaman aceptan esos mismos parametros.
function helpersIn(preamble) {
  const out = new Map();
  for (const m of preamble.matchAll(/^const (\w+) = \(req\)[^\n]*$/gm)) out.set(m[1], { query: destructured(m[0], 'query'), body: destructured(m[0], 'body') });
  return out;
}

const rutas = [];
for (const file of fs.readdirSync(path.join(SRC, 'routes')).filter((f) => f.endsWith('.js'))) {
  const text = fs.readFileSync(path.join(SRC, 'routes', file), 'utf8').replace(/\r\n/g, '\n');
  const authLine = text.search(/^r\.use\(authRequired\)/m);
  const matches = [...text.matchAll(ROUTE)];
  const helpers = helpersIn(text.slice(0, matches[0]?.index ?? 0));
  matches.forEach((m, i) => {
    const seg = text.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : text.length);
    const head = m[3];
    const premium = /premiumRequired/.test(head);
    const usados = [...helpers].filter(([name]) => seg.includes(`${name}(req)`)).map(([, h]) => h);
    rutas.push({
      file, method: m[1].toUpperCase(), path: m[2],
      auth: (authLine >= 0 && authLine < m.index) || /authRequired/.test(head) || premium,
      premium,
      demo: /demoMode\(\)/.test(seg),
      webhook: m[2] === '/webhooks/stripe',
      statuses: [/\bok\(res/.test(seg) && 200, /created\(res/.test(seg) && 201, /noContent\(res/.test(seg) && 204].filter(Boolean),
      body: [...new Set([...destructured(seg, 'body'), ...usados.flatMap((h) => h.body)])],
      query: [...new Set([...destructured(seg, 'query'), ...usados.flatMap((h) => h.query)])],
      paginated: /paginate\(|nextCursor/.test(seg),
      errors: failsIn(seg).concat(/paymentsDisabled\(res\)/.test(seg) ? [{ status: 503, code: 'PAYMENTS_DISABLED', message: 'Los pagos aun no estan habilitados' }] : []),
    });
  });
}
rutas.push({ file: 'index.js', method: 'GET', path: '/health', auth: false, premium: false, demo: false, statuses: [200], body: [], query: [], errors: [] });

// ── 2. Respuestas reales (smoke test) ───────────────────────────────────
const capturas = new Map(); // 'METODO /ruta' -> { ok: {status: [cuerpos]}, errores: Map(code -> {status, message}), bodies: [] }
const cap = (key) => { if (!capturas.has(key)) capturas.set(key, { ok: {}, errores: new Map(), bodies: [] }); return capturas.get(key); };
const origJson = express.response.json;
express.response.json = function (payload) {
  const req = this.req;
  if (req?.route?.path) {
    const c = cap(`${req.method} ${req.route.path}`);
    if (this.statusCode < 400) {
      (c.ok[this.statusCode] ||= []).push(payload);
      if (req.body && Object.keys(req.body).length) c.bodies.push(req.body);
    } else if (payload?.error?.code) {
      c.errores.set(payload.error.code, { status: this.statusCode, message: payload.error.message });
    }
  }
  return origJson.call(this, payload);
};

// El smoke test termina con process.exit(): se intercepta para seguir aqui.
let smokeCode;
const realExit = process.exit.bind(process);
const smokeTerminado = new Promise((resolve) => { process.exit = (code) => { smokeCode = code; resolve(); }; });
const logReal = console.log; console.log = () => {};
await import('../seed/smoke.js');
await smokeTerminado;
process.exit = realExit;
if (smokeCode) { console.log = logReal; console.error(`[openapi] el smoke test fallo (codigo ${smokeCode}): no se genera la especificacion.`); realExit(1); }

// Recorrido complementario: endpoints que el smoke test no ejercita con exito.
// Usa el servidor que dejo levantado el smoke test y prepara el estado con el repo.
{
  const { get, patch, COL } = await import('../data/repo.js');
  const B = `http://127.0.0.1:${process.env.PORT}/api/v1`;
  const call = async (method, p, token, body) => (await fetch(B + p, {
    method, headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  })).json();
  const login = async (email) => (await call('POST', '/auth/login', null, { email, password: 'demo1234' })).data;
  const free = (await login('demo@aprueba.cl')).accessToken;
  const prem = (await login('camila@correo.cl')).accessToken;
  const juan = await login('juan@correo.cl');

  await call('POST', '/auth/refresh', null, { refreshToken: juan.refreshToken });
  await call('POST', '/auth/password/forgot', null, { email: 'juan@correo.cl' });
  await call('POST', '/auth/password/reset', null, { token: (await get(COL.users, juan.user.id)).resetToken, password: 'demo1234' });

  const benefits = (await call('GET', '/benefits', prem)).data || [];
  const camila = await get(COL.users, 'usr_camila');
  await patch(COL.users, camila.id, { medals: { ...camila.medals, platinum: 5, bronze: (camila.medals.bronze || 0) + 10 } });
  if (benefits[0]) await call('POST', `/benefits/${benefits[0].id}/redeem`, prem);
  await call('POST', '/me/medals/exchange', prem, { from: 'bronze', quantity: 5 });

  await call('PATCH', '/me', prem, { name: 'Camila Rojas', school: 'Liceo Bicentenario' });
  await call('GET', '/me/settings', prem);
  await call('PATCH', '/me/settings', prem, { theme: 'light', locale: 'es' });
  await call('GET', '/me/quota', free);
  await patch(COL.users, 'usr_demo', { bonuses: { school: false, address: false } });
  await call('POST', '/me/quota/unlock', free, { type: 'school', school: 'Liceo Demo' });
  const gifts = (await call('GET', '/me/gifts', prem)).data;
  const friend = gifts?.friends?.[0] || gifts?.recipients?.[0];
  if (friend) await call('POST', '/me/gifts', prem, { recipients: [{ userId: friend.userId, amount: 1 }] });
  const notif = (await call('GET', '/me/notifications', free)).data || [];
  if (notif[0]) await call('PATCH', `/me/notifications/${notif[0].id}/read`, free);
  await call('PUT', '/me/notifications/preferences', free, { dailyReminder: true, reminderTime: '19:00' });
  await call('POST', '/devices', free, { platform: 'android', pushToken: 'demo-push-token', deviceId: 'dev_demo' });
  await call('GET', '/me/subscription', prem);
  await call('GET', '/me/invoices', prem);
  await call('GET', '/me/data-export', prem);
  await call('POST', '/me/subscription/cancel', juan.accessToken, { immediate: false });

  const q = (await call('GET', '/practice/next', prem)).data;
  for (const s of ['', '/explanation', '/skill']) await call('GET', `/questions/${q.id}${s}`, prem);
  await call('GET', '/corrections', prem);

  const grp = (await call('POST', '/groups', prem, { name: 'Ensayo M1', subjectTestId: 'm1' })).data;
  await call('GET', `/groups/${grp.id}`, prem);
  await call('PATCH', `/groups/${grp.id}`, prem, { name: 'Ensayo M1 · sábados' });
  await call('GET', `/groups/${grp.id}/stats`, prem);
  await call('POST', `/groups/${grp.id}/shared`, prem, { questionId: q.id, comment: '¿Cómo la resolvieron?' });
  await call('GET', `/groups/${grp.id}/shared`, prem);

  const post = ((await call('GET', '/feed', prem)).data || [])[0];
  if (post) { await call('POST', `/posts/${post.id}/like`, prem); await call('GET', `/posts/${post.id}/comments`, prem); }

  const cs = (await call('POST', '/checkout/sessions', free, { plan: 'uni', billingCycle: 'monthly' })).data;
  if (cs) await call('POST', `/checkout/sessions/${cs.checkoutSessionId}/confirm`, free);
}
console.log = logReal;

// ── 3. Construccion del documento ───────────────────────────────────────
const norm = (p) => p.replace(/:[a-zA-Z]+/g, ':p');
const fichas = new Map(contrato.endpoints.map((e) => [`${e.method} ${norm(e.path)}`, e]));
const toOpenApiPath = (p) => p.replace(/:([a-zA-Z]+)/g, '{$1}');

function scrub(v, key = '') {
  if (typeof v === 'string') {
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v) || /token|secret/i.test(key)) return `<${key || 'token'}>`;
    if (/password/i.test(key)) return '********';
    return v.length > 280 ? `${v.slice(0, 277)}...` : v;
  }
  if (Array.isArray(v)) return v.slice(0, 3).map((x) => scrub(x, key));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x, k)]));
  return v;
}

function infer(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (Array.isArray(v)) return { type: 'array', items: v.length ? v.map(infer).reduce(merge) : {} };
  if (typeof v === 'string') return /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v) ? { type: 'string', format: 'date-time' } : { type: 'string' };
  if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' };
  if (typeof v === 'boolean') return { type: 'boolean' };
  return { type: 'object', properties: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, infer(x)])) };
}
function merge(a, b) {
  if (!a || !Object.keys(a).length) return b;
  if (!b || !Object.keys(b).length) return a;
  let types = [...new Set([].concat(a.type, b.type))];
  if (types.includes('number')) types = types.filter((t) => t !== 'integer');
  const out = { type: types.length === 1 ? types[0] : types };
  if (a.format && a.format === b.format) out.format = a.format;
  if (a.properties || b.properties) {
    out.properties = { ...(a.properties || {}) };
    for (const [k, s] of Object.entries(b.properties || {})) out.properties[k] = merge(out.properties[k], s);
  }
  if (a.items || b.items) out.items = merge(a.items, b.items);
  return out;
}

// Tipos del documento -> JSON Schema.
function schemaFromDoc(type = '', desc = '') {
  const t = type.toLowerCase();
  const values = (desc.match(/^([\w.-]+(?:\s*\|\s*[\w.-]+)+)/) || [])[1];
  if (t.startsWith('enum')) return values ? { type: 'string', enum: values.split('|').map((s) => s.trim()) } : { type: 'string' };
  if (t.startsWith('integer')) return { type: 'integer' };
  if (t.startsWith('number')) return { type: 'number' };
  if (t.startsWith('boolean')) return { type: 'boolean' };
  if (t.startsWith('datetime')) return { type: 'string', format: 'date-time' };
  if (t.startsWith('array')) return { type: 'array', items: {} };
  if (t.startsWith('object') || t.startsWith('map')) return { type: 'object' };
  return { type: 'string' };
}

const envelope = (dataSchema, metaSchema) => ({
  type: 'object', required: ['data', 'error', 'meta'],
  properties: { data: dataSchema, error: { type: 'null' }, meta: metaSchema || { $ref: '#/components/schemas/Meta' } },
});

const reporte = { sinCaptura: [], authDistinta: [], soloDocumento: [] };
const paths = {};
for (const r of rutas) {
  const key = `${r.method} ${r.path}`;
  const ficha = fichas.get(`${r.method} ${norm(r.path)}`);
  const extra = EXTRA[key] || {};
  const c = capturas.get(key) || { ok: {}, errores: new Map(), bodies: [] };
  const tag = TAGS.find((t) => t.archivo === r.file)?.name;
  const entradas = [...(ficha?.entradas || []), ...(extra.entradas || [])];

  // El documento indica "Bearer", "Pública", "Refresh token", etc.: solo Bearer equivale a sesion.
  if (ficha?.auth && /bearer/i.test(ficha.auth) !== r.auth) {
    reporte.authDistinta.push(`${key}: documento "${ficha.auth}", codigo ${r.auth ? 'con sesion' : 'publico'}`);
  }

  // Parametros de ruta y de query.
  const params = [];
  for (const [, name] of r.path.matchAll(/:([a-zA-Z]+)/g)) {
    const e = entradas.find((x) => x.name === name && x.in === 'path');
    params.push({ name, in: 'path', required: true, schema: { type: 'string' }, ...(e?.desc && { description: e.desc }) });
  }
  const queryNames = new Set([...r.query, ...entradas.filter((x) => x.in === 'query').map((x) => x.name)]);
  if (r.paginated) { queryNames.add('limit'); queryNames.add('cursor'); }
  for (const name of queryNames) {
    const e = entradas.find((x) => x.name === name && x.in === 'query');
    const ignorado = !r.query.includes(name) && !(r.paginated && ['limit', 'cursor'].includes(name));
    if (ignorado) reporte.soloDocumento.push(`${key}: query ${name}`);
    const description = [e?.desc || (name === 'limit' ? 'Tamaño de página (por defecto 20, máximo 100).' : name === 'cursor' ? 'Cursor opaco de la página siguiente (meta.pagination.nextCursor).' : undefined),
      ignorado && NOTAS.soloDocumento].filter(Boolean).join(' ');
    params.push({ name, in: 'query', required: e?.required === 'Sí', schema: e ? schemaFromDoc(e.type, e.desc) : (name === 'limit' ? { type: 'integer' } : { type: 'string' }), ...(description && { description }) });
  }

  // Body.
  let requestBody;
  const bodyNames = [...new Set([...r.body, ...entradas.filter((x) => x.in === 'body').map((x) => x.name)])];
  if (bodyNames.length) {
    const observed = c.bodies.length ? c.bodies.map(infer).reduce(merge) : { properties: {} };
    const properties = {}; const required = [];
    for (const name of bodyNames) {
      const e = entradas.find((x) => x.name === name && x.in === 'body');
      const ignorado = !r.body.includes(name);
      if (ignorado) reporte.soloDocumento.push(`${key}: body ${name}`);
      const description = [e?.desc, ignorado && NOTAS.soloDocumento].filter(Boolean).join(' ');
      properties[name] = { ...(observed.properties?.[name] || (e ? schemaFromDoc(e.type, e.desc) : { type: 'string' })), ...(description && { description }) };
      if (e?.required === 'Sí') required.push(name);
    }
    const example = c.bodies[0] ? scrub(c.bodies[0]) : undefined;
    requestBody = { required: required.length > 0, content: { 'application/json': { schema: { type: 'object', properties, ...(required.length && { required }) }, ...(example && { example }) } } };
  }

  // Respuestas de exito. Si hay respuestas capturadas, mandan sus estados: el
  // analisis estatico no ve un estado explicito como ok(res, data, 202).
  const responses = {};
  const observados = Object.keys(c.ok).map(Number);
  const estados = observados.length ? [...new Set([...observados, ...r.statuses.filter((s) => s === 204)])].sort() : r.statuses;
  for (const status of estados) {
    if (status === 204) { responses[204] = { description: 'Sin contenido.' }; continue; }
    const samples = c.ok[status] || [];
    if (!samples.length) { reporte.sinCaptura.push(`${key} (${status})`); }
    const data = samples.length ? samples.map((s) => infer(s.data)).reduce(merge) : {};
    const meta = samples.length ? samples.map((s) => infer(s.meta)).reduce(merge) : undefined;
    responses[status] = {
      description: { 201: 'Creado.', 202: 'Aceptado: se procesa en segundo plano.' }[status] || 'Correcto.',
      content: { 'application/json': { schema: envelope(data, meta), ...(samples[0] && { example: scrub(samples[0]) }) } },
    };
  }

  // Errores: codigo (fail), middlewares, respuestas capturadas y documento.
  const errores = new Map();
  const addErr = (status, code, message) => { if (code && !errores.has(code)) errores.set(code, { status, message }); };
  r.errors.forEach((e) => addErr(e.status, e.code, e.message));
  if (r.auth) MW.auth.forEach((e) => addErr(e.status, e.code, e.message));
  if (r.premium) MW.premium.forEach((e) => addErr(e.status, e.code, e.message));
  for (const [code, e] of c.errores) addErr(e.status, code, e.message);
  // Errores que solo menciona el documento: el codigo no los tiene ni se observaron.
  for (const e of ficha?.errores || []) {
    if (errores.has(e.code)) continue;
    reporte.soloDocumento.push(`${key}: error ${e.status} ${e.code}`);
    addErr(e.status, e.code, `${e.desc} ${NOTAS.soloDocumento}`);
  }
  const porEstado = {};
  for (const [code, e] of errores) (porEstado[e.status] ||= []).push({ code, ...e });
  for (const [status, list] of Object.entries(porEstado).sort()) {
    responses[status] = {
      description: list.map((e) => `\`${e.code}\`: ${e.message}`).join('\n\n'),
      content: { 'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        examples: Object.fromEntries(list.map((e) => [e.code, { summary: e.code, value: { data: null, error: { code: e.code, message: e.message, details: [], field: null }, meta: { requestId: 'req_0a1b2c3d4e5f', timestamp: '2026-09-30T12:00:00.000Z' } } }])),
      } },
    };
  }
  responses[500] = { $ref: '#/components/responses/Interno' };

  const notas = [r.premium && NOTAS.premium, r.demo && NOTAS.demo, r.webhook && NOTAS.webhook, extra.nota].filter(Boolean);
  const descripcion = [ficha?.descripcion || extra.descripcion, ...notas].filter(Boolean).join('\n\n');
  const operationId = (r.method.toLowerCase() + r.path.replace(/:([a-zA-Z]+)/g, 'By-$1').split(/[/-]/).map((s) => s && s[0].toUpperCase() + s.slice(1)).join('')).replace(/[^a-zA-Z]/g, '');

  const fullPath = r.path === '/health' ? '/health' : `/api/v1${toOpenApiPath(r.path)}`;
  (paths[fullPath] ||= {})[r.method.toLowerCase()] = {
    tags: [tag], operationId, summary: RESUMENES[key] || key,
    ...(descripcion && { description: descripcion }),
    security: r.auth ? [{ bearerAuth: [] }] : [],
    ...(r.premium && { 'x-plan-requerido': 'pago' }),
    ...(r.demo && { 'x-solo-demo-mode': true }),
    ...(r.webhook && { 'x-deshabilitado': true }),
    ...(params.length && { parameters: params }),
    ...(requestBody && { requestBody }),
    responses,
  };
}

const doc = {
  openapi: '3.1.0',
  info: {
    title: 'Aprueba · API del alumno',
    version: JSON.parse(fs.readFileSync(path.resolve(SRC, '../package.json'), 'utf8')).version,
    description: [
      'API REST del sitio web y la app del alumno de Aprueba, plataforma de práctica para la PAES.',
      'Todas las respuestas usan el envelope `{ data, error, meta }`. La autenticación es JWT Bearer: access token de 15 minutos y refresh token de 30 días.',
      'Contrato generado desde el código con `npm run openapi:generar` (rutas, parámetros, errores y respuestas reales capturadas al correr el smoke test), combinado con `Aprueba_API_Backend.docx`. No editar a mano.',
      'Mientras el MVP no tenga pagos ni proveedores de identidad reales, algunos endpoints solo funcionan con `DEMO_MODE=true` (marcados con `x-solo-demo-mode`).',
    ].join('\n\n'),
  },
  servers: [
    // Relativo: "Try it out" usa el mismo dominio que sirve la documentacion (sin CORS).
    { url: '/', description: 'Este servidor' },
    { url: 'https://aprueba-student-web.vercel.app', description: 'Producción (Vercel)' },
    { url: 'http://localhost:4100', description: 'Local' },
  ],
  tags: TAGS.map(({ name, description }) => ({ name, description })),
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Meta: { type: 'object', properties: { requestId: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } }, required: ['requestId', 'timestamp'] },
      Error: {
        type: 'object', required: ['code', 'message'],
        properties: {
          code: { type: 'string', description: 'Identificador estable, legible por máquina.' },
          message: { type: 'string', description: 'Texto en español listo para mostrar.' },
          details: { type: 'array', items: {}, description: 'Errores de validación por campo.' },
          field: { type: ['string', 'null'], description: 'Campo conflictivo en errores de validación.' },
        },
      },
      ErrorEnvelope: {
        type: 'object', required: ['data', 'error', 'meta'],
        properties: { data: { type: 'null' }, error: { $ref: '#/components/schemas/Error' }, meta: { $ref: '#/components/schemas/Meta' } },
      },
    },
    responses: {
      Interno: {
        description: '`INTERNAL`: error inesperado del servidor.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
    },
  },
};

fs.writeFileSync(path.join(DIR, 'openapi.json'), `${JSON.stringify(doc, null, 2)}\n`);
const ops = Object.values(doc.paths).reduce((n, o) => n + Object.keys(o).length, 0);
console.log(`[openapi] ${ops} operaciones en ${Object.keys(doc.paths).length} rutas -> src/docs/openapi.json`);
if (reporte.sinCaptura.length) console.log(`[openapi] sin respuesta capturada (esquema vacio): ${reporte.sinCaptura.join(', ')}`);
if (reporte.authDistinta.length) console.log(`[openapi] sesion distinta entre documento y codigo:\n  ${reporte.authDistinta.join('\n  ')}`);
if (reporte.soloDocumento.length) console.log(`[openapi] ${reporte.soloDocumento.length} elementos del documento que el codigo no implementa (marcados en la especificacion):\n  ${reporte.soloDocumento.join('\n  ')}`);
realExit(0);
