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

## Objetivo del producto en el proyecto

Dejar en condiciones de despliegue productivo el backend de Aprueba, junto con su
sitio web y su app móvil del estudiante, antes del término del semestre académico.

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
