# Requisitos no funcionales

Requisitos de calidad del sistema, agrupados según las características de la norma
ISO/IEC 25010. Se derivaron de los documentos de la empresa (`Aprueba_API_Backend.docx`
y `Aprueba_Modelo_Datos_Firestore.docx`), del contexto del proyecto (usuarios menores
de edad, cuota gratuita de Firestore, plazo académico) y de lo que el sistema ya cumple.

**Estado:** **Verificado** (cumplido y con evidencia) · **Parcial** · **Meta** (aún no
cumplido; tiene un elemento del [Product Backlog](scrum/product-backlog.md) asociado).

## Seguridad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-01 | Las sesiones usan tokens firmados de corta duración | Token de acceso JWT de 15 minutos y de renovación de 30 días, con tipo (`access` o `refresh`) verificado en cada uso | Verificado | `lib/jwt.js`, prueba automatizada |
| RNF-02 | La API no arranca con un secreto de firma inseguro | En producción, falla al iniciar si `JWT_SECRET` falta, es un valor de ejemplo o tiene menos de 32 caracteres | Verificado | `lib/jwt.js`, sección [12] de la prueba |
| RNF-03 | Las contraseñas no se guardan en texto plano | Hash scrypt con sal aleatoria por usuario y comparación en tiempo constante | Verificado | `lib/password.js` |
| RNF-04 | Nadie puede suplantar una cuenta ni activar un plan sin pagar | Acceso social y cambio de plan solo en `DEMO_MODE`; webhook de pagos deshabilitado | Verificado | [seguridad-pendiente.md](seguridad-pendiente.md) |
| RNF-05 | Solo orígenes conocidos pueden llamar a la API desde un navegador | CORS con lista exacta (`CORS_ORIGINS`) y patrón anclado; ninguno por defecto en producción | Verificado | `src/index.js`, sección [15] de la prueba |
| RNF-06 | Las respuestas incluyen cabeceras de seguridad | `helmet` en la API; CSP y cabeceras en el sitio web | Verificado | `src/index.js`, `vercel.json` del sitio web |
| RNF-07 | Los clientes no acceden directamente a la base de datos | Reglas de Firestore que niegan toda lectura y escritura | Verificado | `firestore.rules` desplegado |
| RNF-08 | Las credenciales nunca se versionan | Claves solo como variables de entorno; `.gitignore` excluye claves de Firebase y `.env` | Verificado | `.gitignore`, guía de despliegue |
| RNF-09 | El inicio de sesión resiste intentos masivos | Tras varios intentos fallidos responde `429` por un período, con contador en almacén compartido | Meta | PB-07 |
| RNF-10 | Cerrar sesión invalida los tokens | Rotación del token de renovación y revocación al cerrar sesión | Meta | PB-08 |

## Privacidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-11 | El tratamiento de datos se ajusta a la Ley 21.719, considerando que hay usuarios menores de edad | Se recolectan solo los datos necesarios para la práctica y no se exponen datos de otros alumnos | Parcial | Respuestas públicas sin datos personales ajenos |
| RNF-12 | El alumno puede obtener sus datos y eliminar su cuenta | Exportación completa de datos y eliminación de la cuenta con sus datos asociados | Parcial | `DELETE /me` elimina la cuenta; exportación completa en desarrollo (PB-16) |

## Eficiencia de desempeño

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-13 | Servir una pregunta es rápido | `GET /practice/next` bajo 300 ms contra la base de producción (medido: 100 a 125 ms) | Verificado | Medición del 30-09-2026 |
| RNF-14 | El costo de lectura por pregunta es acotado | Como máximo unas 40 lecturas de Firestore por pregunta servida, independiente del tamaño del banco | Verificado | Índice (published, testId, rand), ventana de 20 |
| RNF-15 | El sistema opera dentro de la capa gratuita durante el MVP | Uso diario bajo las 50.000 lecturas gratuitas de Firestore y dentro del plan gratuito de Vercel | Verificado | Consultas nativas (PR #2) |
| RNF-16 | El primer inicio de sesión tras inactividad es aceptable | Arranque en frío de la función serverless bajo 2 segundos (medido: cerca de 1 s) | Verificado | Medición del 30-09-2026 |

## Fiabilidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-17 | Una acción repetida no duplica datos | Dos envíos simultáneos de la misma respuesta generan un solo registro | Verificado | Sección [13] de la prueba |
| RNF-18 | Los contadores del alumno no pierden actualizaciones | Cuota y medallas actualizadas con operaciones atómicas o transacciones | Meta | PB-15 |
| RNF-19 | Los errores se informan de forma uniforme | Toda respuesta usa `{ data, error, meta }` con un código de error estable | Verificado | `lib/envelope.js`, OpenAPI |

## Mantenibilidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-20 | El contrato de la API está documentado y al día | OpenAPI 3.1 que documenta el 100 % de las rutas, verificado con `npm run openapi:verificar` | Verificado | [documentacion-api.md](documentacion-api.md) |
| RNF-21 | Cada cambio se verifica antes de integrarse | Pull Request con vista previa y prueba automatizada sin fallos (ver [Definition of Done](scrum/definition-of-done.md)) | Verificado | Historial de Pull Requests |
| RNF-22 | Las rutas no dependen del motor de base de datos | Acceso a datos solo a través de `data/repo.js`, con drivers intercambiables (memoria y Firestore) | Verificado | `data/repo.js` |
| RNF-23 | Las reglas de negocio críticas tienen pruebas unitarias | Pruebas de autenticación, autorización, cuota diaria y medallas | Meta | PB-12 |

## Portabilidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-24 | La misma API corre en la nube y en contenedores | Un solo servidor Express: adaptador delgado para Vercel y servidor estándar para Docker | Parcial | `api/index.js`; Docker en PB-21 |
| RNF-25 | El sistema completo se levanta con un comando | `docker compose up` levanta la API, el sitio web y el emulador de base de datos | Meta | PB-21 |
| RNF-26 | La app funciona en Android y queda preparada para iOS | Android 6.0 (API 23) o superior; iOS configurado sin compilar (sin Mac) | Parcial | PB-24, PB-26 |

## Usabilidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-27 | La interfaz está en español e inglés | Textos de interfaz en ambos idiomas, con cambio desde Ajustes | Verificado | `i18n.js` |
| RNF-28 | La interfaz ofrece tema claro y oscuro | Cambio desde Ajustes, con los colores del Manual de Marca | Verificado | Sitio web y app |
| RNF-29 | La práctica se puede usar con teclado | Las alternativas de respuesta son accesibles con teclado | Verificado | Commit `fc460db` |

## Disponibilidad

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| RNF-30 | El servicio publicado se puede monitorear | `GET /health` informa el estado y el driver de datos | Verificado | Producción |
| RNF-31 | La demostración final no depende de la conexión de la sala | Entorno completo en Docker en un equipo propio | Meta | PB-21, PB-27 |
