// Inicializacion perezosa de Firebase Admin (solo si DATA_DRIVER=firestore).
let _db = null;
let _FieldValue = null;

export async function initFirestore() {
  if (_db) return { db: _db, FieldValue: _FieldValue };
  const adminMod = await import('firebase-admin');
  const admin = adminMod.default;
  const projectId = process.env.GCLOUD_PROJECT || 'aprueba-dev';
  if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId });
      console.log(`[firebase] Emulador Firestore en ${process.env.FIRESTORE_EMULATOR_HOST}`);
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
      console.log('[firebase] Firestore (credenciales del entorno)');
    }
  }
  _db = admin.firestore();
  _FieldValue = admin.firestore.FieldValue;
  return { db: _db, FieldValue: _FieldValue };
}
