# Diagramas UML

Diagramas del sistema en [Mermaid](https://mermaid.js.org/), que GitHub dibuja
directamente. Cada documento incluye además una imagen PNG en [img/](img).

| Diagrama | Qué muestra |
|---|---|
| [Casos de uso](casos-de-uso.md) | Actores (visitante, estudiante, estudiante con plan de pago) y lo que pueden hacer |
| [Clases](clases.md) | Modelo de dominio: entidades, atributos principales y relaciones |
| [Secuencia](secuencia.md) | Inicio de sesión y renovación, responder una pregunta y despliegue continuo |
| [Componentes](componentes.md) | Organización interna de la API: middleware, routers, reglas de negocio y acceso a datos |
| [Despliegue](despliegue.md) | Dónde se ejecuta cada pieza: Vercel, Google Cloud, dispositivos y Docker (planificado) |

Los diagramas reflejan la rama `main`. Al cambiar el código que representan, se
actualizan en el mismo Pull Request y se regeneran las imágenes.
