# Manual técnico

Guía para instalar, configurar, operar y mantener el backend de Aprueba y sus
clientes. Está pensada para que otro equipo pueda hacerse cargo del sistema sin
depender del equipo original.

## 1. Visión general

| Pieza | Ubicación | Tecnología |
|---|---|---|
| API REST | `aprueba/aprueba_student_web/backend` | Node.js 22, Express 4 |
| Sitio web del estudiante | `aprueba/aprueba_student_web/frontend` | React 18, Vite |
| App móvil | `aprueba/aprueba_app` | Flutter |
| Base de datos | Cloud Firestore, proyecto `aprueba-app-ad401` | Modo nativo, `southamerica-west1` |

Diagramas: [componentes](uml/componentes.md), [despliegue](uml/despliegue.md) y
[secuencias](uml/secuencia.md). Modelo de datos: [modelo-datos.md](modelo-datos.md).

### Estructura de la API

```
backend/
  api/index.js          Adaptador para Vercel (reexporta la app Express)
  src/index.js          Arranque: middleware, documentación y routers
  src/routes/           Un router por dominio (auth, me, practice, groups...)
  src/middleware/       authRequired, premiumRequired, docsAccess, errores
  src/lib/              Reglas de negocio y utilidades (jwt, quota, medals...)
  src/data/             repo.js y drivers (memory, firestore)
  src/docs/             Generación y verificación del contrato OpenAPI
  src/seed/             Seed, importación del banco y prueba automatizada
  firestore.rules       Reglas de seguridad de Firestore
  firestore.indexes.json  Índices compuestos
```

## 2. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22.x | API y sitio web (fijada en `engines`) |
| npm | La de Node 22 | Dependencias (hay `package-lock.json`) |
| Firebase CLI | 15 o superior | Emulador de Firestore y publicación de reglas e índices |
| Java | 21 | Requisito del emulador de Firestore |
| Flutter | Dart 3.3 o superior | App móvil |
| Vercel CLI | Opcional | Despliegues manuales y variables de entorno |

En Windows, clonar con `git config --global core.longpaths true`: algunas rutas de
las evidencias superan el límite de 260 caracteres.

## 3. Configuración

La API se configura con variables de entorno. La plantilla completa y comentada
está en `backend/.env.example`.

| Variable | Valores | Descripción |
|---|---|---|
| `PORT` | `4100` | Puerto local |
| `DATA_DRIVER` | `memory` · `firestore` | Motor de datos. `memory` no requiere Firebase |
| `JWT_SECRET` | 32 caracteres o más | Secreto de firma. Obligatorio en producción |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `900` / `2592000` | Duración de los tokens en segundos |
| `DEMO_MODE` | `true` · `false` | Habilita los atajos de prueba (planes sin pago, acceso social demo). **Apagar antes de tener usuarios reales** |
| `PHONE_VERIFICATION_REQUIRED` | `true` · `false` | Exige teléfono verificado para registrarse |
| `CORS_ORIGINS` / `CORS_ORIGIN_REGEX` | Lista / patrón | Orígenes de navegador permitidos |
| `API_DOCS` | `off` · `protected` · `public` | Acceso a `/api/docs`; `protected` usa `API_DOCS_USER` y `API_DOCS_PASSWORD` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON o base64 | Credencial de Firestore en Vercel |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta | Credencial de Firestore en local (archivo fuera del repositorio) |
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8080` | Usar el emulador en lugar de la base real |
| `PAES_DIR` | Ruta | Carpeta con el banco oficial de preguntas (no está en el repositorio) |

El sitio web solo necesita `VITE_API_URL` (URL de la API) en su despliegue; en local
usa el proxy de Vite hacia `localhost:4100`.

## 4. Instalación y ejecución local

```bash
# API con datos de ejemplo, sin Firebase
cd aprueba/aprueba_student_web/backend
npm ci
cp .env.example .env
npm run seed:ejemplo
npm start                      # http://localhost:4100/api/v1

# Sitio web
cd ../frontend
npm ci
npm run dev                    # http://localhost:5174
```

### Con el emulador de Firestore

```bash
cd aprueba/aprueba_student_web/backend
firebase emulators:start --only firestore --project demo-aprueba
# en otra terminal:
DATA_DRIVER=firestore FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-aprueba npm run seed
DATA_DRIVER=firestore FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-aprueba npm start
```

Usuarios de prueba: `demo@aprueba.cl`, `camila@correo.cl` y `juan@correo.cl`, con
contraseña `demo1234`.

## 5. Base de datos

| Tarea | Comando | Nota |
|---|---|---|
| Poblar datos de demostración | `npm run seed` | Contra la base real exige `SEED_CONFIRM=<projectId>`, para evitar ejecuciones accidentales |
| Importar o actualizar el banco | `npm run import:preguntas` | Identificadores deterministas: reimportar no duplica |
| Publicar reglas e índices | `firebase deploy --only firestore --project aprueba-app-ad401` | Ejecutar desde `backend/`, donde está `firebase.json` |
| Ver índices desplegados | `firebase firestore:indexes --project aprueba-app-ad401` | Solo lectura |

Un índice nuevo tarda unos minutos en construirse; hasta que esté listo, las consultas
que lo necesitan fallan.

## 6. Pruebas

| Comando | Qué verifica |
|---|---|
| `npm run smoke` | Prueba de integración de la API: levanta el servidor y ejercita los endpoints, incluidas las correcciones de seguridad. Debe terminar con 0 fallos |
| `npm run openapi:verificar` | Que todas las rutas de la API estén documentadas en el contrato |
| `flutter test` | Pruebas de la app móvil |

La prueba de integración puede correr en memoria o sobre el emulador
(`DATA_DRIVER=firestore` con `FIRESTORE_EMULATOR_HOST`).

## 7. Despliegue

La API y el sitio web se publican en Vercel como dos proyectos independientes. El
detalle de configuración, variables y verificación está en
[despliegue-vercel.md](despliegue-vercel.md).

- Integrar a `main` despliega a producción; cada Pull Request genera una vista previa.
- Los secretos se cargan sin imprimirlos en la terminal (ver la guía).
- El empaquetado en Docker está planificado (PB-21 del
  [Product Backlog](scrum/product-backlog.md)).

## 8. Operación

| Tarea | Cómo |
|---|---|
| Verificar el servicio | `GET https://aprueba-api.vercel.app/health` debe responder `status: ok` y `driver: firestore` |
| Ver errores | Registros de la función en el panel de Vercel (proyecto `aprueba-api`) |
| Revisar la documentación de la API | `/api/docs`, protegida con usuario y contraseña en producción |
| Cambiar un secreto | Reemplazar la variable en Vercel y redesplegar; cambiar `JWT_SECRET` cierra todas las sesiones |
| Antes de recibir usuarios reales | Apagar `DEMO_MODE` y revisar los pendientes de [seguridad-pendiente.md](seguridad-pendiente.md) |

## 9. Cómo agregar o cambiar un endpoint

1. Crear una rama corta desde `main` (`feat/...` o `fix/...`).
2. Implementar la ruta en el router del dominio, usando `data/repo.js` para los datos
   y `lib/envelope.js` para las respuestas.
3. Agregar los casos a la prueba de integración (`src/seed/smoke.js`).
4. Regenerar y verificar el contrato: `npm run openapi:generar` y
   `npm run openapi:verificar`.
5. Abrir el Pull Request, revisar la vista previa y cumplir la
   [Definition of Done](scrum/definition-of-done.md).

## 10. Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| El emulador no inicia | Java distinto de 21 | Instalar Java 21 y ponerlo primero en el `PATH` |
| `npm run seed` falla con "Falta PAES_DIR" | El banco oficial no está en el repositorio | Usar `npm run seed:ejemplo` o definir `PAES_DIR` |
| La API no arranca en producción | `JWT_SECRET` ausente, de ejemplo o corto | Cargar un secreto aleatorio de 32 caracteres o más |
| El sitio web recibe errores de CORS | Su origen no está en `CORS_ORIGINS` | Agregar el dominio exacto en las variables de la API |
| `/api/docs` se ve en blanco en Vercel | Archivos de Swagger UI no incluidos en la función | Mantener `includeFiles` en `backend/vercel.json` |
| `GET /practice/next` falla tras cambiar consultas | Falta el índice compuesto o está construyéndose | Publicar `firestore.indexes.json` y esperar a que esté listo |
| El clon falla con "Filename too long" en Windows | Rutas largas de las evidencias | `git config --global core.longpaths true` |
