# Innovación

Aprueba no inventa una categoría nueva: existen plataformas de práctica para la PAES.
Su aporte está en **cómo** combina acceso, motivación, seguridad y costo para un
público de estudiantes, muchos de ellos menores de edad, con recursos limitados. Este
documento describe los aspectos innovadores del producto y de la solución técnica
construida en el proyecto.

## 1. Innovación social: preparación accesible

**Problema.** La calidad de la preparación para la PAES depende de lo que cada familia
puede pagar; un preuniversitario presencial cuesta varios cientos de miles de pesos al
año.

**Propuesta.** Práctica diaria gratuita desde el teléfono, con preguntas reales de la
PAES (1.365 en el banco actual), corrección inmediata y explicación paso a paso. El
plan gratuito tiene una cuota que crece con información útil del alumno (colegio y
dirección: de 10 a 20 preguntas diarias), en vez de cerrar el acceso detrás de un pago.

## 2. Motivación con valor real

**Problema.** La práctica autónoma se abandona con facilidad.

**Propuesta.** Una economía de medallas en cinco niveles (bronce, plata, oro, diamante
y platino; cinco de un nivel equivalen a uno del siguiente) que se ganan respondiendo
bien y se canjean por **beneficios reales financiados por marcas patrocinadoras**. La
motivación del alumno se conecta con un modelo de financiamiento que no depende solo
de su pago. Se complementa con rachas, grupos de estudio y una comunidad donde se
comparten preguntas.

## 3. Arquitectura de costo constante

**Problema.** En una base de datos en la nube cada lectura tiene costo. El sistema
recibido leía el banco completo de preguntas en cada solicitud, por lo que el costo
crecía con el tamaño del banco y agotaba la capa gratuita en pocas decenas de
preguntas al día.

**Solución del proyecto.** Cada pregunta guarda un número aleatorio fijo (`rand`),
asignado al importarla. Para servir una pregunta al azar, la API toma un punto
aleatorio y lee como máximo 20 preguntas desde ahí, apoyada en un índice compuesto.
El costo por pregunta servida queda **acotado (unas 40 lecturas) e independiente del
tamaño del banco**, y el servicio funciona dentro de la capa gratuita de Firestore y
Vercel durante el MVP. Ver [modelo-datos.md](modelo-datos.md).

## 4. Seguridad y privacidad desde el diseño

**Problema.** El sistema recibido permitía suplantar cuentas y activar planes de pago
sin pagar, y trata datos de menores de edad.

**Solución del proyecto.**
- Las funciones que dependen de proveedores aún no contratados (acceso con Google o
  Apple, pagos) funcionan solo en un **modo de demostración explícito** (`DEMO_MODE`),
  en vez de quedar abiertas a abuso.
- Separación de la API y el sitio web en proyectos distintos, con **mínimo privilegio**
  en las credenciales, CORS restringido y política de seguridad de contenido.
- La base de datos no es accesible desde los clientes.
- Orientación a la **Ley 21.719** de protección de datos personales: exportación de
  datos y eliminación de la cuenta por el propio alumno (en desarrollo).

## 5. Ingeniería verificable

- El contrato de la API (OpenAPI 3.1) se **genera desde el código y se verifica
  automáticamente**: si una ruta no está documentada, la verificación falla. El
  documento no puede quedar desactualizado respecto del código.
- Cada cambio pasa por un Pull Request con una **vista previa desplegada** y una prueba
  automatizada que ejercita la API completa, incluidas las correcciones de seguridad.
- La misma aplicación Express corre en la nube (serverless) y en contenedores, sin
  mantener dos arquitecturas.

## 6. Proyección

Ideas que el modelo actual ya permite y que quedan propuestas a la empresa:

- **Práctica adaptativa:** usar el historial de respuestas y el dominio por habilidad
  para priorizar las preguntas de los ejes más débiles de cada alumno.
- **Análisis de falencias para grupos y establecimientos:** reportes agregados que
  ayuden a docentes y orientadores a detectar contenidos críticos.
- **Expansión regional:** el catálogo de países y grados ya está modelado para otros
  sistemas de admisión.
