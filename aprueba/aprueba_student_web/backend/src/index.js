import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { demoMode } from './lib/demo.js';
import openapi from './docs/openapi.json' with { type: 'json' };

import { notFound, errorHandler } from './middleware/error.js';
import { docsAccess } from './middleware/docsAccess.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import meRoutes from './routes/me.js';
import practiceRoutes from './routes/practice.js';
import correctionsRoutes from './routes/corrections.js';
import groupsRoutes from './routes/groups.js';
import communityRoutes from './routes/community.js';
import checkoutRoutes from './routes/checkout.js';
import tutorsRoutes from './routes/tutors.js';
import conversationsRoutes from './routes/conversations.js';

const app = express();
app.use(helmet());

// CORS: la API y el frontend web viven en dominios distintos. Solo se aceptan
// los origenes de CORS_ORIGINS (lista exacta, separada por coma) y, si se
// define, los que calzan con CORS_ORIGIN_REGEX (los previews del frontend, cuya
// URL cambia en cada despliegue). Sin ninguna de las dos: cualquier origen en
// desarrollo y ninguno en produccion. Sin credenciales de navegador: la sesion
// viaja como token Bearer en la cabecera Authorization. Las peticiones sin
// Origin (app movil, curl) no pasan por CORS, que es un control del navegador.
// Se lee en cada peticion, para poder probarla sin reiniciar.
function corsOriginAllowed(origin) {
  const list = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const pattern = process.env.CORS_ORIGIN_REGEX;
  if (!list.length && !pattern) return process.env.NODE_ENV !== 'production';
  // Anclado siempre: un patron suelto como "aprueba-student" tambien calzaria
  // con "https://aprueba-student.evil.com".
  return list.includes(origin) || (!!pattern && new RegExp(`^(?:${pattern})$`).test(origin));
}
app.use(cors({
  origin: (origin, done) => done(null, !origin || corsOriginAllowed(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false,
  maxAge: 600,
}));
app.use(express.json({ limit: '5mb' }));

if (demoMode()) {
  console.warn('[demo] DEMO_MODE activo: se permiten activar planes sin pago, login social sin verificar '
    + 'y tokens de telefono dev:. Desactivar antes de tener usuarios reales.');
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aprueba-student-api', driver: process.env.DATA_DRIVER || 'memory' }));

// Documentacion de la API: contrato OpenAPI 3.1 generado desde el codigo
// (npm run openapi:generar) y su vista navegable. El acceso lo controla
// API_DOCS (ver middleware/docsAccess.js). Van antes de los routers de
// /api/v1, que exigen sesion a nivel de router.
app.get('/api/v1/openapi.json', docsAccess, (_req, res) => res.json(openapi));
app.use('/api/docs', docsAccess, swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'Aprueba · API del alumno',
  customfavIcon: '/favicon-32x32.png',
  swaggerOptions: { docExpansion: 'none', operationsSorter: 'alpha', displayRequestDuration: true },
}));

const v1 = express.Router();
// OJO con el orden: varios routers aplican authRequired a nivel de router
// (r.use), asi que cualquier ruta publica debe montarse ANTES de ellos; si no,
// el middleware del router anterior la intercepta. Por eso /webhooks/stripe
// (checkoutRoutes) va antes de meRoutes.
v1.use(authRoutes);       // /auth/*, /auth/phone/*
v1.use(catalogRoutes);    // /countries, /tests, /plans, /benefits
v1.use(checkoutRoutes);   // /checkout/*, /webhooks/stripe (webhook publico)
v1.use(meRoutes);         // /me/*, /devices
v1.use(practiceRoutes);   // /practice/next, /questions/*
v1.use(correctionsRoutes);// /corrections
v1.use(groupsRoutes);     // /groups/*, /invitations/*
v1.use(communityRoutes);  // /feed, /posts/*
v1.use(tutorsRoutes);     // /tutors/*, /me/gap-analysis
v1.use(conversationsRoutes); // /me/conversations, /conversations/*
app.use('/api/v1', v1);

app.use(notFound);
app.use(errorHandler);

// En Vercel (VERCEL=1) la app se exporta como funcion serverless desde
// ../api/index.js y la plataforma atiende las peticiones: no se abre un puerto.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4100;
  app.listen(PORT, () => console.log(`[aprueba-student-api] escuchando en http://localhost:${PORT}/api/v1 (driver: ${process.env.DATA_DRIVER || 'memory'})`));
}

export default app;
