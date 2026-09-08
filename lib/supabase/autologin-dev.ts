/**
 * Auto-login de desarrollo: entrar a localhost sin pasar por el login.
 *
 * NO es un bypass de la autenticación. La app se apoya en las políticas RLS de
 * Postgres, así que fingir un perfil dejaría todas las pantallas vacías: sin
 * token, la base no devuelve una sola fila. Lo que hace esto es iniciar sesión
 * de verdad —con un usuario real de la base local y su contraseña— y dejar las
 * cookies puestas, de modo que el resto de la app funciona exactamente igual
 * que si hubieras tecleado el correo a mano.
 *
 * Se activa sólo si se cumplen LAS TRES condiciones:
 *   1. `next dev` (en un build de producción la constante queda en null),
 *   2. Supabase apunta a la instancia local de loopback, nunca a producción,
 *   3. existe DEV_AUTOLOGIN en .env.local con el correo a usar.
 *
 * Cambiar ese correo es la forma rápida de ver la app como cuadrilla o como
 * contador. Para volver al login normal, comenta la variable.
 */
import { SUPABASE_URL } from '@/lib/supabase/entorno'

const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(SUPABASE_URL)

export const AUTOLOGIN_DEV =
  process.env.NODE_ENV !== 'production' && esLocal && process.env.DEV_AUTOLOGIN
    ? {
        correo: process.env.DEV_AUTOLOGIN,
        // La contraseña que bd:clonar le pone a todos los usuarios locales.
        contrasena: process.env.DEV_AUTOLOGIN_PASSWORD ?? 'hacco123',
      }
    : null
