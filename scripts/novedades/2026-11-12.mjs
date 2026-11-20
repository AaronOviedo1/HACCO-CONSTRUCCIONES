/** Guion de capturas de la entrega del 12 de noviembre. Ver scripts/capturar-novedades.mjs. */

/** La más reciente que cumpla la condición, con OT y aprobada. */
const cotizacion = (conMovimiento) => async ({ sql }) => {
  const [c] = await sql(
    `select c.id
       from cotizaciones c
      where c.estatus = 'aprobada'
        and exists (select 1 from obras o where o.cotizacion_id = c.id)
        and cotizacion_con_movimiento(c.id) = $1
      order by c.fecha desc, c.created_at desc
      limit 1`,
    [conMovimiento],
  )
  if (!c) throw new Error('no hay cotización de ejemplo en la base local')
  return `/admin/cotizaciones/${c.id}`
}

const escenas = [
  {
    tema: 'congelada',
    ruta: cotizacion(true),
    selector: 'button:has-text("Duplicar para otra obra")',
    // Es lo último de la página: con la proporción de siempre, sobra blanco.
    proporcion: { movil: 4 / 3 },
  },
  {
    // No hay ninguna a medio corregir en la base: se enseña dónde empieza.
    tema: 'reaprobar',
    ruta: cotizacion(false),
    selector: 'button:has-text("Regresar a borrador")',
    proporcion: { movil: 4 / 3 },
  },
]

export default escenas
