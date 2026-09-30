// Verificacion del telefono con Firebase Authentication.
//
// El SMS lo envia el cliente (Flutter) con Firebase Auth phone sign-in; el backend
// solo valida el idToken resultante y confirma que trae un phone_number verificado.
// En desarrollo, si no hay credenciales de Firebase, se acepta un token de prueba
// con formato  dev:+56912345678  (solo si PHONE_AUTH_ALLOW_DEV_TOKEN=true).
import { getFirebaseAdmin } from '../config/firebase.js';

let _auth = null;

const devTokensAllowed = () =>
  process.env.PHONE_AUTH_ALLOW_DEV_TOKEN === 'true' && process.env.NODE_ENV !== 'production';

async function firebaseAuth() {
  if (_auth) return _auth;
  _auth = (await getFirebaseAdmin()).auth();
  return _auth;
}

export class PhoneVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Devuelve { phone, firebaseUid, provider } o lanza PhoneVerificationError.
export async function verifyPhoneIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) throw new PhoneVerificationError('VALIDATION_ERROR', 'firebaseIdToken es obligatorio');

  if (token.startsWith('dev:')) {
    if (!devTokensAllowed()) {
      throw new PhoneVerificationError('PHONE_TOKEN_INVALID', 'Los tokens de desarrollo estan deshabilitados');
    }
    const phone = token.slice(4);
    return { phone, firebaseUid: `dev_${phone.replace(/\D/g, '')}`, provider: 'dev' };
  }

  let decoded;
  try {
    const auth = await firebaseAuth();
    decoded = await auth.verifyIdToken(token, true);
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package 'firebase-admin'/.test(e?.message || '')) {
      throw new PhoneVerificationError(
        'PHONE_AUTH_UNAVAILABLE',
        'firebase-admin no esta instalado; instalalo o usa PHONE_AUTH_ALLOW_DEV_TOKEN=true en desarrollo',
      );
    }
    throw new PhoneVerificationError('PHONE_TOKEN_INVALID', 'El idToken de Firebase es invalido o expiro');
  }

  const phone = decoded.phone_number || decoded.firebase?.identities?.phone?.[0];
  const signInProvider = decoded.firebase?.sign_in_provider;
  // Exigimos que la sesion venga del flujo de telefono: un idToken de Google con
  // un numero vinculado no prueba posesion del telefono.
  if (!phone || signInProvider !== 'phone') {
    throw new PhoneVerificationError('PHONE_NOT_VERIFIED', 'El idToken no corresponde a una verificacion telefonica');
  }
  return { phone, firebaseUid: decoded.uid, provider: 'firebase' };
}
