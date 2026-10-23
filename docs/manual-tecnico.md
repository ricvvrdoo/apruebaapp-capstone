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
| Flutter | 3.33 o superior | App móvil |
| Android Studio y Android SDK | Android 6.0 (API 23) o superior | Compilar y emular la app |
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

## 10. Sitio web del estudiante

Aplicación de una sola página en React 18 con Vite y React Router, ubicada en
`aprueba/aprueba_student_web/frontend`. Consume la API por HTTPS; no tiene
credenciales propias.

### Estructura

```
frontend/
  index.html
  vite.config.js        Puerto 5174 y proxy /api -> http://localhost:4100 (solo en desarrollo)
  public/               Íconos y favicon
  src/
    main.jsx            Punto de entrada: BrowserRouter y AuthProvider
    App.jsx             Rutas públicas, protegidas y onboarding
    api/client.js       Cliente HTTP: envelope, token Bearer y renovación automática
    auth/AuthContext.jsx  Sesión, usuario, idioma y tema
    components/         Layout (menú lateral y barra superior), buscador y componentes de interfaz
    pages/              Una página por vista: Login, Register, Forgot, Onboarding, Home,
                        Practice, Medals, Groups, Community, Plan, Settings
    i18n.js             Textos en español e inglés
    styles.css          Estilos y tokens de marca (tema claro y oscuro)
```

### Rutas

| Ruta | Página | Acceso |
|---|---|---|
| `/login`, `/register`, `/forgot` | Acceso y registro | Solo sin sesión |
| `/onboarding` | Elección de pruebas | Con sesión, la primera vez |
| `/`, `/practicar`, `/medallas`, `/grupos`, `/comunidad`, `/plan`, `/ajustes` | Vistas principales dentro del `Layout` | Con sesión y onboarding completo |

`Protected` redirige a `/login` sin sesión y a `/onboarding` si el alumno aún no elige
sus pruebas; cualquier otra ruta vuelve a `/`.

### Comunicación con la API

- La URL de la API se fija **al compilar** con `VITE_API_URL`. Sin ella, el cliente usa
  la ruta relativa `/api/v1`, que en desarrollo atiende el proxy de Vite.
- `api/client.js` agrega `Authorization: Bearer`, interpreta `{ data, error, meta }` y,
  ante un `401`, renueva una vez con el token de renovación y reintenta la solicitud. Si
  la renovación falla, cierra la sesión.
- Los tokens se guardan en `localStorage`; la política de seguridad de contenido (CSP)
  reduce el riesgo de que un script ajeno los lea. El paso a una cookie `httpOnly` queda
  pendiente hasta tener dominios propios (ver [despliegue-vercel.md](despliegue-vercel.md)).
- El idioma y el tema se guardan en el navegador y se sincronizan con `GET /me/settings`.

### Compilación y despliegue

```bash
cd aprueba/aprueba_student_web/frontend
npm ci
VITE_API_URL=https://aprueba-api.vercel.app npm run build   # genera frontend/dist
npm run preview                                             # sirve el build localmente
```

En Vercel, el proyecto `aprueba-student-web` usa `aprueba/aprueba_student_web/vercel.json`:

- instala y compila el frontend, y publica `frontend/dist`;
- redirige toda ruta a `index.html`, para que funcione recargar una ruta interna;
- agrega las cabeceras de seguridad (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` y COOP) y caché larga para `/assets`.

**Si cambia el dominio de la API**, actualizar `VITE_API_URL` en Vercel, el
`connect-src` de la CSP en `vercel.json` y, si cambia el dominio del sitio,
`CORS_ORIGINS` en la API.

### Agregar una vista

1. Crear la página en `src/pages/` y llamar a la API con `api.get`, `api.post`, etc.
2. Registrar la ruta en `App.jsx` dentro del `Layout` protegido y el acceso en el menú
   de `components/Layout.jsx`.
3. Agregar los textos en español e inglés en `i18n.js`.
4. Verificar en local contra la API y en la vista previa del Pull Request.

## 11. App móvil

Aplicación Flutter para Android e iOS, ubicada en `aprueba/aprueba_app`. Comparte el
contrato de la API con el sitio web.

### Arquitectura

| Capa | Ubicación | Tecnología |
|---|---|---|
| Arranque y tema | `lib/main.dart`, `lib/app/` | `MaterialApp.router` con tema claro y oscuro |
| Navegación | `lib/core/router/app_router.dart` | GoRouter |
| Estado | `lib/providers/` | Riverpod |
| Red | `lib/core/network/api_client.dart` | Dio con interceptor de autenticación |
| Sesión | `lib/core/storage/` | `flutter_secure_storage` (Keychain en iOS, Keystore en Android) |
| Datos | `lib/data/` | Modelos, repositorios por dominio y caché local con Drift (SQLite) |
| Funcionalidades | `lib/features/` | Una carpeta por dominio: auth, onboarding, home, practice, medals, groups, community, tutors, subscription, settings |
| Textos | `lib/core/l10n/` | Español e inglés |

El cliente de red adjunta el token de acceso y, ante un `401`, renueva una sola vez con
el token de renovación guardado en almacenamiento seguro; si falla, notifica que la
sesión expiró para volver al inicio de sesión.

### Configuración

La app no guarda claves en el código: se pasan al compilar con `--dart-define`
(valores por defecto en `lib/core/config/app_config.dart`).

| Clave | Uso | Nota |
|---|---|---|
| `API_BASE_URL` | URL base de la API | **Obligatoria**: el valor por defecto (`api.staging.aprueba.cl`) aún no existe. Producción: `https://aprueba-api.vercel.app/api/v1`; emulador Android contra la API local: `http://10.0.2.2:4100/api/v1` |
| `PHONE_AUTH_DEV_TOKEN` | Enviar un token de teléfono de desarrollo en vez del SMS | Activo en modo debug; la API lo acepta solo con `PHONE_AUTH_ALLOW_DEV_TOKEN=true` o `DEMO_MODE=true` |
| `STRIPE_PUBLISHABLE_KEY`, `STRIPE_MERCHANT_ID` | Pagos | Fuera del alcance del MVP |
| `GOOGLE_SERVER_CLIENT_ID` | Inicio de sesión con Google | Pendiente de decisión de la empresa |

### Compilación y ejecución

```bash
cd aprueba/aprueba_app
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # genera el código de Drift
flutter run --dart-define=API_BASE_URL=https://aprueba-api.vercel.app/api/v1
flutter build apk --dart-define=API_BASE_URL=https://aprueba-api.vercel.app/api/v1
flutter test
```

`build_runner` es obligatorio después de clonar o de cambiar las tablas de Drift: sin él
falta `database.g.dart` y la app no compila.

### Plataformas

- **Android:** proyecto nativo en `android/` (paquete `cl.aprueba.aprueba_app`, Android
  6.0 o superior). La configuración nativa de `setup/android` ya está aplicada. Para
  publicar en una tienda falta definir la firma de release: hoy el build de release usa
  la firma de depuración.
- **iOS:** la carpeta `ios/` aún no existe. Se genera con `flutter create` y se le aplica
  `setup/ios`, pero no se puede compilar ni firmar sin un equipo Mac con Xcode (PB-26).
- La autenticación por teléfono, las notificaciones push y los pagos requieren los
  archivos de Firebase (`google-services.json`, `GoogleService-Info.plist`) y las claves
  de la empresa; mientras no existan, funcionan en modo de demostración o quedan
  deshabilitados.

## 12. Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| El sitio web compilado llama a sí mismo en vez de a la API | Se compiló sin `VITE_API_URL` | Definir la variable en Vercel y volver a desplegar |
| Recargar una ruta del sitio web da `404` | Falta la reescritura a `index.html` | Mantener `rewrites` en `aprueba_student_web/vercel.json` |
| La app no se conecta | `API_BASE_URL` sin definir (apunta a un dominio inexistente) | Compilar con `--dart-define=API_BASE_URL=...` |
| La app compila con errores de Drift | Falta el código generado | `dart run build_runner build --delete-conflicting-outputs` |
| El emulador no inicia | Java distinto de 21 | Instalar Java 21 y ponerlo primero en el `PATH` |
| `npm run seed` falla con "Falta PAES_DIR" | El banco oficial no está en el repositorio | Usar `npm run seed:ejemplo` o definir `PAES_DIR` |
| La API no arranca en producción | `JWT_SECRET` ausente, de ejemplo o corto | Cargar un secreto aleatorio de 32 caracteres o más |
| El sitio web recibe errores de CORS | Su origen no está en `CORS_ORIGINS` | Agregar el dominio exacto en las variables de la API |
| `/api/docs` se ve en blanco en Vercel | Archivos de Swagger UI no incluidos en la función | Mantener `includeFiles` en `backend/vercel.json` |
| `GET /practice/next` falla tras cambiar consultas | Falta el índice compuesto o está construyéndose | Publicar `firestore.indexes.json` y esperar a que esté listo |
| El clon falla con "Filename too long" en Windows | Rutas largas de las evidencias | `git config --global core.longpaths true` |
