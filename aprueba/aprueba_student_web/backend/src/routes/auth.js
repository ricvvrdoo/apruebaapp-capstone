// 1.1 Autenticacion y cuenta
import { Router } from 'express';
import bcrypt from '../lib/password.js';
import { ok, created, fail, noContent } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { signAccess, signRefresh, signPhone, verifyPhone, verify, accessTtl, phoneTtl } from '../lib/jwt.js';
import { COL, get, set, add, del, queryOne, genId } from '../data/repo.js';
import { emptyWallet, award } from '../lib/medals.js';
import { todayKey } from '../lib/quota.js';
import { normalizePhone, detectLocale, maskPhone } from '../lib/phone.js';
import { verifyPhoneIdToken, PhoneVerificationError } from '../lib/firebasePhone.js';
import { findCountry } from '../data/catalog.js';
import { demoMode } from '../lib/demo.js';

const r = Router();
const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, plan: u.plan, streak: u.streak || 0,
  quota: { used: u.quota?.used || 0, max: u.plan !== 'free' ? 999999 : 10 },
  medals: u.medals, authProvider: u.authProvider,
  phone: u.phone || null, phoneVerified: !!u.phoneVerified,
  country: u.country || null, language: u.language || u.locale || 'es', gradeId: u.gradeId || null,
  onboarded: !!u.onboarded,
});

// Canjea un phoneToken emitido por /auth/phone/verify-code.
// Devuelve { phone, country, language, firebaseUid } o null si no es valido.
function consumePhoneToken(phoneToken) {
  const payload = verifyPhone(phoneToken);
  if (!payload) return null;
  return {
    phone: payload.sub,
    country: payload.country || null,
    language: payload.language || null,
    firebaseUid: payload.firebaseUid || null,
  };
}

async function dailyLoginReward(user) {
  const today = todayKey();
  if (user.lastLoginRewardDay === today) return null;
  user.medals = user.medals || emptyWallet();
  award(user.medals, 'bronze', 1);
  user.lastLoginRewardDay = today;
  user.streak = (user.streak || 0) + 1;
  await set(COL.users, user.id, user);
  await add(COL.medalLedger, { userId: user.id, tier: 'bronze', amount: 1, reason: 'daily_login', createdAt: new Date().toISOString() }, 'mdl');
  return { tier: 'bronze', amount: 1 };
}

// POST /auth/phone/send-code
// El SMS lo envia Firebase Auth desde el cliente. Aqui se valida el numero,
// se detecta pais/idioma por prefijo (pantalla confirm-locale) y se indica al
// cliente que debe iniciar el flujo de Firebase.
r.post('/auth/phone/send-code', wrap(async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return fail(res, 400, 'INVALID_PHONE', 'El telefono debe venir en formato internacional (+56912345678)', { field: 'phone' });
  const locale = detectLocale(phone);
  if (!locale.supported) {
    return fail(res, 422, 'COUNTRY_NOT_SUPPORTED', 'Por ahora solo operamos en Chile (+56) y Reino Unido (+44)', { field: 'phone' });
  }
  const existing = await queryOne(COL.users, [['phone', '==', phone]]);
  return ok(res, {
    phone,
    masked: maskPhone(phone),
    verifier: 'firebase',            // el cliente pide el SMS con Firebase Auth
    codeLength: 6,
    detectedCountry: locale.country,
    detectedLanguage: locale.language,
    dialCode: locale.dialCode,
    accountExists: !!existing,       // permite al cliente ofrecer "iniciar sesion"
  });
}));

// POST /auth/phone/verify-code
// Recibe el idToken de Firebase (resultado del SMS) y emite un phoneToken corto
// que se canjea al registrarse o al asociar el telefono a una cuenta social.
r.post('/auth/phone/verify-code', wrap(async (req, res) => {
  const { firebaseIdToken, idToken, phone: claimedPhone } = req.body || {};
  let verified;
  try {
    verified = await verifyPhoneIdToken(firebaseIdToken || idToken);
  } catch (e) {
    if (e instanceof PhoneVerificationError) {
      const status = e.code === 'VALIDATION_ERROR' ? 400 : e.code === 'PHONE_AUTH_UNAVAILABLE' ? 503 : 401;
      return fail(res, status, e.code, e.message);
    }
    throw e;
  }
  const phone = normalizePhone(verified.phone);
  if (!phone) return fail(res, 422, 'INVALID_PHONE', 'El telefono verificado no tiene formato valido');
  if (claimedPhone && normalizePhone(claimedPhone) !== phone) {
    return fail(res, 409, 'PHONE_MISMATCH', 'El telefono verificado no coincide con el solicitado');
  }
  const locale = detectLocale(phone);
  if (!locale.supported) {
    return fail(res, 422, 'COUNTRY_NOT_SUPPORTED', 'Por ahora solo operamos en Chile (+56) y Reino Unido (+44)');
  }
  const existing = await queryOne(COL.users, [['phone', '==', phone]]);
  return ok(res, {
    phoneToken: signPhone({
      phone, country: locale.country, language: locale.language,
      firebaseUid: verified.firebaseUid, provider: verified.provider,
    }),
    expiresIn: phoneTtl,
    phone,
    country: locale.country,
    language: locale.language,
    accountExists: !!existing,
  });
}));

// POST /auth/register
r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, consent, locale, phoneToken, country, language, gradeId } = req.body || {};
  if (!name || !email || !password) return fail(res, 400, 'VALIDATION_ERROR', 'Nombre, correo y contrasena son obligatorios');
  if (String(password).length < 8) return fail(res, 400, 'WEAK_PASSWORD', 'La contrasena debe tener al menos 8 caracteres');
  if (!consent) return fail(res, 400, 'CONSENT_REQUIRED', 'Debe aceptarse el tratamiento de datos');
  const exists = await queryOne(COL.users, [['emailLower', '==', String(email).toLowerCase()]]);
  if (exists) return fail(res, 409, 'EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese correo');

  // Telefono verificado (pantalla sms-verification). Obligatorio salvo que se
  // desactive con PHONE_VERIFICATION_REQUIRED=false (util para tests/demos).
  const phoneRequired = process.env.PHONE_VERIFICATION_REQUIRED !== 'false';
  const verifiedPhone = phoneToken ? consumePhoneToken(phoneToken) : null;
  if (phoneToken && !verifiedPhone) return fail(res, 401, 'PHONE_TOKEN_INVALID', 'El phoneToken es invalido o expiro', { field: 'phoneToken' });
  if (phoneRequired && !verifiedPhone) return fail(res, 400, 'PHONE_VERIFICATION_REQUIRED', 'Debes verificar tu telefono antes de crear la cuenta', { field: 'phoneToken' });
  if (verifiedPhone) {
    const phoneTaken = await queryOne(COL.users, [['phone', '==', verifiedPhone.phone]]);
    if (phoneTaken) return fail(res, 409, 'PHONE_ALREADY_IN_USE', 'Ya existe una cuenta con ese telefono', { field: 'phoneToken' });
  }
  if (country && !findCountry(country)) return fail(res, 400, 'VALIDATION_ERROR', 'country invalido', { field: 'country' });

  const resolvedCountry = (country || verifiedPhone?.country || 'CL').toUpperCase();
  const resolvedLanguage = language || locale || verifiedPhone?.language || 'es';
  const id = genId('usr');
  const user = {
    id, name, email, emailLower: String(email).toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 8), authProvider: 'password',
    phone: verifiedPhone?.phone || null, phoneVerified: !!verifiedPhone,
    firebaseUid: verifiedPhone?.firebaseUid || null,
    country: resolvedCountry, language: resolvedLanguage, gradeId: gradeId || null,
    plan: 'free', state: 'active', locale: resolvedLanguage, theme: 'light', dailyReminder: true,
    streak: 0, quota: { day: todayKey(), used: 0 }, bonuses: { school: false, address: false },
    medals: emptyWallet(), selectedTests: [], format: 'random', difficulty: 'd2',
    onboarded: false, createdAt: new Date().toISOString(),
  };
  award(user.medals, 'bronze', 1); // bronce de bienvenida
  await set(COL.users, id, user);
  return created(res, {
    user: publicUser(user), accessToken: signAccess(user), refreshToken: signRefresh(user), expiresIn: accessTtl,
  });
}));

// POST /auth/login
r.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, 'VALIDATION_ERROR', 'email y password son obligatorios');
  const user = await queryOne(COL.users, [['emailLower', '==', String(email).toLowerCase()]]);
  if (!user || !bcrypt.compareSync(password, user.passwordHash || '')) {
    return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'El correo o la contrasena son incorrectos');
  }
  if (user.state === 'suspended') return fail(res, 403, 'ACCOUNT_SUSPENDED', 'La cuenta esta suspendida');
  const reward = await dailyLoginReward(user);
  return ok(res, {
    user: publicUser(user), accessToken: signAccess(user), refreshToken: signRefresh(user),
    dailyLoginReward: reward,
  });
}));

// POST /auth/social  (demo: confia en el email del idToken simulado)
// El idToken no se verifica contra Google ni Apple, asi que cualquiera puede
// fabricarlo: solo se acepta en modo demo (ver lib/demo.js).
r.post('/auth/social', wrap(async (req, res) => {
  if (!demoMode()) return fail(res, 503, 'SOCIAL_LOGIN_UNAVAILABLE', 'El inicio de sesion con Google o Apple aun no esta habilitado');
  const { provider, idToken, locale, phoneToken } = req.body || {};
  if (!provider || !idToken) return fail(res, 400, 'VALIDATION_ERROR', 'provider e idToken son obligatorios');
  // En demo el idToken trae "provider:email:nombre"
  const [, email, name] = String(idToken).split(':');
  if (!email) return fail(res, 401, 'SOCIAL_TOKEN_INVALID', 'El idToken del proveedor no es valido');

  // El login social puede traer ya el telefono verificado (flujo social -> /onboarding/phone).
  const verifiedPhone = phoneToken ? consumePhoneToken(phoneToken) : null;
  if (phoneToken && !verifiedPhone) return fail(res, 401, 'PHONE_TOKEN_INVALID', 'El phoneToken es invalido o expiro', { field: 'phoneToken' });
  if (verifiedPhone) {
    const phoneTaken = await queryOne(COL.users, [['phone', '==', verifiedPhone.phone]], (u) => u.emailLower !== email.toLowerCase());
    if (phoneTaken) return fail(res, 409, 'PHONE_ALREADY_IN_USE', 'Ya existe una cuenta con ese telefono', { field: 'phoneToken' });
  }

  let user = await queryOne(COL.users, [['emailLower', '==', email.toLowerCase()]]);
  // Incluso en demo, un token fabricado no puede entrar a una cuenta con
  // contrasena: eso permitia suplantar a cualquier usuario conociendo su correo.
  if (user && user.authProvider === 'password') {
    return fail(res, 409, 'ACCOUNT_USES_PASSWORD', 'Esa cuenta usa correo y contrasena; inicia sesion con ellos');
  }
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const id = genId('usr');
    const language = locale || verifiedPhone?.language || 'es';
    user = {
      id, name: name || email.split('@')[0], email, emailLower: email.toLowerCase(),
      authProvider: provider, plan: 'free', state: 'active', locale: language, theme: 'light',
      phone: verifiedPhone?.phone || null, phoneVerified: !!verifiedPhone,
      firebaseUid: verifiedPhone?.firebaseUid || null,
      country: (verifiedPhone?.country || 'CL'), language, gradeId: null,
      dailyReminder: true, streak: 0, quota: { day: todayKey(), used: 0 },
      bonuses: { school: false, address: false }, medals: emptyWallet(),
      selectedTests: [], format: 'random', difficulty: 'd2', onboarded: false, createdAt: new Date().toISOString(),
    };
    award(user.medals, 'bronze', 1);
    await set(COL.users, id, user);
  } else if (verifiedPhone && !user.phoneVerified) {
    user.phone = verifiedPhone.phone;
    user.phoneVerified = true;
    user.firebaseUid = verifiedPhone.firebaseUid || user.firebaseUid || null;
    user.country = user.country || verifiedPhone.country || 'CL';
    await set(COL.users, user.id, user);
  }
  await dailyLoginReward(user);
  return ok(res, {
    user: publicUser(user), isNewUser,
    // El cliente manda a /onboarding/phone mientras esto sea true.
    phoneVerificationRequired: !user.phoneVerified,
    accessToken: signAccess(user), refreshToken: signRefresh(user),
  });
}));

// POST /auth/refresh
r.post('/auth/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return fail(res, 400, 'VALIDATION_ERROR', 'refreshToken es obligatorio');
  let payload;
  try { payload = verify(refreshToken); } catch { return fail(res, 401, 'REFRESH_TOKEN_INVALID', 'El refresh token es invalido'); }
  if (payload.typ !== 'refresh') return fail(res, 401, 'REFRESH_TOKEN_INVALID', 'Tipo de token invalido');
  const user = await get(COL.users, payload.sub);
  if (!user) return fail(res, 401, 'REFRESH_TOKEN_INVALID', 'Usuario no encontrado');
  return ok(res, { accessToken: signAccess(user), refreshToken: signRefresh(user), expiresIn: accessTtl });
}));

// POST /auth/logout
r.post('/auth/logout', authRequired, wrap(async (_req, res) => noContent(res)));

// POST /auth/password/forgot  (siempre 200)
r.post('/auth/password/forgot', wrap(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return fail(res, 400, 'VALIDATION_ERROR', 'email es obligatorio');
  const user = await queryOne(COL.users, [['emailLower', '==', String(email).toLowerCase()]]);
  if (user) {
    const token = genId('rst');
    await set(COL.users, user.id, { ...user, resetToken: token });
    console.log(`[demo] enlace de recuperacion para ${email}: token=${token}`);
  }
  return ok(res, { sent: true });
}));

// POST /auth/password/reset
r.post('/auth/password/reset', wrap(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return fail(res, 400, 'VALIDATION_ERROR', 'token y password son obligatorios');
  if (String(password).length < 8) return fail(res, 400, 'WEAK_PASSWORD', 'La contrasena debe tener al menos 8 caracteres');
  const user = await queryOne(COL.users, [['resetToken', '==', token]]);
  if (!user) return fail(res, 400, 'RESET_TOKEN_INVALID', 'El token de recuperacion es invalido o expiro');
  await set(COL.users, user.id, { ...user, passwordHash: bcrypt.hashSync(password, 8), resetToken: null });
  return ok(res, { reset: true });
}));

export { dailyLoginReward, publicUser };
export default r;
