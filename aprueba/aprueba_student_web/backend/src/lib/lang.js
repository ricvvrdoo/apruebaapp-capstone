// Idioma de las respuestas y etiquetas traducibles de pruebas y ejes.
import { TEST_LABELS_EN, AXIS_LABELS_EN } from '../data/catalog.js';
import { COL, list } from '../data/repo.js';

// ?lang= explicito; si no, el idioma que el alumno eligio. `locale` manda sobre
// `language`: PATCH /me/settings (el selector de idioma de la web y de la app)
// solo cambia `locale`, mientras `language` queda con el valor del alta.
export const langOf = (req) => (String(req.query?.lang || req.user?.locale || req.user?.language || 'es') === 'en' ? 'en' : 'es');

// Las pruebas casi no cambian: una lectura por minuto en vez de una por peticion.
const TESTS_TTL_MS = 60_000;
let cache = { at: 0, rows: [] };
export async function getTests() {
  if (Date.now() - cache.at > TESTS_TTL_MS) cache = { at: Date.now(), rows: await list(COL.tests) };
  return cache.rows;
}

// La coleccion `tests` solo trae el nombre en espanol.
export const testLabel = (test, lang) => (lang === 'en' ? TEST_LABELS_EN[test.id] || test.label : test.label);
export const axisLabel = (axis, lang) => (lang === 'en' ? AXIS_LABELS_EN[axis] || axis : axis);
