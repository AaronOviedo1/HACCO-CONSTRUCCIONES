/**
 * Aplica supabase/migrations en orden contra el proyecto conectado.
 *
 *   npm run bd:push                                          — la local
 *   node --env-file=.env.local.produccion.bak \
 *        scripts/aplicar-migraciones.mjs                     — producción
 *   ... -- --si                                              — sin preguntar
 *
 * Hace lo mismo que `supabase db push` pero sin necesitar el login interactivo
 * del CLI: sólo la cadena SUPABASE_DB_URL. Cada archivo se aplica dentro de una
 * transacción y se anota en supabase_migrations.schema_migrations, así que el
 * CLI puede seguir usándose después sin repetir lo ya aplicado.
 *
 * ---------------------------------------------------------------------------
 * A CUÁL BASE. Lo primero que se imprime, y con todas sus letras.
 *
 * `.env.local` apunta a la Supabase de la máquina y no hay nada malo en ello:
 * es la de desarrollo. Pero entonces `npm run bd:push` aplica ahí, y es fácil
 * leer «✓ 2 migraciones aplicadas» y darlas por puestas en la nube. Una tarde
 * se fue en eso: la terminal decía que sí y el proyecto de producción decía que
 * la función no existía, y las dos tenían razón, cada una de su base.
 *
 * Así que el destino se dice antes de tocar nada, y si es remota se pregunta.
 * La local no pregunta: ahí se corre veinte veces al día y el costo de
 * equivocarse es `supabase db reset`.
 * ---------------------------------------------------------------------------
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error(
    '✗ Falta SUPABASE_DB_URL en .env.local\n' +
      '  Supabase → Connect → Connection string → URI (Session pooler)\n' +
      '  Si la contraseña trae @ ? # o /, hay que escribirla codificada (@ → %40).',
  )
  process.exit(1)
}

const aqui = dirname(fileURLToPath(import.meta.url))
const carpeta = join(aqui, '..', 'supabase', 'migrations')

const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort()
if (archivos.length === 0) {
  console.log('No hay migraciones que aplicar.')
  process.exit(0)
}

// Supabase exige TLS; el Postgres que levanta `supabase start` en la máquina no
// lo ofrece siquiera, así que pedirlo ahí tumba la conexión.
const esLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1)/.test(cadena)
const sslDeLaCadena = esLocal ? false : { rejectUnauthorized: false }

/* El destino, sin la contraseña: esto se pega en un chat sin pensarlo. */
const destino = (() => {
  try {
    const u = new URL(cadena)
    return `${u.hostname}:${u.port || 5432}${u.pathname}`
  } catch {
    return cadena.replace(/:[^:@]*@/, ':****@')
  }
})()

console.log(
  `\nBase de datos:  ${destino}\n` +
    `                ${esLocal ? '↑ LOCAL · la Supabase de esta máquina' : '↑ REMOTA · esto toca datos de verdad'}\n`,
)

if (!esLocal && !process.argv.includes('--si')) {
  if (!process.stdin.isTTY) {
    console.error('✗ Base remota sin nadie que confirme. Si es a propósito, agrega --si.')
    process.exit(1)
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = await rl.question('¿Aplicar las migraciones ahí? (escribe si): ')
  rl.close()
  if (respuesta.trim().toLowerCase() !== 'si') {
    console.log('Cancelado; no se tocó nada.')
    process.exit(0)
  }
}

const cliente = new pg.Client({ connectionString: cadena, ssl: sslDeLaCadena })
await cliente.connect()

try {
  await cliente.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `)

  const { rows } = await cliente.query('select version from supabase_migrations.schema_migrations')
  const aplicadas = new Set(rows.map((r) => r.version))

  let nuevas = 0

  for (const archivo of archivos) {
    // El nombre es 20260726000001_schema.sql → versión 20260726000001
    const version = archivo.split('_')[0]
    const nombre = archivo.replace(/^\d+_/, '').replace(/\.sql$/, '')

    if (aplicadas.has(version)) {
      console.log(`·  ${archivo} (ya estaba aplicada)`)
      continue
    }

    const sql = await readFile(join(carpeta, archivo), 'utf8')

    await cliente.query('begin')
    try {
      await cliente.query(sql)
      await cliente.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [version, nombre],
      )
      await cliente.query('commit')
      console.log(`✓  ${archivo}`)
      nuevas++
    } catch (error) {
      await cliente.query('rollback')
      console.error(`\n✗  ${archivo} falló y se revirtió por completo:\n   ${error.message}`)
      process.exitCode = 1
      break
    }
  }

  if (process.exitCode !== 1) {
    console.log(
      nuevas === 0
        ? '\nLa base ya estaba al corriente.'
        : `\n✓ ${nuevas} ${nuevas === 1 ? 'migración aplicada' : 'migraciones aplicadas'}.`,
    )
  }
} finally {
  await cliente.end()
}
