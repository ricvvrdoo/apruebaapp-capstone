// Inicializacion perezosa de Firebase Admin, compartida por el driver Firestore
// y la verificacion telefonica (una sola app, unas mismas credenciales).
//
// Credenciales, en este orden:
//   1. FIREBASE_SERVICE_ACCOUNT: JSON de la cuenta de servicio, en texto o en
//      base64. Es la opcion para Vercel, donde no hay archivo de clave en disco.
//   2. Emulador (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST): sin
//      credenciales reales.
//   3. applicationDefault(): GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON, o
//      las credenciales del entorno de GCP.
import fs from 'fs';

let _admin = null;
let _db = null;
let _FieldValue = null;

function readServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON valido (ni en texto ni en base64)');
  }
}

// project_id del archivo apuntado por GOOGLE_APPLICATION_CREDENTIALS, si existe.
function keyFileProjectId() {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!file) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).project_id;
  } catch {
    return undefined;
  }
}

export async function getFirebaseAdmin() {
  if (_admin) return _admin;
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    const serviceAccount = readServiceAccount();
    // Sin GCLOUD_PROJECT, el proyecto sale de la credencial (variable o archivo
    // de clave). No se fuerza un valor por defecto: pisaria el de la clave.
    const projectId = process.env.GCLOUD_PROJECT || serviceAccount?.project_id || keyFileProjectId();
    const usingEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (serviceAccount) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
    } else if (usingEmulator) {
      // El emulador no valida credenciales, pero exige un projectId.
      admin.initializeApp({ projectId: projectId || 'aprueba-dev' });
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), ...(projectId ? { projectId } : {}) });
    }
    const origen = serviceAccount ? 'cuenta de servicio por variable de entorno'
      : usingEmulator ? `emulador Firestore ${process.env.FIRESTORE_EMULATOR_HOST || '-'}, Auth ${process.env.FIREBASE_AUTH_EMULATOR_HOST || '-'}`
        : 'credenciales del entorno';
    console.log(`[firebase] Proyecto ${admin.app().options.projectId || '(del entorno)'} (${origen})`);
  }
  _admin = admin;
  return _admin;
}

export async function initFirestore() {
  if (_db) return { db: _db, FieldValue: _FieldValue };
  const admin = await getFirebaseAdmin();
  _db = admin.firestore();
  _FieldValue = admin.firestore.FieldValue;
  return { db: _db, FieldValue: _FieldValue };
}
