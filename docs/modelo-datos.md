# Modelo de datos

La API persiste sus datos en **Cloud Firestore** en modo nativo (base `(default)` del
proyecto `aprueba-app-ad401`, región `southamerica-west1`). El modelo sigue la
especificación de la empresa (`Aprueba_Modelo_Datos_Firestore.docx`), con los ajustes
descritos más abajo. El diagrama de clases del dominio está en
[uml/clases.md](uml/clases.md).

## Diagrama entidad-relación

Colecciones principales de Firestore y sus referencias. Cada relación es un campo con el
identificador del documento padre (por ejemplo, `answers.userId`); Firestore no impone
claves foráneas, y la integridad la mantiene la API. `quota` y `medals` no son
colecciones: son objetos embebidos en el documento del usuario.

```mermaid
erDiagram
    users ||--o{ answers : "responde"
    tests ||--o{ questions : "agrupa"
    questions ||--o{ answers : "recibe"
    users ||--o{ medalLedger : "registra"
    sponsors ||--o{ benefits : "financia"
    users ||--o{ groups : "crea"
    groups ||--|{ groupMembers : "tiene"
    users ||--o{ groupMembers : "participa"
    tests |o--o{ groups : "asignatura"
    users ||--o{ posts : "publica"
    questions |o--o{ posts : "se comparte en"
    posts ||--o{ comments : "tiene"
    posts ||--o{ likes : "recibe"
    users ||--o{ comments : "escribe"
    users ||--o{ likes : "marca"
    tutors ||--o{ tutorReviews : "recibe"
    users ||--o{ tutorReviews : "escribe"
    users ||--o{ tutorRequests : "solicita"
    tutors ||--o{ tutorRequests : "recibe"
    tutorRequests ||--o| conversations : "abre"
    conversations ||--o{ messages : "contiene"
    users ||--o{ subscriptions : "contrata"
    plans ||--o{ subscriptions : "define"
    users ||--o{ invoices : "paga"
    users ||--o{ notifications : "recibe"

    users {
        string id PK
        string name
        string email
        string authProvider "password, google o apple"
        string plan "free, uni o all"
        string state "active o suspended"
        array selectedTests
        number streak
        map quota "embebido: day, used"
        map medals "embebido: bronze a platinum"
    }
    tests {
        string id PK "lectora, m1, m2, cien, hist"
        string label
        number order
    }
    questions {
        string id PK "determinista"
        string testId FK
        string axis
        string difficulty
        string statement
        array options
        number correctIndex
        string explanation
        boolean published
        number rand "eleccion al azar con indice"
    }
    answers {
        string id PK "alumno, pregunta y sesion"
        string userId FK
        string questionId FK
        string testId FK
        number selected
        boolean correct
        number elapsedMs
        string sessionId
    }
    medalLedger {
        string id PK
        string userId FK
        string tier
        number amount
        string reason
    }
    sponsors {
        string id PK
        string name
        string tier
    }
    benefits {
        string id PK
        string sponsor FK
        string name
        number costPlatinum
        number stock
    }
    groups {
        string id PK
        string ownerId FK
        string subjectTestId FK
        string name
    }
    groupMembers {
        string id PK
        string groupId FK
        string userId FK
        string role "owner o member"
        number score
    }
    posts {
        string id PK
        string authorId FK
        string questionId FK "opcional"
        string authorName "desnormalizado"
        string text
        number likes
        number comments
    }
    comments {
        string id PK
        string postId FK
        string authorId FK
        string text
    }
    likes {
        string id PK
        string postId FK
        string userId FK
    }
    tutors {
        string id PK
        string name
        array subjects
        number pricePerHour
        number rating
        boolean verified
    }
    tutorReviews {
        string id PK
        string tutorId FK
        string userId FK
        number overall
        map ratings
    }
    tutorRequests {
        string id PK
        string tutorId FK
        string userId FK
        string conversationId FK
        string status
        string message
    }
    conversations {
        string id PK
        string userId FK
        string tutorId FK
        string requestId FK
        string lastMessageAt
    }
    messages {
        string id PK
        string conversationId FK
        string senderType "user o tutor"
        string senderId "alumno o tutor"
        string text
    }
    plans {
        string id PK "free, uni o all"
        number price
        map limits
    }
    subscriptions {
        string id PK
        string userId FK
        string plan FK
        string billingCycle
        string status
        number amount
    }
    invoices {
        string id PK
        string userId FK
        number amount
        string status
        string paidAt
    }
    notifications {
        string id PK
        string userId FK
        string type
        string title
        boolean read
    }
```

La colección `features` (características que se muestran en los planes) no tiene
referencias a otras colecciones, por lo que no aparece en el diagrama.

## Decisiones de diseño

| Decisión | Motivo |
|---|---|
| **Colecciones raíz con referencia al padre** (por ejemplo, `answers.userId`, `groupMembers.groupId`) en lugar de subcolecciones | Permite consultar entre padres (todas las respuestas de una pregunta, todos los grupos de un alumno) con un solo índice, y mantiene una sola API de acceso (`data/repo.js`) para el driver en memoria y el de Firestore |
| **Sin joins**: cada pantalla se resuelve con consultas por campo y documentos que guardan los datos que se muestran (por ejemplo, `posts.authorName`) | Firestore no tiene joins; desnormalizar evita lecturas adicionales por elemento de una lista |
| **Cuota y medallas embebidas en `users`** (`quota`, `medals`, `bonuses`) | Se leen en cada solicitud del alumno; embeberlas evita una lectura extra |
| **`questions.rand`**, número aleatorio fijo asignado al importar | Elegir una pregunta al azar con el índice (published, testId, rand) leyendo como máximo 20 documentos, en vez de las 1.365 preguntas del banco |
| **Identificadores deterministas** en `questions` y `answers` | Reimportar el banco no duplica preguntas, y una misma respuesta no puede registrarse dos veces (creación atómica) |
| **Sin acceso directo desde clientes** | Las reglas niegan toda lectura y escritura: solo la API accede, con el Admin SDK |

## Colecciones

Cantidad de documentos en producción al 23-10-2026.

| Dominio | Colección | Documentos | Contenido | Referencias |
|---|---|---|---|---|
| Usuarios | `users` | 3 | Perfil, plan, estado, preferencias, cuota y billetera de medallas | — |
| | `notifications` | 2 | Avisos al alumno | `userId` |
| | `subscriptions` | 2 | Suscripción a un plan de pago | `userId` |
| | `invoices` | 2 | Boletas de las suscripciones | `userId` |
| Práctica | `tests` | 5 | Pruebas PAES (Comp. Lectora, Matemática M1...) | — |
| | `questions` | 1.365 | Enunciado, alternativas, respuesta correcta, explicación y eje | `testId` |
| | `answers` | 6 | Respuesta del alumno, si fue correcta y el tiempo usado | `userId`, `questionId`, `testId` |
| Gamificación | `medalLedger` | 23 | Movimientos de medallas (ganadas, canjeadas, regaladas) | `userId` |
| | `benefits` | 3 | Beneficios canjeables por medallas de platino | `sponsor` |
| | `sponsors` | 3 | Marcas que financian los beneficios | — |
| Grupos | `groups` | 3 | Grupos de estudio | `ownerId`, `subjectTestId` |
| | `groupMembers` | 7 | Miembros, rol y puntaje | `groupId`, `userId` |
| Comunidad | `posts` | 3 | Publicaciones, opcionalmente con una pregunta | `authorId`, `questionId` |
| | `comments` | 2 | Comentarios de una publicación | `postId`, `authorId` |
| | `likes` | 3 | "Me gusta" de una publicación | `postId`, `userId` |
| Tutores | `tutors` | 4 | Perfil, asignaturas, precio y valoración | — |
| | `tutorReviews` | 2 | Reseñas de alumnos | `tutorId`, `userId` |
| | `tutorRequests` | 1 | Solicitudes de contacto | `tutorId`, `userId`, `conversationId` |
| | `conversations` | 1 | Chat alumno-tutor | `userId`, `tutorId`, `requestId` |
| | `messages` | 4 | Mensajes del chat | `conversationId`, `senderId` |
| Catálogo | `plans` | 3 | Planes de pago y sus límites | — |
| | `features` | 6 | Características que se muestran en los planes | — |

El código define además colecciones que se crean con el uso (por ejemplo,
`corrections`, `groupInvitations`, `devices`, `benefitRedemptions`); no aparecen en la
tabla porque aún no tienen documentos en producción.

## Índices

| Colección | Campos | Consulta que atiende |
|---|---|---|
| `questions` | `published` ↑, `testId` ↑, `rand` ↑ | `GET /practice/next`: preguntas publicadas de una prueba a partir de un pivote aleatorio |

Las demás consultas filtran por un solo campo o por igualdad, y Firestore las resuelve
con sus índices automáticos. El índice está definido en
`aprueba/aprueba_student_web/backend/firestore.indexes.json` y se publica con
`firebase deploy --only firestore`.

## Reglas de seguridad

```
match /{document=**} {
  allow read, write: if false;
}
```

Los clientes nunca leen la base directamente; la API usa el Admin SDK, que no pasa por
las reglas.

## Pendientes

- Actualizar la cuota y los contadores del usuario con `FieldValue.increment` o
  transacciones, como indica la sección 7 del documento de la empresa: hoy se reescribe
  el documento completo y dos solicitudes simultáneas pueden pisarse (PB-15).
- Ver el detalle en [seguridad-pendiente.md](seguridad-pendiente.md), sección "Otros
  hallazgos".
