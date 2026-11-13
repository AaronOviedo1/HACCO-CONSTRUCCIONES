import Anthropic from '@anthropic-ai/sdk'
import { revisarLectura, type ConceptoCos, type LecturaCos } from '@/lib/importar-cos'

/**
 * La lectura con Claude del PDF de una cotización de COS. La llama la ruta
 * /api/cotizaciones/importar; vive aparte para poder correrla sobre un PDF de
 * verdad sin sesión ni servidor de por medio.
 */

export const INSTRUCCIONES = `Eres el capturista de HAACO PRO, una empresa de recubrimientos en Hermosillo, Sonora.
Te llega en PDF una cotización de COS Arquitectura & Construcción y la pasas al sistema.

Tu trabajo es COPIAR, no calcular. No sumes, no redondees, no corrijas cifras ni ortografía: el
sistema rehace las cuentas y compara. Un texto que no esté impreso va vacío (""); una cifra que no
esté impresa va en null.

El PDF va así: una banda negra por ÁREA (ej. «HABILITACIÓN CLÍNICA»), dentro bandas grises por
SECCIÓN (ej. «DEMOLICIONES») y en cada sección los conceptos con CLAVE, CONCEPTO, UNIDAD,
CANTIDAD, P. UNITARIO y TOTAL.

Reglas:
- «conceptos»: TODOS los renglones con clave, en el orden del PDF, aunque sigan en otra página.
  Las bandas de área y sección, los subtotales de sección y los «SUB-TOTAL …» no son conceptos.
  Los conceptos en $0.00 sí van.
- «descripcion»: el texto COMPLETO del concepto, palabra por palabra, como está impreso. Une las
  líneas cortadas y quita los guiones de corte de palabra que mete el renglón («CO-LOCACIÓN» →
  «COLOCACIÓN»).
- «cantidad», «precio_unitario» e «importe_impreso»: las cifras de sus columnas, sin signo de pesos
  ni comas. «importe_impreso» es la columna TOTAL del renglón.
- «unidad»: tal cual (M2, ML, PZA, SAL, LOTE…).
- «lleva_iva»: true sólo si el IVA se SUMA al total de la obra (un renglón «IVA (16%)»). Si sólo
  dice «EN CASO DE REQUERIR FACTURA (+IVA 16%)», es false. «iva_pct» es el porcentaje que menciona.
- «subtotal_impreso»: el «SUB-TOTAL» general del pie (no los de cada área). «total_impreso»: «TOTAL OBRA».
- «anticipo_pct»: el porcentaje del ANTICIPO del desglose de pagos. «vigencia_dias»: los días de validez.
- «obra»: el trabajo en pocas palabras, sacado del párrafo «A su amable solicitud…», con mayúscula
  inicial y lo demás en minúsculas. Ej. «Habilitación de espacios para clínica/consultorios».
- «fecha», «ubicacion» y «tiempo_estimado»: como estén impresos; un «—» va vacío.
- Si el PDF no es una cotización, «conceptos» va vacío y escribes el «aviso».
- «aviso»: una frase corta SÓLO si algo impide leerlo bien. Si se leyó bien, vacío.`

// La API admite a lo más 16 campos con tipo unión en el esquema: los textos
// van como cadena (vacía si no están) y sólo las cifras pueden ser null.
const texto = { type: 'string' }
const numeroONulo = { type: ['number', 'null'] }

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    folio: texto,
    cliente: texto,
    fecha: texto,
    ubicacion: texto,
    tiempo_estimado: texto,
    obra: texto,
    lleva_iva: { type: 'boolean' },
    iva_pct: numeroONulo,
    anticipo_pct: numeroONulo,
    vigencia_dias: numeroONulo,
    subtotal_impreso: numeroONulo,
    total_impreso: numeroONulo,
    conceptos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          area: texto,
          seccion: texto,
          clave: texto,
          descripcion: texto,
          unidad: texto,
          cantidad: numeroONulo,
          precio_unitario: numeroONulo,
          importe_impreso: numeroONulo,
        },
        required: [
          'area', 'seccion', 'clave', 'descripcion', 'unidad', 'cantidad', 'precio_unitario',
          'importe_impreso',
        ],
      },
    },
    aviso: texto,
  },
  required: [
    'folio', 'cliente', 'fecha', 'ubicacion', 'tiempo_estimado', 'obra', 'lleva_iva', 'iva_pct',
    'anticipo_pct', 'vigencia_dias', 'subtotal_impreso', 'total_impreso', 'conceptos', 'aviso',
  ],
}

export type ResultadoLectura =
  | { ok: true; lectura: LecturaCos; avisos: string[] }
  | { ok: false; error: string; estado: number }

export async function leerCotizacionCos(
  pdfBase64: string,
  apiKey: string,
): Promise<ResultadoLectura> {
  const anthropic = new Anthropic({ apiKey })

  // En streaming porque la respuesta es larga: sin él, la petición se
  // arriesga a que la corte el tiempo de espera del SDK.
  const respuesta = await anthropic.beta.messages
    .stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      // Copiar un PDF no pide pensar mucho; pide no saltarse renglones.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: ESQUEMA },
      },
      // Si el modelo declina por un falso positivo de seguridad, la misma
      // petición se reintenta en el modelo de respaldo que elija la API.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCCIONES,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Pasa esta cotización de COS al sistema.' },
          ],
        },
      ],
    })
    .finalMessage()

  if (respuesta.stop_reason === 'refusal') {
    console.error('[importar-cos] lectura rechazada', respuesta.stop_details)
    return { ok: false, error: 'No se pudo leer la cotización.', estado: 502 }
  }
  if (respuesta.stop_reason === 'max_tokens') {
    return { ok: false, error: 'La cotización es demasiado larga para leerla de una vez.', estado: 502 }
  }

  const bloque = respuesta.content.find((b) => b.type === 'text')
  if (!bloque || bloque.type !== 'text') {
    return { ok: false, error: 'No se pudo leer la cotización.', estado: 502 }
  }

  const leido = JSON.parse(bloque.text) as Record<string, unknown>
  const conceptos = (Array.isArray(leido.conceptos) ? leido.conceptos : [])
    .map((c): ConceptoCos => {
      const fila = c as Record<string, unknown>
      return {
        area: cadena(fila.area),
        seccion: cadena(fila.seccion),
        clave: cadena(fila.clave),
        descripcion: cadena(fila.descripcion) ?? '',
        unidad: cadena(fila.unidad),
        cantidad: cifra(fila.cantidad),
        precio_unitario: cifra(fila.precio_unitario),
        importe_impreso: cifra(fila.importe_impreso),
      }
    })
    .filter((c) => c.descripcion)

  if (conceptos.length === 0) {
    return {
      ok: false,
      error: cadena(leido.aviso) ?? 'Ese PDF no parece una cotización de COS.',
      estado: 422,
    }
  }

  const lectura: LecturaCos = {
    folio: cadena(leido.folio),
    cliente: cadena(leido.cliente),
    fecha: cadena(leido.fecha),
    ubicacion: cadena(leido.ubicacion),
    tiempo_estimado: cadena(leido.tiempo_estimado),
    obra: cadena(leido.obra),
    lleva_iva: leido.lleva_iva === true,
    iva_pct: cifra(leido.iva_pct),
    anticipo_pct: cifra(leido.anticipo_pct),
    vigencia_dias: cifra(leido.vigencia_dias),
    subtotal_impreso: cifra(leido.subtotal_impreso),
    total_impreso: cifra(leido.total_impreso),
    conceptos,
  }

  const aviso = cadena(leido.aviso)
  return { ok: true, lectura, avisos: [...(aviso ? [aviso] : []), ...revisarLectura(lectura)] }
}

const cadena = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
/** Cero sí vale: hay conceptos de COS en $0.00 que se cotizan después. */
const cifra = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
