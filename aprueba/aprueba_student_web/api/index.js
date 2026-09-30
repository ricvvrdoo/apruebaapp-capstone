// Funcion serverless de Vercel: reexporta la app Express del backend.
// vercel.json redirige /api/* y /health aqui; Express recibe la ruta original.
//
// Un despliegue siempre se trata como produccion: exige un JWT_SECRET real y
// apaga los atajos de prueba salvo DEMO_MODE=true explicito. Se fija antes de
// importar la app porque jwt.js valida el secreto al cargarse.
process.env.NODE_ENV ||= 'production';

const { default: app } = await import('../backend/src/index.js');

export default app;
