/**
 * Crea las cuentas de los trabajadores reales de la cuadrilla (pintores y
 * herreros que aparecen en las nóminas de 2026). Los correos son placeholder
 * (@haacopro.local): cámbialos por los reales desde Admin → Usuarios cuando
 * cada trabajador vaya a entrar a la app.
 *
 *   npm run usuarios:reales
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local. Es idempotente: si la
 * cuenta ya existe solo lo informa.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const llaveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !llaveServicio) {
  console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const CONTRASENA = process.env.CONTRASENA_TRABAJADORES ?? 'HaacoPro2026!'

// Nombres tal como aparecen en «4. NÓMINAS PINTORES 2026» — datos-reales.mjs
// los busca por nombre exacto.
export const TRABAJADORES = [
  { correo: 'jorge.ascacio@haacopro.local',      nombre: 'Jorge Alejandro Ascacio',   oficio: 'pintor' },
  { correo: 'jesus.ramos@haacopro.local',        nombre: 'Jesús Ramos',               oficio: 'herrero' },
  { correo: 'yasxen.leyva@haacopro.local',       nombre: 'Yasxen Leyva',              oficio: 'otro', es_externo: true },
  { correo: 'juancarlos.barajas@haacopro.local', nombre: 'Juan Carlos Barajas',       oficio: 'pintor' },
  { correo: 'abraham.salazar@haacopro.local',    nombre: 'Abraham Salazar',           oficio: 'herrero' },
  { correo: 'enrique.chaparro@haacopro.local',   nombre: 'Enrique Chaparro',          oficio: 'herrero' },
  { correo: 'alejandro.gonzalez@haacopro.local', nombre: 'Alejandro González López',  oficio: 'pintor' },
]

const supabase = createClient(url, llaveServicio, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log(`\nCreando trabajadores en ${url}\n`)

for (const t of TRABAJADORES) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: t.correo,
    password: CONTRASENA,
    email_confirm: true,
    user_metadata: {
      nombre: t.nombre,
      rol: 'cuadrilla',
      oficio: t.oficio,
      es_externo: t.es_externo ?? false,
    },
  })

  if (error) {
    const yaExiste = error.message.toLowerCase().includes('already')
    console.log(`${yaExiste ? '·' : '✗'} ${t.correo.padEnd(36)} ${error.message}`)
    continue
  }

  // El trigger nuevo_usuario ya creó el perfil; se refuerza por si acaso.
  await supabase.from('profiles').upsert({
    id: data.user.id,
    nombre: t.nombre,
    correo: t.correo,
    rol: 'cuadrilla',
    oficio: t.oficio,
    es_externo: t.es_externo ?? false,
    activo: true,
  })

  console.log(`✓ ${t.correo.padEnd(36)} ${t.oficio}${t.es_externo ? ' · externo' : ''}`)
}

console.log(`\nContraseña temporal para todos: ${CONTRASENA}`)
console.log('Cámbiala (y el correo) desde Admin → Usuarios antes de entregarles acceso.\n')
