/**
 * Carga supabase/seed.sql en el proyecto conectado.
 *
 *   npm run bd:seed
 *
 * Requiere SUPABASE_DB_URL en .env.local
 * (Supabase → Project Settings → Database → Connection string → URI).
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL

if (!cadena) {
  console.error(
    '✗ Falta SUPABASE_DB_URL en .env.local\n' +
      '  Supabase → Project Settings → Database → Connection string → URI\n\n' +
      '  Alternativa sin configurar nada: copia el contenido de supabase/seed.sql\n' +
      '  y pégalo en el SQL Editor de Supabase.',
  )
  process.exit(1)
}

const aqui = dirname(fileURLToPath(import.meta.url))
const sql = await readFile(join(aqui, '..', 'supabase', 'seed.sql'), 'utf8')

// Supabase exige TLS; el Postgres que levanta `supabase start` en la máquina no
// lo ofrece siquiera, así que pedirlo ahí tumba la conexión.
const esLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1)/.test(cadena)
const sslDeLaCadena = esLocal ? false : { rejectUnauthorized: false }
const cliente = new pg.Client({ connectionString: cadena, ssl: sslDeLaCadena })
await cliente.connect()

try {
  await cliente.query(sql)
  console.log('✓ Catálogo inicial cargado: proveedores, pinturas, insumos de taller y herramientas.')
} catch (error) {
  console.error('✗ Error al cargar el seed:', error.message)
  process.exitCode = 1
} finally {
  await cliente.end()
}
