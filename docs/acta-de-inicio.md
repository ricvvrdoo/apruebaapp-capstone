# Acta de inicio del proyecto

Documento de inicio del Proyecto APT. Resume la definición aprobada en la Fase 1
(Guía de definición del proyecto 1.5 e Informe técnico 1.4, en
`Documentos Duoc/FASE 1/Evidencias Grupales/`) y la deja en un solo lugar del
repositorio.

| | |
|---|---|
| Asignatura | Capstone (PTY4614), sección PTY4614-006 |
| Carrera | Ingeniería en Informática, Duoc UC, sede San Joaquín |
| Docente | Alex Zúñiga |
| Empresa mandante | Alloxentric |
| Período | Semestre 2026-2, del 10-08-2026 al 12-12-2026 |
| Fecha de definición | Septiembre de 2026 (Fase 1) |

## Nombre del proyecto

**Aprueba — Desarrollo de la plataforma móvil y web de preparación para la PAES.**

## Problema y relevancia

La Prueba de Acceso a la Educación Superior (PAES) determina buena parte del futuro
académico de los estudiantes chilenos, pero la calidad de la preparación depende de
la capacidad de pago de cada familia: un preuniversitario presencial cuesta varios
cientos de miles de pesos al año. Aprueba busca reducir esa brecha con práctica
gratuita o de bajo costo desde el teléfono o el navegador.

La empresa entregó un sistema funcional que no podía salir a producción: guardaba sus
datos en un archivo local, tenía vulnerabilidades de autenticación y no tenía pruebas
automatizadas en el backend. El aporte del equipo es llevarlo a condiciones de
despliegue productivo, el escenario habitual de un ingeniero recién titulado que
recibe un sistema existente.

- **Usuarios directos:** estudiantes de enseñanza media, principalmente de tercero y
  cuarto medio, que preparan la PAES.
- **Usuarios indirectos:** sus familias y establecimientos.
- **Mercado inicial:** Chile, con una arquitectura preparada para otros sistemas de
  admisión de la región.

## Objetivos

### Objetivo general

Implementar las mejoras de seguridad, persistencia y calidad necesarias para dejar el
backend de la plataforma Aprueba, junto con su aplicación móvil y su sitio web del
estudiante, en condiciones de despliegue productivo antes del término del semestre
académico.

### Objetivos específicos

1. Migrar la capa de persistencia del backend desde el almacenamiento local en archivo
   hacia Cloud Firestore, incluyendo el diseño de índices compuestos y de reglas de
   seguridad.
2. Corregir las seis vulnerabilidades identificadas en el backend recibido, priorizando
   la verificación del acceso mediante proveedores externos y la validación del cambio
   de plan de suscripción.
3. Desplegar el backend en dos modalidades complementarias: publicación continua en
   Vercel durante el desarrollo, para exhibir avances a la empresa, y empaquetado en
   contenedores Docker como entregable final.
4. Construir una batería de pruebas automatizadas sobre las reglas de negocio críticas
   del sistema: autenticación, autorización, cuota diaria y gamificación.
5. Completar los flujos funcionales que quedaron sin cierre dentro del alcance
   definido, en particular la resolución de solicitudes de recorrección de preguntas.
6. Documentar el contrato de la API mediante una especificación OpenAPI versionada,
   que unifique las fuentes de información hoy contradictorias y sirva de contrato
   único para la aplicación móvil y el sitio web.
7. Integrar y adecuar los clientes: generar la configuración nativa de la aplicación
   móvil, ajustar la aplicación Flutter y el sitio web React al contrato actualizado y
   a la autenticación verificada, y comprobar los flujos principales de extremo a
   extremo.

El avance de cada objetivo se sigue en el [Product Backlog](scrum/product-backlog.md).

## Alcance

**Incluye:** el backend (API REST en Node.js y Express), el sitio web del estudiante
(React) y la aplicación móvil del estudiante (Flutter), en sus capas de backend y de
frontend.

**Excluye**, por acuerdo con la empresa mandante:

- la consola de administración;
- el módulo generador de preguntas con inteligencia artificial.

Las decisiones de alcance tomadas durante el semestre se registran en el
[Product Backlog](scrum/product-backlog.md) y en
[seguridad-pendiente.md](seguridad-pendiente.md).

## Metodología

**Scrum**, en sprints de dos semanas alineados al calendario académico, con
**GitHub Flow** para el código: `main` siempre desplegable, una rama corta y un Pull
Request por cambio. Ceremonias: Sprint Planning al inicio de cada sprint, reporte de
avance semanal a la empresa, y Sprint Review y Retrospective al cierre. Detalle en
[docs/scrum](scrum).

## Cronograma

| Sprint | Semanas | Fechas | Objetivo |
|---|---|---|---|
| Sprint 0 | 5 y 6 | 07-09 al 19-09 | Definición del proyecto, cronograma y configuración del repositorio |
| Sprint 1 | 7 y 8 | 21-09 al 03-10 | Migración a Cloud Firestore y despliegue inicial del backend |
| Sprint 2 | 9 y 10 | 05-10 al 17-10 | Vulnerabilidades críticas y configuración nativa de la app móvil |
| Sprint 3 | 11 y 12 | 19-10 al 31-10 | Vulnerabilidades restantes y pruebas automatizadas |
| Sprint 4 | 13 y 14 | 02-11 al 14-11 | Cierre de flujos incompletos e integración de los clientes |
| Sprint 5 | 15 y 16 | 16-11 al 28-11 | Documentación, especificación OpenAPI, contenedores y estabilización |
| Cierre | 17 y 18 | 30-11 al 12-12 | Preparación y ejecución de la presentación final |

La Carta Gantt completa está en la Guía 1.5 (sección 8).

## Integrantes y roles

| Integrante | Rol Scrum | Responsabilidades principales |
|---|---|---|
| Ricardo Rodríguez | Scrum Master y desarrollador | Seguridad del backend, migración y modelo de datos en Firestore, despliegue de la API, documentación técnica y coordinación con la empresa |
| Elías Millahuala | Product Owner y desarrollador | Integración de los clientes web y móvil, pruebas automatizadas, empaquetado en Docker y presentación final |

## Partes interesadas

| Parte interesada | Interés en el proyecto |
|---|---|
| Alloxentric (empresa mandante) | Recibir un sistema desplegable, documentado y con pruebas; define el alcance y prioriza |
| Estudiantes que preparan la PAES | Practicar con preguntas reales, gratis o a bajo costo |
| Docente de la asignatura | Evaluar el cumplimiento de los objetivos y de las competencias del perfil de egreso |
| Equipo de proyecto | Entregar un producto real y titularse |
