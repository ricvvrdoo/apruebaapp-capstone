# Retrospectivas

Cada retrospectiva revisa el proceso de trabajo del equipo, no solo el producto.
Formato: qué funcionó, qué no funcionó y acciones de mejora con responsable y fecha.
Las acciones abiertas se revisan al comienzo de la retrospectiva siguiente.

## Retrospectiva 1 — sprints 0 a 2

**Fecha:** 23-10-2026 (semana 11, durante el Sprint 3) · **Participantes:** Ricardo
Rodríguez y Elías Millahuala

Primera retrospectiva del proyecto. Debió hacerse al cierre de cada sprint; se hizo
junto con el monitoreo del plan de trabajo de la Fase 2 y cubre los sprints 0 a 2.

### Qué funcionó

- **Ordenar el trabajo por dependencias.** Atacar primero la base de datos y el
  despliegue permitió probar todo lo demás en un entorno real desde el Sprint 1.
- **Pull Requests con vista previa.** Cada cambio se verificó en Vercel antes de
  integrarse, y `main` se mantuvo desplegable.
- **Prueba automatizada desde el inicio.** Detectó regresiones durante las
  correcciones de seguridad y reprodujo el doble envío de respuestas antes de corregirlo.
- **Emulador de Firestore.** Permitió probar la migración sin costo y sin riesgo para
  la base real.
- **Adelantar trabajo cuando convenía.** La especificación OpenAPI se adelantó porque
  la separación entre la API y el sitio web necesitaba un contrato explícito.

### Qué no funcionó

- **No hubo artefactos Scrum.** El Product Backlog, el Sprint Backlog y las actas
  comprometidos en la Fase 1 no se crearon. Sin ellos no era visible qué se había
  atrasado ni quién trabajaba en qué.
- **Ritmo irregular.** El Sprint 1 concentró casi todo el avance y entre el 08-10 y el
  21-10 no hubo cambios en el repositorio.
- **Sin ceremonias registradas.** No se hicieron Sprint Planning, Sprint Review ni
  retrospectivas formales al cierre de cada sprint.
- **Cambios fuera del flujo acordado.** El 22-10 llegaron a `main` commits sin Pull
  Request, y se abrió una rama `develop` que no forma parte de GitHub Flow.

### Acciones de mejora

| # | Acción | Responsable | Fecha | Estado |
|---|---|---|---|---|
| 1 | Crear los artefactos Scrum en `docs/scrum` y actualizarlos en cada Planning y Review | Ricardo | 23-10 | En revisión |
| 2 | Revisión semanal corta (15 minutos) del Sprint Backlog al cierre de cada semana | Ambos | Desde el 24-10 | Pendiente |
| 3 | Todo cambio entra a `main` por Pull Request, sin push directo | Ambos | Desde el 23-10 | Pendiente |
| 4 | Integrar `develop` a `main` mediante Pull Requests por tema (seguridad, privacidad, sitio web, app) y volver a GitHub Flow | Elías | 27-10 | Pendiente |
| 5 | Hacer la retrospectiva al cierre de cada sprint, empezando por el Sprint 3 | Ricardo | 31-10 | Pendiente |

---

## Plantilla

```markdown
## Retrospectiva N — Sprint X

**Fecha:** dd-mm-aaaa · **Participantes:**

### Revisión de acciones anteriores
| # | Acción | Estado | Comentario |
|---|---|---|---|

### Qué funcionó
-

### Qué no funcionó
-

### Acciones de mejora
| # | Acción | Responsable | Fecha | Estado |
|---|---|---|---|---|
```
