/**
 * Llaves públicas del proyecto.
 *
 * Supabase está migrando de la llave `anon` (JWT largo) a la nueva
 * `publishable` (`sb_publishable_…`). Se aceptan las dos para que rotar una por
 * otra no tumbe la app: basta con que exista cualquiera de las dos.
 *
 * Ambas se leen con acceso literal a `process.env` porque Next las sustituye en
 * tiempo de compilación; una lectura dinámica no llegaría al navegador.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

export const SUPABASE_LLAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''

/**
 * Sin llaves la app no puede autenticar a nadie. En vez de tronar con un error
 * de runtime, muestra la pantalla de instalación con los pasos que faltan.
 */
export const SUPABASE_CONFIGURADO = Boolean(SUPABASE_URL && SUPABASE_LLAVE_PUBLICA)
