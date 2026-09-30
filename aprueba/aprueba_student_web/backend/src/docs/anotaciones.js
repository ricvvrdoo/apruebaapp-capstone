// Anotaciones manuales del contrato OpenAPI: lo que el codigo no expresa.
//
// generar.js combina tres fuentes, en este orden de prioridad:
//   1. El codigo: rutas, parametros, campos del body, errores (fail) y las
//      respuestas reales capturadas al correr el smoke test.
//   2. contrato-api.json: fichas de Aprueba_API_Backend.docx (descripciones,
//      tipos y obligatoriedad de las entradas, errores documentados).
//   3. Este archivo: grupos (tags), resumenes, y la documentacion de los
//      endpoints agregados despues del documento (ver backend/ENDPOINTS_GAP.md).

// Grupo de cada archivo de rutas.
export const TAGS = [
  { archivo: 'auth.js', name: 'Autenticación y cuenta', description: 'Registro, login con correo o proveedor social, renovación de tokens, recuperación de contraseña y verificación telefónica.' },
  { archivo: 'catalog.js', name: 'Catálogo', description: 'Países, grados, pruebas, planes y beneficios. Datos de referencia para el onboarding y la tienda.' },
  { archivo: 'me.js', name: 'Perfil y cuenta del alumno', description: 'Perfil, ajustes, preferencias de práctica, cuota diaria, progreso, medallas, regalos, notificaciones, dispositivos, suscripción y exportación de datos.' },
  { archivo: 'practice.js', name: 'Práctica', description: 'Núcleo de la app: siguiente pregunta según la cuota, respuesta, explicación paso a paso y habilidad evaluada.' },
  { archivo: 'corrections.js', name: 'Recorrecciones', description: 'Solicitudes del alumno para revisar una pregunta con error.' },
  { archivo: 'groups.js', name: 'Grupos de estudio', description: 'Grupos, miembros, invitaciones, estadísticas y preguntas compartidas.' },
  { archivo: 'community.js', name: 'Comunidad', description: 'Feed, publicaciones, comentarios, likes y reposts.' },
  { archivo: 'tutors.js', name: 'Tutores', description: 'Marketplace de tutores: búsqueda, perfil, reseñas, solicitudes de contacto y análisis de falencias. Los tutores se administran desde la consola admin; el alumno solo lee, reseña y contacta.' },
  { archivo: 'conversations.js', name: 'Chat con tutores', description: 'Conversaciones con tutores por REST + polling: bandeja, historial paginado, envío, lectura y consentimiento para compartir WhatsApp.' },
  { archivo: 'checkout.js', name: 'Pagos (modo demo)', description: 'Los pagos están fuera del alcance del MVP. Sin Stripe integrado, activar un plan sin pagar solo se permite con DEMO_MODE=true; el webhook está deshabilitado.' },
  { archivo: 'index.js', name: 'Sistema', description: 'Estado del servicio.' },
];

// Resumen corto por endpoint ('METODO /ruta' con la ruta de Express).
export const RESUMENES = {
  'GET /health': 'Estado del servicio',
  'POST /auth/register': 'Registrar alumno con correo y contraseña',
  'POST /auth/login': 'Iniciar sesión con correo y contraseña',
  'POST /auth/social': 'Iniciar sesión con Google o Apple',
  'POST /auth/refresh': 'Renovar el access token',
  'POST /auth/logout': 'Cerrar sesión',
  'POST /auth/password/forgot': 'Solicitar recuperación de contraseña',
  'POST /auth/password/reset': 'Restablecer la contraseña',
  'POST /auth/phone/send-code': 'Iniciar la verificación telefónica',
  'POST /auth/phone/verify-code': 'Verificar el teléfono con Firebase Auth',
  'GET /countries': 'Listar países soportados',
  'GET /countries/:code/grades': 'Listar grados de un país',
  'GET /tests': 'Listar pruebas y asignaturas',
  'GET /plans': 'Listar planes de pago',
  'GET /benefits': 'Listar beneficios canjeables',
  'GET /benefits/:id': 'Obtener un beneficio',
  'POST /benefits/:id/redeem': 'Canjear un beneficio',
  'GET /me': 'Obtener el perfil del alumno',
  'PATCH /me': 'Actualizar el perfil',
  'DELETE /me': 'Eliminar la cuenta',
  'PATCH /me/phone': 'Asociar un teléfono verificado',
  'GET /me/settings': 'Obtener ajustes',
  'PATCH /me/settings': 'Actualizar ajustes',
  'GET /me/preferences': 'Obtener preferencias de práctica',
  'PUT /me/preferences': 'Guardar preferencias de práctica',
  'GET /me/quota': 'Consultar la cuota diaria',
  'POST /me/quota/unlock': 'Desbloquear cuota adicional',
  'GET /me/progress': 'Consultar el progreso por prueba',
  'GET /me/medals': 'Consultar la billetera de medallas',
  'POST /me/medals/exchange': 'Canjear 5 medallas por 1 del nivel siguiente',
  'GET /me/gifts': 'Consultar regalos disponibles y a quién regalar',
  'POST /me/gifts': 'Regalar medallas a compañeros de grupo',
  'GET /me/notifications': 'Listar notificaciones',
  'PATCH /me/notifications/:id/read': 'Marcar una notificación como leída',
  'POST /me/notifications/read-all': 'Marcar todas las notificaciones como leídas',
  'PUT /me/notifications/preferences': 'Guardar preferencias de notificación',
  'POST /devices': 'Registrar un dispositivo para push',
  'DELETE /devices/:id': 'Eliminar un dispositivo',
  'GET /me/subscription': 'Consultar la suscripción',
  'POST /me/subscription/change': 'Cambiar de plan o ciclo (modo demo)',
  'POST /me/subscription/cancel': 'Cancelar la suscripción',
  'GET /me/invoices': 'Listar boletas',
  'GET /me/data-export': 'Exportar los datos del alumno',
  'GET /practice/next': 'Obtener la siguiente pregunta',
  'GET /questions/:id': 'Obtener una pregunta',
  'POST /questions/:id/answer': 'Responder una pregunta',
  'GET /questions/:id/explanation': 'Obtener la explicación paso a paso',
  'GET /questions/:id/skill': 'Obtener la habilidad evaluada',
  'POST /corrections': 'Solicitar una recorrección',
  'GET /corrections': 'Listar mis recorrecciones',
  'GET /corrections/:id': 'Consultar una recorrección',
  'GET /groups': 'Listar mis grupos',
  'POST /groups': 'Crear un grupo',
  'GET /groups/:id': 'Obtener un grupo',
  'PATCH /groups/:id': 'Actualizar un grupo',
  'DELETE /groups/:id': 'Eliminar un grupo',
  'POST /groups/:id/invitations': 'Invitar a un grupo por correo',
  'GET /groups/:id/invitations': 'Listar invitaciones pendientes',
  'POST /invitations/:token/accept': 'Aceptar una invitación',
  'DELETE /groups/:id/members/me': 'Salir de un grupo',
  'DELETE /groups/:id/members/:userId': 'Quitar a un miembro',
  'GET /groups/:id/stats': 'Estadísticas del grupo',
  'GET /groups/:id/shared': 'Listar preguntas compartidas',
  'POST /groups/:id/shared': 'Compartir una pregunta en el grupo',
  'GET /feed': 'Obtener el feed de la comunidad',
  'POST /posts': 'Publicar en la comunidad',
  'DELETE /posts/:id': 'Eliminar una publicación propia',
  'POST /posts/:id/like': 'Dar o quitar like',
  'POST /posts/:id/repost': 'Hacer o deshacer repost',
  'GET /posts/:id/comments': 'Listar comentarios',
  'POST /posts/:id/comments': 'Comentar una publicación',
  'DELETE /posts/:id/comments/:commentId': 'Eliminar un comentario',
  'GET /tutors': 'Buscar tutores',
  'GET /tutors/featured': 'Listar tutores destacados',
  'GET /tutors/:id': 'Obtener el perfil de un tutor',
  'GET /tutors/:id/reviews': 'Listar reseñas de un tutor',
  'POST /tutors/:id/reviews': 'Reseñar a un tutor',
  'POST /tutors/:id/contact-requests': 'Contactar a un tutor',
  'GET /me/gap-analysis': 'Análisis de falencias',
  'GET /me/conversations': 'Listar mis conversaciones',
  'GET /conversations/:id': 'Obtener una conversación',
  'GET /conversations/:id/messages': 'Listar mensajes',
  'POST /conversations/:id/messages': 'Enviar un mensaje',
  'POST /conversations/:id/read': 'Marcar la conversación como leída',
  'PATCH /conversations/:id/contact-sharing': 'Compartir o no el WhatsApp',
  'POST /checkout/sessions': 'Crear una sesión de pago (modo demo)',
  'POST /checkout/sessions/:id/confirm': 'Confirmar el pago de una sesión (modo demo)',
  'POST /webhooks/stripe': 'Webhook de Stripe (deshabilitado)',
};

// Endpoints que no tienen ficha en Aprueba_API_Backend.docx: se agregaron
// despues (backend/ENDPOINTS_GAP.md). Misma forma que las entradas del
// contrato: { name, in, type, required: 'Sí' | 'No', desc }.
const E = (name, where, type, required, desc) => ({ name, in: where, type, required: required ? 'Sí' : 'No', desc });

export const EXTRA = {
  'GET /health': { descripcion: 'Indica si el servicio responde y qué driver de datos usa.' },
  // Diferencia conocida con el documento: se aclara en vez de documentar algo que no ocurre.
  'POST /auth/logout': {
    nota: '**Diferencia con el documento:** la implementación actual no revoca el refresh token; sigue siendo válido hasta que expira (30 días). Pendiente en docs/seguridad-pendiente.md.',
  },
  'POST /auth/phone/send-code': {
    descripcion: 'Valida el teléfono en formato E.164 y deriva el país y el idioma del prefijo (+56 → CL/es, +44 → UK/en). No envía el SMS: lo envía el cliente con Firebase Auth. Responde 422 COUNTRY_NOT_SUPPORTED fuera de CL y UK.',
    entradas: [E('phone', 'body', 'string', true, 'Teléfono en formato E.164, por ejemplo +56912345678.')],
  },
  'POST /auth/phone/verify-code': {
    descripcion: 'Canjea el idToken de Firebase Auth (flujo de teléfono) por un phoneToken corto, que luego se usa en /auth/register, /auth/social o PATCH /me/phone. Con DEMO_MODE, acepta tokens de prueba con formato dev:+56912345678.',
    entradas: [
      E('firebaseIdToken', 'body', 'string', true, 'idToken de Firebase Auth tras verificar el SMS.'),
      E('phone', 'body', 'string', false, 'Teléfono esperado; si viene, debe coincidir con el del token.'),
    ],
  },
  'PATCH /me/phone': {
    descripcion: 'Asocia al alumno el teléfono acreditado por un phoneToken. Es el paso del flujo social cuando /auth/social responde phoneVerificationRequired.',
    entradas: [E('phoneToken', 'body', 'string', true, 'Token obtenido en POST /auth/phone/verify-code.')],
  },
  'GET /countries': { descripcion: 'Países soportados con su prefijo telefónico, idiomas, idioma por defecto y moneda.' },
  'GET /countries/:code/grades': {
    descripcion: 'Grados del país agrupados como en el onboarding (básica, media, PAES / primary, secondary, sixth form, GCSE, A levels).',
    entradas: [E('code', 'path', 'string', true, 'Código del país: CL o UK.'), E('lang', 'query', 'enum', false, 'Idioma de los textos: es | en.')],
  },
  'GET /benefits/:id': { descripcion: 'Detalle del beneficio y los cupones que el alumno ya canjeó.' },
  'GET /corrections/:id': { descripcion: 'Estado de una recorrección; la pantalla de recorrección lo consulta mientras está pending.' },
  'POST /me/notifications/read-all': { descripcion: 'Marca como leídas todas las notificaciones del alumno.' },
  'DELETE /groups/:id/members/me': { descripcion: 'El alumno sale del grupo. Si era el dueño, la propiedad pasa al miembro más antiguo; si no queda nadie, el grupo y sus datos se eliminan.' },
  'DELETE /posts/:id': { descripcion: 'Elimina una publicación propia (403 NOT_POST_AUTHOR si es de otro) junto con sus comentarios, likes y reposts.' },
  'DELETE /posts/:id/comments/:commentId': { descripcion: 'Elimina un comentario. Puede hacerlo el autor del comentario o el de la publicación.' },
  'POST /posts/:id/repost': { descripcion: 'Alterna el repost del alumno sobre la publicación y actualiza el contador.' },
  'GET /tutors': {
    descripcion: 'Búsqueda de tutores con filtros y orden. meta.premium indica si el plan del alumno permite contactar.',
    entradas: [
      E('q', 'query', 'string', false, 'Texto libre: nombre o asignatura.'),
      E('subject', 'query', 'string', false, 'Asignatura.'),
      E('mode', 'query', 'enum', false, 'Modalidad: online | presencial.'),
      E('verified', 'query', 'boolean', false, 'Solo tutores verificados.'),
      E('featured', 'query', 'boolean', false, 'Solo tutores destacados.'),
      E('sort', 'query', 'enum', false, 'Orden: rating | price_asc | price_desc | experience.'),
    ],
  },
  'GET /tutors/featured': { descripcion: 'Bloque "Profesores destacados" del marketplace.' },
  'GET /tutors/:id': { descripcion: 'Perfil del tutor: biografía, precio, valoración por criterio, reseña destacada y, para el alumno, si ya lo contactó, si puede reseñarlo y su conversación.' },
  'GET /tutors/:id/reviews': { descripcion: 'Reseñas paginadas; meta.summary trae el promedio global y por criterio.' },
  'POST /tutors/:id/reviews': {
    descripcion: 'Reseña con tres criterios. Exige haber contactado al tutor (403 REVIEW_NOT_ALLOWED) y admite una por alumno (409 REVIEW_ALREADY_EXISTS).',
    entradas: [
      E('ratings', 'body', 'object', true, 'Notas de 1 a 5: { teaching, punctuality, mastery }.'),
      E('comment', 'body', 'string', false, 'Comentario opcional.'),
    ],
  },
  'POST /tutors/:id/contact-requests': {
    descripcion: 'Crea la solicitud de contacto y la conversación con el tutor. Es idempotente: si ya existe, agrega el mensaje y responde 200 con created: false.',
    entradas: [
      E('message', 'body', 'string', true, 'Mensaje inicial para el tutor.'),
      E('shareProfile', 'body', 'boolean', false, 'Compartir el perfil académico del alumno con el tutor.'),
    ],
  },
  'GET /me/gap-analysis': { descripcion: 'Dominio del alumno por prueba, áreas a reforzar y cuántos tutores se recomiendan, ordenado de mayor a menor necesidad.' },
  'GET /me/conversations': { descripcion: 'Conversaciones del alumno con unreadCount por chat; meta.unreadTotal alimenta el badge.' },
  'GET /conversations/:id': { descripcion: 'Conversación con el perfil compartido en la solicitud y el estado del contacto.' },
  'GET /conversations/:id/messages': {
    descripcion: 'Historial en orden descendente con cursor opaco. Marca como leídos los mensajes del tutor salvo markRead=false.',
    entradas: [E('markRead', 'query', 'boolean', false, 'false para consultar sin marcar como leídos.')],
  },
  'POST /conversations/:id/messages': {
    descripcion: 'Envía un mensaje al tutor.',
    entradas: [E('text', 'body', 'string', true, 'Texto del mensaje, hasta 2.000 caracteres.')],
  },
  'POST /conversations/:id/read': { descripcion: 'Pone en cero el contador de no leídos de la conversación.' },
  'PATCH /conversations/:id/contact-sharing': {
    descripcion: 'Consentimiento para compartir el WhatsApp. El teléfono se revela solo con consentimiento mutuo y exige teléfono verificado (422 PHONE_REQUIRED).',
    entradas: [E('shareWhatsapp', 'body', 'boolean', true, 'true para compartir el teléfono con el tutor.')],
  },
  'POST /checkout/sessions/:id/confirm': { descripcion: 'Confirma el pago de una sesión de checkout y activa el plan. Equivale a recibir checkout.session.completed desde Stripe.' },
};

// Notas que se agregan a la descripcion segun lo que detecta el analisis del codigo.
export const NOTAS = {
  premium: '**Requiere plan de pago** (uni o all): con plan free responde 403 PLAN_REQUIRED.',
  demo: '**Solo con DEMO_MODE=true.** Sin pagos ni proveedores de identidad reales, fuera de modo demo responde 503.',
  webhook: '**Deshabilitado:** responde siempre 503 PAYMENTS_DISABLED. No verificaba la firma de Stripe; se habilitará al integrar pagos, validando la firma sobre el cuerpo crudo.',
  soloDocumento: '(Definido en Aprueba_API_Backend.docx; la implementación actual no lo usa.)',
};
