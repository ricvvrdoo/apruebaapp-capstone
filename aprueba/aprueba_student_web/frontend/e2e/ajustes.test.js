// Pruebas de navegador de Ajustes: secciones que se abren y cierran en la misma vista
// ("Ajustes", "Mis datos y privacidad") y eliminar la cuenta.
// Requisitos y forma de correrlas: ver el encabezado de home.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
  const email = `ajustes${Date.now()}${++seq}@x.cl`;
  const reg = await call('POST', '/auth/register', null, { name: 'Alumno Ajustes', email, password: 'clave1234', consent: true, country: 'CL', language: 'es', gradeId: 'cl-paes' });
  assert.equal(reg.status, 201, `no se pudo registrar (¿PHONE_VERIFICATION_REQUIRED=false?): ${JSON.stringify(reg.json?.error)}`);
  const token = reg.json.data.accessToken;
  await call('PUT', '/me/preferences', token, { selectedTests: ['m1'], country: 'CL', gradeId: 'cl-paes' });
  return { email, password: 'clave1234', token };
}

async function open({ email, password }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Santiago' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${WEB}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('form .btn.full').click();
  await page.waitForURL(`${WEB}/`, { timeout: 10000 });
  await page.goto(`${WEB}/ajustes`);
  contexts.push(ctx);
  return { page, errors };
}

const section = (page, name) => page.getByRole('button', { name, exact: false }).first();

before(async () => {
  assert.ok(await fetch(`${WEB}/`).then((r) => r.ok).catch(() => false), `la web no responde en ${WEB}: levantala con "npm run dev"`);
  assert.ok(await fetch(`${API}/plans`).then((r) => r.ok).catch(() => false), 'la API no responde: levantala con "npm run dev" en backend/');
  browser = await chromium.launch({ channel: CHANNEL, headless: true });
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
});

test('Mis datos y privacidad se abre y se cierra en la misma vista, mostrando los datos reales', async () => {
  const s = await newStudent();
  const { page, errors } = await open(s);
  const header = section(page, 'Mis datos y privacidad');
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByText('Si eliminas tu cuenta').count(), 0, 'cerrada: no debe mostrar el contenido');

  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  assert.equal(page.url(), `${WEB}/ajustes`, 'no debe navegar a otra pantalla');
  const panel = page.locator(`#${await header.getAttribute('aria-controls')}`);
  await panel.getByText('Alumno Ajustes').waitFor();
  // El país y el grado se resuelven con el catálogo, un poco después del perfil.
  await panel.getByText('Chile').waitFor();
  await panel.getByText('PAES').waitFor();
  const text = await panel.innerText();
  const fila = (etiqueta, valor) => assert.ok(new RegExp(`${etiqueta}\\s*${valor}`).test(text), `${etiqueta}: ${valor} en ${text}`);
  fila('Nombre', 'Alumno Ajustes');
  fila('Correo', s.email.replace('.', '\\.'));
  fila('País', 'Chile');
  fila('Grado', 'PAES');
  fila('Colegio', 'No indicado');
  fila('Idioma', 'Español');
  fila('Plan', 'Gratis');
  assert.match(text, /Si eliminas tu cuenta/);
  assert.match(text, /Las boletas se conservan sin vincularse a ti/);
  assert.doesNotMatch(await page.locator('body').innerText(), /Descargar/);

  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByText('Alumno Ajustes').count() > 0 ? await panel.count() : 0, 0, 'cerrada: el contenido se quita');
  assert.deepEqual(errors, []);
});

test('Ajustes agrupa tema, idioma, recordatorio, pruebas y plan, y se abre y se cierra igual que la otra sección', async () => {
  const { page, errors } = await open(await newStudent());
  const header = section(page, 'Ajustes');
  assert.equal(await header.getAttribute('aria-expanded'), 'true', 'Ajustes arranca abierta');
  const panel = page.locator('#' + await header.getAttribute('aria-controls'));
  const text = await panel.innerText();
  for (const t of ['Modo oscuro', 'Idioma', 'Recordatorio diario', 'Mis pruebas', 'Mi plan']) assert.ok(text.includes(t), t + ' en ' + text);
  await panel.getByText('Comp. Lectora').waitFor();
  await panel.getByText('Comp. Lectora').click();
  await page.getByText('Cambios guardados').waitFor();
  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByText('Modo oscuro').count(), 0, 'cerrada: el contenido se quita');
  assert.equal(page.url(), WEB + '/ajustes');
  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  await page.getByText('Modo oscuro').waitFor();
  assert.deepEqual(errors, []);
});

test('se puede navegar con el teclado: Enter abre y cierra la sección', async () => {
  const { page } = await open(await newStudent());
  const header = section(page, 'Mis datos y privacidad');
  await header.focus();
  await page.keyboard.press('Enter');
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Enter');
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
});

test('Mi plan sigue llevando a su pantalla', async () => {
  const { page } = await open(await newStudent());
  await page.getByText('Mi plan').first().click();
  await page.waitForURL(`${WEB}/plan`);
});

test('la pantalla separada /privacidad ya no existe: vuelve al inicio', async () => {
  const { page } = await open(await newStudent());
  await page.goto(`${WEB}/privacidad`);
  await page.waitForURL(`${WEB}/`);
});

test('eliminar la cuenta: pide la contraseña y la cuenta deja de existir', async () => {
  const s = await newStudent();
  const { page } = await open(s);
  await page.getByRole('button', { name: 'Eliminar cuenta' }).click();
  await page.locator('input[type=password]').fill('clave-equivocada');
  await page.locator('.btn', { hasText: 'Eliminar cuenta' }).last().click();
  assert.equal((await call('POST', '/auth/login', null, { email: s.email, password: s.password })).status, 200, 'con la contraseña incorrecta no debe borrarse');
  await page.locator('input[type=password]').fill(s.password);
  await page.locator('.btn', { hasText: 'Eliminar cuenta' }).last().click();
  await page.waitForURL(`${WEB}/login`);
  assert.equal((await call('POST', '/auth/login', null, { email: s.email, password: s.password })).status, 401);
});

test('en inglés las secciones y sus datos también están traducidos', async () => {
  const s = await newStudent();
  await call('PATCH', '/me/settings', s.token, { locale: 'en' });
  const { page } = await open(s);
  const header = section(page, 'My data & privacy');
  await header.click();
  const panel = page.locator(`#${await header.getAttribute('aria-controls')}`);
  await panel.getByText('Chile').waitFor();
  const text = await panel.innerText();
  assert.match(text, /Name\s*Alumno Ajustes/);
  assert.match(text, /Country\s*Chile/);
  assert.match(text, /If you delete your account/);
  assert.doesNotMatch(await page.locator('body').innerText(), /priv_|set_/);
});
