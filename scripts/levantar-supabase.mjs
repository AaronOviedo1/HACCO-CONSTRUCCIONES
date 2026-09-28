/**
 * Deja la Supabase local encendida antes de `next dev`. Lo corre npm solo,
 * como `predev`; no hace falta invocarlo a mano.
 *
 * La razón es el auto-login de desarrollo (ver lib/supabase/autologin-dev.ts).
 * Entrar sin teclear credenciales no es magia: el proxy inicia sesión de verdad
 * contra la base local. Si esa base no está arriba, el signIn falla, la app te
 * manda al login —que tampoco va a funcionar— y desde el navegador parece que
 * el auto-login «se descompuso». En realidad nada más faltaba `supabase start`,
 * pero eso sólo se ve en un console.warn de la terminal del servidor, entre
 * cien líneas de compilación. Una mañana se fue en eso.
 *
 * Así que la comprobación se hace aquí, antes de arrancar, y en voz alta.
 *
 * Nunca toca nada si la app no apunta a la instancia local: con .env.local
 * mirando a un proyecto remoto, este script se hace a un lado en silencio.
 */
import { spawn } from 'node:child_process'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/** La instancia de `supabase start` vive en loopback. Cualquier otra cosa es remota. */
const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(URL_SUPABASE)

if (!esLocal) process.exit(0)

/**
 * ¿Responde el servicio de auth? Es el que hace falta para iniciar sesión, así
 * que es el que se pregunta: el resto del stack puede estar a medio levantar y
 * lo que nos importa seguiría sin funcionar.
 */
async function estaArriba() {
  try {
    const r = await fetch(new URL('/auth/v1/health', URL_SUPABASE), {
      signal: AbortSignal.timeout(2000),
    })
    return r.ok
  } catch {
    return false
  }
}

if (await estaArriba()) {
  console.log('✓ Supabase local arriba · entras sin teclear credenciales\n')
  process.exit(0)
}

console.log('\nLa Supabase local no responde. Levantándola (la primera vez tarda)…\n')

const codigo = await new Promise((resolve) => {
  const hijo = spawn('npx', ['supabase', 'start'], { stdio: 'inherit' })
  hijo.on('error', () => resolve(1))
  hijo.on('close', (c) => resolve(c ?? 1))
})

// Que no arranque no es motivo para impedir `next dev`: se puede querer abrir
// la app aunque la base no esté —a ver una pantalla, a compilar—. Pero se dice
// con todas sus letras qué va a pasar, porque el síntoma es confuso.
if (codigo !== 0 || !(await estaArriba())) {
  console.warn(
    '\n⚠ No se pudo levantar la Supabase local (¿Docker apagado?).\n' +
      '  La app va a pedirte credenciales y el login tampoco va a poder validarlas.\n' +
      '  Enciende Docker y corre `npx supabase start`.\n',
  )
  process.exit(0)
}

console.log('\n✓ Supabase local arriba · entras sin teclear credenciales\n')
