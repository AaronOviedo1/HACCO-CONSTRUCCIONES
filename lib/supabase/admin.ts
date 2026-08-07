import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase/entorno'
import type { Database } from '@/types/database'

/**
 * Cliente con la llave de servicio.
 *
 * Se salta RLS por completo, así que sólo sirve para lo que la base no puede
 * hacer con la sesión de quien pide: crear y borrar usuarios de Auth. Cualquier
 * acción que lo use tiene que haber pasado antes por `requerirRol(['admin'])`
 * — la llave no pregunta quién eres.
 *
 * `server-only` corta la compilación si alguien lo importa desde un componente
 * de cliente: la llave nunca puede viajar al navegador, y por eso tampoco lleva
 * el prefijo NEXT_PUBLIC.
 */
export function crearClienteAdmin() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) return null

  return createClient<Database>(SUPABASE_URL, llave, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Lo que se le dice a quien intenta dar de alta sin la llave configurada. */
export const SIN_LLAVE_SERVICIO =
  'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin ella no se pueden crear ni borrar cuentas.'
