import type { EstatusObra, EstatusTarea } from '@/types/database'
import type { TonoEtiqueta } from '@/components/ui'

export const ESTATUS_OBRA: Record<EstatusObra, { texto: string; tono: TonoEtiqueta }> = {
  agendada: { texto: 'Agendada', tono: 'gris' },
  en_obra: { texto: 'En obra', tono: 'verde' },
  pausada: { texto: 'Pausada', tono: 'ambar' },
  en_entrega: { texto: 'En entrega', tono: 'azul' },
  terminada: { texto: 'Terminada', tono: 'azul' },
  cerrada: { texto: 'Cerrada', tono: 'gris' },
}

export const ESTATUS_TAREA: Record<EstatusTarea, { texto: string; tono: TonoEtiqueta }> = {
  pendiente: { texto: 'Pendiente', tono: 'gris' },
  en_proceso: { texto: 'En proceso', tono: 'azul' },
  terminada: { texto: 'Terminada', tono: 'verde' },
}

// ---------------------------------------------------------------------------
// CONTRATO POR OBRA DETERMINADA · los cuatro grupos del formato real
// ---------------------------------------------------------------------------
export type GrupoTrabajos = {
  clave: 'vinilicas' | 'impermeabilizantes' | 'otros'
  titulo: string
  opciones: { clave: string; texto: string }[]
}

export const GRUPOS_TRABAJOS: GrupoTrabajos[] = [
  {
    clave: 'vinilicas',
    titulo: 'Vinílicas',
    opciones: [
      { clave: 'superficie_nueva', texto: 'Superficie nueva' },
      { clave: 'repintado', texto: 'Repintado' },
      { clave: 'interior', texto: 'Interior' },
      { clave: 'exterior', texto: 'Exterior' },
      { clave: 'habitado', texto: 'Habitado' },
      { clave: 'resanes_menores', texto: 'Resanes menores' },
      { clave: 'albanileria', texto: 'Albañilería' },
    ],
  },
  {
    clave: 'impermeabilizantes',
    titulo: 'Impermeabilizantes',
    opciones: [
      { clave: 'superficie_nueva', texto: 'Superficie nueva' },
      { clave: 'mantenimiento', texto: 'Mantenimiento' },
      { clave: 'desprendimiento', texto: 'Desprendimiento / acarreo' },
      { clave: 'elastomerico', texto: 'Elastomérico' },
      { clave: 'malla', texto: 'Aplicación de malla' },
      { clave: 'fibratado', texto: 'Fibratado' },
      { clave: 'resanes_menores', texto: 'Resanes menores' },
      { clave: 'albanileria', texto: 'Albañilería' },
    ],
  },
  {
    clave: 'otros',
    titulo: 'Otros',
    opciones: [
      { clave: 'herreria', texto: 'Herrería' },
      { clave: 'epoxicos_apu', texto: 'Epóxicos / APU' },
      { clave: 'superficie_nueva', texto: 'Superficie nueva' },
      { clave: 'mantenimiento', texto: 'Mantenimiento' },
    ],
  },
]

export type TrabajosContrato = Record<string, string[]>
export type ReparacionContrato = { descripcion: string; importe: number }

/** Lista legible de los trabajos marcados, para el PDF y las tarjetas. */
export function resumirTrabajos(trabajos: unknown): string[] {
  const seleccion = (trabajos ?? {}) as TrabajosContrato
  const lineas: string[] = []

  for (const grupo of GRUPOS_TRABAJOS) {
    const marcadas = seleccion[grupo.clave] ?? []
    if (marcadas.length === 0) continue
    const textos = grupo.opciones
      .filter((o) => marcadas.includes(o.clave))
      .map((o) => o.texto)
    lineas.push(`${grupo.titulo}: ${textos.join(', ')}`)
  }
  return lineas
}

export function leerReparaciones(valor: unknown): ReparacionContrato[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      descripcion: String(r.descripcion ?? ''),
      importe: Number(r.importe ?? 0),
    }))
}

// ---------------------------------------------------------------------------
// Semáforo de material: qué tanto se pasó lo real de lo presupuestado
// ---------------------------------------------------------------------------
export function semaforoMaterial(cotizado: number, real: number) {
  if (cotizado <= 0) {
    return real > 0
      ? { tono: 'gris' as TonoEtiqueta, texto: 'Sin presupuesto', pct: 0 }
      : { tono: 'gris' as TonoEtiqueta, texto: 'Sin capturar', pct: 0 }
  }
  const pct = Math.round((real / cotizado) * 100)
  if (pct <= 85) return { tono: 'verde' as TonoEtiqueta, texto: `${pct}% del presupuesto`, pct }
  if (pct <= 100) return { tono: 'ambar' as TonoEtiqueta, texto: `${pct}% del presupuesto`, pct }
  return { tono: 'rojo' as TonoEtiqueta, texto: `${pct}% · rebasado`, pct }
}

/** Utilidad sobre lo cotizado, con el tono con el que se debe pintar. */
export function tonoUtilidad(utilidad: number, cotizado: number): TonoEtiqueta {
  if (cotizado <= 0) return 'gris'
  const pct = (utilidad / cotizado) * 100
  if (pct < 0) return 'rojo'
  if (pct < 15) return 'ambar'
  return 'verde'
}

// ---------------------------------------------------------------------------
// Texto legal del pagaré, con los datos de la obra ya sustituidos
// ---------------------------------------------------------------------------
export function textoPagare(datos: {
  suscriptor: string
  obra: string
  domicilio: string
  valor: string
  valorLetra: string
  fecha: string
  beneficiario: string
  interesOrdinario: number
  interesMoratorio: number
}): string[] {
  return [
    `Por este PAGARÉ debo(emos) y pagaré(mos) incondicionalmente a la orden de ${datos.beneficiario} en la ciudad de Hermosillo, Sonora, el día en que me sea requerido, la cantidad de ${datos.valor} (${datos.valorLetra}), valor total de las herramientas, equipo y accesorios que en este acto recibo(imos) en calidad de préstamo para su uso exclusivo en la obra descrita.`,
    `Este pagaré causará intereses ordinarios a razón del ${datos.interesOrdinario}% mensual desde la fecha de su suscripción hasta el día de su total liquidación. En caso de mora, causará intereses moratorios a razón del ${datos.interesMoratorio}% mensual, equivalente al doble de la tasa ordinaria pactada.`,
    `Para el cumplimiento de este pagaré, el(los) suscriptor(es) se somete(n) expresamente a la jurisdicción y competencia de los tribunales de la ciudad de Hermosillo, Sonora, renunciando a cualquier otro fuero que pudiera corresponderle(s) por razón de su domicilio presente o futuro.`,
    `El(los) suscriptor(es) se obliga(n) a devolver la totalidad de las herramientas relacionadas al concluir la obra, en las mismas condiciones en que las recibió(eron), salvo el desgaste natural por su uso. La devolución total y en buen estado de las herramientas cancela el presente pagaré.`,
  ]
}
