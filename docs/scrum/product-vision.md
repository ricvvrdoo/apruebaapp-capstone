# Visión del producto

## Declaración de visión

> **Para** estudiantes de enseñanza media que preparan la PAES,
> **que** no pueden pagar un preuniversitario o necesitan practicar más allá de él,
> **Aprueba** es una plataforma móvil y web de práctica
> **que** entrega preguntas reales de la PAES con corrección inmediata, explicaciones
> y motivación diaria.
> **A diferencia de** un preuniversitario presencial, cuesta poco o nada y se usa
> desde el teléfono en cualquier momento,
> **y a diferencia del** sistema recibido de la empresa, puede recibir usuarios
> reales: guarda los datos en una base de datos en la nube, protege las cuentas y se
> verifica con pruebas automatizadas.

## Problema

La preparación para la PAES depende de la capacidad de pago de cada familia. La
empresa Alloxentric construyó Aprueba para reducir esa brecha, pero el sistema que
entregó al equipo no podía salir a producción: guardaba los datos en un archivo
local, permitía suplantar cuentas y activar planes de pago sin pagar, y no tenía
pruebas automatizadas.

## Usuarios y partes interesadas

| Quién | Qué necesita |
|---|---|
| Estudiantes de 3° y 4° medio | Practicar con preguntas reales, saber en qué fallan y mantener la constancia |
| Familias y establecimientos | Una preparación accesible y segura para estudiantes menores de edad |
| Alloxentric (empresa mandante) | Un backend desplegable, seguro, documentado y mantenible por otro equipo |
| Docente guía (Duoc UC) | Evidencia del proceso y del cumplimiento de las competencias del perfil de egreso |

## Objetivos del proyecto

**Objetivo general.** Implementar las mejoras de seguridad, persistencia y calidad
necesarias para dejar el backend de la plataforma Aprueba, junto con su aplicación
móvil y su sitio web del estudiante, en condiciones de despliegue productivo antes del
término del semestre académico.

**Objetivos específicos.**

1. Migrar la capa de persistencia desde el almacenamiento local en archivo hacia Cloud
   Firestore, con índices compuestos y reglas de seguridad.
2. Corregir las vulnerabilidades identificadas en el backend recibido, priorizando el
   acceso mediante proveedores externos y el cambio de plan de suscripción.
3. Desplegar el backend con publicación continua en Vercel durante el desarrollo y en
   contenedores Docker como entregable final.
4. Construir una batería de pruebas automatizadas sobre las reglas de negocio
   críticas: autenticación, autorización, cuota diaria y gamificación.
5. Completar los flujos funcionales sin cierre, en particular las recorrecciones de
   preguntas, y corregir los defectos de consistencia de datos.
6. Documentar el contrato de la API con una especificación OpenAPI versionada.
7. Integrar y adecuar los clientes: sitio web y app Flutter validada en Android, con
   iOS configurado sin compilar.

Los objetivos 3, 5 y 7 incluyen los ajustes acordados en la Fase 2.

## Alcance

- **Dentro:** API REST, base de datos, sitio web del estudiante y app móvil Flutter.
- **Fuera, por acuerdo con la empresa:** consola de administración y generador de
  preguntas con inteligencia artificial.
- **Pendiente de decisión de la empresa:** pagos reales (Stripe), inicio de sesión
  social real y notificaciones push. Mientras tanto funcionan en modo de demostración.

## Criterios de éxito

| Criterio | Medida |
|---|---|
| Persistencia real | API operando sobre Cloud Firestore en producción, sin leer colecciones completas por solicitud |
| Seguridad | Vulnerabilidades críticas cerradas y verificadas con pruebas; pendientes documentados |
| Calidad | Pruebas automatizadas sobre autenticación, autorización, cuota diaria y medallas, sin fallos |
| Contrato | Especificación OpenAPI que documenta el 100 % de las rutas, verificada automáticamente |
| Entrega | API y sitio web desplegados; entorno completo levantable con Docker Compose |
| Clientes | Flujos principales del sitio web y de la app Android funcionando contra la API |
