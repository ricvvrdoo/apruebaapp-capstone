# Despliegue en Vercel: sitio web del alumno

Un solo proyecto de Vercel, **`aprueba-student-web`**, sirve el frontend y el
backend de `aprueba/aprueba_student_web` en el mismo dominio:

- **Producción**: https://aprueba-student-web.vercel.app
- **Frontend**: `frontend/`, compilado con Vite y servido como estático.
- **Backend**: `backend/` (Express), como función serverless en `api/index.js`.
- `vercel.json` manda `/api/*` y `/health` a la función, y el resto a
  `index.html` (rutas del frontend).

Como el frontend llama a `/api/v1` en su mismo dominio, no necesita CORS ni
configuración de URL.

## Cómo se despliega

El proyecto está **conectado al repositorio de GitHub**:

| Evento | Resultado |
|---|---|
| Mezclar un PR a `main` (o hacer push a `main`) | Despliegue a **producción** |
| Abrir un PR o hacer push a otra rama | Despliegue de **Preview** con URL propia |

Los despliegues de Preview están protegidos con la autenticación de Vercel:
solo los ven los miembros del equipo con sesión iniciada. El dominio de
producción es público.

### Configuración del proyecto

| Ajuste | Valor |
|---|---|
| Root Directory | `aprueba/aprueba_student_web` |
| Node.js | 22.x (también fijado en `engines`) |
| Framework Preset | Other |
| Build, Output, Install | Los define `vercel.json` |
| Región de funciones | `gru1` (São Paulo), la más cercana al Firestore en `southamerica-west1` (Santiago) |

### Despliegue manual con Vercel CLI

Normalmente no hace falta, pero si se necesita:

```bash
vercel --prod
```

Se ejecuta **desde la raíz del repositorio**, no desde
`aprueba/aprueba_student_web`. Como el proyecto tiene Root Directory, desde la
subcarpeta el CLI falla con *"The specified Root Directory…"*. El
`.vercelignore` de la raíz limita la subida a los archivos del sitio y excluye
credenciales, `node_modules`, el build local y la base local `backend/.data`.

Para vincular un equipo nuevo, desde la raíz:

```bash
vercel link --yes --project aprueba-student-web
```

Ojo: `vercel link` agrega `.vercel` y `.env*` al final del `.gitignore`. Hay que
revertir ese cambio: la regla `.env*` al final anula la excepción
`!.env.example`, y el `.gitignore` ya ignora `.vercel/` y `.env.local`.

## Variables de entorno

Definidas en **Production** y en **Preview**:

| Variable | Valor | Nota |
|---|---|---|
| `DATA_DRIVER` | `firestore` | |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio en base64 | **Secreta.** |
| `JWT_SECRET` | Aleatorio, 32 caracteres o más | **Secreta.** Distinta en Production y en Preview: una sesión de un preview no sirve en producción. Sin ella, el API no arranca. |
| `DEMO_MODE` | `true` | Atajos de prueba. **Apagar antes de tener usuarios reales.** |
| `PHONE_VERIFICATION_REQUIRED` | `false` | El frontend web no envía `phoneToken` al registrarse. |

`NODE_ENV` no se define: `api/index.js` ya trata todo despliegue como
producción. `CORS_ORIGINS` tampoco hace falta: el frontend va en el mismo
dominio.

Los secretos se cargan con el CLI, generando el valor y enviándolo directo a
Vercel, **sin imprimirlo**. En PowerShell, desde la raíz del repositorio
(cambiar `production` por `preview` para el otro entorno):

```powershell
node -e "process.stdout.write(require('fs').readFileSync(process.argv[1]).toString('base64'))" "RUTA\AL\ARCHIVO-firebase-adminsdk.json" | vercel env add FIREBASE_SERVICE_ACCOUNT production --yes
```

```powershell
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))" | vercel env add JWT_SECRET production --yes
```

Nunca pegar estos valores en el repositorio, en un `.env` versionado ni en un
chat.

## Verificar un despliegue

- `https://aprueba-student-web.vercel.app/health` debe responder
  `{"status":"ok", ..., "driver":"firestore"}`.
- En un Preview protegido, usar el CLI, que se autentica con la sesión:

```bash
vercel curl /health --deployment <url-del-preview>
```

- Iniciar sesión con un usuario demo:

| Usuario | Plan |
|---|---|
| `demo@aprueba.cl` | `free` |
| `juan@correo.cl` | `uni` |
| `camila@correo.cl` | `all` |

Contraseña: `demo1234`.

- La app Flutter se apunta al despliegue con:

```bash
flutter run --dart-define=API_BASE_URL=https://aprueba-student-web.vercel.app/api/v1
```

## Previews y datos

Los Previews usan **el mismo Firestore que producción**: una prueba descuidada
en un PR puede desordenar los datos demo. Si pasa, se restauran con el seed,
que es idempotente (ver `backend/src/seed/seed.js`). Cuando haya más
movimiento, conviene un proyecto Firebase aparte para Preview.

## Notas

- **Arranque en frío**: la primera petición después de un despliegue o de un
  rato sin uso tarda 1 a 2 segundos (carga de `firebase-admin`).
- **Plan Hobby**: es para uso no comercial.
