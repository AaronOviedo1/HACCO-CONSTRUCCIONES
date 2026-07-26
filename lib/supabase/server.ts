import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from '@/lib/supabase/entorno'
import type { Database } from '@/types/database'

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Cada consulta viaja con la sesión del usuario, así que RLS es quien decide
 * qué puede ver: la app nunca es la única barrera.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies()

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_LLAVE_PUBLICA,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll()
        },
        setAll(cookiesNuevas) {
          try {
            cookiesNuevas.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, options),
            )
          } catch {
            // Los Server Components no pueden escribir cookies; el proxy
            // ya se encarga de refrescar la sesión.
          }
        },
      },
    },
  )
}
