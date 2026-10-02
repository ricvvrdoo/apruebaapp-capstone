// Verifica src/docs/openapi.json contra el codigo:
//
//   npm run openapi:verificar
//
// 1. Es un documento OpenAPI 3.1 valido.
// 2. Cada ruta de Express esta documentada, y cada operacion documentada existe.
// 3. Cada operacion tiene resumen, grupo y respuesta de exito con esquema, y
//    las que exigen sesion documentan el 401.
// Falla (codigo 1) ante cualquier diferencia: si se agrega un endpoint sin
// regenerar la documentacion, esta verificacion lo detecta.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import parser from '@readme/openapi-parser';

process.env.VERCEL = '1'; // importar la app sin abrir un puerto
const DIR = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'openapi.json'), 'utf8'));
const problemas = [];

try {
  await parser.validate(structuredClone(spec));
} catch (e) {
  problemas.push(`especificacion invalida: ${e.message}`);
}

// Rutas registradas en Express.
const { default: app } = await import('../index.js');
const codigo = new Set();
for (const layer of app._router.stack) {
  if (layer.route) { for (const m of Object.keys(layer.route.methods)) codigo.add(`${m.toUpperCase()} ${layer.route.path}`); continue; }
  if (layer.name !== 'router') continue;
  const base = /api\\\/v1/.test(layer.regexp.toString()) ? '/api/v1' : '';
  for (const sub of layer.handle.stack) {
    const routes = sub.route ? [sub] : (sub.name === 'router' ? sub.handle.stack.filter((l) => l.route) : []);
    for (const l of routes) for (const m of Object.keys(l.route.methods)) codigo.add(`${m.toUpperCase()} ${base}${l.route.path}`);
  }
}
const aOpenApi = (k) => k.replace(/:([a-zA-Z]+)/g, '{$1}');
const rutasCodigo = new Set([...codigo].map(aOpenApi).filter((k) => !/ \/api\/(docs|v1\/openapi\.json)/.test(k)));

const documentadas = new Set();
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    const key = `${method.toUpperCase()} ${p}`;
    documentadas.add(key);
    if (!op.summary || op.summary === key) problemas.push(`${key}: sin resumen`);
    if (!op.tags?.length) problemas.push(`${key}: sin grupo`);
    const exito = Object.entries(op.responses).filter(([s]) => s < 300);
    if (!exito.length && !op['x-deshabilitado']) problemas.push(`${key}: sin respuesta de exito`);
    for (const [s, r] of exito) {
      if (s !== '204' && !Object.keys(r.content?.['application/json']?.schema?.properties?.data || {}).length) problemas.push(`${key}: respuesta ${s} sin esquema`);
    }
    if (op.security?.length && !op.responses['401']) problemas.push(`${key}: exige sesion pero no documenta 401`);
  }
}
for (const k of rutasCodigo) if (!documentadas.has(k)) problemas.push(`${k}: existe en el codigo pero no esta documentada`);
for (const k of documentadas) if (!rutasCodigo.has(k)) problemas.push(`${k}: esta documentada pero no existe en el codigo`);

if (problemas.length) {
  console.error(`[openapi] ${problemas.length} problemas:\n  ${problemas.join('\n  ')}`);
  console.error('[openapi] Regenera con: npm run openapi:generar');
  process.exit(1);
}
console.log(`[openapi] OK: OpenAPI ${spec.openapi} valido, ${documentadas.size} operaciones documentadas = ${rutasCodigo.size} rutas del codigo.`);
process.exit(0);
