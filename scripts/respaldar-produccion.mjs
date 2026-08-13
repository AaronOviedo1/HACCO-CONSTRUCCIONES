/**
 * Respalda los DATOS de producción a la carpeta respaldos/ (sólo lectura).
 *
 *   npm run bd:respaldar
 *   (equivale a: node --env-file=.env.local.produccion.bak scripts/respaldar-produccion.mjs)
 *
 * Deja tres archivos que scripts/clonar-a-local.mjs consume después:
 *   respaldos/datos-public.sql  — pg_dump --data-only del esquema public
 *   respaldos/usuarios.json     — id/correo/metadata de auth.users (sin hashes)
 *   respaldos/conteos.json      — filas por tabla, para verificar el clonado
 *
 * Este script JAMÁS escribe en la base: la sesión se abre con
 * default_transaction_read_only=on y pg_dump sólo lee.
 *
 * Usa el pg_dump de Homebrew (postgresql@17). Si producción algún día migra a
 * Postgres 18, pg_dump fallará con un error de versión: instalar el paquete
 * más nuevo y ajustar RUTA_PG_BIN.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL (¿corriste sin --env-file=.env.local.produccion.bak?).')
  process.exit(1)
}

// Guardia invertida: este script es para PRODUCCIÓN. Si la cadena apunta a la
// local es que se corrió con el env equivocado, y el respaldo no serviría.
if (/(^|@|\/\/)(localhost|127\.0\.0\.1|\[::1\])/.test(cadena)) {
  console.error(
    '✗ SUPABASE_DB_URL apunta a la Supabase local; este script respalda producción.\n' +
      '  Córrelo con: npm run bd:respaldar',
  )
  process.exit(1)
}

const aqui = dirname(fileURLToPath(import.meta.url))
const carpeta = join(aqui, '..', 'respaldos')
await mkdir(carpeta, { recursive: true })

const rutaPgBin = process.env.RUTA_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'

// pg_dump vía sh -c con la cadena SIN expandir en los argumentos: así la
// contraseña no queda visible en `ps` mientras corre el volcado.
console.log('Volcando datos de public…')
const codigo = await new Promise((resolver) => {
  const hijo = spawn(
    '/bin/sh',
    [
      '-c',
      'exec "$PGBIN/pg_dump" --data-only --schema=public --no-owner --no-privileges ' +
        '--file="$DESTINO" "$SUPABASE_DB_URL"',
    ],
    {
      env: { ...process.env, PGBIN: rutaPgBin, DESTINO: join(carpeta, 'datos-public.sql') },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  )
  hijo.on('close', resolver)
})
if (codigo !== 0) {
  console.error('✗ pg_dump falló; no se tocó nada más.')
  process.exit(1)
}

// Sesión aparte, con candado duro de sólo lectura, para usuarios y conteos.
const cliente = new pg.Client({
  connectionString: cadena,
  ssl: { rejectUnauthorized: false },
  options: '-c default_transaction_read_only=on',
})
await cliente.connect()

try {
  const { rows: usuarios } = await cliente.query(
    'select id, email, raw_user_meta_data from auth.users order by created_at',
  )
  await writeFile(join(carpeta, 'usuarios.json'), JSON.stringify(usuarios, null, 2) + '\n')

  const { rows: tablas } = await cliente.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )
  const conteos = {}
  for (const { tablename } of tablas) {
    const { rows } = await cliente.query(`select count(*)::int as n from public."${tablename}"`)
    conteos[tablename] = rows[0].n
  }
  await writeFile(
    join(carpeta, 'conteos.json'),
    JSON.stringify({ fecha: new Date().toISOString(), conteos }, null, 2) + '\n',
  )

  const totalFilas = Object.values(conteos).reduce((a, b) => a + b, 0)
  console.log(
    `✓ Respaldo listo en respaldos/: ${usuarios.length} usuarios, ` +
      `${Object.keys(conteos).length} tablas, ${totalFilas} filas.\n` +
      '  Para pasarlo a la local: npm run bd:clonar',
  )
} finally {
  await cliente.end()
}
