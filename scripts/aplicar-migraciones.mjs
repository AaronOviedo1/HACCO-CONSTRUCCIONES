/**
 * Aplica supabase/migrations en orden contra el proyecto conectado.
 *
 *   npm run bd:push
 *
 * Hace lo mismo que `supabase db push` pero sin necesitar el login interactivo
 * del CLI: sólo la cadena SUPABASE_DB_URL. Cada archivo se aplica dentro de una
 * transacción y se anota en supabase_migrations.schema_migrations, así que el
 * CLI puede seguir usándose después sin repetir lo ya aplicado.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const cliente = new pg.Client({ connectionString: cadena, ssl: { rejectUnauthorized: false } })
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
