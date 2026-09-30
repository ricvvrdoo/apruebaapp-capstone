// Importa SOLO el banco de preguntas a la coleccion `questions`.
// Es idempotente: los IDs son deterministas, asi que correrlo de nuevo
// actualiza las mismas preguntas en vez de duplicarlas. No toca usuarios,
// respuestas ni ninguna otra coleccion.
//
//   Uso:  PAES_DIR=<carpeta con "PAES Chile *"> npm run import:preguntas
//
// Con DATA_DRIVER=firestore escribe en el proyecto de las credenciales
// configuradas (ver .env.example); el proyecto destino se muestra antes.
import 'dotenv/config';
import { bulkSet, driverName, COL } from '../data/repo.js';
import { loadQuestionBank, printReport } from './questions.js';

let bank;
try {
  bank = loadQuestionBank(process.env.PAES_DIR);
} catch (e) {
  console.error(`[import] ${e.message}`);
  process.exit(1);
}
printReport(bank.report);

let target = 'memoria (.data/db.json)';
if (driverName === 'firestore') {
  const { getFirebaseAdmin } = await import('../config/firebase.js');
  const admin = await getFirebaseAdmin();
  target = `Firestore, proyecto ${admin.app().options.projectId || '(del entorno)'}${process.env.FIRESTORE_EMULATOR_HOST ? ` (emulador ${process.env.FIRESTORE_EMULATOR_HOST})` : ''}`;
}
console.log(`[import] destino: ${target}`);

const written = await bulkSet(COL.questions, Object.values(bank.questions));
console.log(`[import] listo: ${written} preguntas escritas en '${COL.questions}'.`);
process.exit(0);
