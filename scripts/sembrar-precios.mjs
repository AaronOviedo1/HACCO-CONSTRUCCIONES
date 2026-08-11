/**
 * Rescata los precios que ya están en la casa y nadie ha vuelto a mirar.
 *
 *   npm run precios:sembrar            enseña qué haría, sin tocar nada
 *   npm run precios:sembrar -- --ejecutar
 *
 * Cada factura de material capturada trae el precio de lo que se compró, con su
 * proveedor y su fecha. Hasta ahora eso se guardaba como gasto y ahí moría.
 * Este script recorre lo ya capturado y lo convierte en historial de precios,
 * en tres pasos:
 *
 *   1. Aprende alias de lo que ya viene ligado (obra_materiales y gastos con
 *      producto), para reconocer cómo escribe cada proveedor cada material.
 *   2. Reproduce los gastos de material del último año por
 *      `observar_precios_de_gasto`, que es la misma puerta que usa la app: nada
 *      se liga por parecido, sólo por alias o nombre exacto.
 *   3. Reporta qué quedó sin reconocer, ordenado por frecuencia — ésa es la
 *      lista de la pantalla de precios, y encoge cada vez que se resuelve una.
 *
 * Correrlo ANTES de enseñar la pantalla no es opcional: si el primer día ella
 * abre el cotizador y ve rojo en todo, va a concluir que no sirve. Con esto
 * encuentra ya con precio la mitad de lo que compra.
 *
 * Es idempotente: una observación por gasto, así que correrlo dos veces no
 * duplica nada.
 */
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL en .env.local (Supabase → Database → Connection string).')
  process.exit(1)
}

const ejecutar = process.argv.includes('--ejecutar')
const MESES = 12

// Supabase exige TLS; el Postgres que levanta `supabase start` en la máquina no
// lo ofrece siquiera, así que pedirlo ahí tumba la conexión.
const esLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1)/.test(cadena)
const c = new pg.Client({
  connectionString: cadena,
  ssl: esLocal ? false : { rejectUnauthorized: false },
})
await c.connect()

const todos = async (sql, args = []) => (await c.query(sql, args)).rows
const uno = async (sql, args = []) => (await todos(sql, args))[0]

try {
  await c.query('begin')

  console.log(`\n${ejecutar ? '▶' : '◇'} Sembrando el historial de precios${ejecutar ? '' : ' (ensayo)'}\n`)

  // -------------------------------------------------------------------------
  // 1 · Alias de lo que ya está ligado
  // -------------------------------------------------------------------------
  const { count: alias } = await uno(`
    with ligados as (
      select producto_id, public.normalizar_material(material) as texto_norm
        from public.obra_materiales
       where producto_id is not null and material is not null
      union all
      select producto_id, public.normalizar_material(descripcion)
        from public.gastos
       where producto_id is not null and descripcion is not null
    ),
    nuevos as (
      insert into public.producto_alias (producto_id, texto_norm, veces, origen)
      select distinct on (texto_norm) producto_id, texto_norm, 1, 'historial'
        from ligados
       where texto_norm is not null
      on conflict (texto_norm) do nothing
      returning 1
    )
    select count(*)::int as count from nuevos
  `)
  console.log(`  Alias aprendidos del historial: ${alias}`)

  // -------------------------------------------------------------------------
  // 2 · Los gastos de material vuelven a pasar por la misma puerta que la app
  // -------------------------------------------------------------------------
  const gastos = await todos(
    `select id from public.gastos
      where categoria = 'material'
        and proveedor_id is not null
        and fecha >= public.hoy_hermosillo() - interval '${MESES} months'
      order by fecha`,
  )
  console.log(`  Gastos de material con proveedor (${MESES} meses): ${gastos.length}`)

  for (const g of gastos) {
    await c.query('select public.observar_precios_de_gasto($1)', [g.id])
  }

  // -------------------------------------------------------------------------
  // 2b · El material de las obras ya capturadas
  //
  // La operación que se migró del Excel no pasó por la pantalla de gastos: el
  // material real quedó en `obra_materiales`, con su costo y su folio pero sin
  // gasto detrás. Ahí está casi todo el historial de precios de la casa, así
  // que se rescata igual. Se toma el renglón más reciente de cada material: los
  // anteriores ya no dicen nada que el último no diga.
  // -------------------------------------------------------------------------
  await c.query(
    `delete from public.precios_material where nota = 'Del historial de material de obra'`,
  )

  const materiales = await todos(`
    select distinct on (public.normalizar_material(material))
           material, costo, folio_factura, created_at::date as fecha
      from public.obra_materiales
     where origen = 'real' and costo > 0 and material is not null
       and created_at::date >= public.hoy_hermosillo() - interval '${MESES} months'
     order by public.normalizar_material(material), created_at desc
  `)
  console.log(`  Materiales distintos en obras capturadas: ${materiales.length}`)

  for (const m of materiales) {
    await c.query('select public.observar_precio_historico($1, $2, null, $3, $4)', [
      m.material,
      m.costo,
      m.folio_factura,
      m.fecha,
    ])
  }

  // -------------------------------------------------------------------------
  // 3 · Cómo quedó
  // -------------------------------------------------------------------------
  const resumen = await uno(`
    select
      (select count(*)::int from public.precios_material)                    as observaciones,
      (select count(distinct producto_id)::int from public.precios_material) as materiales,
      (select count(*)::int from public.renglones_sin_ligar where not resuelto) as sin_ligar
  `)

  console.log(`\n  Observaciones de precio: ${resumen.observaciones}`)
  console.log(`  Materiales con precio conocido: ${resumen.materiales}`)
  console.log(`  Renglones sin reconocer: ${resumen.sin_ligar}`)

  const pendientes = await todos(`
    select texto_norm, count(*)::int as veces, max(texto) as ejemplo
      from public.renglones_sin_ligar
     where not resuelto
     group by texto_norm
     order by veces desc, texto_norm
     limit 15
  `)

  if (pendientes.length > 0) {
    console.log('\n  Lo que más se repite sin reconocer (se resuelve en /admin/precios):')
    for (const p of pendientes) {
      console.log(`    ${String(p.veces).padStart(3)}×  ${p.ejemplo}`)
    }
  }

  const conPrecio = await todos(`
    select producto, precio_neto, proveedor, dias, semaforo
      from public.v_precios_vigentes
     order by dias
     limit 10
  `)

  if (conPrecio.length > 0) {
    console.log('\n  Los precios más frescos que quedaron:')
    for (const p of conPrecio) {
      console.log(
        `    ${p.producto.padEnd(34).slice(0, 34)} $${String(p.precio_neto).padStart(10)}  ` +
          `${p.dias === 0 ? 'hoy' : `hace ${p.dias} d`}  ${p.proveedor ?? ''}`,
      )
    }
  }

  if (ejecutar) {
    await c.query('commit')
    console.log('\nListo. Revisa /admin/precios y abre una cotización de herrería.\n')
  } else {
    await c.query('rollback')
    console.log('\nEnsayo: no se guardó nada. Repite con --ejecutar para aplicarlo.\n')
  }
} catch (error) {
  await c.query('rollback').catch(() => {})
  console.error('✗ No se pudo sembrar el historial de precios:', error.message)
  process.exitCode = 1
} finally {
  await c.end()
}
