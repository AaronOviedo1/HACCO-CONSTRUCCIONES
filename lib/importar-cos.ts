import { REGLAS } from '@/lib/empresa'
import { redondear, type BorradorCotizacion, type PartidaBorrador } from '@/lib/cotizaciones'

/**
 * Cotizaciones de COS Arquitectura & Construcción, de su PDF al cotizador.
 *
 * COS manda sus cotizaciones en PDF y HAACO las trabaja como propias. La
 * lectura del papel la hace Claude en `app/api/cotizaciones/importar`; aquí
 * vive todo lo demás, sin red y sin modelo, para poder probarlo a mano
 * (`node scripts/probar-importar-cos.mjs`):
 *
 *   revisarLectura   compara lo leído contra las cifras que el PDF imprime
 *   aBorrador        convierte la lectura en un borrador del editor
 *
 * El PDF de COS viene agrupado —área › sección › concepto—, y en HAACO las
 * partidas son una lista sin grupos. Se decidió aplanar: cada concepto es una
 * partida y su clave y su sección van al principio del texto, para que en la
 * carta al cliente se siga entendiendo de dónde sale cada renglón.
 */

export type ConceptoCos = {
  /** La banda negra del PDF: «HABILITACIÓN CLÍNICA». */
  area: string | null
  /** La banda gris: «DEMOLICIONES». */
  seccion: string | null
  clave: string | null
  descripcion: string
  unidad: string | null
  cantidad: number | null
  precio_unitario: number | null
  /** La columna TOTAL tal cual viene impresa; con ella se revisa la lectura. */
  importe_impreso: number | null
}

export type LecturaCos = {
  folio: string | null
  cliente: string | null
  /** Como viene impresa, «5 DE NOVIEMBRE DEL 2026». */
  fecha: string | null
  ubicacion: string | null
  tiempo_estimado: string | null
  /** Nombre corto del trabajo, sacado del párrafo «A su amable solicitud…». */
  obra: string | null
  /** El PDF suma el IVA al total (no sólo lo anuncia «en caso de requerir factura»). */
  lleva_iva: boolean
  iva_pct: number | null
  anticipo_pct: number | null
  vigencia_dias: number | null
  /** «SUB-TOTAL» del pie, antes de IVA. */
  subtotal_impreso: number | null
  /** «TOTAL OBRA». */
  total_impreso: number | null
  conceptos: ConceptoCos[]
}

/** Diferencias menores a esto son redondeo de centavos, no un error de lectura. */
const TOLERANCIA = 1

const dinero = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Mayúsculas, sin acentos ni espacios de más: para comparar nombres. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/** «LUIS INDA» → «Luis Inda», para dar de alta al cliente como se escribe aquí. */
export function nombrePropio(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase('es-MX')
    .replace(/(^|[\s.-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('es-MX'))
}

/**
 * Unidades de COS → las del editor. Las de COS salen de su catálogo
 * (M2, M3, ML, PZA, SAL, JGO, KG, DIA, VIAJE, SERVICIO) más el LOTE que
 * escriben a mano. Las que el editor no conoce pasan tal cual, en minúsculas,
 * y se avisan.
 */
const UNIDADES: Record<string, string> = {
  M2: '',
  'M²': '',
  ML: 'ml',
  PZA: 'pza',
  PZ: 'pza',
  PIEZA: 'pza',
  LOTE: 'lote',
  LOT: 'lote',
  SERVICIO: 'servicio',
  SERV: 'servicio',
  SAL: 'sal',
  SALIDA: 'sal',
}

export function unidadDeCos(unidad: string | null): { unidad: string; conocida: boolean } {
  const limpia = normalizarNombre(unidad ?? '').replace(/\./g, '')
  if (!limpia) return { unidad: '', conocida: true }
  if (limpia in UNIDADES) return { unidad: UNIDADES[limpia], conocida: true }
  return { unidad: limpia.toLowerCase(), conocida: false }
}

const importeLeido = (c: ConceptoCos) => redondear((c.cantidad ?? 1) * (c.precio_unitario ?? 0))

const etiqueta = (c: ConceptoCos, i: number) => c.clave || `Renglón ${i + 1}`

/**
 * Lo que no cuadra entre lo leído y lo que el PDF imprime. Es la red contra
 * los errores de lectura: el modelo copia las cifras y aquí se rehacen las
 * cuentas, así que un número mal leído casi siempre deja una diferencia.
 * Vacío = todo cuadra.
 */
export function revisarLectura(lectura: LecturaCos): string[] {
  const avisos: string[] = []

  lectura.conceptos.forEach((c, i) => {
    if (c.precio_unitario === null) {
      avisos.push(`${etiqueta(c, i)}: no se leyó el precio unitario.`)
      return
    }
    const calculado = importeLeido(c)
    if (c.importe_impreso !== null && Math.abs(calculado - c.importe_impreso) > TOLERANCIA) {
      avisos.push(
        `${etiqueta(c, i)}: ${c.cantidad ?? 1} × $${dinero(c.precio_unitario)} da $${dinero(calculado)}, pero el PDF dice $${dinero(c.importe_impreso)}.`,
      )
    }
    if (c.cantidad !== null && redondear(c.cantidad) !== c.cantidad) {
      avisos.push(
        `${etiqueta(c, i)}: la cantidad ${c.cantidad} se guarda con dos decimales (${redondear(c.cantidad)}).`,
      )
    }
    const { conocida } = unidadDeCos(c.unidad)
    if (!conocida) {
      avisos.push(`${etiqueta(c, i)}: la unidad «${c.unidad}» no está en el cotizador; revísala.`)
    }
  })

  const suma = redondear(lectura.conceptos.reduce((s, c) => s + importeLeido(c), 0))
  // Sin IVA, el «TOTAL OBRA» es el mismo subtotal: sirve para revisar aunque
  // no se haya leído el SUB-TOTAL.
  const subtotal =
    lectura.subtotal_impreso ?? (lectura.lleva_iva ? null : lectura.total_impreso)
  if (subtotal !== null && Math.abs(suma - subtotal) > TOLERANCIA) {
    avisos.push(
      `Las partidas suman $${dinero(suma)} y el subtotal del PDF es $${dinero(subtotal)}: falta o sobra algún renglón.`,
    )
  }

  const ceros = lectura.conceptos.filter((c) => c.precio_unitario === 0)
  if (ceros.length > 0) {
    avisos.push(
      `${ceros.length === 1 ? 'Una partida viene' : `${ceros.length} partidas vienen`} en $0.00 (${ceros
        .map((c, i) => c.clave || `renglón ${i + 1}`)
        .join(', ')}): ponles precio o quítalas.`,
    )
  }

  return avisos
}

export type Importacion = {
  borrador: BorradorCotizacion
  /** El nombre del cliente en COS cuando no hay uno igual en HAACO. */
  clienteSinAlta: string | null
}

/**
 * La lectura de COS como borrador del editor, montada sobre `base` —el
 * borrador vacío de la pantalla, que ya trae los términos de la casa—.
 *
 * Los precios son los de COS, tal cual: si hay que ajustarlos se hace en el
 * editor. La fecha es la de hoy, porque la cotización de HAACO es nueva; la de
 * COS se queda en las notas junto con su folio, que no puede ir en `folio`
 * (es único y el F-xxx lo pone la base).
 */
export function aBorrador(
  lectura: LecturaCos,
  base: BorradorCotizacion,
  clientes: { id: string; nombre: string }[],
): Importacion {
  const areas = new Set(lectura.conceptos.map((c) => c.area?.trim()).filter(Boolean))
  const variasAreas = areas.size > 1

  const items: PartidaBorrador[] = lectura.conceptos.map((c) => {
    const grupo = [variasAreas ? c.area?.trim() : null, c.seccion?.trim()]
      .filter(Boolean)
      .join(' › ')
    const encabezado = [c.clave?.trim(), grupo].filter(Boolean).join(' · ')
    return {
      descripcion: encabezado ? `${encabezado} — ${c.descripcion.trim()}` : c.descripcion.trim(),
      m2: c.cantidad === null ? '' : String(redondear(c.cantidad)),
      unidad: unidadDeCos(c.unidad).unidad,
      precio_unitario: String(redondear(c.precio_unitario ?? 0)),
    }
  })

  // Un solo cliente con el mismo nombre: ése es. Dos o ninguno, se elige a mano.
  const nombre = lectura.cliente?.trim() || null
  const iguales = nombre
    ? clientes.filter((c) => normalizarNombre(c.nombre) === normalizarNombre(nombre))
    : []
  const cliente_id = iguales.length === 1 ? iguales[0].id : ''

  const notas = [
    `Importada de COS${lectura.folio ? ` · ${lectura.folio}` : ''}${lectura.fecha ? ` del ${lectura.fecha.toLowerCase()}` : ''}.`,
    nombre ? `Cliente en COS: ${nombre}.` : null,
    lectura.tiempo_estimado && lectura.tiempo_estimado !== '—'
      ? `Tiempo estimado: ${lectura.tiempo_estimado}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  const ubicacion = lectura.ubicacion?.trim()
  const obra =
    lectura.obra?.trim() || (areas.size === 1 ? [...areas][0]! : '')

  return {
    borrador: {
      ...base,
      cliente_id,
      nombre_obra: obra.slice(0, 120),
      domicilio_obra: ubicacion && ubicacion !== '—' ? ubicacion : '',
      tipo: 'otros',
      requiere_factura: lectura.lleva_iva,
      iva_pct: lectura.lleva_iva ? String(lectura.iva_pct ?? REGLAS.ivaPct) : '0',
      anticipo_pct:
        lectura.anticipo_pct !== null ? String(lectura.anticipo_pct) : base.anticipo_pct,
      vigencia_dias:
        lectura.vigencia_dias !== null ? String(lectura.vigencia_dias) : base.vigencia_dias,
      notas: base.notas.trim() ? `${base.notas.trim()}\n${notas}` : notas,
      items,
      desglose: [],
    },
    clienteSinAlta: nombre && iguales.length === 0 ? nombre : null,
  }
}
