# Product Backlog

**Product Owner:** Elías Millahuala · **Versión:** 1 · **Actualizado:** 23-10-2026 (Sprint 3)

Elementos ordenados por épica. La prioridad usa MoSCoW (**M**ust, **S**hould,
**C**ould) y la estimación, puntos de historia en escala de Fibonacci. Los elementos
terminados en los sprints 0 a 2 se registraron a partir de los Pull Requests (PR) que
los implementaron; sus puntos se estimaron al crear este backlog.

**Estados:** Terminado · En curso · En revisión (implementado, pendiente de integrar a
`main`) · Pendiente.

## Resumen

| ID | Elemento | Prioridad | Puntos | Sprint | Responsable | Estado |
|---|---|---|---|---|---|---|
| **Persistencia** |||||||
| PB-01 | Migrar la persistencia a Cloud Firestore | M | 8 | 1 | Ricardo | Terminado (PR #2) |
| PB-02 | Consultas nativas e índice compuesto en la práctica | M | 5 | 1 | Ricardo | Terminado (PR #2) |
| PB-03 | Importar el banco de 1.365 preguntas PAES | M | 3 | 1 | Ricardo | Terminado (PR #3) |
| **Seguridad** |||||||
| PB-04 | Impedir la suplantación de cuentas en el acceso social | M | 5 | 1 | Ricardo | Terminado (PR #4) |
| PB-05 | Impedir activar planes de pago sin pagar | M | 3 | 1 | Ricardo | Terminado (PR #4) |
| PB-06 | Secreto JWT obligatorio, invitaciones seguras, CORS y cabeceras | M | 5 | 1 | Ricardo | Terminado (PR #4, #10, #11) |
| PB-07 | Límite de intentos en el inicio de sesión | M | 5 | 3 | Ricardo | Pendiente |
| PB-08 | Rotación y revocación de los tokens de renovación | M | 5 | 3 | Ricardo | Pendiente |
| PB-09 | Endurecimiento de la API: algoritmo JWT fijo, cuentas suspendidas, tamaño máximo de solicitud y regalo de medallas | S | 3 | 3 | Elías | En revisión |
| **Calidad** |||||||
| PB-10 | Evitar respuestas duplicadas por doble envío | M | 3 | 1 | Ricardo | Terminado (PR #6) |
| PB-11 | Prueba automatizada de integración de la API | M | 5 | 1 | Ricardo | Terminado (135 verificaciones) |
| PB-12 | Pruebas unitarias de las reglas de negocio críticas | M | 8 | 3 | Elías | En curso |
| PB-13 | Plan de pruebas | S | 2 | 4 | Elías | Pendiente |
| **Flujos y consistencia** |||||||
| PB-14 | Resolver las solicitudes de recorrección de preguntas | M | 5 | 4 | Ricardo | Pendiente |
| PB-15 | Corregir los defectos de consistencia de datos | M | 5 | 4 | Ricardo | Pendiente |
| PB-16 | Exportar los datos del alumno y eliminar su cuenta (Ley 21.719) | S | 5 | 3 | Elías | En revisión |
| **Contrato y documentación** |||||||
| PB-17 | Especificación OpenAPI 3.1 verificada y protegida | M | 5 | 1 | Ricardo | Terminado (PR #9, #10) |
| PB-18 | Artefactos Scrum | M | 3 | 3 | Ricardo | En revisión |
| PB-19 | Documentación técnica: modelo de datos, requisitos no funcionales, diagramas UML e innovación | S | 5 | 5 | Ricardo | Pendiente |
| **Despliegue** |||||||
| PB-20 | API y sitio web en Vercel como proyectos independientes | M | 5 | 1 | Ricardo | Terminado (PR #5, #7, #11, #12) |
| PB-21 | Entorno completo con Docker Compose | M | 8 | 5 | Elías | Pendiente |
| **Clientes** |||||||
| PB-22 | Sitio web integrado con la API desplegada | M | 3 | 1 | Ricardo | Terminado (PR #12) |
| PB-23 | Mejoras del sitio web: búsqueda, Inicio con datos reales y accesibilidad | S | 5 | 3 | Elías | En curso |
| PB-24 | App Android compilable con su configuración nativa | M | 3 | 2 | Ricardo | Terminado (PR #13) |
| PB-25 | App Flutter integrada con la API en los flujos principales | M | 8 | 3 y 4 | Elías | En curso |
| PB-26 | Configuración nativa de iOS (sin compilación: el equipo no tiene Mac) | C | 2 | 5 | Ricardo | Pendiente |
| **Cierre** |||||||
| PB-27 | Presentación final y demostración | M | 3 | Cierre | Elías | Pendiente |

**Avance:** 12 de 27 elementos terminados (53 de 125 puntos).

## Historias y criterios de aceptación

### Persistencia

**PB-01 · Migrar la persistencia a Cloud Firestore.** Como empresa, quiero que los
datos se guarden en una base de datos en la nube, para poder desplegar la API y no
perder información.
- La API funciona con `DATA_DRIVER=firestore` contra la base real y el emulador.
- El seed puebla la base y se protege contra ejecuciones accidentales en producción.

**PB-02 · Consultas nativas e índice compuesto.** Como empresa, quiero que cada
pregunta servida no lea la colección completa, para no agotar la cuota de Firestore.
- `GET /practice/next` usa el índice (published, testId, rand) y no lee todas las preguntas.
- El índice está desplegado y en estado listo.

**PB-03 · Importar el banco de preguntas.** Como estudiante, quiero practicar con
preguntas reales de la PAES.
- Se importan 1.365 preguntas con identificadores deterministas; reimportar no duplica.
- Los archivos inválidos se informan y se documentan.

### Seguridad

**PB-04 · Acceso social sin suplantación.** Como estudiante, quiero que nadie pueda
entrar a mi cuenta con un token falso.
- Fuera del modo de demostración, `POST /auth/social` responde `503`.
- En modo de demostración, el token demo no entra a cuentas con contraseña.

**PB-05 · Planes de pago protegidos.** Como empresa, quiero que nadie active un plan
de pago sin pagar.
- El cambio de plan valida plan y ciclo, y solo funciona en modo de demostración.
- El webhook de pagos responde `503` mientras no haya pagos integrados.

**PB-06 · Configuración segura.** Como empresa, quiero que la API no arranque con una
configuración insegura y que solo acepte orígenes conocidos.
- Sin un `JWT_SECRET` válido, la API no arranca en producción.
- Las invitaciones solo las acepta el correo invitado y vencen a los 7 días.
- CORS acepta solo orígenes configurados; se envían cabeceras de seguridad.

**PB-07 · Límite de intentos.** Como estudiante, quiero que mi cuenta esté protegida
contra intentos masivos de contraseña.
- Tras N intentos fallidos, `POST /auth/login` responde `429` durante un período.
- El contador vive en un almacén compartido, no en memoria de la instancia.

**PB-08 · Rotación de tokens.** Como estudiante, quiero que cerrar sesión invalide mis
tokens.
- Cada renovación entrega un token nuevo e invalida el anterior.
- El cierre de sesión revoca el token de renovación.

**PB-09 · Endurecimiento de la API.** Como empresa, quiero cerrar validaciones
adicionales detectadas en la revisión.
- Los tokens se verifican solo con HS256; las cuentas suspendidas no renuevan sesión.
- El cuerpo JSON se limita a 100 KB; regalar medallas valida monto, destinatarios y saldo.

### Calidad

**PB-10 · Sin respuestas duplicadas.** Como estudiante, quiero que un doble clic no
registre mi respuesta dos veces.
- Dos envíos simultáneos de la misma respuesta generan un solo registro.

**PB-11 · Prueba de integración.** Como equipo, queremos verificar la API completa
antes de integrar cada cambio.
- `npm run smoke` ejecuta todas las secciones y termina sin fallos.

**PB-12 · Pruebas unitarias.** Como equipo, queremos pruebas rápidas de las reglas de
negocio críticas.
- Cubren autenticación, autorización, cuota diaria y medallas, y se ejecutan con un comando.

**PB-13 · Plan de pruebas.** Como equipo, queremos documentar qué se prueba y cómo.
- Describe tipos de prueba (unitarias, integración, seguridad), alcance y criterios.

### Flujos y consistencia

**PB-14 · Recorrecciones.** Como estudiante, quiero saber qué pasó con la pregunta que
reporté como errónea.
- Una solicitud de recorrección puede resolverse y el alumno ve su estado.

**PB-15 · Consistencia de datos.** Como estudiante, quiero que mi cuota y mis medallas
no se pierdan si uso la app y la web a la vez.
- Los contadores del usuario se actualizan con operaciones atómicas o transacciones.
- Una pregunta repetida en la práctica puede responderse.

**PB-16 · Mis datos y privacidad.** Como estudiante, quiero obtener una copia de mis
datos y eliminar mi cuenta.
- El alumno puede exportar sus datos y eliminar su cuenta con sus datos asociados,
  con un aviso previo de lo que ocurrirá.

### Contrato y documentación

**PB-17 · OpenAPI.** Como empresa, quiero un contrato único de la API.
- `/api/docs` muestra la especificación; `npm run openapi:verificar` confirma que todas
  las rutas están documentadas; en producción el acceso está protegido.

**PB-18 · Artefactos Scrum.** Como equipo, queremos un registro visible del backlog,
los sprints y las retrospectivas.
- Existen visión, Product Backlog, Sprint Backlog, Definition of Done y retrospectivas en `docs/scrum`.

**PB-19 · Documentación técnica.** Como empresa, quiero que otro equipo pueda entender
y mantener el sistema.
- `docs/` incluye modelo de datos, requisitos no funcionales, diagramas UML y la
  propuesta de innovación.

### Despliegue

**PB-20 · Vercel.** Como empresa, quiero ver el avance publicado cada semana.
- API y sitio web se despliegan desde `main`; cada Pull Request genera una vista previa.

**PB-21 · Docker.** Como empresa, quiero levantar el sistema completo con un comando.
- `docker compose up` levanta la API, el sitio web y el emulador de base de datos, y
  el README explica cómo hacerlo.

### Clientes

**PB-22 · Sitio web integrado.** Como estudiante, quiero usar el sitio web contra la
API publicada.
- El sitio web consume la API por su dominio, con CORS restringido.

**PB-23 · Mejoras del sitio web.** Como estudiante, quiero buscar contenido y ver mi
progreso real al entrar.
- Inicio muestra racha, cuota y progreso con datos reales; la búsqueda usa `GET /search`.

**PB-24 · App Android compilable.** Como equipo, queremos probar la app en un
dispositivo Android.
- `flutter build apk` termina sin errores con la configuración nativa aplicada.

**PB-25 · App integrada.** Como estudiante, quiero practicar desde la app con mi cuenta.
- Inicio de sesión, Inicio, práctica, medallas y ajustes funcionan contra la API.

**PB-26 · iOS.** Como empresa, quiero que el proyecto iOS quede preparado.
- La carpeta `ios/` existe con la configuración de `setup/ios` aplicada.

### Cierre

**PB-27 · Presentación final.** Como equipo, queremos demostrar el sistema a la
institución.
- La demostración corre con Docker en equipo propio, sin depender de la conexión.
