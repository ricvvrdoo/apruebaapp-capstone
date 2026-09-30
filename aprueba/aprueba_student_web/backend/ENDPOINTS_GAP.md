# Endpoints nuevos — cierre del gap wireframe `Aprueba_App.html` ↔ backend

Base: `/api/v1`. Envelope estándar `{ data, error, meta }`.
Estado: **todos los endpoints listados están implementados y verificados** con `npm run seed && npm run smoke` (92 checks, 0 fallos).

Decisiones de diseño acordadas:

- **Teléfono**: Firebase Auth phone. El SMS lo envía el cliente Flutter; el backend valida el `idToken` y emite un `phoneToken` corto que se canjea al registrarse.
- **Tutores**: administrados desde la consola admin (`/api/v1/admin/tutors`); la app del alumno solo lee, reseña, contacta y chatea.
- **Chat**: REST + polling (`unreadCount` para el badge, cursor opaco para el historial).

---

## 1. Verificación telefónica (pantalla `sms-verification`)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/phone/send-code` | `{ phone }` | `{ phone, masked, verifier:'firebase', codeLength, detectedCountry, detectedLanguage, dialCode, accountExists }` |
| POST | `/auth/phone/verify-code` | `{ firebaseIdToken, phone? }` | `{ phoneToken, expiresIn, phone, country, language, accountExists }` |
| PATCH | `/me/phone` | `{ phoneToken }` | `{ phone, phoneVerified, country, language }` |

- `send-code` **no** envía SMS: valida E.164, deriva país/idioma del prefijo (+56 → CL/es, +44 → UK/en) y alimenta `confirm-locale`. `422 COUNTRY_NOT_SUPPORTED` fuera de CL/UK.
- `/auth/register` ahora acepta `phoneToken`, `country`, `language`, `gradeId`. Sin `phoneToken` → `400 PHONE_VERIFICATION_REQUIRED` (desactivable con `PHONE_VERIFICATION_REQUIRED=false`). Teléfono repetido → `409 PHONE_ALREADY_IN_USE`.
- `/auth/social` acepta `phoneToken` y devuelve `phoneVerificationRequired`, que es lo que manda al flujo `/onboarding/phone`.
- En desarrollo, `PHONE_AUTH_ALLOW_DEV_TOKEN=true` habilita tokens `dev:+56912345678`. En producción hace falta `npm install firebase-admin` (si falta, responde `503 PHONE_AUTH_UNAVAILABLE`).

## 2. Catálogo país / grado / asignaturas (`confirm-locale`, `select-grade`, `select-tests`)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/countries` | público. `{ code, name, dialCode, flag, languages, defaultLanguage, currency }` |
| GET | `/countries/:code/grades?lang=` | público. Grupos del wireframe: básica 1-8, media 1-4, PAES / primary, secondary, sixth form, GCSE, A levels |
| GET | `/tests?gradeId=&lang=` | asignaturas del grado; `hasQuestions:true` cuando salen de la colección `tests` (PAES con preguntas reales) |

La fuente de verdad quedó en `src/data/catalog.js` (antes duplicada en el wireframe y en `education_catalog.dart`).

## 3. Persistencia del onboarding

- `PUT /me/preferences` acepta `{ country, language, gradeId, selectedTests, format?, difficulty? }`. `format`/`difficulty` pasaron a opcionales. Valida grado (`400 INVALID_GRADE`) y coherencia con el país (`422 GRADE_COUNTRY_MISMATCH`).
- `GET /me` y `GET /me/preferences` exponen `phone`, `phoneVerified`, `country`, `language`, `gradeId`, `onboarded`.

## 4. Marketplace de tutores

| Método | Ruta | Notas |
|---|---|---|
| GET | `/tutors` | `q`, `subject`, `mode`, `verified`, `featured`, `sort=rating\|price_asc\|price_desc\|experience`, `limit`, `cursor`. `meta.premium` indica si el plan permite contactar |
| GET | `/tutors/featured` | bloque "Profesores destacados" |
| GET | `/tutors/:id` | bio, precio, `ratingByCriterion`, reseña destacada, `contacted`, `canReview`, `conversationId` |
| GET | `/tutors/:id/reviews` | paginado + `meta.summary` (promedio global y por criterio) |
| POST | `/tutors/:id/reviews` | `{ ratings:{ teaching, punctuality, mastery }, comment? }`. Exige contacto previo (`403 REVIEW_NOT_ALLOWED`), una por alumno (`409 REVIEW_ALREADY_EXISTS`) |
| POST | `/tutors/:id/contact-requests` | **Premium**. `{ message, shareProfile? }` → crea solicitud + conversación. Idempotente: si ya existe, agrega el mensaje y responde `200 { created:false }` |
| GET | `/me/gap-analysis` | **Premium**. Dominio por prueba, `areasToReinforce`, `recommendedTutorCount`, ordenado de mayor a menor necesidad |

El plan free recibe `403 PLAN_REQUIRED` en contacto y análisis (middleware `premiumRequired`).
Las valoraciones combinan la reputación histórica del tutor (`ratingSeed`/`reviewCountSeed`) con las reseñas creadas en la app.

## 5. Chat con tutores (REST + polling)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/me/conversations` | `unreadCount` por chat y `meta.unreadTotal` |
| GET | `/conversations/:id` | perfil compartido en la solicitud + estado de contacto |
| GET | `/conversations/:id/messages` | orden descendente, cursor opaco, marca leídos (`?markRead=false` para no marcar) |
| POST | `/conversations/:id/messages` | `{ text }` (máx. 2000) |
| POST | `/conversations/:id/read` | pone el badge en cero |
| PATCH | `/conversations/:id/contact-sharing` | `{ shareWhatsapp }`. El teléfono se revela **solo con consentimiento mutuo**; requiere teléfono verificado (`422 PHONE_REQUIRED`) |

## 6. Huecos menores cerrados

| Método | Ruta | Motivo |
|---|---|---|
| GET | `/corrections/:id` | la pantalla `recorreccion` consulta el veredicto mientras está `pending` |
| POST | `/posts/:id/repost` | contador 🔁 del feed (toggle) |
| DELETE | `/posts/:id` | solo autor (`403 NOT_POST_AUTHOR`), limpia comentarios/likes/reposts |
| DELETE | `/posts/:id/comments/:commentId` | autor del comentario o del post |
| POST | `/me/notifications/read-all` | marcar todo leído |
| DELETE | `/groups/:id/members/me` | salir del grupo; traspasa la propiedad o elimina el grupo si queda vacío |
| GET | `/benefits/:id` | detalle del beneficio + cupones ya canjeados |

`GET /feed` ahora devuelve `reposts`, `reposted` y `mine`.

## 7. Consola admin — alta de tutores

Nuevo router `aprueba_admin_web/backend/src/routes/tutors.js`:

`GET /admin/tutors`, `GET /admin/tutors/:id`, `POST /admin/tutors`, `PUT /admin/tutors/:id`,
`PATCH /admin/tutors/:id/verification`, `DELETE /admin/tutors/:id` (`?hard=true` borra, por defecto pausa),
`DELETE /admin/tutors/:id/reviews/:reviewId` (moderación). Rol `support`; el borrado duro exige `admin`.

## 8. Cliente Flutter

`aprueba_app/lib/core/network/endpoints.dart` quedó sincronizado: tutores, conversaciones, `me/gap-analysis`,
`countries`/`grades`, `me/phone`, `corrections/:id`, repost, borrado de post/comentario, `groups/:id/members/me`,
`notifications/read-all`, `benefits/:id` y el faltante `checkout/sessions/:id/confirm`.

---

## Cómo verificar

```bash
cd aprueba_student_web/backend
npm install
npm run seed          # siembra tutores, reseñas y una conversación demo
npm run smoke         # 92 checks sobre los endpoints nuevos + regresión
```

Usuarios demo: `demo@aprueba.cl` (free), `camila@correo.cl` (plan `all`, premium), `juan@correo.cl` — contraseña `demo1234`.

## Hallazgos de seguridad preexistentes (NO tocados, requieren decisión)

Salieron en la revisión de código de este cambio pero son del código anterior:

1. **`POST /auth/social` acepta un idToken falsificable** (`routes/auth.js`): el formato demo `provider:email:nombre` permite entrar como cualquier cuenta existente sin contraseña. Hay que verificar el token del proveedor (mismo patrón que `lib/firebasePhone.js`) y dejar el atajo detrás de un flag de desarrollo.
2. **`JWT_SECRET` cae a `'dev-secret'`** en ambos backends si falta la variable: conviene abortar el arranque en producción.
3. **`GET /groups/:id/invitations` no valida membresía**: cualquier usuario autenticado puede leer los correos invitados de cualquier grupo.
4. **`POST /me/subscription/change` no valida el plan** contra la colección `plans` ni exige pago: permite auto-asignarse `all` y con ello el acceso premium.
5. **`POST /invitations/:token/accept` no liga la invitación al correo invitado**; el token tampoco expira.
6. `cors()` abierto en ambos servicios, `logout` sin revocación y refresh tokens de 30 días sin rotación.

## Pendientes conscientes (fuera de alcance)

- Portal/app del tutor: no hay signup ni bandeja del lado del profesor; los mensajes del tutor entran por seed o por la consola admin.
- Pago de clases dentro de Aprueba (el wireframe lo declara "pronto").
- Preguntas para asignaturas escolares (no PAES): el catálogo las expone con `hasQuestions:false`; `/practice/next` sigue sirviendo solo pruebas con banco cargado.
