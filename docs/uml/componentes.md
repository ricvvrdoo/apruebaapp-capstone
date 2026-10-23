# Diagrama de componentes

Organización interna de la API y su relación con los clientes y los servicios
externos. Las rutas se agrupan en routers de Express; todas usan la misma capa de
acceso a datos (`data/repo.js`), que elige el driver según `DATA_DRIVER`.

```mermaid
flowchart TB
    subgraph CL["Clientes"]
        WEB["Sitio web<br/>React + Vite"]
        APP["App móvil<br/>Flutter (Dio, Riverpod)"]
    end

    subgraph API["API REST · Node.js + Express · /api/v1"]
        direction TB
        subgraph MW["Middleware transversal"]
            HEL["helmet<br/>cabeceras de seguridad"]
            COR["cors<br/>orígenes permitidos"]
            AUTH["authRequired<br/>JWT Bearer"]
            PREM["premiumRequired<br/>control de plan"]
            DOCS["docsAccess<br/>off / protected / public"]
        end
        subgraph RT["Routers"]
            R1["auth"]
            R2["catalog"]
            R3["me"]
            R4["practice"]
            R5["corrections"]
            R6["groups"]
            R7["community"]
            R8["tutors"]
            R9["conversations"]
            R10["checkout (demo)"]
            R11["search"]
        end
        subgraph LIB["Lógica de negocio (lib)"]
            L1["jwt"]
            L2["quota"]
            L3["medals"]
            L4["envelope<br/>{ data, error, meta }"]
            L5["demo<br/>DEMO_MODE"]
            L6["firebasePhone"]
        end
        REPO["data/repo.js<br/>query · get · create · bulkSet"]
        MEM["driver memory<br/>(desarrollo)"]
        FSD["driver firestore<br/>(Admin SDK)"]
        OAS["OpenAPI 3.1 + Swagger UI<br/>/api/docs"]
    end

    FS[("Cloud Firestore")]
    FBA["Firebase Auth<br/>(verificación por SMS)"]

    WEB & APP -- "HTTPS · JSON · Bearer" --> MW
    MW --> RT
    RT --> LIB
    RT --> REPO
    REPO --> MEM
    REPO --> FSD
    FSD --> FS
    L6 --> FBA
    DOCS --> OAS
```

## Responsabilidades

| Componente | Responsabilidad |
|---|---|
| Routers | Validan la solicitud y aplican las reglas de cada dominio (práctica, grupos, comunidad, tutores...) |
| `authRequired` | Verifica el token de acceso y rechaza cuentas suspendidas |
| `premiumRequired` | Responde `403 PLAN_REQUIRED` a las funciones de pago en el plan gratuito |
| `quota`, `medals` | Reglas de la cuota diaria y de la billetera de medallas |
| `envelope` | Formato común de respuesta `{ data, error, meta }` |
| `demo` | Habilita atajos de prueba solo con `DEMO_MODE=true` |
| `data/repo.js` | Única puerta a los datos; aísla las rutas del motor de base de datos |
