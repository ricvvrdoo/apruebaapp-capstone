# Diagramas de secuencia

Tres flujos clave del sistema, tal como están implementados en la rama `main`.

## 1. Inicio de sesión y renovación de la sesión

El token de acceso dura 15 minutos y el de renovación, 30 días. Los clientes renuevan
de forma transparente cuando reciben un `401`.

```mermaid
sequenceDiagram
    autonumber
    actor A as Estudiante
    participant C as Cliente (web o app)
    participant API as API /api/v1
    participant DB as Cloud Firestore

    A->>C: correo y contraseña
    C->>API: POST /auth/login
    API->>DB: buscar usuario por emailLower
    DB-->>API: usuario
    alt credenciales inválidas
        API-->>C: 401 AUTH_INVALID_CREDENTIALS
    else cuenta suspendida
        API-->>C: 403 ACCOUNT_SUSPENDED
    else válido
        API->>DB: premio de inicio de sesión diario (si corresponde)
        API-->>C: 200 { user, accessToken (15 min), refreshToken (30 días) }
    end

    Note over C,API: Más tarde, el token de acceso expira
    C->>API: GET /me (Authorization: Bearer accessToken)
    API-->>C: 401 AUTH_INVALID
    C->>API: POST /auth/refresh { refreshToken }
    API->>API: verificar firma y tipo "refresh"
    API->>DB: obtener usuario
    API-->>C: 200 { accessToken, refreshToken }
    C->>API: GET /me (reintento con el nuevo token)
    API-->>C: 200 { data: perfil }
```

## 2. Responder una pregunta

La respuesta se registra primero y de forma atómica: solo la solicitud que logra
crearla descuenta cuota y entrega la medalla. Así, un doble clic no duplica nada.

```mermaid
sequenceDiagram
    autonumber
    actor A as Estudiante
    participant C as Cliente
    participant API as API /api/v1
    participant DB as Cloud Firestore

    C->>API: GET /practice/next
    API->>API: verificar cuota diaria del usuario
    API->>DB: preguntas publicadas con rand >= pivote (máx. 20, índice compuesto)
    API->>DB: respuestas del alumno para esas preguntas
    API-->>C: 200 pregunta + progreso + cuota
    A->>C: elige la alternativa "B"
    C->>API: POST /questions/{id}/answer { selected: "B", elapsedMs }
    API->>DB: obtener pregunta
    API->>API: validar alternativa y cuota
    API->>DB: create(answers, id = sha1(alumno|pregunta|sesión))
    alt la respuesta ya existía (doble envío)
        DB-->>API: ya existe
        API-->>C: 409 ALREADY_ANSWERED
    else creada
        API->>DB: actualizar usuario (cuota +1, medalla bronce si es correcta)
        API->>DB: registrar movimiento en medalLedger (si es correcta)
        API-->>C: 201 { correct, correctAnswer, explicación, medalla, cuota }
    end
```

## 3. Despliegue continuo

Cada cambio entra por un Pull Request; Vercel publica una vista previa y, al integrarse
a `main`, despliega a producción.

```mermaid
sequenceDiagram
    autonumber
    actor D as Desarrollador
    participant G as GitHub
    participant V as Vercel
    participant P as Producción

    D->>D: rama corta (feat/, fix/, sec/...) y npm run smoke
    D->>G: push de la rama y Pull Request a main
    G->>V: webhook del Pull Request
    V-->>G: URL de vista previa (protegida)
    D->>V: verificar los flujos afectados en la vista previa
    D->>G: merge commit a main
    G->>V: webhook de main
    V->>P: build y despliegue (API y sitio web por separado)
    D->>P: verificar /health y los flujos principales
    opt hito del sprint
        D->>G: etiqueta anotada (por ejemplo, v0.1.0)
    end
```
