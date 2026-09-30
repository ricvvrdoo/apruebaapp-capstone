// Modo demo: habilita atajos de prueba mientras el MVP no tiene pagos ni
// proveedores de identidad reales. Apagado por defecto.
//
// Con DEMO_MODE=true se permiten:
//   - POST /checkout/sessions y /checkout/sessions/:id/confirm (activar un plan sin pagar)
//   - POST /me/subscription/change (cambiar de plan sin pagar)
//   - POST /auth/social con el token demo "proveedor:email:nombre"
//   - tokens de telefono "dev:+56912345678", incluso con NODE_ENV=production
//
// Se lee en cada peticion (no al arrancar) para poder probar ambos modos.
export const demoMode = () => process.env.DEMO_MODE === 'true';
