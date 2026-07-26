/**
 * Crea una cuenta por rol para probar HaacoPro.
 * No hay registro público: las cuentas siempre las crea Dirección.
 *
 *   npm run usuarios:demo
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const llaveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !llaveServicio) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const CONTRASENA = process.env.CONTRASENA_DEMO ?? 'HaacoPro2026!'

const USUARIOS = [
  { correo: 'luis@haacopro.mx',     nombre: 'Luis Enrique Inda Franco', rol: 'admin' },
  { correo: 'pati@haacopro.mx',     nombre: 'Pati',                     rol: 'administracion' },
  { correo: 'jorge@haacopro.mx',    nombre: 'Jorge',                    rol: 'cuadrilla', oficio: 'pintor' },
  { correo: 'alejandro@haacopro.mx',nombre: 'Alejandro',                rol: 'cuadrilla', oficio: 'herrero' },
  { correo: 'contador@haacopro.mx', nombre: 'Contador externo',         rol: 'contador',  es_externo: true },
]

const supabase = createClient(url, llaveServicio, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(`\nCreando usuarios en ${url}\n`)

for (const usuario of USUARIOS) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: usuario.correo,
    password: CONTRASENA,
    email_confirm: true,
    user_metadata: {
      nombre: usuario.nombre,
      rol: usuario.rol,
      oficio: usuario.oficio ?? null,
      es_externo: usuario.es_externo ?? false,
    },
  })

  if (error) {
    const yaExiste = error.message.toLowerCase().includes('already')
    console.log(`${yaExiste ? '·' : '✗'} ${usuario.correo.padEnd(24)} ${error.message}`)
    continue
  }

  // El trigger nuevo_usuario ya creó el perfil; se refuerza por si acaso.
  await supabase.from('profiles').upsert({
    id: data.user.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    oficio: usuario.oficio ?? null,
    es_externo: usuario.es_externo ?? false,
    activo: true,
  })

  console.log(`✓ ${usuario.correo.padEnd(24)} ${usuario.rol}`)
}

console.log(`\nContraseña para todas: ${CONTRASENA}`)
console.log('Cámbiala antes de usar la app con datos reales.\n')
