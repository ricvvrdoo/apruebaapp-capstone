// Smoke test de los endpoints del API del alumno, con foco en los agregados
// para el wireframe Aprueba_App.html (telefono, catalogo pais/grado, tutores,
// chat, analisis de falencias y huecos menores).
//
//   npm run seed && npm run smoke
//
// Requiere la base sembrada: el script muta datos (sale de un grupo, publica
// resenas), asi que hay que resembrar antes de cada corrida.
process.env.PHONE_AUTH_ALLOW_DEV_TOKEN = 'true';
process.env.PHONE_VERIFICATION_REQUIRED = 'true';
// Los flujos demo (login social, activar planes) se prueban con DEMO_MODE; la
// seccion [12] lo apaga temporalmente para probar el comportamiento sin el.
process.env.DEMO_MODE = 'true';
process.env.PORT = process.env.SMOKE_PORT || '4199';
await import('../index.js');
const BASE = `http://127.0.0.1:${process.env.PORT}/api/v1`;
await new Promise((r) => setTimeout(r, 400));

let pass = 0, failCount = 0;
const results = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function check(label, cond, extra = '') {
  if (cond) { pass++; results.push(`  ok   ${label}`); }
  else { failCount++; results.push(`  FAIL ${label} ${extra}`); }
}

async function expect(label, method, path, opts, expectedStatus, validate) {
  const { status, json } = await call(method, path, opts);
  const statusOk = status === expectedStatus;
  const dataOk = statusOk && (!validate || validate(json?.data, json?.meta, json));
  check(`${method} ${path} -> ${expectedStatus} ${label}`, statusOk && dataOk,
    statusOk ? `(validacion fallida: ${String(JSON.stringify(json?.data)).slice(0, 220)})` : `(recibido ${status} ${String(JSON.stringify(json?.error)).slice(0, 160)})`);
  return json?.data;
}

const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: 'demo1234' } })).json.data.accessToken;

// ── Tokens: demo = plan free, camila = plan all (premium) ──
const free = await login('demo@aprueba.cl');
const premium = await login('camila@correo.cl');

results.push('\n[1] Verificacion telefonica (Firebase)');
await expect('detecta pais/idioma', 'POST', '/auth/phone/send-code', { body: { phone: '+44 7700 900123' } }, 200,
  (d) => d.detectedCountry === 'UK' && d.detectedLanguage === 'en' && d.verifier === 'firebase');
await expect('rechaza formato', 'POST', '/auth/phone/send-code', { body: { phone: '123' } }, 400);
await expect('pais no soportado', 'POST', '/auth/phone/send-code', { body: { phone: '+34600000000' } }, 422);
await expect('cuenta existente', 'POST', '/auth/phone/send-code', { body: { phone: '+56912345678' } }, 200,
  (d) => d.accountExists === true);
const verified = await expect('emite phoneToken', 'POST', '/auth/phone/verify-code',
  { body: { firebaseIdToken: 'dev:+56999888777' } }, 200,
  (d) => typeof d.phoneToken === 'string' && d.country === 'CL' && d.accountExists === false);
// Con firebase-admin instalado devuelve 401 PHONE_TOKEN_INVALID; sin el paquete,
// 503 PHONE_AUTH_UNAVAILABLE (el backend no puede validar tokens reales).
{
  const { status, json } = await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: 'basura' } });
  check('POST /auth/phone/verify-code rechaza token real invalido',
    (status === 401 && json.error.code === 'PHONE_TOKEN_INVALID')
    || (status === 503 && json.error.code === 'PHONE_AUTH_UNAVAILABLE'),
    `(recibido ${status} ${json?.error?.code})`);
}
await expect('phone/mismatch', 'POST', '/auth/phone/verify-code',
  { body: { firebaseIdToken: 'dev:+56999888777', phone: '+56911111111' } }, 409);

results.push('\n[2] Registro con telefono verificado');
await expect('exige phoneToken', 'POST', '/auth/register',
  { body: { name: 'Sin Fono', email: `nofono${Date.now()}@x.cl`, password: 'clave1234', consent: true } }, 400);
const reg = await expect('crea cuenta', 'POST', '/auth/register', {
  body: {
    name: 'Nueva Alumna', email: `nueva${Date.now()}@x.cl`, password: 'clave1234', consent: true,
    phoneToken: verified.phoneToken, country: 'CL', language: 'es', gradeId: 'cl-media-3',
  },
}, 201, (d) => d.user.phoneVerified === true && d.user.phone === '+56999888777' && d.user.gradeId === 'cl-media-3');
await expect('telefono duplicado', 'POST', '/auth/register', {
  body: { name: 'Otra', email: `otra${Date.now()}@x.cl`, password: 'clave1234', consent: true, phoneToken: verified.phoneToken },
}, 409);
const socialPhone = (await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: 'dev:+56977766655' } })).json.data;
await expect('social pide telefono', 'POST', '/auth/social',
  { body: { provider: 'google', idToken: `google:social${Date.now()}@x.cl:Social User` } }, 200,
  (d) => d.phoneVerificationRequired === true);
await expect('PATCH /me/phone asocia', 'PATCH', '/me/phone',
  { token: reg.accessToken, body: { phoneToken: socialPhone.phoneToken } }, 200,
  (d) => d.phone === '+56977766655' && d.phoneVerified === true);
await expect('phoneToken invalido', 'PATCH', '/me/phone', { token: reg.accessToken, body: { phoneToken: 'xx' } }, 401);

results.push('\n[3] Catalogo pais / grado / asignaturas');
await expect('paises', 'GET', '/countries', {}, 200, (d) => d.length === 2 && d[0].dialCode === '+56');
await expect('grados CL', 'GET', '/countries/CL/grades', {}, 200,
  (d) => d.length === 3 && d[0].items.length === 8 && d[2].items[0].id === 'cl-paes');
await expect('grados UK en ingles', 'GET', '/countries/UK/grades?lang=en', {}, 200,
  (d) => d.length === 4 && d.at(-1).items.some((x) => x.id === 'uk-a-levels'));
await expect('pais inexistente', 'GET', '/countries/FR/grades', {}, 404);
await expect('asignaturas escolares CL', 'GET', '/tests?gradeId=cl-media-2', { token: free }, 200,
  (d) => d.length === 4 && d.some((x) => x.id === 'language') && d.every((x) => x.hasQuestions === false));
await expect('asignaturas PAES', 'GET', '/tests?gradeId=cl-paes', { token: free }, 200,
  (d) => d.length === 5 && d.every((x) => x.hasQuestions === true));
await expect('asignaturas UK exam en ingles', 'GET', '/tests?gradeId=uk-a-levels&lang=en', { token: free }, 200,
  (d) => d.some((x) => x.id === 'eng-lit'));
await expect('grado inexistente', 'GET', '/tests?gradeId=zz-999', { token: free }, 404);

results.push('\n[4] Preferencias con pais/idioma/grado');
await expect('guarda onboarding', 'PUT', '/me/preferences',
  { token: free, body: { country: 'CL', language: 'es', gradeId: 'cl-paes', selectedTests: ['lectora', 'm1'] } }, 200,
  (d) => d.gradeId === 'cl-paes' && d.country === 'CL' && d.onboarded === true && d.format === 'random');
await expect('grado invalido', 'PUT', '/me/preferences',
  { token: free, body: { gradeId: 'no-existe', selectedTests: ['m1'] } }, 400);
await expect('grado de otro pais', 'PUT', '/me/preferences',
  { token: free, body: { country: 'UK', gradeId: 'cl-paes', selectedTests: ['m1'] } }, 422);
await expect('lee preferencias', 'GET', '/me/preferences', { token: free }, 200, (d) => d.gradeId === 'cl-paes');
await expect('/me expone telefono y grado', 'GET', '/me', { token: free }, 200,
  (d) => d.phone === '+56912345678' && d.gradeId === 'cl-paes' && d.country === 'CL');

results.push('\n[5] Tutores');
const tutorList = await expect('listado', 'GET', '/tutors', { token: free }, 200,
  (d, m) => d.length === 4 && d[0].rating >= d[1].rating && m.premium.contactTutors === false);
await expect('destacados', 'GET', '/tutors/featured', { token: free }, 200, (d) => d.length === 4);
await expect('filtro por asignatura', 'GET', '/tutors?subject=m1', { token: free }, 200,
  (d) => d.length === 1 && d[0].name === 'Maria Valdes');
await expect('filtro verificados', 'GET', '/tutors?verified=true', { token: free }, 200, (d) => d.length === 3);
await expect('busqueda por texto', 'GET', '/tutors?q=paula', { token: free }, 200, (d) => d.length === 1);
await expect('orden por precio', 'GET', '/tutors?sort=price_asc', { token: free }, 200,
  (d) => d[0].pricePerHour === 9500);
await expect('mode invalido', 'GET', '/tutors?mode=telepatia', { token: free }, 400);
const maria = tutorList.find((t) => t.name === 'Maria Valdes');
await expect('perfil', 'GET', `/tutors/${maria.id}`, { token: premium }, 200,
  (d) => d.bio && d.ratingByCriterion.length === 3 && d.reviewCount === 130);
await expect('perfil inexistente', 'GET', '/tutors/tut_nope', { token: free }, 404);
await expect('resenas', 'GET', `/tutors/${maria.id}/reviews`, { token: free }, 200,
  (d, m) => d.length === 2 && m.summary.byCriterion.length === 3 && m.summary.overall > 4);

results.push('\n[6] Gating premium');
await expect('contacto bloqueado en free', 'POST', `/tutors/${maria.id}/contact-requests`,
  { token: free, body: { message: 'Hola' } }, 403, (_d, _m, j) => j.error.code === 'PLAN_REQUIRED');
await expect('analisis bloqueado en free', 'GET', '/me/gap-analysis', { token: free }, 403);
const analysis = await expect('analisis premium', 'GET', '/me/gap-analysis', { token: premium }, 200,
  (d) => Array.isArray(d.subjects) && d.subjects.length === 3
    && d.subjects[0].mastery <= d.subjects[1].mastery
    && typeof d.subjects[0].recommendedTutorCount === 'number');
check('gap-analysis: recomienda tutor para lectora', analysis.subjects.some((s) => s.testId === 'lectora' && s.recommendedTutorCount === 1));

results.push('\n[7] Solicitud de contacto y chat');
const rodrigo = tutorList.find((t) => t.name === 'Rodrigo Cea');
await expect('mensaje obligatorio', 'POST', `/tutors/${rodrigo.id}/contact-requests`,
  { token: premium, body: { message: '  ' } }, 400);
const contact = await expect('crea conversacion', 'POST', `/tutors/${rodrigo.id}/contact-requests`,
  { token: premium, body: { message: 'Hola Rodrigo, necesito reforzar inferencias.' } }, 201,
  (d) => d.created === true && d.conversationId && d.sharedProfile.name === 'Camila Rojas');
await expect('idempotente', 'POST', `/tutors/${rodrigo.id}/contact-requests`,
  { token: premium, body: { message: 'Insisto :)' } }, 200, (d) => d.created === false);
await expect('lista conversaciones', 'GET', '/me/conversations', { token: premium }, 200,
  (d) => d.length === 1 && d[0].tutor.name === 'Rodrigo Cea');
await expect('detalle conversacion', 'GET', `/conversations/${contact.conversationId}`, { token: premium }, 200,
  (d) => d.contactSharing.mutual === false && d.sharedProfile.weakAreas);
await expect('mensajes', 'GET', `/conversations/${contact.conversationId}/messages`, { token: premium }, 200,
  (d) => d.length === 2 && d.every((m) => m.mine === true));
await expect('envia mensaje', 'POST', `/conversations/${contact.conversationId}/messages`,
  { token: premium, body: { text: 'Puedo los jueves' } }, 201, (d) => d.mine === true);
await expect('texto vacio', 'POST', `/conversations/${contact.conversationId}/messages`,
  { token: premium, body: { text: '' } }, 400);
await expect('conversacion ajena', 'GET', `/conversations/${contact.conversationId}/messages`, { token: free }, 404);
await expect('marca leido', 'POST', `/conversations/${contact.conversationId}/read`, { token: premium }, 200,
  (d) => d.unreadCount === 0);
await expect('consentimiento no booleano', 'PATCH', `/conversations/${contact.conversationId}/contact-sharing`,
  { token: premium, body: { shareWhatsapp: 'si' } }, 400);
await expect('consentimiento mutuo revela', 'PATCH', `/conversations/${contact.conversationId}/contact-sharing`,
  { token: premium, body: { shareWhatsapp: true } }, 200,
  (d) => d.mutual === true && d.revealed.tutorWhatsapp === '+56922222222' && d.revealed.myWhatsapp === '+56987654321');
await expect('revoca consentimiento', 'PATCH', `/conversations/${contact.conversationId}/contact-sharing`,
  { token: premium, body: { shareWhatsapp: false } }, 200, (d) => d.mutual === false && d.revealed === null);

// Conversacion sembrada del alumno free (demo): chat y no-lectura
const freeConvs = await expect('demo tiene conversacion sembrada', 'GET', '/me/conversations', { token: free }, 200,
  (d) => d.length === 1 && d[0].unreadCount === 1);
await expect('lectura baja el badge', 'GET', `/conversations/${freeConvs[0].id}/messages`, { token: free }, 200,
  (d) => d.length === 4 && d[0].senderType === 'tutor');
await expect('badge en cero', 'GET', '/me/conversations', { token: free }, 200, (d) => d[0].unreadCount === 0);

results.push('\n[8] Resenas de tutores');
await expect('sin contacto no puede resenar', 'POST', `/tutors/${maria.id}/reviews`,
  { token: premium, body: { ratings: { teaching: 5, punctuality: 5, mastery: 5 } } }, 403);
await expect('ratings invalidos', 'POST', `/tutors/${rodrigo.id}/reviews`,
  { token: premium, body: { ratings: { teaching: 9, punctuality: 5, mastery: 5 } } }, 400);
await expect('publica resena', 'POST', `/tutors/${rodrigo.id}/reviews`,
  { token: premium, body: { ratings: { teaching: 5, punctuality: 4, mastery: 5 }, comment: 'Muy claro' } }, 201,
  (d) => d.reviewCount === 87 && d.review.overall > 4.5 && d.review.criteria.length === 3);
await expect('una resena por alumno', 'POST', `/tutors/${rodrigo.id}/reviews`,
  { token: premium, body: { ratings: { teaching: 3, punctuality: 3, mastery: 3 } } }, 409);
await expect('perfil marca canReview=false', 'GET', `/tutors/${rodrigo.id}`, { token: premium }, 200,
  (d) => d.contacted === true && d.canReview === false && d.myReview !== null);

results.push('\n[9] Huecos menores');
const correction = await expect('crea recorreccion', 'POST', '/corrections',
  { token: premium, body: { questionId: (await call('GET', '/practice/next', { token: premium })).json.data.id, reason: 'ambiguous', comment: 'Enunciado ambiguo' } }, 201);
await expect('detalle recorreccion', 'GET', `/corrections/${correction.id}`, { token: premium }, 200,
  (d) => d.status === 'pending' && d.question.officialAnswer && d.potentialReward.amount === 250);
await expect('recorreccion ajena', 'GET', `/corrections/${correction.id}`, { token: free }, 404);
const feed = await expect('feed con reposts', 'GET', '/feed', { token: free }, 200,
  (d) => d.length >= 2 && d[0].reposts === 0 && d[0].reposted === false);
await expect('repost', 'POST', `/posts/${feed[0].id}/repost`, { token: free }, 200,
  (d) => d.reposted === true && d.reposts === 1);
await expect('repost toggle', 'POST', `/posts/${feed[0].id}/repost`, { token: free }, 200,
  (d) => d.reposted === false && d.reposts === 0);
await expect('no borra post ajeno', 'DELETE', `/posts/${feed[0].id}`, { token: free }, 403);
const myPost = await expect('crea post', 'POST', '/posts', { token: free, body: { text: 'Post de prueba' } }, 201);
const myComment = await expect('comenta', 'POST', `/posts/${myPost.id}/comments`, { token: free, body: { text: 'Comentario' } }, 201);
await expect('borra comentario', 'DELETE', `/posts/${myPost.id}/comments/${myComment.id}`, { token: free }, 204, () => true);
await expect('borra post propio', 'DELETE', `/posts/${myPost.id}`, { token: free }, 204, () => true);
await expect('marca todo leido', 'POST', '/me/notifications/read-all', { token: free }, 200, (d) => d.unreadCount === 0);
await expect('detalle beneficio', 'GET', '/benefits/ben_platzi', { token: free }, 200,
  (d) => d.requiredPlatinum === 5 && Array.isArray(d.myRedemptions));
await expect('beneficio inexistente', 'GET', '/benefits/ben_nope', { token: free }, 404);
const groups = await expect('grupos', 'GET', '/groups', { token: free }, 200, (d) => d.length >= 1);
const leaveTarget = groups.find((g) => g.name === 'Lectura critica');
await expect('sale del grupo', 'DELETE', `/groups/${leaveTarget.id}/members/me`, { token: free }, 204, () => true);
await expect('no puede salir dos veces', 'DELETE', `/groups/${leaveTarget.id}/members/me`, { token: free }, 404);

results.push('\n[10] Correcciones de la revision de codigo');
// Webhook publico: no debe quedar tapado por el authRequired de meRoutes.
{
  const { status } = await call('POST', '/webhooks/stripe', { body: { type: 'ping' } });
  check('POST /webhooks/stripe sigue siendo publico', status !== 401, `(recibido ${status})`);
}
await expect('cursor invalido no rompe el feed', 'GET', '/feed?cursor[a]=1', { token: free }, 200, (d) => Array.isArray(d));
await expect('limit negativo se acota', 'GET', '/feed?limit=-5', { token: free }, 200,
  (d, m) => d.length >= 1 && m.pagination.limit === 1);
await expect('enviar mensaje exige plan de pago', 'POST', `/conversations/${freeConvs[0].id}/messages`,
  { token: free, body: { text: 'Hola' } }, 403);
await expect('compartir contacto exige plan de pago', 'PATCH', `/conversations/${freeConvs[0].id}/contact-sharing`,
  { token: free, body: { shareWhatsapp: true } }, 403);
await expect('telefono enmascarado', 'POST', '/auth/phone/send-code', { body: { phone: '+56912345678' } }, 200,
  (d) => d.masked === '+56*****5678');
await expect('post demasiado largo', 'POST', '/posts', { token: free, body: { text: 'x'.repeat(2001) } }, 400);
{
  // Un tutor sin ratingSeed no debe diluir las resenas reales contra cero.
  const { aggregateRatings } = await import('../lib/tutors.js');
  const sinSeed = aggregateRatings({ ratingSeed: null, reviewCountSeed: 100 },
    [{ ratings: { teaching: 5, punctuality: 5, mastery: 5 } }]);
  check('aggregateRatings ignora historico sin valores', sinSeed.overall === 5, `(overall=${sinSeed.overall})`);
  const parcial = aggregateRatings({ ratingSeed: { teaching: 4.8, punctuality: 4.6 }, reviewCountSeed: 10 },
    [{ ratings: { teaching: 5, punctuality: 5, mastery: 4 } }]);
  check('aggregateRatings soporta historico parcial', parcial.criteria.mastery === 4, `(mastery=${parcial.criteria.mastery})`);
}

results.push('\n[11] Regresion de rutas existentes');
await expect('practice/next', 'GET', '/practice/next', { token: premium }, 200, (d) => d.progress.total === 10);
await expect('plans publico', 'GET', '/plans', {}, 200, (d) => d.length >= 2);
await expect('me/medals', 'GET', '/me/medals', { token: free }, 200, (d) => d.wallet);
await expect('me/progress', 'GET', '/me/progress', { token: free }, 200, (d) => Array.isArray(d));
await expect('sin token', 'GET', '/tutors', {}, 401);

results.push('\n[12] Seguridad (rama sec/cierre-hallazgos-acotado)');
{
  const juan = await login('juan@correo.cl');
  const { patch: patchDoc, COL: C } = await import('../data/repo.js');

  // Invitaciones: solo miembros ven los correos; solo el invitado acepta; vencen.
  const grp = (await call('POST', '/groups', { token: premium, body: { name: 'Grupo seguridad', subjectTestId: 'm1' } })).json.data;
  await expect('no miembro NO ve correos invitados', 'GET', `/groups/${grp.id}/invitations`, { token: free }, 403);
  await expect('miembro ve invitaciones', 'GET', `/groups/${grp.id}/invitations`, { token: premium }, 200, (d) => Array.isArray(d));
  const inv = (await call('POST', `/groups/${grp.id}/invitations`, { token: premium, body: { email: 'Juan@Correo.cl' } })).json.data;
  check('invitacion creada con vencimiento', !!inv?.token);
  await expect('otro correo NO acepta la invitacion', 'POST', `/invitations/${inv.token}/accept`, { token: free }, 403);
  await expect('el invitado acepta (sin importar mayusculas)', 'POST', `/invitations/${inv.token}/accept`, { token: juan }, 200,
    (d) => d.joined === true);
  const grp2 = (await call('POST', '/groups', { token: premium, body: { name: 'Grupo vencido', subjectTestId: 'm1' } })).json.data;
  const inv2 = (await call('POST', `/groups/${grp2.id}/invitations`, { token: premium, body: { email: 'juan@correo.cl' } })).json.data;
  await patchDoc(C.groupInvitations, inv2.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
  await expect('invitacion vencida se rechaza', 'POST', `/invitations/${inv2.token}/accept`, { token: juan }, 400);

  // Cambio de plan: valida plan y ciclo.
  await expect('plan inexistente', 'POST', '/me/subscription/change', { token: premium, body: { plan: 'vip' } }, 400);
  await expect('plan free no se asigna asi', 'POST', '/me/subscription/change', { token: premium, body: { plan: 'free' } }, 400);
  await expect('ciclo inexistente', 'POST', '/me/subscription/change', { token: premium, body: { billingCycle: 'weekly' } }, 400);
  await expect('cambio valido en demo', 'POST', '/me/subscription/change', { token: premium, body: { billingCycle: 'yearly' } }, 200);

  // Login social demo: no puede entrar a una cuenta con contrasena.
  await expect('token social NO suplanta cuenta con contrasena', 'POST', '/auth/social',
    { body: { provider: 'google', idToken: 'google:camila@correo.cl:Falsa' } }, 409);

  // Webhook de Stripe: deshabilitado siempre (no verifica firma).
  await expect('webhook de Stripe deshabilitado', 'POST', '/webhooks/stripe',
    { body: { type: 'checkout.session.completed', data: { object: { id: 'cs_x' } } } }, 503);

  // Sin DEMO_MODE: los atajos quedan cerrados.
  process.env.DEMO_MODE = 'false';
  await expect('sin demo: login social cerrado', 'POST', '/auth/social',
    { body: { provider: 'google', idToken: `google:nuevo${Date.now()}@x.cl:X` } }, 503);
  await expect('sin demo: checkout cerrado', 'POST', '/checkout/sessions',
    { token: free, body: { plan: 'all', billingCycle: 'monthly' } }, 503);
  await expect('sin demo: confirmar pago cerrado', 'POST', '/checkout/sessions/cs_x/confirm', { token: free }, 503);
  await expect('sin demo: cambio de plan cerrado', 'POST', '/me/subscription/change',
    { token: premium, body: { plan: 'uni' } }, 503);
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const devPhoneProd = await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: 'dev:+56911112222' } });
  check('produccion sin demo: token dev: de telefono rechazado', devPhoneProd.status !== 200, `(recibido ${devPhoneProd.status})`);
  process.env.DEMO_MODE = 'true';
  const devPhoneDemo = await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: 'dev:+56911112222' } });
  check('produccion con demo: token dev: aceptado', devPhoneDemo.status === 200, `(recibido ${devPhoneDemo.status})`);
  if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;

  // JWT_SECRET obligatorio en produccion: el proceso no debe arrancar.
  const { spawnSync } = await import('child_process');
  const jwtStarts = (secret) => spawnSync(process.execPath, ['-e', "import('./src/lib/jwt.js')"], {
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret }, encoding: 'utf8',
  }).status === 0;
  check('produccion sin JWT_SECRET: no arranca', !jwtStarts(''));
  check('produccion con JWT_SECRET de ejemplo: no arranca', !jwtStarts('cambia-esto-en-produccion'));
  check('produccion con JWT_SECRET corto: no arranca', !jwtStarts('corto'));
  check('produccion con JWT_SECRET valido: arranca', jwtStarts('x'.repeat(48)));

  // Cabeceras de seguridad (helmet).
  const h = await fetch(BASE.replace('/api/v1', '') + '/health');
  check('helmet: X-Content-Type-Options nosniff', h.headers.get('x-content-type-options') === 'nosniff');
  check('helmet: sin X-Powered-By', !h.headers.get('x-powered-by'));
}

results.push('\n[13] Respuestas: envios simultaneos (doble clic)');
{
  const { query: q2, COL: C } = await import('../data/repo.js');
  let duplicated = 0, bothAccepted = 0;
  for (let i = 0; i < 5; i++) {
    const qn = (await call('GET', '/practice/next', { token: premium })).json.data;
    const [a, b] = await Promise.all([
      call('POST', `/questions/${qn.id}/answer`, { token: premium, body: { selected: 'A' } }),
      call('POST', `/questions/${qn.id}/answer`, { token: premium, body: { selected: 'A' } }),
    ]);
    const statuses = [a.status, b.status].sort().join('/');
    if (statuses !== '201/409') bothAccepted++;
    if ((await q2(C.answers, [['questionId', '==', qn.id], ['userId', '==', 'usr_camila']], (x) => x.sessionId === null)).length !== 1) duplicated++;
  }
  check('5 dobles envios: siempre uno 201 y el otro 409', bothAccepted === 0, `(${bothAccepted} distintos)`);
  check('5 dobles envios: nunca queda la respuesta duplicada', duplicated === 0, `(${duplicated} duplicadas)`);
}

results.push('\n[14] Acceso a la documentacion de la API (API_DOCS)');
{
  const ROOT = BASE.replace('/api/v1', '');
  const docs = async (auth) => Promise.all(['/api/v1/openapi.json', '/api/docs/'].map(async (p) => {
    const r = await fetch(ROOT + p, auth ? { headers: { Authorization: `Basic ${Buffer.from(auth).toString('base64')}` } } : {});
    return { status: r.status, auth: r.headers.get('www-authenticate'), robots: r.headers.get('x-robots-tag') };
  }));
  const both = (rs, status) => rs.every((r) => r.status === status);
  const saved = { mode: process.env.API_DOCS, user: process.env.API_DOCS_USER, pass: process.env.API_DOCS_PASSWORD, env: process.env.NODE_ENV };

  process.env.API_DOCS = 'public';
  let rs = await docs();
  check('public: especificacion y Swagger UI responden 200', both(rs, 200), `(${rs.map((r) => r.status)})`);
  check('public: no se indexa (X-Robots-Tag)', rs.every((r) => /noindex/.test(r.robots || '')));

  process.env.API_DOCS = 'off';
  rs = await docs();
  check('off: responde 404, como si no existiera', both(rs, 404), `(${rs.map((r) => r.status)})`);

  delete process.env.API_DOCS; process.env.NODE_ENV = 'production';
  rs = await docs();
  check('produccion sin API_DOCS: cerrada por defecto (404)', both(rs, 404), `(${rs.map((r) => r.status)})`);

  process.env.API_DOCS = 'protected'; delete process.env.API_DOCS_USER; delete process.env.API_DOCS_PASSWORD;
  rs = await docs('a:b');
  check('protected sin credenciales configuradas: falla cerrado (404)', both(rs, 404), `(${rs.map((r) => r.status)})`);

  process.env.API_DOCS_USER = 'empresa'; process.env.API_DOCS_PASSWORD = 'clave-larga-de-prueba-1234';
  rs = await docs();
  check('protected sin credenciales: 401 y pide Basic', both(rs, 401) && rs.every((r) => /^Basic /.test(r.auth || '')), `(${rs.map((r) => r.status)})`);
  rs = await docs('empresa:otra-clave');
  check('protected con clave incorrecta: 401', both(rs, 401), `(${rs.map((r) => r.status)})`);
  rs = await docs('otro:clave-larga-de-prueba-1234');
  check('protected con usuario incorrecto: 401', both(rs, 401), `(${rs.map((r) => r.status)})`);
  rs = await docs('empresa:clave-larga-de-prueba-1234');
  check('protected con credenciales correctas: 200', both(rs, 200), `(${rs.map((r) => r.status)})`);

  for (const [k, v] of Object.entries({ API_DOCS: saved.mode, API_DOCS_USER: saved.user, API_DOCS_PASSWORD: saved.pass, NODE_ENV: saved.env })) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

results.push('\n[15] CORS (API y frontend en dominios distintos)');
{
  const saved = { list: process.env.CORS_ORIGINS, re: process.env.CORS_ORIGIN_REGEX, env: process.env.NODE_ENV };
  const FRONT = 'https://aprueba-student-web.vercel.app';
  const PREVIEW = 'https://aprueba-student-3ab9xk2-aprueba.vercel.app';
  const acao = async (origin, method = 'GET') => {
    const r = await fetch(`${BASE}/plans`, { method, headers: { Origin: origin, ...(method === 'OPTIONS' && { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }) } });
    return { status: r.status, origin: r.headers.get('access-control-allow-origin'), methods: r.headers.get('access-control-allow-methods'), headers: r.headers.get('access-control-allow-headers'), creds: r.headers.get('access-control-allow-credentials') };
  };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGINS = FRONT;
  process.env.CORS_ORIGIN_REGEX = 'https://aprueba-student-(web-git-[a-z0-9-]+|[a-z0-9]+)-aprueba\\.vercel\\.app';
  check('origen del frontend permitido', (await acao(FRONT)).origin === FRONT);
  check('preview del frontend permitido por patron', (await acao(PREVIEW)).origin === PREVIEW);
  check('origen ajeno rechazado', !(await acao('https://sitio-ajeno.com')).origin);
  check('patron anclado: dominio que lo contiene rechazado', !(await acao(`${PREVIEW}.evil.com`)).origin);
  check('patron anclado: prefijo malicioso rechazado', !(await acao(`https://evil.com/${PREVIEW}`)).origin);
  const pre = await acao(FRONT, 'OPTIONS');
  check('preflight: 204 con metodos y cabeceras permitidas', pre.status === 204 && /PATCH/.test(pre.methods || '') && /Authorization/i.test(pre.headers || ''), `(${pre.status} ${pre.methods} ${pre.headers})`);
  check('sin credenciales de navegador (Allow-Credentials ausente)', !pre.creds);
  delete process.env.CORS_ORIGINS; delete process.env.CORS_ORIGIN_REGEX;
  check('produccion sin configuracion: ningun origen permitido', !(await acao(FRONT)).origin);
  for (const [k, v] of Object.entries({ CORS_ORIGINS: saved.list, CORS_ORIGIN_REGEX: saved.re, NODE_ENV: saved.env })) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

results.push('\n[16] Busqueda global');
{
  const g = (await call('POST', '/groups', { token: free, body: { name: 'Algebra avanzada', subjectTestId: 'm1' } })).json.data;
  await expect('encuentra el grupo sin importar tildes ni mayusculas', 'GET', '/search?q=ALGEBRA&types=groups', { token: free }, 200,
    (d) => d.groups.some((x) => x.id === g.id));
  await expect('no mezcla grupos de otros alumnos', 'GET', '/search?q=algebra&types=groups', { token: premium }, 200,
    (d) => !d.groups.some((x) => x.id === g.id));
  await expect('busca en pruebas', 'GET', '/search?q=matematica&types=topics', { token: free }, 200, (d) => d.topics.length >= 1);
  await expect('preguntas: nunca expone la respuesta correcta', 'GET', '/search?q=de&types=questions', { token: free }, 200,
    (d) => d.questions.every((x) => !('correctIndex' in x) && !('options' in x)));
  await expect('q muy corta -> 400', 'GET', '/search?q=a', { token: free }, 400);
  await expect('types invalido -> 400', 'GET', '/search?q=algebra&types=foo', { token: free }, 400);
  await expect('exige sesion', 'GET', '/search?q=algebra', {}, 401);
  let last = 0;
  for (let i = 0; i < 31; i++) last = (await call('GET', '/search?q=algebra&types=topics', { token: premium })).status;
  check('rate limit: pasadas 30 busquedas responde 429', last === 429, `(${last})`);
}

results.push('\n[17] Idioma: grupos, pruebas y busqueda en ingles');
{
  const setLocale = (locale) => call('PATCH', '/me/settings', { token: free, body: { locale } });
  const mates = (d) => d.find((g) => g.id === 'grp_mates');
  await setLocale('en');
  await expect('PATCH /me/settings locale=en cambia el idioma de las respuestas', 'GET', '/tests', { token: free }, 200,
    (d) => d.some((t) => t.id === 'm1' && t.label === 'Maths M1'));
  await expect('grupos: la materia sale en ingles', 'GET', '/groups', { token: free }, 200, (d) => mates(d)?.subject === 'Maths M1');
  await expect('detalle de grupo: materia en ingles', 'GET', '/groups/grp_mates', { token: free }, 200, (d) => d.subject === 'Maths M1');
  await expect('progreso por prueba: etiquetas en ingles', 'GET', '/me/progress', { token: free }, 200, (d) => d.some((p) => p.label === 'Maths M1'));
  await expect('buscar "maths" encuentra prueba y grupo', 'GET', '/search?q=maths&types=topics,groups', { token: free }, 200,
    (d) => d.topics.some((t) => t.testId === 'm1' && t.label === 'Maths M1') && d.groups.some((g) => g.id === 'grp_mates' && g.subject === 'Maths M1'));
  await expect('en ingles tambien encuentra escribiendo en espanol', 'GET', '/search?q=matematica&types=topics', { token: free }, 200,
    (d) => d.topics.some((t) => t.testId === 'm1' && t.label === 'Maths M1'));
  await expect('?lang=es manda sobre el ajuste del alumno', 'GET', '/search?q=maths&types=topics&lang=es', { token: free }, 200,
    (d) => d.topics.some((t) => t.testId === 'm1' && t.label === 'Matematica M1'));
  await expect('pregunta de practica: eje en ingles', 'GET', '/practice/next?testId=m1', { token: free }, 200, (d) => d.axis === 'Numbers & Algebra');
  await setLocale('es');
  await expect('de vuelta en espanol: grupos', 'GET', '/groups', { token: free }, 200, (d) => mates(d)?.subject === 'Matematica M1');
  await expect('de vuelta en espanol: buscar "maths" sigue encontrando', 'GET', '/search?q=maths&types=topics', { token: free }, 200,
    (d) => d.topics.some((t) => t.testId === 'm1' && t.label === 'Matematica M1'));
}

results.push('\n[18] Regalos de medallas: monto, destinatarios y saldo');
{
  const bronze = async (tok) => (await call('GET', '/me/medals', { token: tok })).json.data.wallet.bronze;
  const gift = (recipients) => call('POST', '/me/gifts', { token: free, body: { recipients } });
  const before = await bronze(free);
  const camilaBefore = await bronze(premium);

  for (const [label, amount] of [['negativo', -100], ['cero', 0], ['decimal', 1.5], ['texto', '5']]) {
    const r = await gift([{ userId: 'usr_camila', amount }]);
    check(`regalo con monto ${label} -> 400`, r.status === 400, `(${r.status})`);
  }
  let r = await gift([{ userId: 'usr_demo', amount: 1 }]);
  check('regalo a uno mismo -> 422 CANNOT_GIFT_SELF', r.status === 422 && r.json?.error?.code === 'CANNOT_GIFT_SELF', `(${r.status})`);
  r = await gift([{ userId: 'usr_camila', amount: 1 }, { userId: 'usr_camila', amount: 1 }]);
  check('destinatario repetido -> 400', r.status === 400, `(${r.status})`);
  r = await gift([{ amount: 1 }]);
  check('destinatario sin userId -> 400', r.status === 400, `(${r.status})`);
  check('los rechazos no mueven las medallas del emisor', (await bronze(free)) === before);
  check('ni las del destinatario', (await bronze(premium)) === camilaBefore);
  r = await gift([{ userId: 'usr_camila', amount: 1 }]);
  check('regalo valido -> 200', r.status === 200, `(${r.status})`);
  check('el emisor pierde 1 bronce', (await bronze(free)) === before - 1);
  check('el destinatario recibe 1 bronce', (await bronze(premium)) === camilaBefore + 1);
}

results.push('\n[19] Refresh de cuentas suspendidas');
{
  const { patch: patchUser, COL: COLS } = await import('../data/repo.js');
  const juan = (await call('POST', '/auth/login', { body: { email: 'juan@correo.cl', password: 'demo1234' } })).json.data;
  await patchUser(COLS.users, 'usr_juan', { state: 'suspended' });
  let r = await call('POST', '/auth/refresh', { body: { refreshToken: juan.refreshToken } });
  check('refresh de una cuenta suspendida -> 403 ACCOUNT_SUSPENDED', r.status === 403 && r.json?.error?.code === 'ACCOUNT_SUSPENDED', `(${r.status})`);
  await patchUser(COLS.users, 'usr_juan', { state: 'active' });
  r = await call('POST', '/auth/refresh', { body: { refreshToken: juan.refreshToken } });
  check('reactivada la cuenta, el refresh vuelve a funcionar', r.status === 200, `(${r.status})`);
}

results.push('\n[20] JWT: solo se acepta el algoritmo HS256');
{
  const { default: jwtLib } = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const forged = (alg) => jwtLib.sign({ sub: 'usr_demo', typ: 'access' }, secret, { algorithm: alg, expiresIn: 300 });
  let r = await call('GET', '/me', { token: forged('HS512') });
  check('token firmado con HS512 -> 401', r.status === 401, `(${r.status})`);
  r = await call('GET', '/me', { token: forged('HS256') });
  check('el mismo token firmado con HS256 si entra (control)', r.status === 200, `(${r.status})`);
}

results.push('\n[21] Limite del cuerpo JSON');
{
  let r = await call('POST', '/posts', { token: free, body: { text: 'a'.repeat(200000) } });
  check('cuerpo de 200 KB -> 413', r.status === 413, `(${r.status})`);
  r = await call('POST', '/posts', { token: free, body: { text: 'a'.repeat(2000) } });
  check('una publicacion de 2000 caracteres sigue entrando -> 201', r.status === 201, `(${r.status})`);
}

results.push('\n[22] Inicio: progreso por prueba con datos reales');
{
  const { set: setDoc, patch: patchDoc, query: queryDocs, COL: DB } = await import('../data/repo.js');
  let seq = 0;
  // Alumno nuevo (registro real con telefono de desarrollo) con las pruebas elegidas.
  const newStudent = async ({ plan = 'free', tests = ['m1', 'lectora'] } = {}) => {
    seq++;
    const phone = `+569${String(90000000 + seq).padStart(8, '0')}`;
    const v = (await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: `dev:${phone}` } })).json.data;
    const r = (await call('POST', '/auth/register', {
      body: { name: `Alumno Inicio ${seq}`, email: `inicio${seq}-${Date.now()}@x.cl`, password: 'clave1234', consent: true, phoneToken: v.phoneToken, country: 'CL', language: 'es', gradeId: 'cl-paes' },
    })).json.data;
    await call('PUT', '/me/preferences', { token: r.accessToken, body: { selectedTests: tests, country: 'CL', gradeId: 'cl-paes' } });
    if (plan !== 'free') await patchDoc(DB.users, r.user.id, { plan });
    return { token: r.accessToken, id: r.user.id };
  };
  // Inserta respuestas de una prueba, de la mas antigua a la mas reciente (una por minuto).
  const addAnswers = async (userId, testId, flags) => {
    const q = (await queryDocs(DB.questions, [['testId', '==', testId]]))[0];
    const start = Date.now() - flags.length * 60000;
    for (let i = 0; i < flags.length; i++) {
      await setDoc(DB.answers, `ans_t22_${userId}_${testId}_${i}`, {
        id: `ans_t22_${userId}_${testId}_${i}`, userId, questionId: q.id, testId, selected: 'A', correct: flags[i],
        elapsedMs: 9000, sessionId: `t22-${i}`, createdAt: new Date(start + i * 60000).toISOString(),
      });
    }
  };
  const progressOf = async (token) => Object.fromEntries((await call('GET', '/me/progress', { token })).json.data.map((p) => [p.testId, p]));

  const nuevo = await newStudent();
  let p = await progressOf(nuevo.token);
  check('alumno nuevo: una entrada por prueba elegida', Object.keys(p).sort().join() === 'lectora,m1', JSON.stringify(Object.keys(p)));
  check('alumno nuevo: sin datos (hasData false, answered 0, recent 0, percent 0)',
    Object.values(p).every((x) => x.hasData === false && x.answered === 0 && x.recent === 0 && x.percent === 0), JSON.stringify(p));

  await patchDoc(DB.users, nuevo.id, { progressSeed: { m1: 99 } });
  p = await progressOf(nuevo.token);
  check('los porcentajes de ejemplo (progressSeed) ya no cuentan', p.m1.percent === 0 && p.m1.hasData === false, JSON.stringify(p.m1));

  await addAnswers(nuevo.id, 'm1', [true, true, true, true]);
  p = await progressOf(nuevo.token);
  check('con 4 respuestas todavia no hay datos suficientes', p.m1.hasData === false && p.m1.answered === 4 && p.m1.recent === 4 && p.m1.percent === 100, JSON.stringify(p.m1));
  await addAnswers(nuevo.id, 'm1', [true, true, true, true, true]);
  p = await progressOf(nuevo.token);
  check('con 5 respuestas ya hay datos', p.m1.hasData === true && p.m1.recent === 5, JSON.stringify(p.m1));
  check('las respuestas de una prueba no afectan a otra', p.lectora.hasData === false && p.lectora.answered === 0, JSON.stringify(p.lectora));

  const mejoro = await newStudent({ tests: ['m1'] });
  await addAnswers(mejoro.id, 'm1', [...Array(10).fill(false), ...Array(20).fill(true)]);
  p = await progressOf(mejoro.token);
  check('mide solo las ultimas 20: 10 fallos antiguos y 20 aciertos recientes -> 100', p.m1.percent === 100 && p.m1.recent === 20 && p.m1.answered === 30, JSON.stringify(p.m1));

  const empeoro = await newStudent({ tests: ['m1'] });
  await addAnswers(empeoro.id, 'm1', [...Array(12).fill(true), ...Array(20).fill(false)]);
  p = await progressOf(empeoro.token);
  check('12 aciertos antiguos y 20 fallos recientes -> 0', p.m1.percent === 0 && p.m1.recent === 20 && p.m1.answered === 32, JSON.stringify(p.m1));
  check('percent es un entero', Number.isInteger(p.m1.percent));

  const demo = await progressOf(free);
  check('usuario demo: historial real en Lectora (14 de 20 = 70)', demo.lectora?.hasData === true && demo.lectora.percent === 70 && demo.lectora.recent === 20, JSON.stringify(demo.lectora));
  check('usuario demo: historial real en M1 (11 de 20 = 55)', demo.m1?.hasData === true && demo.m1.percent === 55, JSON.stringify(demo.m1));
}

results.push('\n[23] Inicio: progreso de canje de medallas');
{
  const { patch: patchDoc2, COL: DB2 } = await import('../data/repo.js');
  let seq2 = 0;
  const zero = { bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0 };
  // Alumno nuevo con un monedero a medida; devuelve lo que informa GET /me/medals.
  const progressFor = async (wallet) => {
    seq2++;
    const phone = `+569${String(91000000 + seq2).padStart(8, '0')}`;
    const v = (await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: `dev:${phone}` } })).json.data;
    const r = (await call('POST', '/auth/register', {
      body: { name: `Alumno Medallas ${seq2}`, email: `medallas${seq2}-${Date.now()}@x.cl`, password: 'clave1234', consent: true, phoneToken: v.phoneToken, country: 'CL', language: 'es', gradeId: 'cl-paes' },
    })).json.data;
    await patchDoc2(DB2.users, r.user.id, { medals: { ...zero, ...wallet } });
    return (await call('GET', '/me/medals', { token: r.accessToken })).json.data.progress;
  };
  const only = (p) => { const k = Object.keys(p); return k.length === 1 ? [k[0], p[k[0]]] : [null, null]; };

  let [tier, p] = only(await progressFor({ bronze: 15 }));
  check('15 bronces: se destaca bronce, ya se puede canjear 3 veces', tier === 'bronze' && p.exchangeable === 3 && p.missing === 0 && p.have === 5 && p.needed === 5 && p.next === 'silver', JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ bronze: 2 }));
  check('2 bronces: faltan 3 y no se puede canjear', tier === 'bronze' && p.exchangeable === 0 && p.missing === 3 && p.have === 2, JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ bronze: 5 }));
  check('5 bronces: exactamente un canje', p.exchangeable === 1 && p.missing === 0 && p.have === 5, JSON.stringify(p));
  [tier, p] = only(await progressFor({ bronze: 7, silver: 6 }));
  check('si varios niveles se pueden canjear, se destaca el mas bajo', tier === 'bronze' && p.exchangeable === 1, JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ bronze: 3, silver: 6 }));
  check('bronce aun no alcanza y plata si: se destaca plata', tier === 'silver' && p.exchangeable === 1 && p.next === 'gold', JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ bronze: 2, silver: 4 }));
  check('sin canjes disponibles: se destaca el nivel mas cercano (plata, faltan 1)', tier === 'silver' && p.exchangeable === 0 && p.missing === 1 && p.have === 4 && p.next === 'gold', JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ bronze: 2, silver: 2 }));
  check('empate de cercania: gana el nivel mas bajo', tier === 'bronze', JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({}));
  check('sin medallas: bronce, faltan 5', tier === 'bronze' && p.have === 0 && p.missing === 5 && p.exchangeable === 0, JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ platinum: 3 }));
  check('solo platino (no se canjea): se muestra bronce con 0', tier === 'bronze' && p.have === 0 && p.exchangeable === 0, JSON.stringify([tier, p]));
  [tier, p] = only(await progressFor({ diamond: 5 }));
  check('5 diamantes: canje a platino', tier === 'diamond' && p.exchangeable === 1 && p.next === 'platinum', JSON.stringify([tier, p]));
}

// Registra un alumno nuevo (telefono de desarrollo) y devuelve su token y su id.
let studentSeq = 0;
async function registerStudent({ tests = ['m1'] } = {}) {
  studentSeq++;
  const phone = `+569${String(92000000 + studentSeq).padStart(8, '0')}`;
  const v = (await call('POST', '/auth/phone/verify-code', { body: { firebaseIdToken: `dev:${phone}` } })).json.data;
  const r = (await call('POST', '/auth/register', {
    body: { name: `Alumno Dia ${studentSeq}`, email: `dia${studentSeq}-${Date.now()}@x.cl`, password: 'clave1234', consent: true, phoneToken: v.phoneToken, country: 'CL', language: 'es', gradeId: 'cl-paes' },
  })).json.data;
  await call('PUT', '/me/preferences', { token: r.accessToken, body: { selectedTests: tests, country: 'CL', gradeId: 'cl-paes' } });
  return { token: r.accessToken, id: r.user.id, email: r.user.email };
}

results.push('\n[24] Zona horaria: el dia del alumno');
{
  const { dayKey, nextMidnight, tzOf, isValidTimeZone, shiftDay } = await import('../lib/tz.js');
  const { get: getDoc, COL: DB3 } = await import('../data/repo.js');
  const at = new Date('2026-10-23T02:30:00Z'); // 23:30 del 22 en Santiago

  check('02:30 UTC del 23 es el dia 22 en Santiago', dayKey(at, 'America/Santiago') === '2026-10-22', dayKey(at, 'America/Santiago'));
  check('... el 23 en UTC', dayKey(at, 'UTC') === '2026-10-23');
  check('... el 23 en Londres', dayKey(at, 'Europe/London') === '2026-10-23');
  check('la proxima medianoche de Santiago es 03:00 UTC', nextMidnight('America/Santiago', at).toISOString() === '2026-10-23T03:00:00.000Z', nextMidnight('America/Santiago', at).toISOString());
  check('la proxima medianoche en UTC es 00:00 del dia siguiente', nextMidnight('UTC', at).toISOString() === '2026-10-24T00:00:00.000Z');
  // En Santiago el 4 de abril de 2026 el reloj retrocede: ese dia dura 25 horas.
  check('dia de cambio de hora (25 h): la medianoche sigue siendo la del dia siguiente',
    nextMidnight('America/Santiago', new Date('2026-04-04T12:00:00Z')).toISOString() === '2026-04-05T04:00:00.000Z', nextMidnight('America/Santiago', new Date('2026-04-04T12:00:00Z')).toISOString());
  check('shiftDay cruza fin de mes y de ano', shiftDay('2026-03-01', -1) === '2026-02-28' && shiftDay('2026-12-31', 1) === '2027-01-01');

  check('isValidTimeZone acepta una zona IANA', isValidTimeZone('America/Santiago') === true);
  check('isValidTimeZone rechaza zonas inexistentes y valores vacios', isValidTimeZone('Mars/Base') === false && isValidTimeZone('') === false && isValidTimeZone(undefined) === false);
  check('tzOf usa la zona del alumno', tzOf({ timezone: 'Europe/London' }) === 'Europe/London');
  check('tzOf ignora una zona invalida y usa el pais', tzOf({ timezone: 'Mars/Base', country: 'UK' }) === 'Europe/London');
  check('tzOf por pais Chile y sin datos = Santiago', tzOf({ country: 'CL' }) === 'America/Santiago' && tzOf({}) === 'America/Santiago');

  const s = await registerStudent();
  const me0 = (await call('GET', '/me', { token: s.token })).json.data;
  check('GET /me informa la zona horaria efectiva (Santiago por pais)', me0.timezone === 'America/Santiago', JSON.stringify(me0.timezone));
  let r = await call('PATCH', '/me/settings', { token: s.token, body: { timezone: 'Mars/Base' } });
  check('PATCH /me/settings rechaza una zona invalida -> 400', r.status === 400, `(${r.status})`);
  r = await call('PATCH', '/me/settings', { token: s.token, body: { timezone: 'Europe/London' } });
  check('PATCH /me/settings acepta Europe/London', r.status === 200 && r.json.data.timezone === 'Europe/London', JSON.stringify(r.json));
  check('GET /me/settings devuelve la zona', (await call('GET', '/me/settings', { token: s.token })).json.data.timezone === 'Europe/London');
  check('GET /me devuelve la zona', (await call('GET', '/me', { token: s.token })).json.data.timezone === 'Europe/London');

  // La cuota se reinicia a la medianoche de la zona del alumno.
  const now = new Date();
  for (const tz of ['Europe/London', 'America/Santiago']) {
    await call('PATCH', '/me/settings', { token: s.token, body: { timezone: tz } });
    const q = (await call('GET', '/me/quota', { token: s.token })).json.data;
    const reset = new Date(q.resetsAt);
    check(`cuota (${tz}): resetsAt es futuro y cae en el dia siguiente de esa zona`, reset > now && dayKey(reset, tz) === shiftDay(dayKey(now, tz), 1), q.resetsAt);
    check(`cuota (${tz}): un milisegundo antes todavia es hoy`, dayKey(new Date(reset.getTime() - 1), tz) === dayKey(now, tz));
    check(`cuota (${tz}): el dia guardado es el de esa zona`, (await getDoc(DB3.users, s.id)).quota.day === dayKey(now, tz));
  }
}

results.push('\n[25] Racha: cuenta practicar, no iniciar sesion');
{
  const { streakView, recordPractice } = await import('../lib/streak.js');
  const { dayKey, shiftDay, tzOf } = await import('../lib/tz.js');
  const { patch: patchU, COL: DB4 } = await import('../data/repo.js');
  const d = (iso) => new Date(iso);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Logica pura con fechas fijas.
  const u = { country: 'CL' };
  check('sin practica: racha 0 y estado none', same(streakView(u, d('2026-10-23T15:00:00Z')), { streak: 0, status: 'none' }));
  check('primera practica: racha 1', recordPractice(u, d('2026-10-23T15:00:00Z')) === true && u.streak === 1 && u.lastPracticeDay === '2026-10-23');
  check('otra practica el mismo dia no cambia la racha', recordPractice(u, d('2026-10-23T20:00:00Z')) === false && u.streak === 1);
  check('hecho hoy: estado done_today', same(streakView(u, d('2026-10-23T23:00:00Z')), { streak: 1, status: 'done_today' }));
  check('al dia siguiente, antes de practicar: la racha sigue pero esta en riesgo', same(streakView(u, d('2026-10-24T12:00:00Z')), { streak: 1, status: 'at_risk' }));
  check('practicar el dia siguiente suma: racha 2', recordPractice(u, d('2026-10-24T12:00:00Z')) === true && u.streak === 2);
  check('saltar un dia reinicia a 1 al volver a practicar', recordPractice(u, d('2026-10-26T12:00:00Z')) === true && u.streak === 1);
  const v = { country: 'CL', streak: 4, lastPracticeDay: '2026-10-24' };
  check('dos dias sin practicar: la racha vencio (0, none)', same(streakView(v, d('2026-10-27T12:00:00Z')), { streak: 0, status: 'none' }));
  const w = { country: 'CL', streak: 3, lastPracticeDay: '2026-10-25' };
  check('con un dia futuro (cambio de zona) se considera hecho hoy y no se toca', same(streakView(w, d('2026-10-24T12:00:00Z')), { streak: 3, status: 'done_today' }) && recordPractice(w, d('2026-10-24T12:00:00Z')) === false && w.streak === 3);

  // La zona horaria decide cual es "el dia": 23:30 y 02:00 locales son dos dias seguidos en Santiago,
  // pero el mismo dia en UTC.
  const cl = { country: 'CL' }; const utc = { timezone: 'UTC' };
  recordPractice(cl, d('2026-10-23T02:30:00Z')); recordPractice(cl, d('2026-10-23T05:00:00Z'));
  recordPractice(utc, d('2026-10-23T02:30:00Z')); recordPractice(utc, d('2026-10-23T05:00:00Z'));
  check('Santiago: practicar a las 23:30 y a las 02:00 locales son dos dias seguidos (racha 2)', cl.streak === 2, JSON.stringify(cl));
  check('UTC: esos mismos instantes son el mismo dia (racha 1)', utc.streak === 1, JSON.stringify(utc));

  // Contra la API.
  const s = await registerStudent();
  const meOf = async () => (await call('GET', '/me', { token: s.token })).json.data;
  const answerOne = async (n) => {
    const q = (await call('GET', '/practice/next?testId=m1', { token: s.token })).json.data;
    return call('POST', `/questions/${q.id}/answer`, { token: s.token, body: { selected: 'A', elapsedMs: 5000, sessionId: `racha${studentSeq}-${n}` } });
  };
  let me = await meOf();
  check('alumno nuevo: racha 0 (registrarse no cuenta)', me.streak === 0 && me.streakStatus === 'none', JSON.stringify([me.streak, me.streakStatus]));
  await call('POST', '/auth/login', { body: { email: s.email, password: 'clave1234' } });
  me = await meOf();
  check('iniciar sesion no suma racha', me.streak === 0 && me.streakStatus === 'none', JSON.stringify([me.streak, me.streakStatus]));
  await answerOne(1);
  me = await meOf();
  check('responder una pregunta: racha 1 y hecho hoy', me.streak === 1 && me.streakStatus === 'done_today', JSON.stringify([me.streak, me.streakStatus]));
  await answerOne(2);
  check('responder otra el mismo dia no cambia la racha', (await meOf()).streak === 1);

  const tz = tzOf({ country: 'CL' }); const today = dayKey(new Date(), tz);
  await patchU(DB4.users, s.id, { streak: 5, lastPracticeDay: shiftDay(today, -1) });
  me = await meOf();
  check('practico ayer (racha 5): sigue 5 pero en riesgo', me.streak === 5 && me.streakStatus === 'at_risk', JSON.stringify([me.streak, me.streakStatus]));
  await answerOne(3);
  me = await meOf();
  check('al practicar hoy sube a 6', me.streak === 6 && me.streakStatus === 'done_today', JSON.stringify([me.streak, me.streakStatus]));

  await patchU(DB4.users, s.id, { streak: 5, lastPracticeDay: shiftDay(today, -2) });
  me = await meOf();
  check('hace dos dias sin practicar: la racha vencio', me.streak === 0 && me.streakStatus === 'none', JSON.stringify([me.streak, me.streakStatus]));
  await answerOne(4);
  check('y al volver a practicar empieza en 1', (await meOf()).streak === 1);

  const legacy = await registerStudent();
  await patchU(DB4.users, legacy.id, { streak: 9 }); // cuenta anterior al cambio de regla: sin lastPracticeDay
  const meLegacy = (await call('GET', '/me', { token: legacy.token })).json.data;
  check('rachas anteriores a la regla nueva se reinician (streak 9 sin lastPracticeDay -> 0)', meLegacy.streak === 0 && meLegacy.streakStatus === 'none', JSON.stringify([meLegacy.streak, meLegacy.streakStatus]));
}

console.log(results.join('\n'));
console.log(`\n${pass} ok / ${failCount} fallos`);
process.exit(failCount ? 1 : 0);
