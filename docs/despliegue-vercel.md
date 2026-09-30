# Despliegue en Vercel: sitio web del alumno

Un solo proyecto de Vercel sirve el frontend y el backend de
`aprueba/aprueba_student_web`, en el mismo dominio:

- **Frontend**: `frontend/`, compilado con Vite y servido como estático.
- **Backend**: `backend/` (Express), como función serverless en `api/index.js`.
- `vercel.json` manda `/api/*` y `/health` a la función, y el resto a
  `index.html` (rutas del frontend).

Como el frontend llama a `/api/v1` en su mismo dominio, no necesita CORS ni
configuración de URL.

## 1. Importar el proyecto

En [vercel.com/new](https://vercel.com/new), importar el repositorio
`apruebaapp-capstone` y configurar:

| Campo | Valor |
|---|---|
| **Root Directory** | `aprueba/aprueba_student_web` |
| Framework Preset | Other |
| Build, Output, Install | No tocar: los define `vercel.json` |

## 2. Variables de entorno

En la misma pantalla de importación (o después, en *Settings → Environment
Variables*):

| Variable | Valor | Nota |
|---|---|---|
| `DATA_DRIVER` | `firestore` | |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio en base64 | Ver abajo. **Secreta.** |
| `JWT_SECRET` | Aleatorio, 32 caracteres o más | Ver abajo. **Secreta.** Sin ella, el API no arranca. |
| `DEMO_MODE` | `true` | Atajos de prueba. **Apagar antes de tener usuarios reales.** |
| `PHONE_VERIFICATION_REQUIRED` | `false` | El frontend web no envía `phoneToken` al registrarse. |

`NODE_ENV` no se define: `api/index.js` ya trata todo despliegue como
producción. `CORS_ORIGINS` tampoco hace falta, porque el frontend va en el
mismo dominio.

Para generar los valores secretos **sin imprimirlos en pantalla** (los copia
al portapapeles; pegarlos directamente en Vercel):

```bash
node -e "process.stdout.write(require('fs').readFileSync(process.argv[1]).toString('base64'))" "RUTA\AL\ARCHIVO-firebase-adminsdk.json" | clip
```

```bash
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))" | clip
```

Nunca pegar estos valores en el repositorio, en un `.env` versionado ni en un
chat.

## 3. Verificar el despliegue

- `https://<proyecto>.vercel.app/health` debe responder
  `{"status":"ok", ..., "driver":"firestore"}`.
- Iniciar sesión en la web con un usuario demo:

| Usuario | Plan |
|---|---|
| `demo@aprueba.cl` | `free` |
| `juan@correo.cl` | `uni` |
| `camila@correo.cl` | `all` |

Contraseña: `demo1234`.

- La app Flutter se apunta al despliegue con:

```bash
flutter run --dart-define=API_BASE_URL=https://<proyecto>.vercel.app/api/v1
```

## Previews

Cada Pull Request genera un despliegue de *Preview* con su propia URL. Usa las
mismas variables, así que **escribe en el mismo Firestore que producción**:
cuidado con probar en un PR algo que desordene los datos demo. Si pasa, se
restauran con el seed, que es idempotente (ver `backend/src/seed/seed.js`).

## Notas

- **Región**: las funciones corren en `gru1` (São Paulo), la más cercana al
  Firestore en `southamerica-west1` (Santiago).
- **Arranque en frío**: la primera petición tras un rato sin uso tarda
  alrededor de 1 segundo (carga de `firebase-admin`).
- **Plan Hobby**: es para uso no comercial.
