// Lectura del banco de preguntas PAES desde los JSON de las carpetas
// "PAES Chile *" (material de la empresa, fuera del repositorio). Lo usan el
// seed completo y la importacion de solo preguntas (import-questions.js).
//
// Mapeo segun MODELO_CAMBIOS.md seccion 4: pregunta -> statement,
// alternativas -> options, respuesta_correcta (letra) -> correctIndex,
// explicacion_respuesta -> explanation (+ shortExplanation), habilidad_requerida
// -> habilidad; se agregan testId, testLabel, axis, difficulty y published.
//
// Los IDs y `rand` son deterministas (derivados del archivo y la posicion de la
// pregunta en el): reimportar actualiza las mismas preguntas en vez de
// duplicarlas, y las respuestas ya guardadas siguen apuntando a IDs validos.
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Catalogo de pruebas (alineado al doc de API).
export const TESTS = {
  lectora: { id: 'lectora', label: 'Comp. Lectora', color: '#1A365D', order: 1 },
  m1: { id: 'm1', label: 'Matematica M1', color: '#10B981', order: 2 },
  m2: { id: 'm2', label: 'Matematica M2', color: '#6366F1', order: 3 },
  cien: { id: 'cien', label: 'Ciencias', color: '#F5B041', order: 4 },
  hist: { id: 'hist', label: 'Historia y C. Soc.', color: '#EF4444', order: 5 },
};

// Carpeta PAES -> testId
const SOURCES = [
  { dir: 'PAES Chile Verbal', testId: 'lectora', axis: 'Comprension lectora' },
  { dir: 'PAES Chile Matematica', testId: 'm1', axis: 'Numeros y Algebra' },
  { dir: 'PAES Chile Biologia', testId: 'cien', axis: 'Biologia' },
];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ID y rand estables para la pregunta `index` del archivo `source`.
function stableKeys(source, index) {
  const h = createHash('sha1').update(`${source}#${index}`).digest('hex');
  return { id: `qst_${h.slice(0, 10)}`, rand: parseInt(h.slice(10, 18), 16) / 0x100000000 };
}

// Lee el banco desde `baseDir` (la carpeta que contiene "PAES Chile *").
// Devuelve { questions: { id: doc }, report } y lanza error si no encuentra
// ninguna carpeta de origen, para no importar un banco vacio sin avisar.
export function loadQuestionBank(baseDir) {
  if (!baseDir) {
    throw new Error('Falta PAES_DIR: ruta a la carpeta que contiene "PAES Chile Verbal", "PAES Chile Matematica", etc.');
  }
  const found = SOURCES.filter((s) => fs.existsSync(path.join(baseDir, s.dir)));
  if (!found.length) {
    throw new Error(`PAES_DIR=${baseDir} no contiene ninguna carpeta "PAES Chile *"`);
  }

  const questions = {};
  const report = { files: [], invalidFiles: [], missingDirs: SOURCES.filter((s) => !found.includes(s)).map((s) => s.dir) };
  for (const src of found) {
    const dir = path.join(baseDir, src.dir);
    // Orden alfabetico: readdirSync no garantiza orden y la dificultad depende de el.
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
    let i = 0;
    for (const file of files) {
      const source = `${src.dir}/${file}`;
      let arr;
      try { arr = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
      catch (e) { report.invalidFiles.push({ source, error: e.message }); continue; }
      if (!Array.isArray(arr)) { report.invalidFiles.push({ source, error: 'no es un arreglo de preguntas' }); continue; }
      let loaded = 0, discarded = 0;
      arr.forEach((item, index) => {
        const options = item.alternativas || [];
        const correctIndex = LETTERS.indexOf(String(item.respuesta_correcta || '').trim().toUpperCase());
        if (!item.pregunta || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) { discarded++; return; }
        const { id, rand } = stableKeys(source, index);
        // La dificultad no viene en el origen: se asigna por posicion (MODELO_CAMBIOS.md seccion 4).
        const difficulty = ['d1', 'd2', 'd2', 'd3', 'd3', 'd4'][i % 6];
        questions[id] = {
          id, testId: src.testId, testLabel: TESTS[src.testId].label, axis: src.axis, difficulty,
          statement: item.pregunta, options, correctIndex, published: true,
          shortExplanation: String(item.explicacion_respuesta || '').split(/(?<=\.)\s/)[0].slice(0, 200),
          explanation: item.explicacion_respuesta || '',
          habilidad: item.habilidad_requerida || '', source, sourceIndex: index,
          // Clave de seleccion aleatoria de GET /practice/next (ver pickQuestion).
          rand,
          createdAt: new Date().toISOString(),
        };
        i++; loaded++;
      });
      report.files.push({ source, testId: src.testId, loaded, discarded });
    }
  }
  report.total = Object.keys(questions).length;
  report.byTest = report.files.reduce((acc, f) => ({ ...acc, [f.testId]: (acc[f.testId] || 0) + f.loaded }), {});
  return { questions, report };
}

export function printReport(report, log = console.log) {
  log(`[banco] ${report.total} preguntas en ${report.files.length} archivos: ${JSON.stringify(report.byTest)}`);
  const withDiscards = report.files.filter((f) => f.discarded);
  for (const f of withDiscards) log(`[banco]   ${f.source}: ${f.discarded} preguntas descartadas (sin enunciado, alternativas o respuesta valida)`);
  for (const f of report.invalidFiles) log(`[banco] OMITIDO ${f.source}: ${f.error}`);
  for (const d of report.missingDirs) log(`[banco] carpeta no encontrada: ${d}`);
}
