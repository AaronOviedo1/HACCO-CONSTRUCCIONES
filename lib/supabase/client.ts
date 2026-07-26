import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from '@/lib/supabase/entorno'
import type { Database } from '@/types/database'

/** Cliente de Supabase para componentes que corren en el navegador. */
export function crearClienteNavegador() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA)
}
