// Pruebas de navegador de "Mis datos y privacidad" (descargar los datos y eliminar la cuenta).
// Requisitos y forma de correrlas: ver el encabezado de home.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const WEB = process.env.E2E_WEB || 'http://localhost:5174';
const API = `${WEB}/api/v1`;
const CHANNEL = process.env.E2E_BROWSER || 'msedge';

let browser;
const contexts = [];

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

let seq = 0;
async function newStudent() {
  const email = `priv${Date.now()}${++seq}@x.cl`;
  const reg = await call('POST', '/auth/register', null, { name: 'Alumno Privacidad', email, password: 'clave1234', consent: true, country: 'CL', language: 'es', gradeId: 'cl-paes' });
  assert.equal(reg.status, 201, `no se pudo registrar (¿PHONE_VERIFICATION_REQUIRED=false?): ${JSON.stringify(reg.json?.error)}`);
  const token = reg.json.data.accessToken;
  await call('PUT', '/me/preferences', token, { selectedTests: ['m1'], country: 'CL', gradeId: 'cl-paes' });
  const q = await call('GET', '/practice/next?testId=m1', token);
  await call('POST', `/questions/${q.json.data.id}/answer`, token, { selected: 'A', elapsedMs: 6000, sessionId: 'priv-e2e' });
  await call('POST', '/posts', token, { text: 'Publicación de prueba' });
  return { email, password: 'clave1234', token };
}

async function open({ email, password, routes }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Santiago', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (routes) await routes(page);
  await page.goto(`${WEB}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('form .btn.full').click();
  await page.waitForURL(`${WEB}/`, { timeout: 10000 });
  contexts.push(ctx);
  return { page, errors };
}

before(async () => {
  assert.ok(await fetch(`${WEB}/`).then((r) => r.ok).catch(() => false), `la web no responde en ${WEB}: levantala con "npm run dev"`);
  assert.ok(await fetch(`${API}/plans`).then((r) => r.ok).catch(() => false), 'la API no responde: levantala con "npm run dev" en backend/');
  browser = await chromium.launch({ channel: CHANNEL, headless: true });
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
});

test('muestra los datos reales del alumno, la descarga y lo que pasa al eliminar', async () => {
  const s = await newStudent();
  const { page, errors } = await open(s);
  await page.goto(`${WEB}/ajustes`);
  await page.getByText('Mis datos y privacidad').click();
  await page.waitForURL(`${WEB}/privacidad`);
  const datos = page.locator('.card', { hasText: 'Tus datos' }).first();
  await datos.getByText('Alumno Privacidad').waitFor();
  // El país y el grado se resuelven con el catálogo, un poco después del perfil.
  await datos.getByText('Chile').waitFor();
  await datos.getByText('PAES').waitFor();
  const text = await datos.innerText();
  const fila = (etiqueta, valor) => assert.ok(text.includes(etiqueta) && new RegExp(`${etiqueta}\\s*${valor}`).test(text), `${etiqueta}: ${valor} en ${text}`);
  fila('Nombre', 'Alumno Privacidad');
  fila('Correo', s.email.replace('.', '\\.'));
  fila('País', 'Chile');
  fila('Grado', 'PAES');
  fila('Colegio', 'No indicado');
  fila('Idioma', 'Español');
  fila('Plan', 'Gratis');
  const todo = await page.locator('body').innerText();
  assert.match(todo, /Descargar mis datos/);
  assert.match(todo, /Si eliminas tu cuenta/);
  assert.match(todo, /Las boletas se conservan sin vincularse a ti/);
  assert.doesNotMatch(todo, /Qué guardamos/);
  assert.deepEqual(errors, []);
});

test('descargar entrega un .json con los datos del alumno y sin su contraseña', async () => {
  const s = await newStudent();
  const { page, errors } = await open(s);
  await page.goto(`${WEB}/privacidad`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar archivo/ }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^aprueba-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  const raw = fs.readFileSync(await download.path(), 'utf8');
  const data = JSON.parse(raw);
  assert.equal(data.profile.email, s.email);
  assert.equal(data.answers.length, 1);
  assert.equal(data.posts[0].text, 'Publicación de prueba');
  assert.doesNotMatch(raw, /passwordHash|clave1234/);
  await page.getByText('Archivo descargado').waitFor();
  assert.equal(await page.getByRole('button', { name: /Descargar archivo/ }).isEnabled(), true);
  assert.deepEqual(errors, []);
});

test('si el servidor falla avisa y el botón vuelve a quedar disponible', async () => {
  const { page } = await open({
    ...(await newStudent()),
    routes: (p) => p.route('**/me/data-export', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { code: 'INTERNAL', message: 'No se pudo preparar el archivo', details: [], field: null }, meta: {} }) })),
  });
  await page.goto(`${WEB}/privacidad`);
  await page.getByRole('button', { name: /Descargar archivo/ }).click();
  await page.getByText('No se pudo preparar el archivo').waitFor();
  assert.equal(await page.getByRole('button', { name: /Descargar archivo/ }).isEnabled(), true);
});

test('eliminar la cuenta desde la pantalla: pide la contraseña y la cuenta deja de existir', async () => {
  const s = await newStudent();
  const { page } = await open(s);
  await page.goto(`${WEB}/privacidad`);
  await page.getByRole('button', { name: /Ir a eliminar mi cuenta/ }).click();
  await page.waitForURL(`${WEB}/ajustes`);
  await page.getByRole('button', { name: 'Eliminar cuenta' }).click();
  await page.locator('input[type=password]').fill('clave-equivocada');
  await page.locator('.btn', { hasText: 'Eliminar cuenta' }).last().click();
  assert.equal((await call('POST', '/auth/login', null, { email: s.email, password: s.password })).status, 200, 'con la contraseña incorrecta no debe borrarse');
  await page.locator('input[type=password]').fill(s.password);
  await page.locator('.btn', { hasText: 'Eliminar cuenta' }).last().click();
  await page.waitForURL(`${WEB}/login`);
  assert.equal((await call('POST', '/auth/login', null, { email: s.email, password: s.password })).status, 401);
});

test('en inglés la pantalla también está traducida', async () => {
  const s = await newStudent();
  await call('PATCH', '/me/settings', s.token, { locale: 'en' });
  const { page } = await open(s);
  await page.goto(`${WEB}/privacidad`);
  await page.getByText('Download my data').first().waitFor();
  await page.getByText('Chile').first().waitFor();
  const text = await page.locator('body').innerText();
  assert.match(text, /Your data/);
  assert.match(text, /Name\s*Alumno Privacidad/);
  assert.match(text, /Country\s*Chile/);
  assert.match(text, /If you delete your account/);
  assert.doesNotMatch(text, /priv_/);
});
