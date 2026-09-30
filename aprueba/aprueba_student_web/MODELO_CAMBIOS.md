# Cambios y decisiones sobre el modelo de datos

El sitio web del alumno reutiliza el modelo de `Aprueba_Modelo_Datos_Firestore.docx`. Para que el
proyecto corra de forma autonoma (sin Firebase) y para cerrar algunos huecos del modelo, se hicieron
estos ajustes. Ninguno rompe el contrato de la API.

## 1. Subcolecciones representadas como colecciones raiz
Firestore modela varias entidades como subcolecciones (`users/{uid}/answers`, `groups/{gid}/members`,
`posts/{pid}/comments`, etc.). El driver de datos por defecto es un almacen documental plano, por lo que
esas subcolecciones se guardan como **colecciones raiz con un campo de referencia al padre**:

| Modelo Firestore | En este backend | Campo de enlace |
|---|---|---|
| users/{uid}/answers | `answers` | `userId` |
| users/{uid}/notifications | `notifications` | `userId` |
| users/{uid}/devices | `devices` | `userId` |
| users/{uid}/medalLedger | `medalLedger` | `userId` |
| groups/{gid}/members | `groupMembers` | `groupId`, `userId` |
| groups/{gid}/invitations | `groupInvitations` | `groupId`, `token` |
| groups/{gid}/shared | `groupShared` | `groupId` |
| posts/{pid}/comments | `comments` | `postId` |
| posts/{pid}/likes | `likes` | `postId`, `userId` |

El driver Firestore opcional aplica el mismo esquema plano (equivalente a consultas `collectionGroup`).

## 2. Cuota diaria en el documento `users`
Se agregaron al documento de usuario los campos operativos `quota: { day, used }` y
`bonuses: { school, address }` para implementar la cuota (base 10, +5 colegio, +5 region, max 20) y su
reinicio diario, tal como describe `GET /me/quota` y `POST /me/quota/unlock`. Los planes de pago la
dejan ilimitada.

## 3. Planes alineados al documento de API (no al wireframe)
El wireframe usaba `plan1`/`plan5` ($1/$5). Se adopta la nomenclatura del doc de API y del modelo:
`free`, `uni` ($1/mes) y `all` ($5/mes), con ciclo `monthly`/`yearly` (anual = 10 meses). El catalogo
de planes (`/plans`) entrega `price.{monthly,yearly}`, `features` y `limits`.

## 4. Preguntas: banco real PAES
Las preguntas se importan de los JSON de las carpetas `PAES Chile *`. Cada documento `questions` mapea:
`pregunta -> statement`, `alternativas -> options`, `respuesta_correcta` (letra) -> `correctIndex`,
`explicacion_respuesta -> explanation` (+ `shortExplanation` derivada), `habilidad_requerida -> habilidad`.
Se agregan `testId`, `testLabel`, `axis`, `difficulty` (d1-d4) y `published`. La respuesta correcta nunca
se expone en `GET /practice/next` ni `GET /questions/:id` (solo al responder), como exige el contrato.
Dos archivos de Verbal con JSON invalido se omiten automaticamente en el seed.

## 5. Habilidades (`skills`) generadas
El doc define una coleccion `skills` con prerrequisitos. Como las preguntas reales solo traen el texto
`habilidad_requerida`, `GET /questions/:id/skill` construye el arbol (dominados/activo/bloqueados),
el dominio del alumno (a partir de sus `answers` por prueba) y recursos sugeridos de forma dinamica.
La coleccion `skills` queda disponible para precargar arboles curados si se desea.

## 6. Suscripcion y pago (demo de Stripe)
`POST /checkout/sessions` crea una suscripcion `incomplete` y devuelve un `clientSecret` simulado. Como
no hay Stripe real en la demo, se agrega `POST /checkout/sessions/:id/confirm` (equivale a recibir el
webhook `checkout.session.completed`) para activar el plan desde el frontend. `POST /webhooks/stripe`
existe y procesa el mismo evento si se integra Stripe de verdad.

## 7. Contrasenas con scrypt
El hashing usa `crypto.scrypt` nativo de Node (`lib/password.js`) en lugar de bcrypt, para evitar
dependencias nativas y que `npm install` sea liviano. Formato almacenado: `scrypt$<salt>$<hash>`.
