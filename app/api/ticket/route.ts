import Anthropic from '@anthropic-ai/sdk'
import { obtenerPerfil } from '@/lib/auth'
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/finanzas'
import type { LecturaTicket } from '@/lib/ticket'
import type { CategoriaGasto, MetodoPago } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Lectura del ticket con Claude.
 *
 * El gasto se captura en la obra, con el ticket en la mano y una barra de
 * señal: la foto ya se toma de todos modos, así que de la misma foto salen la
 * descripción, las piezas, el monto y la forma de pago. Todo llega al
 * formulario como propuesta —quien captura sigue viendo y corrigiendo—, nunca
 * se guarda solo.
 */

const MAXIMO = 8 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

const INSTRUCCIONES = `Eres el capturista de una empresa de pintura y herrería en Hermosillo, Sonora.
Te llega la foto de un ticket, una nota de remisión o una factura y llenas la captura del gasto.

Reglas:
- «monto» es el TOTAL que se pagó, con IVA incluido. Nunca el subtotal ni un renglón suelto.
- «renglones»: un renglón por cada artículo distinto del ticket, con su descripción corta, sus piezas
  y el importe de ese renglón (lo que costó en total ese artículo, tal como lo dice el ticket).
  Si el ticket es de un solo artículo, la lista lleva ese único renglón. Ignora renglones de
  descuentos, redondeos o propinas.
- «piezas»: si el ticket es de un solo artículo, su cantidad. Si trae varios artículos distintos, pon 1
  (el sistema divide monto entre piezas para sacar el costo unitario, y esa cuenta sólo sirve con un artículo).
- «descripcion»: corta y en el español de la obra, como la escribiría el maestro. Ej. «4 cubetas Rivinol 7 blanco».
  Si trae varios artículos es el resumen del ticket completo.
  Nada de RFC, direcciones, cajero ni leyendas del ticket.
- «fecha»: en México se escribe día/mes/año. Devuélvela como AAAA-MM-DD. Si no se alcanza a leer, null.
- «metodo»: efectivo o «contado» → efectivo; terminal, TDC, TDD o cualquier tarjeta → tarjeta_empresa;
  SPEI o transferencia → transferencia; cheque → cheque; ficha de depósito → deposito.
- «proveedor»: elige uno de la lista sólo si el negocio del ticket es ese, aunque venga abreviado. Si no, null.
- «folio»: el número del ticket, nota o factura, tal cual.
- No inventes: lo que no se vea en la imagen va en null.
- Si la imagen no es un comprobante de compra, TODOS los campos van en null y sólo escribes el aviso.
- «aviso»: una frase corta SÓLO si algo salió mal —la foto está borrosa, viene cortada, o no es un
  comprobante de compra—. Si se leyó bien, null.`

export async function POST(peticion: Request) {
  const perfil = await obtenerPerfil()
  if (!perfil) return Response.json({ error: 'Sesión no válida.' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en el entorno.' }, { status: 501 })
  }

  const formulario = await peticion.formData()
  const archivo = formulario.get('archivo')
  if (!(archivo instanceof File)) {
    return Response.json({ error: 'No llegó ninguna imagen.' }, { status: 400 })
  }
  if (archivo.size > MAXIMO) {
    return Response.json({ error: 'La imagen pesa demasiado.' }, { status: 413 })
  }
  // Algunos teléfonos entregan formatos que el navegador no supo convertir.
  if (!TIPOS.includes(archivo.type)) {
    return Response.json(
      { error: 'Ese archivo no se puede leer; vuelve a tomar la foto.' },
      { status: 415 },
    )
  }
  const tipo = archivo.type

  // Los proveedores dados de alta viajan como opciones cerradas: así el modelo
  // elige uno existente o ninguno, en vez de inventar un nombre que no casa.
  const proveedores = JSON.parse(
    (formulario.get('proveedores') as string) || '[]',
  ) as { id: string; nombre: string }[]

  const datos = Buffer.from(await archivo.arrayBuffer()).toString('base64')
  const hoy = new Date().toISOString().slice(0, 10)

  const esquema = {
    type: 'object' as const,
    properties: {
      descripcion: { type: ['string', 'null'], description: 'Qué se compró, en pocas palabras' },
      piezas: { type: ['number', 'null'] },
      monto: { type: ['number', 'null'], description: 'Total pagado con IVA' },
      renglones: {
        type: 'array',
        description: 'Un renglón por artículo distinto del ticket',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            piezas: { type: 'number' },
            importe: { type: 'number', description: 'Lo que costó ese renglón en total' },
          },
          required: ['descripcion', 'piezas', 'importe'],
        },
      },
      metodo: { type: ['string', 'null'], enum: [...Object.keys(METODO_PAGO), null] },
      categoria: { type: ['string', 'null'], enum: [...Object.keys(CATEGORIA_GASTO), null] },
      folio: { type: ['string', 'null'] },
      fecha: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
      proveedor: { type: ['string', 'null'], enum: [...proveedores.map((p) => p.nombre), null] },
      aviso: { type: ['string', 'null'] },
    },
    required: ['descripcion', 'piezas', 'monto', 'renglones', 'metodo', 'categoria', 'folio', 'fecha', 'proveedor', 'aviso'],
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: INSTRUCCIONES,
      tools: [
        {
          name: 'capturar_gasto',
          description: 'Entrega los datos leídos del comprobante.',
          input_schema: esquema,
        },
      ],
      tool_choice: { type: 'tool', name: 'capturar_gasto' },
      messages: [
        {
          role: 'user',
          content: [
            tipo === 'application/pdf'
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: datos } }
              : {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: tipo as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                    data: datos,
                  },
                },
            { type: 'text', text: `Captura el gasto de este comprobante. Hoy es ${hoy}.` },
          ],
        },
      ],
    })

    const bloque = respuesta.content.find((b) => b.type === 'tool_use')
    if (!bloque || bloque.type !== 'tool_use') {
      return Response.json({ error: 'No se pudo leer el comprobante.' }, { status: 502 })
    }

    const leido = bloque.input as Record<string, unknown>
    const nombre = typeof leido.proveedor === 'string' ? leido.proveedor : null

    // Renglones del ticket: sólo pasan los que traen descripción e importe.
    const renglones = (Array.isArray(leido.renglones) ? leido.renglones : [])
      .map((r) => {
        const fila = r as Record<string, unknown>
        return {
          descripcion: texto(fila.descripcion),
          piezas: entero(fila.piezas) ?? 1,
          monto: numero(fila.importe),
        }
      })
      .filter((r): r is { descripcion: string; piezas: number; monto: number } =>
        Boolean(r.descripcion && r.monto),
      )

    const lectura: LecturaTicket = {
      descripcion: texto(leido.descripcion),
      piezas: entero(leido.piezas),
      monto: numero(leido.monto),
      renglones,
      metodo: clave<MetodoPago>(leido.metodo, METODO_PAGO),
      categoria: clave<CategoriaGasto>(leido.categoria, CATEGORIA_GASTO),
      folio: texto(leido.folio),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(leido.fecha)) ? String(leido.fecha) : null,
      proveedor_id: proveedores.find((p) => p.nombre === nombre)?.id ?? null,
      aviso: texto(leido.aviso),
    }

    return Response.json({ lectura })
  } catch (e) {
    console.error('[ticket] lectura fallida', e)
    return Response.json({ error: 'No se pudo leer el comprobante.' }, { status: 502 })
  }
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
/** Sólo pasan los valores que existen en el catálogo; lo demás se descarta. */
const clave = <T extends string>(v: unknown, catalogo: Record<string, string>) =>
  typeof v === 'string' && v in catalogo ? (v as T) : null
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const entero = (v: unknown) => {
  const n = numero(v)
  return n ? Math.max(1, Math.round(n)) : null
}
