/**
 * Mientras no existan las llaves de Supabase la app no puede autenticar a
 * nadie. En vez de tronar con un error de runtime, muestra la pantalla de
 * instalación con los pasos que faltan.
 */
export const SUPABASE_CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
