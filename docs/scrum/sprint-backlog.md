# Sprint Backlog

Registro de cada sprint: objetivo, elementos comprometidos y resultado. Los IDs
corresponden al [Product Backlog](product-backlog.md).

> Los sprints 0 a 2 se reconstruyeron el 23-10-2026 a partir del historial del
> repositorio (commits y Pull Requests). Desde el Sprint 3, este documento se
> actualiza en cada Sprint Planning y Sprint Review.

## Sprint 3 — en curso

**Semanas 11 y 12 · 19-10 al 31-10-2026**

**Objetivo:** cerrar las vulnerabilidades restantes, iniciar las pruebas unitarias y
avanzar la integración de los clientes con la API.

| ID | Elemento | Responsable | Puntos | Estado al 23-10 | Observación |
|---|---|---|---|---|---|
| PB-07 | Límite de intentos en el inicio de sesión | Ricardo | 5 | Pendiente | Requiere un almacén compartido: en serverless un contador en memoria se reinicia por instancia |
| PB-08 | Rotación y revocación de tokens de renovación | Ricardo | 5 | Pendiente | |
| PB-09 | Endurecimiento de la API | Elías | 3 | En revisión | En la rama `develop`, pendiente de Pull Request a `main` |
| PB-12 | Pruebas unitarias de reglas críticas | Elías | 8 | En curso | Iniciadas con pruebas de navegador para Inicio y de modelos de la app (en `develop`) |
| PB-16 | Exportar datos y eliminar la cuenta | Elías | 5 | En revisión | En la rama `develop`, pendiente de Pull Request a `main` |
| PB-18 | Artefactos Scrum | Ricardo | 3 | En revisión | Pull Request `docs/readme-scrum-fase2` |
| PB-23 | Mejoras del sitio web | Elías | 5 | En curso | Búsqueda global y formularios en `main` (22-10); Inicio con datos reales en `develop` |
| PB-25 | App Flutter integrada con la API | Elías | 8 | En curso | Inicio, práctica y ajustes en `develop`; continúa en el Sprint 4 |

**Comprometido:** 42 puntos.

**Notas del sprint:**
- El sprint comenzó con retraso: entre el 08-10 y el 21-10 no se registraron cambios en
  el repositorio. El trabajo se retomó el 22-10.
- Quince commits del 22-10 llegaron a `main` sin Pull Request. Desde ahora todo cambio
  entra por Pull Request, también la integración de `develop` a `main`
  (ver [retrospectiva](retrospectivas.md)).

## Sprint 2 — cerrado

**Semanas 9 y 10 · 05-10 al 17-10-2026**

**Objetivo:** cerrar las vulnerabilidades críticas y dejar la app Android compilable.

| ID | Elemento | Responsable | Puntos | Resultado |
|---|---|---|---|---|
| PB-04, PB-05 | Vulnerabilidades críticas | Ricardo | 8 | Terminadas antes de iniciar el sprint (Sprint 1) |
| PB-24 | App Android compilable | Ricardo | 3 | Terminado el 07-10 (PR #13) |

**Completado en el sprint:** 3 puntos. **Resultado:** objetivo cumplido, porque las
vulnerabilidades críticas se adelantaron al Sprint 1. Después del 07-10 no hubo
avance en el resto del sprint.

## Sprint 1 — cerrado

**Semanas 7 y 8 · 21-09 al 03-10-2026**

**Objetivo:** dejar la base de datos operativa y la API desplegada.

| ID | Elemento | Responsable | Puntos | Resultado |
|---|---|---|---|---|
| PB-01 | Migrar la persistencia a Cloud Firestore | Ricardo | 8 | Terminado 30-09 (PR #2) |
| PB-02 | Consultas nativas e índice compuesto | Ricardo | 5 | Terminado 30-09 (PR #2) |
| PB-03 | Importar el banco de preguntas | Ricardo | 3 | Terminado 30-09 (PR #3) |
| PB-04 | Acceso social sin suplantación | Ricardo | 5 | Terminado 30-09 (PR #4), adelantado del Sprint 2 |
| PB-05 | Planes de pago protegidos | Ricardo | 3 | Terminado 30-09 (PR #4), adelantado del Sprint 2 |
| PB-06 | Configuración segura | Ricardo | 5 | Terminado 30-09 y 02-10 (PR #4, #10, #11) |
| PB-10 | Respuestas sin duplicados | Ricardo | 3 | Terminado 30-09 (PR #6) |
| PB-11 | Prueba de integración automatizada | Ricardo | 5 | Terminado 30-09 (se amplía en cada PR) |
| PB-17 | Especificación OpenAPI | Ricardo | 5 | Terminado 02-10 (PR #9, #10), adelantado del Sprint 5 |
| PB-20 | API y sitio web en Vercel | Ricardo | 5 | Terminado 30-09 y 02-10 (PR #5, #7, #11, #12) |
| PB-22 | Sitio web integrado con la API | Ricardo | 3 | Terminado 02-10 (PR #12) |

**Completado:** 50 puntos. **Resultado:** objetivo cumplido el 30-09 y marcado con la
etiqueta `v0.1.0` ("MVP con base de datos operativa"). Se adelantaron elementos de los
sprints 2 y 5.

## Sprint 0 — cerrado

**Semanas 5 y 6 · 07-09 al 19-09-2026**

**Objetivo:** definir el proyecto y preparar el repositorio.

| Elemento | Responsable | Resultado |
|---|---|---|
| Análisis del sistema recibido: código, documentación y vulnerabilidades | Ambos | Terminado |
| Definición del proyecto: objetivos, metodología, plan de trabajo y Carta Gantt | Ambos | Terminado (evidencias de la Fase 1) |
| Repositorio en GitHub con la estructura del proyecto y de las evidencias | Ricardo | Terminado 11-09 |

**Resultado:** objetivo cumplido. Quedó pendiente crear el tablero y el Product Backlog
(se crean el 23-10, en el Sprint 3).

## Próximos sprints

| Sprint | Elementos planificados |
|---|---|
| Sprint 4 (02-11 al 14-11) | PB-13, PB-14, PB-15, PB-25 (continuación) |
| Sprint 5 (16-11 al 28-11) | PB-19, PB-21, PB-26 |
| Cierre (30-11 al 12-12) | PB-27 |
