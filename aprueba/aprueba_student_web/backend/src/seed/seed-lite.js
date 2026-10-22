// Seed reducido para desarrollar sin el banco de la empresa (PAES_DIR).
//
//   npm run seed:ejemplo
//
// Corre el seed real (usuarios demo, grupos, tutores, planes, beneficios) pero con
// un banco de ejemplo de 30 preguntas originales (src/seed/ejemplo/). Sirve para
// entrar a la app, probar el flujo y correr el smoke; NO es contenido para alumnos.
// Para el banco completo, usar `PAES_DIR=<carpeta> npm run seed`.
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Contra un Firestore real mezclaria preguntas de ejemplo con las del banco oficial.
// Solo se permite con el emulador (FIRESTORE_EMULATOR_HOST) o con el driver en memoria.
if (process.env.DATA_DRIVER === 'firestore' && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('[seed:ejemplo] Se niega a correr contra Firestore real: usa el emulador o el driver "memory".');
  console.error('[seed:ejemplo] Para el banco oficial: PAES_DIR=<carpeta> npm run seed');
  process.exit(1);
}

process.env.PAES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ejemplo');
console.log(`[seed:ejemplo] banco de ejemplo en ${process.env.PAES_DIR}`);
await import('./seed.js');
