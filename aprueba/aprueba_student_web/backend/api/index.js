// Funcion serverless de Vercel para el proyecto de la API (aprueba-api, con
// Root Directory en este backend). vercel.json redirige todas las rutas aqui;
// Express recibe la ruta original.
//
// Un despliegue siempre se trata como produccion: exige un JWT_SECRET real y
// apaga los atajos de prueba salvo DEMO_MODE=true explicito. Se fija antes de
// importar la app porque jwt.js valida el secreto al cargarse.
process.env.NODE_ENV ||= 'production';

const { default: app } = await import('../src/index.js');

export default app;
