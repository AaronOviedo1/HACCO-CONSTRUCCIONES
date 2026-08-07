import Anthropic from '@anthropic-ai/sdk'
import { obtenerPerfil } from '@/lib/auth'
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/finanzas'
import {
  cuadrarRenglones,
  type DesgloseComprobante,
  type LecturaTicket,
  type RenglonLeido,
} from '@/lib/ticket'
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

Tu trabajo es COPIAR las cifras que el papel ya trae, no sacarlas. No sumes, no restes, no
prorratees, no cuadres nada: de eso se encarga el sistema. Lo que no esté impreso va en null.

Reglas:
- «monto» es el TOTAL a pagar del comprobante: el descuento ya restado y el IVA ya sumado. Es la
  cifra grande del pie, la que se firma. Nunca el subtotal ni un renglón suelto.
- «renglones»: un renglón por cada artículo distinto del ticket, con su descripción corta y sus
  piezas. Su «importe» es lo que dice la columna de importe, tal cual, ANTES de descuento e
  impuesto. Si el ticket es de un solo artículo, la lista lleva ese único renglón. Las líneas que
  no son un artículo —descuentos, redondeos, propinas— no van en la lista.
- «descuento» e «impuesto» del renglón: sólo cuando el comprobante los desglosa renglón por
  renglón, como hacen las facturas. Cópialos en positivo, cada uno con el suyo. Si el comprobante
  no los separa así, van en null y ya: el sistema los reparte.
- «desglose» son las cifras del pie, tal como están impresas: «subtotal», «descuento» (la suma de
  los descuentos, en positivo), «impuesto» (el IVA) y «total». Lo que no venga impreso va en null.
  Un ticket de tiendita casi siempre trae nada más el total: los demás en null y ya.
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
      monto: {
        type: ['number', 'null'],
        description: 'El TOTAL a pagar, con el descuento restado y el IVA sumado',
      },
      renglones: {
        type: 'array',
        description: 'Un renglón por artículo distinto del ticket',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            piezas: { type: 'number' },
            importe: {
              type: 'number',
              description: 'El importe del renglón tal cual, antes de descuento e impuesto',
            },
            descuento: {
              type: ['number', 'null'],
              description: 'El descuento DE ESE RENGLÓN, en positivo, si el comprobante lo desglosa',
            },
            impuesto: {
              type: ['number', 'null'],
              description: 'El IVA DE ESE RENGLÓN, si el comprobante lo desglosa',
            },
          },
          required: ['descripcion', 'piezas', 'importe', 'descuento', 'impuesto'],
        },
      },
      // Requerido y sin null: así el modelo tiene que mirar el pie y decir «aquí
      // no hay nada», en vez de saltárselo.
      desglose: {
        type: 'object',
        description: 'Las cifras del pie del comprobante, tal como están impresas',
        properties: {
          subtotal: { type: ['number', 'null'] },
          descuento: { type: ['number', 'null'], description: 'La suma de los descuentos, en positivo' },
          impuesto: { type: ['number', 'null'], description: 'El IVA del comprobante' },
          total: { type: ['number', 'null'] },
        },
        required: ['subtotal', 'descuento', 'impuesto', 'total'],
      },
      metodo: { type: ['string', 'null'], enum: [...Object.keys(METODO_PAGO), null] },
      categoria: { type: ['string', 'null'], enum: [...Object.keys(CATEGORIA_GASTO), null] },
      folio: { type: ['string', 'null'] },
      fecha: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
      proveedor: { type: ['string', 'null'], enum: [...proveedores.map((p) => p.nombre), null] },
      aviso: { type: ['string', 'null'] },
    },
    required: ['descripcion', 'piezas', 'monto', 'renglones', 'desglose', 'metodo', 'categoria', 'folio', 'fecha', 'proveedor', 'aviso'],
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

    // Renglones del ticket tal como vienen impresos: sólo pasan los que traen
    // descripción e importe, que es lo mínimo para poder cuadrarlos.
    const leidos = (Array.isArray(leido.renglones) ? leido.renglones : [])
      .map((r) => {
        const fila = r as Record<string, unknown>
        return {
          descripcion: texto(fila.descripcion),
          piezas: entero(fila.piezas) ?? 1,
          importe: numero(fila.importe),
          descuento: positivo(fila.descuento),
          impuesto: positivo(fila.impuesto),
        }
      })
      .filter((r): r is RenglonLeido => Boolean(r.descripcion && r.importe))

    // El pie del comprobante. Si el modelo puso el total sólo en «monto» —o al
    // revés—, la cifra que sí leyó cubre a la que se le fue.
    const pie = (leido.desglose ?? {}) as Record<string, unknown>
    const desglose: DesgloseComprobante = {
      subtotal: numero(pie.subtotal),
      descuento: positivo(pie.descuento),
      impuesto: positivo(pie.impuesto),
      total: numero(pie.total) ?? numero(leido.monto),
    }
    const { renglones } = cuadrarRenglones(leidos, desglose)

    const lectura: LecturaTicket = {
      descripcion: texto(leido.descripcion),
      piezas: entero(leido.piezas),
      monto: numero(leido.monto) ?? desglose.total,
      renglones,
      // Sin una sola cifra del pie no hay nada que enseñar ni con qué comparar.
      desglose: Object.values(desglose).some((v) => v !== null) ? desglose : null,
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
/** Descuentos e IVA se copian en positivo; si vienen con signo, se endereza. */
const positivo = (v: unknown) => (typeof v === 'number' ? numero(Math.abs(v)) : null)
const entero = (v: unknown) => {
  const n = numero(v)
  return n ? Math.max(1, Math.round(n)) : null
}
