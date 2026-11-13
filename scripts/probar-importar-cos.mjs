/**
 * Pruebas de la importación de COS · npm run probar:importar-cos
 *
 * `revisarLectura` y `aBorrador` (lib/importar-cos.ts) convierten lo que Claude
 * leyó del PDF de COS en un borrador del cotizador. La lectura de aquí es la
 * COT-2026-950 (Luis Inda, $709,508.75) copiada a mano, con las descripciones
 * recortadas: lo que se prueba son las cuentas, las unidades y los avisos.
 *
 * Node 23 corre TypeScript de corrido; lo único que le falta es el alias «@/»
 * de Next, que aquí se resuelve a mano contra la raíz del proyecto.
 */

import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'

const RAIZ = new URL('../', import.meta.url)

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('@/')) {
      return { url: new URL(`${especificador.slice(2)}.ts`, RAIZ).href, shortCircuit: true }
    }
    return siguiente(especificador, contexto)
  },
})

const { revisarLectura, aBorrador, unidadDeCos } = await import('../lib/importar-cos.ts')
const { borradorVacio, totalesCotizacion, validar } = await import('../lib/cotizaciones.ts')

const HC = 'HABILITACIÓN CLÍNICA'
const c = (seccion, clave, descripcion, unidad, cantidad, pu, importe, area = HC) => ({
  area, seccion, clave, descripcion, unidad, cantidad, precio_unitario: pu, importe_impreso: importe,
})

const conceptos = [
  c('DEMOLICIONES', 'DEM-01', 'DEMOLICIÓN DE MURO EXISTENTE PARA APERTURA DE VANO', 'LOTE', 1, 1800, 1800),
  c('DEMOLICIONES', 'DEM-02', 'DEMOLICIÓN PARCIAL DE MURO EXISTENTE', 'LOTE', 1, 1800, 1800),
  c('DEMOLICIONES', 'DEM-03', 'RETIRO DE PUERTA INTERIOR EXISTENTE', 'LOTE', 1, 1800, 1800),
  c('DEMOLICIONES', 'DEM-04', 'RETIRO DE PUERTAS DE CANCELERIAS INTERIORES', 'LOTE', 1, 6000, 6000),
  c('ALBAÑILERÍAS', 'ALB-01', '(PLANTA BAJA) MURO DIVISORIO DE TABLAROCA', 'M2', 10.12, 1026, 10383.12),
  c('ALBAÑILERÍAS', 'ALB-02', '(PLANTA BAJA) MURO LAMBRIN UNA CARA', 'M2', 16.36, 600, 9816),
  c('ALBAÑILERÍAS', 'ALB-03', '(PLANTA SÓTANO) MURO DIVISORIO DE TABLAROCA', 'M2', 105, 1026.59, 107791.95),
  c('ALBAÑILERÍAS', 'ALB-04', '(PLANTA SOTANO) MURO LAMBRIN UNA CARA', 'M2', 111.48, 600, 66888),
  c('ALBAÑILERÍAS', 'ALB-05', '(PLANTA SOTANO) (ESCALERA) PLAFÓN CORRIDO', 'M2', 5.1, 668, 3406.8),
  c('ALBAÑILERÍAS', 'ALB-06', '(PLANTA SOTANO) PLAFÓN CORRIDO', 'M2', 46.58, 668.53, 31140.13),
  c('ALBAÑILERÍAS', 'ALB-07', '(PLANTA SOTANO) PLAFÓN DETALLE CAJON', 'M2', 12.8, 450, 5760),
  c('ALBAÑILERÍAS', 'ALB-08', '(PLANTA SOTANO) PLAFÓN CON CAJILLO', 'M2', 17.9, 530, 9487),
  c('INSTALACION ELECTRICA', 'IE-01', '(PLANTA BAJA) SALIDA PARA SPOT', 'SAL', 27, 1000, 27000),
  c('INSTALACION ELECTRICA', 'IE-02', '(PLANTA BAJA) SALIDA PARA APAGADOR', 'SAL', 9, 1120, 10080),
  c('INSTALACION ELECTRICA', 'IE-03', '(PLANTA BAJA) SALIDA PARA TIRA LED', 'SAL', 1, 1100, 1100),
  c('INSTALACION ELECTRICA', 'IE-04', '(PLANTA BAJA) SALIDA PARA CONTACTO', 'SAL', 18, 1120, 20160),
  c('INSTALACION ELECTRICA', 'IE-05', '(PLANTA ZOTANO) SALIDA PARA SPOT', 'SAL', 59, 1000, 59000),
  c('INSTALACION ELECTRICA', 'IE-06', '(PLANTA ZOTANO) SALIDA PARA TIRA LED', 'SAL', 7, 1000, 7000),
  c('INSTALACION ELECTRICA', 'IE-07', '(PLANTA ZOTANO) SALIDA PARA APAGADOR', 'SAL', 23, 1120, 25760),
  c('INSTALACION ELECTRICA', 'IE-08', '(PLANTA ZOTANO) SALIDA PARA CONTACTO', 'SAL', 39, 1120, 43680),
  c('INSTALACION ELECTRICA', 'IE-09', '(AMBAS PLANTAS) INSTALACIÓN DE SPOT LED', 'PZA', 86, 120, 10320),
  c('INSTALACION ELECTRICA', 'IE-10', '(AMBAS PLANTAS) INSTALACIÓN DE TIRA LED', 'ML', 58.62, 110, 6448.2),
  c('INSTALACION ELECTRICA', 'IE-11', '(CONTROL PLANTA BAJA) CENTRO DE CARGA', 'LOTE', 1, 15000, 15000),
  c('INSTALACION HIDROSANITARIA', 'IH-01', 'RED HIDRÁULICA PARA TARJA (PLANTA BAJA)', 'SAL', 1, 600, 600),
  c('INSTALACION HIDROSANITARIA', 'IH-02', 'RED HIDRÁULICA PARA TARJA (ZOTANO)', 'SAL', 4, 600, 2400),
  c('INSTALACION HIDROSANITARIA', 'IH-03', 'SALIDA SANITARIA DE 2" (PLANTA BAJA)', 'SAL', 1, 600, 600),
  c('INSTALACION HIDROSANITARIA', 'IH-04', 'SALIDA SANITARIA DE 2" (ZOTANO)', 'SAL', 4, 600, 2400),
  c('PUERTAS Y VENTANAS', 'PYV-01', 'VENTANA V-01 (PLANTA BAJA)', 'PZA', 1, 0, 0),
  c('PUERTAS Y VENTANAS', 'PYV-02', 'VENTANA V-02 (PLANTA BAJA)', 'PZA', 1, 0, 0),
  c('PUERTAS Y VENTANAS', 'PYV-03', 'PUERTAS CORREDIZAS P-02 (PLANTA BAJA)', 'PZA', 1, 0, 0),
  c('PUERTAS Y VENTANAS', 'PYV-04', 'PUERTA CORREDIZA CON FIJO P-10 (ZOTANO)', 'PZA', 3, 0, 0),
  c('PUERTAS Y VENTANAS', 'PYV-05', 'PUERTA ABATIBLE P-11 (ZOTANO)', 'PZA', 3, 0, 0),
  c('PINTURA Y ACABADOS', 'PYA-01', 'PINTURA POLIPRISA PREMIUM 100% ACRÍLICA', 'M2', 332.91, 125, 41613.75),
  c('PINTURA Y ACABADOS', 'PYA-02', 'PINTURA PRISA (PUERTAS PLANTA BAJA)', 'PZA', 2, 1100, 2200),
  c('PINTURA Y ACABADOS', 'PYA-03', 'PINTURA PRISA (PUERTAS SANITARIOS)', 'PZA', 2, 1100, 2200),
  c('PINTURA Y ACABADOS', 'PYA-04', 'AZULEJO KIT KAT MOSAIC SNOW GLOSSY', 'M2', 38.93, 180, 7007.4),
  c('PINTURA Y ACABADOS', 'PYA-05', 'AZULEJO KIT KAT MOSAIC IVORY GLOSSY', 'M2', 2.11, 180, 379.8),
  c('PINTURA Y ACABADOS', 'PYA-06', 'PORCELANATO ETERNAL STONES SILK ST', 'M2', 5.49, 180, 988.2),
  c('PINTURA Y ACABADOS', 'PYA-07', 'PAPEL TAPIZ', 'M2', 97.64, 80, 7811.2),
  c('PINTURA Y ACABADOS', 'PYA-08', 'PISO VINILICO SPC BANFF', 'M2', 26.04, 180, 4687.2),
  c('AIRE ACONDICIONADO', 'AC-01', 'FAN N COIL 3 TONELADAS CON DUCTERIA', 'LOTE', 1, 155000, 155000, 'FAN N COIL'),
]

const lectura = {
  folio: 'COT-2026-950',
  cliente: 'LUIS INDA',
  fecha: '5 DE NOVIEMBRE DEL 2026',
  ubicacion: '—',
  tiempo_estimado: '—',
  obra: 'Habilitación de espacios para clínica/consultorios',
  lleva_iva: false,
  iva_pct: 16,
  anticipo_pct: 60,
  vigencia_dias: 20,
  subtotal_impreso: 709508.75,
  total_impreso: 709508.75,
  conceptos,
}

const base = borradorVacio('pintura', 'Términos de la casa')
let fallas = 0
const caso = (nombre, fn) => {
  try {
    fn()
    console.log(`  ✓ ${nombre}`)
  } catch (e) {
    fallas++
    console.log(`  ✗ ${nombre}\n    ${e.message.split('\n').join('\n    ')}`)
  }
}

console.log('COT-2026-950')

caso('la lectura buena sólo avisa de las partidas en $0', () => {
  const avisos = revisarLectura(lectura)
  assert.equal(avisos.length, 1, avisos.join('\n'))
  assert.match(avisos[0], /^5 partidas vienen en \$0\.00 \(PYV-01, PYV-02, PYV-03, PYV-04, PYV-05\)/)
})

caso('41 partidas que suman $709,508.75, sin IVA', () => {
  const { borrador } = aBorrador(lectura, base, [])
  assert.equal(borrador.items.length, 41)
  const t = totalesCotizacion(borrador)
  assert.equal(t.subtotal, 709508.75)
  assert.equal(t.total, 709508.75)
  assert.equal(borrador.requiere_factura, false)
  assert.equal(borrador.iva_pct, '0')
})

caso('anticipo, vigencia, tipo, obra y términos', () => {
  const { borrador } = aBorrador(lectura, base, [])
  assert.equal(borrador.anticipo_pct, '60')
  assert.equal(borrador.vigencia_dias, '20')
  assert.equal(borrador.tipo, 'otros')
  assert.equal(borrador.nombre_obra, 'Habilitación de espacios para clínica/consultorios')
  assert.equal(borrador.domicilio_obra, '')
  assert.equal(borrador.terminos, 'Términos de la casa')
  assert.equal(borrador.fecha, base.fecha)
})

caso('dos áreas: la sección lleva el área delante', () => {
  const { borrador } = aBorrador(lectura, base, [])
  assert.equal(
    borrador.items[0].descripcion,
    'DEM-01 · HABILITACIÓN CLÍNICA › DEMOLICIONES — DEMOLICIÓN DE MURO EXISTENTE PARA APERTURA DE VANO',
  )
  assert.match(borrador.items[40].descripcion, /^AC-01 · FAN N COIL › AIRE ACONDICIONADO — /)
})

caso('una sola área: sólo la sección', () => {
  const unaArea = { ...lectura, conceptos: conceptos.slice(0, 4) }
  const { borrador } = aBorrador(unaArea, base, [])
  assert.match(borrador.items[0].descripcion, /^DEM-01 · DEMOLICIONES — /)
})

caso('unidades: M2 → m², SAL → sal, LOTE → lote, ML → ml, PZA → pza', () => {
  const { borrador } = aBorrador(lectura, base, [])
  const por = (clave) => borrador.items.find((i) => i.descripcion.startsWith(clave))
  assert.equal(por('ALB-01').unidad, '')
  assert.equal(por('IE-01').unidad, 'sal')
  assert.equal(por('DEM-01').unidad, 'lote')
  assert.equal(por('IE-10').unidad, 'ml')
  assert.equal(por('IE-09').unidad, 'pza')
  assert.deepEqual(unidadDeCos('m²'), { unidad: '', conocida: true })
  assert.deepEqual(unidadDeCos('M3'), { unidad: 'm3', conocida: false })
})

caso('cantidad y precio pasan tal cual', () => {
  const { borrador } = aBorrador(lectura, base, [])
  const alb03 = borrador.items.find((i) => i.descripcion.startsWith('ALB-03'))
  assert.equal(alb03.m2, '105')
  assert.equal(alb03.precio_unitario, '1026.59')
})

caso('notas con el folio, la fecha y el cliente de COS', () => {
  const { borrador } = aBorrador(lectura, base, [])
  assert.equal(
    borrador.notas,
    'Importada de COS · COT-2026-950 del 5 de noviembre del 2026. Cliente en COS: LUIS INDA.',
  )
})

caso('cliente que ya existe: queda elegido, aunque cambien acentos y mayúsculas', () => {
  const clientes = [{ id: 'a', nombre: 'Luis Inda' }, { id: 'b', nombre: 'Otro' }]
  const { borrador, clienteSinAlta } = aBorrador(lectura, base, clientes)
  assert.equal(borrador.cliente_id, 'a')
  assert.equal(clienteSinAlta, null)
  assert.deepEqual(validar(borrador), [])
})

caso('cliente que no existe: se ofrece darlo de alta', () => {
  const { borrador, clienteSinAlta } = aBorrador(lectura, base, [{ id: 'b', nombre: 'Otro' }])
  assert.equal(borrador.cliente_id, '')
  assert.equal(clienteSinAlta, 'LUIS INDA')
})

caso('dos clientes con el mismo nombre: se elige a mano', () => {
  const clientes = [{ id: 'a', nombre: 'Luis Inda' }, { id: 'b', nombre: 'LUIS  INDA' }]
  const { borrador, clienteSinAlta } = aBorrador(lectura, base, clientes)
  assert.equal(borrador.cliente_id, '')
  assert.equal(clienteSinAlta, null)
})

caso('con IVA impreso: pide factura con 16%', () => {
  const { borrador } = aBorrador({ ...lectura, lleva_iva: true, total_impreso: 823030.15 }, base, [])
  assert.equal(borrador.requiere_factura, true)
  assert.equal(borrador.iva_pct, '16')
  assert.equal(totalesCotizacion(borrador).total, 823030.15)
})

caso('un precio mal leído se avisa en su renglón y en el subtotal', () => {
  const mala = structuredClone(lectura)
  mala.conceptos[2].precio_unitario = 1900
  const avisos = revisarLectura(mala)
  assert.ok(
    avisos.includes('DEM-03: 1 × $1,900.00 da $1,900.00, pero el PDF dice $1,800.00.'),
    avisos.join('\n'),
  )
  assert.ok(avisos.some((a) => a.startsWith('Las partidas suman $709,608.75')), avisos.join('\n'))
})

caso('un renglón que se saltó se nota en el subtotal', () => {
  const corta = { ...lectura, conceptos: conceptos.filter((x) => x.clave !== 'IE-11') }
  const avisos = revisarLectura(corta)
  assert.ok(avisos.some((a) => a.startsWith('Las partidas suman $694,508.75')), avisos.join('\n'))
})

caso('sin SUB-TOTAL leído y sin IVA, se compara contra el TOTAL OBRA', () => {
  const corta = { ...lectura, subtotal_impreso: null, conceptos: conceptos.slice(1) }
  assert.ok(revisarLectura(corta).some((a) => a.startsWith('Las partidas suman')))
})

caso('unidad desconocida y cantidad con tres decimales se avisan', () => {
  const rara = {
    ...lectura,
    subtotal_impreso: null,
    total_impreso: null,
    conceptos: [c('X', 'X-01', 'CONCRETO', 'M3', 1.237, 100, 123.7)],
  }
  const avisos = revisarLectura(rara)
  assert.ok(avisos.some((a) => a.includes('«M3» no está en el cotizador')), avisos.join('\n'))
  assert.ok(avisos.some((a) => a.includes('se guarda con dos decimales (1.24)')), avisos.join('\n'))
})

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : '\nTodo cuadra.')
process.exit(fallas ? 1 : 0)
