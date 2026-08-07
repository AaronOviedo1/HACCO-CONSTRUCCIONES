/**
 * Lista los contratos que quedaron con todo el importe en «otros».
 *
 *   npm run bd:revisar-contratos
 *
 * Al importar el Excel 2026 no se pudo separar metros de tarifa —las hojas no
 * la traen igual—, así que el trato completo se asentó en «otros importe» y los
 * m² quedaron en cero. La cuenta cuadra, pero el avance por metros no, y en la
 * pantalla del contrato se ve un renglón vacío arriba y el dinero abajo.
 *
 * Este script sólo LEE: imprime qué contratos conviene corregir con el lápiz
 * —m² y tarifa reales, moviendo el importe de «otros»— y no toca ningún dato.
 */
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL en .env.local')
  process.exit(1)
}

const cliente = new pg.Client({ connectionString: cadena, ssl: { rejectUnauthorized: false } })
await cliente.connect()

const { rows } = await cliente.query(`
  select
    o.ot_numero,
    o.nombre                                  as obra,
    o.estatus                                 as estatus_obra,
    p.nombre                                  as trabajador,
    c.estatus                                 as estatus_contrato,
    c.otros_importe,
    c.total_pagar,
    coalesce(sum(np.monto), 0)                as pagado
  from public.contratos_oficial c
  join public.obras o    on o.id = c.obra_id
  join public.profiles p on p.id = c.trabajador_id
  left join public.nomina_pagos np on np.contrato_id = c.id
  where c.m2 = 0 and c.otros_importe > 0
  group by o.ot_numero, o.nombre, o.estatus, p.nombre, c.id, c.estatus,
           c.otros_importe, c.total_pagar
  order by o.ot_numero nulls last, p.nombre
`)

await cliente.end()

if (rows.length === 0) {
  console.log('\n✓ Ningún contrato quedó con el importe en «otros».\n')
  process.exit(0)
}

const pesos = (n) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

console.log(`\n${rows.length} contratos con el importe en «otros» y cero m²:\n`)
console.log('  OT     Obra                            Oficial                    Importe     Pagado')
console.log('  ' + '─'.repeat(92))

for (const r of rows) {
  console.log(
    '  ' +
      String(r.ot_numero ?? '—').padEnd(7) +
      String(r.obra).slice(0, 30).padEnd(32) +
      String(r.trabajador).slice(0, 24).padEnd(27) +
      pesos(r.otros_importe).padStart(11) +
      pesos(r.pagado).padStart(11) +
      (r.estatus_contrato === 'cerrado' ? '  (cerrado)' : ''),
  )
}

const conPagos = rows.filter((r) => Number(r.pagado) > 0).length

console.log(`
  Para corregir uno: Obras → la OT → Contratos → lápiz. Captura los m² y la
  tarifa reales y baja «otros importe» a lo que de verdad no se cobra por metro.
  El total a pagar no debe cambiar.

  ${conPagos} de ellos ya tienen nómina pagada: ahí el total nuevo no puede
  quedar por debajo de lo ya entregado, el sistema lo va a rechazar.
`)
