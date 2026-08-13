/**
 * Reemplaza los datos de la Supabase LOCAL con el respaldo de respaldos/.
 *
 *   npm run bd:clonar          — pide confirmación
 *   npm run bd:clonar -- --si  — sin preguntar (lo usa bd:clonar:todo)
 *
 * Necesita un respaldo previo (npm run bd:respaldar). Trunca todo public y
 * auth.users, restaura el dump en una sola transacción y recrea los usuarios
 * con sus MISMOS uuid de producción pero contraseña conocida para entrar en
 * local. Las credenciales de producción nunca entran a este proceso: el script
 * npm lo corre con --env-file=.env.local y las guardias de abajo abortan si la
 * cadena no es la local.
 */
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const CONTRASENA_LOCAL = 'hacco123'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL en .env.local.')
  process.exit(1)
}

// Guardias duras: este script BORRA datos, así que sólo acepta la instancia
// local de `supabase start` (allowlist de loopback + puerto 54322).
const url = new URL(cadena)
const esLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
if (!esLoopback || url.port !== '54322') {
  console.error(
    '✗ SUPABASE_DB_URL no apunta a la Supabase local (127.0.0.1:54322).\n' +
      '  Este script sólo escribe en la local; revisa .env.local.',
  )
  process.exit(1)
}
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').startsWith('http://127.0.0.1')) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL no es la API local (http://127.0.0.1:54321).')
  process.exit(1)
}

const aqui = dirname(fileURLToPath(import.meta.url))
const carpeta = join(aqui, '..', 'respaldos')
const rutaDump = join(carpeta, 'datos-public.sql')

let usuarios, respaldo
try {
  await stat(rutaDump)
  usuarios = JSON.parse(await readFile(join(carpeta, 'usuarios.json'), 'utf8'))
  respaldo = JSON.parse(await readFile(join(carpeta, 'conteos.json'), 'utf8'))
} catch {
  console.error('✗ No hay respaldo completo en respaldos/. Corre primero: npm run bd:respaldar')
  process.exit(1)
}

const fecha = new Date(respaldo.fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })

if (!process.argv.includes('--si')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = await rl.question(
    `Esto BORRA todos los datos de la Supabase local (${process.env.NEXT_PUBLIC_SUPABASE_URL})\n` +
      `y los reemplaza con el respaldo del ${fecha}. ¿Continuar? (escribe si): `,
  )
  rl.close()
  if (respuesta.trim().toLowerCase() !== 'si') {
    console.log('Cancelado; no se tocó nada.')
    process.exit(0)
  }
}

const cliente = new pg.Client({ connectionString: cadena, ssl: false })
await cliente.connect()

try {
  // Las tablas se enumeran en runtime para no dejar la lista en duro.
  const { rows: tablas } = await cliente.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )
  const listaPublic = tablas.map((t) => `public."${t.tablename}"`).join(', ')

  // Truncado + restore atómicos en una sola sesión psql: si el dump truena a
  // mitad, --single-transaction revierte todo y la local queda como estaba.
  // session_replication_role = replica salta triggers y validación de FK
  // durante el COPY; el CASCADE arrastra auth.identities/sessions/refresh_tokens.
  console.log(`Restaurando el respaldo del ${fecha}…`)
  const rutaPgBin = process.env.RUTA_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
  const codigo = await new Promise((resolver) => {
    const hijo = spawn(
      join(rutaPgBin, 'psql'),
      [
        cadena,
        '-q',
        '-v', 'ON_ERROR_STOP=1',
        '--single-transaction',
        '-c', 'set session_replication_role = replica',
        '-c', `truncate table auth.users, ${listaPublic} cascade`,
        '-c', 'truncate table auth.audit_log_entries, auth.flow_state cascade',
        '-f', rutaDump,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    )
    hijo.on('close', resolver)
  })
  if (codigo !== 0) {
    console.error('✗ La restauración falló y se revirtió; la local quedó como estaba.')
    process.exit(1)
  }

  // Usuarios de auth con sus uuid de producción y contraseña local conocida.
  // Van después del restore con los triggers activos: tg_nuevo_usuario hace
  // on conflict do nothing, así que no pisa los profiles restaurados.
  await cliente.query('begin')
  try {
    for (const u of usuarios) {
      await cliente.query(
        `insert into auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, confirmation_token, recovery_token,
           email_change_token_new, email_change, email_change_token_current,
           email_change_confirm_status, phone_change, phone_change_token,
           reauthentication_token, raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at, is_sso_user, is_anonymous
         ) values (
           '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
           $2, extensions.crypt($3, extensions.gen_salt('bf')),
           now(), '', '', '', '', '', 0, '', '', '',
           '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb,
           now(), now(), false, false
         )`,
        [u.id, u.email, CONTRASENA_LOCAL, JSON.stringify(u.raw_user_meta_data ?? {})],
      )
      await cliente.query(
        `insert into auth.identities (
           provider_id, user_id, identity_data, provider,
           last_sign_in_at, created_at, updated_at
         ) values (
           $1::text, $1::uuid,
           jsonb_build_object('sub', $1::text, 'email', $2::text,
                              'email_verified', true, 'phone_verified', false),
           'email', now(), now(), now()
         )`,
        [u.id, u.email],
      )
    }
    await cliente.query('commit')
  } catch (error) {
    await cliente.query('rollback')
    console.error(`✗ Falló la creación de usuarios locales: ${error.message}`)
    process.exit(1)
  }

  // Verificación: conteos contra el respaldo, profiles huérfanos y login real.
  let fallas = 0

  for (const [tabla, esperado] of Object.entries(respaldo.conteos)) {
    const { rows } = await cliente.query(`select count(*)::int as n from public."${tabla}"`)
    if (rows[0].n !== esperado) {
      console.error(`✗ ${tabla}: producción tenía ${esperado} filas y la local tiene ${rows[0].n}.`)
      fallas++
    }
  }

  const { rows: huerfanos } = await cliente.query(
    `select count(*)::int as n from public.profiles p
       left join auth.users u on u.id = p.id where u.id is null`,
  )
  if (huerfanos[0].n !== 0) {
    console.error(`✗ Hay ${huerfanos[0].n} profiles sin usuario de auth.`)
    fallas++
  }

  const llave =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  for (const u of usuarios) {
    const respuesta = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: { apikey: llave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: CONTRASENA_LOCAL }),
      },
    )
    const cuerpo = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok || !cuerpo.access_token) {
      console.error(`✗ El login local de ${u.email} falló (${respuesta.status}).`)
      fallas++
    }
  }

  if (fallas > 0) {
    console.error(`\n✗ El clonado terminó con ${fallas} ${fallas === 1 ? 'falla' : 'fallas'}.`)
    process.exit(1)
  }

  const totalFilas = Object.values(respaldo.conteos).reduce((a, b) => a + b, 0)
  console.log(
    `✓ Clonado listo: ${Object.keys(respaldo.conteos).length} tablas, ${totalFilas} filas y ` +
      `${usuarios.length} usuarios verificados (login incluido).\n` +
      `  Entra con cualquier correo de producción y contraseña ${CONTRASENA_LOCAL}.`,
  )
} finally {
  await cliente.end()
}
