// Pruebas de navegador de la pantalla de Inicio (y del buscador de la barra superior).
//
// Requisitos, con la API y la web levantadas en local:
//   API:  cd ../backend && npm run seed:ejemplo && npm run dev
//         (en backend/.env: PHONE_VERIFICATION_REQUIRED=false, para registrar alumnos sin telefono)
//   Web:  npm run dev          (http://localhost:5174, con proxy a la API en el 4100)
//   Test: npm run test:e2e
//
// Usan el Edge o el Chrome instalados (no descargan navegadores): E2E_BROWSER=msedge|chrome.
// Los usuarios demo (demo@, camila@) solo se leen; lo que modifica datos usa alumnos nuevos.
// Conviene resembrar antes de cada corrida (`npm run seed:ejemplo` con la API detenida): los
// valores del demo (70 %, 55 %, 15 bronces) son los del seed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const WEB = process.env.E2E_WEB || 'http://localhost:5174';
const API = `${WEB}/api/v1`;
const CHANNEL = process.env.E2E_BROWSER || 'msedge';

let browser;
const pages = [];

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function apiLogin(email, password = 'demo1234') {
  return (await call('POST', '/auth/login', null, { email, password })).json.data.accessToken;
}

let seq = 0;
async function newStudent(tests = ['m1']) {
  const email = `e2e${Date.now()}${++seq}@x.cl`;
  const reg = await call('POST', '/auth/register', null, { name: 'Alumno E2E', email, password: 'clave1234', consent: true, country: 'CL', language: 'es', gradeId: 'cl-paes' });
  assert.equal(reg.status, 201, `no se pudo registrar (¿PHONE_VERIFICATION_REQUIRED=false?): ${JSON.stringify(reg.json?.error)}`);
  const token = reg.json.data.accessToken;
  await call('PUT', '/me/preferences', token, { selectedTests: tests, country: 'CL', gradeId: 'cl-paes' });
  return { email, password: 'clave1234', token };
}

async function answerQuestions(token, testId, n, tag) {
  for (let i = 0; i < n; i++) {
    const q = await call('GET', `/practice/next?testId=${testId}`, token);
    await call('POST', `/questions/${q.json.data.id}/answer`, token, { selected: 'A', elapsedMs: 6000, sessionId: `${tag}-${i}` });
  }
}

async function open({ email, password = 'demo1234', width = 1280, height = 900, timezoneId = 'America/Santiago', routes } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId });
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
  pages.push(ctx);
  return { page, ctx, errors };
}

const home = async (opts) => {
  const s = await open(opts);
  await s.page.waitForSelector('.hero', { timeout: 10000 });
  return s;
};
const card = (page, re) => page.locator('.card', { hasText: re }).first();
const fail500 = { status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { code: 'INTERNAL', message: 'x', details: [], field: null }, meta: {} }) };

before(async () => {
  const up = await fetch(`${WEB}/`).then((r) => r.ok).catch(() => false);
  assert.ok(up, `la web no responde en ${WEB}: levantala con "npm run dev"`);
  assert.ok(await fetch(`${API}/plans`).then((r) => r.ok).catch(() => false), 'la API no responde: levantala con "npm run dev" en backend/');
  browser = await chromium.launch({ channel: CHANNEL, headless: true });
  // Los usuarios demo se prueban en espanol, sin importar con que idioma se hayan usado antes.
  for (const email of ['demo@aprueba.cl', 'camila@correo.cl']) await call('PATCH', '/me/settings', await apiLogin(email), { locale: 'es' });
});

after(async () => {
  for (const c of pages) await c.close().catch(() => {});
  await browser?.close();
});

test('alumno nuevo: sin datos, sin racha y con una sola accion principal', async () => {
  const s = await newStudent(['m1', 'lectora']);
  const { page, errors } = await home(s);
  const progress = await card(page, /Progreso por prueba/).innerText();
  assert.equal((progress.match(/Sin datos aún/g) || []).length, 2, progress);
  assert.match(progress, /Responde 5 preguntas más/);
  assert.doesNotMatch(progress, /\b0%/);
  const streak = await card(page, /Racha/).innerText();
  assert.match(streak, /0\s*días/);
  assert.match(streak, /Responde una pregunta hoy para empezar tu racha/);
  assert.equal(await page.getByRole('button', { name: /Empezar a practicar/ }).count(), 1, 'debe haber un solo boton principal');
  assert.match(await card(page, /Empieza a practicar/).innerText(), /Responde tu primera pregunta/);
  assert.match(await card(page, /Cuota diaria/).innerText(), /Te quedan 10 hoy · se reinicia en/);
  assert.match(await card(page, /Tus medallas/).innerText(), /Te faltan 3 medallas de bronce/);
  assert.deepEqual(errors, []);
});

test('alumno nuevo: tras practicar muestra progreso, racha y retoma la ultima prueba', async () => {
  const s = await newStudent(['m1']);
  await answerQuestions(s.token, 'm1', 5, 'practica');
  const { page } = await home(s);
  assert.match(await card(page, /Progreso por prueba/).innerText(), /\d+%/);
  const streak = await card(page, /Racha/).innerText();
  assert.match(streak, /1\s*día/);
  assert.match(streak, /Hoy ya practicaste/);
  const cont = await card(page, /Continuar practicando/).innerText();
  assert.match(cont, /Seguir con Matem[aá]tica M1/);
  assert.match(cont, /Te quedan 5 preguntas hoy/);
  await page.getByRole('button', { name: /Seguir con/ }).click();
  await page.waitForURL(/\/practicar\?testId=m1/);
  assert.match(await page.locator('.tag').first().innerText({ timeout: 8000 }), /M1/i);
});

test('usuario con historial (demo): progreso real, canjes de medallas y banner con precio', async () => {
  const { page } = await home({ email: 'demo@aprueba.cl' });
  const progress = await card(page, /Progreso por prueba/).innerText();
  assert.match(progress, /70%/);
  assert.match(progress, /55%/);
  assert.doesNotMatch(progress, /68%|54%/, 'ya no deben verse los porcentajes de ejemplo');
  const medals = await card(page, /Tus medallas/).innerText();
  assert.match(medals, /Puedes hacer 3 canjes/);
  assert.doesNotMatch(medals, /0\/5/);
  assert.match(await card(page, /Desbloquea preguntas ilimitadas/).innerText(), /desde US\$1\/mes/);
  await page.getByRole('button', { name: /Ir a canjear/ }).click();
  await page.waitForURL(/\/medallas/);
});

test('plan de pago (camila): muestra su actividad en lugar de la cuota y no ofrece mejorar el plan', async () => {
  const { page } = await home({ email: 'camila@correo.cl' });
  const activity = await card(page, /Tu actividad/).innerText();
  assert.match(activity, /Respondidas hoy/);
  assert.match(activity, /Últimos 7 días/);
  assert.equal(await page.locator('.upgrade').count(), 0);
  assert.equal(await page.getByText(/Cuota diaria/).count(), 0);
});

test('la zona horaria del navegador se envia al servidor', async () => {
  const s = await newStudent();
  assert.equal((await call('GET', '/me', s.token)).json.data.timezone, 'America/Santiago');
  await home({ ...s, timezoneId: 'Europe/London' });
  assert.equal((await call('GET', '/me', s.token)).json.data.timezone, 'Europe/London');
});

test('mientras carga se ve un esqueleto accesible', async () => {
  const s = await newStudent();
  const { page } = await open({
    ...s,
    routes: (p) => p.route('**/api/v1/me/progress', async (route) => { await new Promise((r) => setTimeout(r, 1200)); route.continue(); }),
  });
  await page.waitForSelector('[role=status][aria-busy=true]', { timeout: 4000 });
  assert.equal(await page.locator('.hero').count(), 0);
  await page.waitForSelector('.hero', { timeout: 8000 });
  assert.equal(await page.locator('[aria-busy=true]').count(), 0);
});

test('si fallan las medallas, solo esa tarjeta muestra el error y se puede reintentar', async () => {
  const s = await newStudent();
  let fail = true;
  const { page } = await home({ ...s, routes: (p) => p.route('**/api/v1/me/medals', (route) => (fail ? route.fulfill(fail500) : route.continue())) });
  const medals = card(page, /Tus medallas/);
  assert.equal(await medals.locator('[role=alert]').count(), 1);
  assert.ok((await page.getByText(/Cuota diaria/).count()) >= 1, 'el resto de Inicio debe seguir funcionando');
  fail = false;
  await medals.getByRole('button', { name: /Reintentar/ }).click();
  await page.waitForSelector('[role=group]', { timeout: 6000 });
  assert.equal(await page.locator('[role=group]').count(), 5);
});

test('si falla el progreso, solo esa tarjeta muestra el error', async () => {
  const s = await newStudent();
  const { page } = await home({ ...s, routes: (p) => p.route('**/api/v1/me/progress', (route) => route.fulfill(fail500)) });
  const progress = page.locator('.card.span3', { hasText: /Progreso por prueba/ }).first();
  assert.equal(await progress.locator('[role=alert]').count(), 1);
  assert.equal(await page.locator('[role=group]').count(), 5, 'las medallas siguen visibles');
});

test('diseno: sin emojis, iconos ocultos a lectores, barras con nombre y "Ver todo" con teclado', async () => {
  const { page } = await home(await newStudent());
  const emojis = await page.locator('.content').evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.medal-coin').forEach((n) => n.remove());
    return c.innerText.match(/\p{Extended_Pictographic}/gu) || [];
  });
  assert.deepEqual(emojis, []);
  assert.ok((await page.locator('.hero svg[aria-hidden=true]').count()) >= 1);
  const bars = await page.$$eval('[role=progressbar]', (els) => els.map((e) => [e.getAttribute('aria-label'), e.getAttribute('aria-valuenow')]));
  assert.ok(bars.length >= 3 && bars.every(([name, now]) => name && now !== null), JSON.stringify(bars));
  const viewAll = page.getByRole('button', { name: /Ver todo/ });
  await viewAll.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medallas/);
});

test('celular (390 px): sin desborde horizontal y la accion principal va primero', async () => {
  const { page } = await home({ ...(await newStudent()), width: 390, height: 844 });
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'hay desborde horizontal');
  const order = await page.locator('.dash > .card').evaluateAll((els) => els.map((e) => (e.classList.contains('hero') ? 'hero' : e.classList.contains('stat') ? 'racha' : 'otra')));
  assert.deepEqual(order.slice(0, 2), ['hero', 'racha']);
});

test('el buscador de la barra superior solo aparece en Inicio y Grupos', async () => {
  const { page } = await home(await newStudent());
  const box = page.locator('input[role=combobox]');
  const expected = { '/': 1, '/grupos': 1, '/practicar': 0, '/medallas': 0, '/comunidad': 0, '/plan': 0, '/ajustes': 0 };
  for (const [route, count] of Object.entries(expected)) {
    await page.goto(`${WEB}${route}`);
    await page.waitForSelector('.topbar');
    assert.equal(await box.count(), count, `buscador en ${route}`);
  }
});
