# Definition of Done

Un elemento del Product Backlog está **terminado** cuando cumple todas las
condiciones que le aplican. Si una condición no aplica (por ejemplo, un cambio solo de
documentación no tiene rutas nuevas), se indica en el Pull Request.

## Código

- [ ] El cambio está en una rama corta con el prefijo que corresponde (`feat/`, `fix/`,
      `sec/`, `refactor/`, `chore/`, `docs/`).
- [ ] Entra a `main` mediante un Pull Request, con una descripción que explica qué
      cambia y por qué. Nunca se hace push directo a `main`.
- [ ] Los commits están en español, en tercera persona, y explican el motivo del cambio.
- [ ] No se versionan credenciales ni datos de la empresa fuera del alcance.

## Calidad

- [ ] La prueba automatizada de la API (`npm run smoke`) pasa sin fallos, en memoria y
      sobre el emulador de Firestore cuando el cambio toca datos.
- [ ] Si el cambio corrige un defecto o una vulnerabilidad, se agrega una prueba que lo
      cubre.
- [ ] La vista previa de Vercel del Pull Request se revisó en los flujos afectados.

## Contrato y documentación

- [ ] Si se agregan o cambian rutas de la API, la especificación OpenAPI se regenera y
      `npm run openapi:verificar` confirma que todas las rutas están documentadas.
- [ ] Si cambian variables de entorno, despliegue o seguridad, se actualiza la guía
      correspondiente en `docs/`.

## Entrega

- [ ] El cambio quedó desplegado en producción después de integrarse a `main`.
- [ ] El elemento se marca como terminado en el [Product Backlog](product-backlog.md) y
      en el [Sprint Backlog](sprint-backlog.md).

## Definición de terminado para un sprint

Un sprint se cierra cuando sus elementos terminados están en `main` y desplegados, el
Sprint Backlog registra el resultado de cada elemento y se realizó la retrospectiva.
Los hitos se marcan con una etiqueta versionada (por ejemplo, `v0.1.0`).
