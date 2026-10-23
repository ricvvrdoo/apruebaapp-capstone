# Diagrama de despliegue

Dónde se ejecuta cada componente. La publicación continua en Vercel está operativa; el
entorno en contenedores Docker es el entregable final y está planificado para el
Sprint 5 (PB-21 del [Product Backlog](../scrum/product-backlog.md)).

```mermaid
flowchart LR
    subgraph DEV["«dispositivo» Usuario"]
        BR["Navegador web"]
        AND["Teléfono Android<br/>«artefacto» APK Flutter"]
    end

    subgraph VER["«nube» Vercel"]
        CDN["CDN · proyecto aprueba-student-web<br/>«artefacto» build de Vite (estático)"]
        FN["Función serverless Node.js 22 · región gru1<br/>proyecto aprueba-api<br/>«artefacto» Express vía api/index.js"]
    end

    subgraph GCP["«nube» Google Cloud · southamerica-west1"]
        FS[("Cloud Firestore<br/>proyecto aprueba-app-ad401<br/>modo nativo")]
        FBA["Firebase Auth"]
    end

    subgraph GH["«nube» GitHub"]
        REPO["Repositorio<br/>ricvvrdoo/apruebaapp-capstone"]
    end

    subgraph DK["«nodo» Equipo con Docker (planificado)"]
        C1["contenedor api"]
        C2["contenedor web"]
        C3["contenedor emulador de Firestore"]
    end

    BR -- "HTTPS" --> CDN
    BR -- "HTTPS · CORS restringido" --> FN
    AND -- "HTTPS" --> FN
    FN -- "gRPC · Admin SDK" --> FS
    FN -.-> FBA
    REPO -- "push a main: producción<br/>Pull Request: vista previa" --> VER
    C2 --> C1 --> C3
```

## Entornos

| Entorno | Dónde | Datos | Uso |
|---|---|---|---|
| Producción | Vercel (`aprueba-api`, `aprueba-student-web`) | Firestore `aprueba-app-ad401` | Demostración a la empresa y a la institución |
| Vista previa | Vercel, una URL por Pull Request (protegida) | La misma base de Firestore, con un `JWT_SECRET` propio | Verificar cada cambio antes de integrarlo |
| Local | Equipo del desarrollador | Memoria o emulador de Firestore | Desarrollo y prueba automatizada |
| Contenedores (planificado) | Docker Compose | Emulador de Firestore | Entregable final y demostración sin conexión |
