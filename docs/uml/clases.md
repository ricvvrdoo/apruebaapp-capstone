# Diagrama de clases (modelo de dominio)

Entidades del dominio y sus relaciones. Cada clase corresponde a una colección de
Cloud Firestore; las relaciones se implementan como referencias por identificador
(por ejemplo, `Answer.userId`). Ver también el [modelo de datos](../modelo-datos.md).

```mermaid
classDiagram
    direction LR

    class User {
        +id
        +name
        +email
        +authProvider: password|google|apple
        +plan: free|uni|all
        +state: active|suspended
        +country
        +selectedTests[]
        +streak
        +quota: Quota
        +medals: MedalWallet
        +bonuses
    }
    class Quota {
        <<embebido>>
        +day
        +used
    }
    class MedalWallet {
        <<embebido>>
        +bronze
        +silver
        +gold
        +diamond
        +platinum
    }
    class Test {
        +id: lectora|m1|cien...
        +label
        +order
    }
    class Question {
        +id
        +testId
        +axis
        +difficulty
        +statement
        +options[]
        +correctIndex
        +explanation
        +published
        +rand
    }
    class Answer {
        +id
        +userId
        +questionId
        +selected
        +correct
        +elapsedMs
        +sessionId
    }
    class MedalLedger {
        +userId
        +tier
        +amount
        +reason
    }
    class Sponsor {
        +name
        +tier
    }
    class Benefit {
        +name
        +costPlatinum
        +stock
    }
    class Group {
        +name
        +ownerId
        +subjectTestId
    }
    class GroupMember {
        +groupId
        +userId
        +role: owner|member
        +score
    }
    class Post {
        +authorId
        +text
        +questionId
        +likes
        +comments
    }
    class Comment {
        +postId
        +authorId
        +text
    }
    class Like {
        +postId
        +userId
    }
    class Tutor {
        +name
        +subjects[]
        +pricePerHour
        +rating
        +verified
    }
    class TutorReview {
        +tutorId
        +userId
        +overall
        +ratings
    }
    class TutorRequest {
        +tutorId
        +userId
        +status
        +message
    }
    class Conversation {
        +userId
        +tutorId
        +requestId
        +lastMessageAt
    }
    class Message {
        +conversationId
        +senderType: user|tutor
        +text
    }
    class Plan {
        +id: uni|all
        +price
        +limits
    }
    class Feature {
        +name_es
        +name_en
    }
    class Subscription {
        +userId
        +plan
        +billingCycle
        +status
        +currentPeriodEnd
    }
    class Invoice {
        +userId
        +amount
        +status
    }
    class Notification {
        +userId
        +type
        +title
        +read
    }

    User *-- Quota
    User *-- MedalWallet
    Test "1" -- "0..*" Question : agrupa
    User "1" -- "0..*" Answer : responde
    Question "1" -- "0..*" Answer : recibe
    User "1" -- "0..*" MedalLedger : movimientos
    Sponsor "1" -- "0..*" Benefit : financia
    User "1" -- "0..*" GroupMember
    Group "1" -- "1..*" GroupMember : miembros
    User "1" -- "0..*" Post : publica
    Post "1" -- "0..*" Comment
    Post "1" -- "0..*" Like
    Post "0..*" -- "0..1" Question : comparte
    Tutor "1" -- "0..*" TutorReview
    User "1" -- "0..*" TutorRequest : solicita
    Tutor "1" -- "0..*" TutorRequest
    TutorRequest "1" -- "0..1" Conversation : abre
    Conversation "1" -- "0..*" Message
    Plan "0..*" -- "0..*" Feature : incluye
    User "1" -- "0..*" Subscription
    Subscription "1" -- "0..*" Invoice
    User "1" -- "0..*" Notification
```

## Notas

- `Quota` y `MedalWallet` no son colecciones: son objetos embebidos en el documento del
  usuario.
- `Answer` usa un identificador determinista derivado de (alumno, pregunta, sesión), lo
  que impide registrar dos veces la misma respuesta.
- `Question.rand` es un número aleatorio fijo asignado al importar el banco; permite
  elegir preguntas al azar con el índice (published, testId, rand) sin leer la
  colección completa.
