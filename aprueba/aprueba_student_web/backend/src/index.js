import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { notFound, errorHandler } from './middleware/error.js';
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
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aprueba-student-api', driver: process.env.DATA_DRIVER || 'memory' }));

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

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => console.log(`[aprueba-student-api] escuchando en http://localhost:${PORT}/api/v1 (driver: ${process.env.DATA_DRIVER || 'memory'})`));

export default app;
