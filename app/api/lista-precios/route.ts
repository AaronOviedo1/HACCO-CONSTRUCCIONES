import Anthropic from '@anthropic-ai/sdk'
import { obtenerPerfil } from '@/lib/auth'
import { crearClienteServidor } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Lee la lista de precios que el vendedor manda por WhatsApp.
 *
 * Los proveedores de acero no publican precios en ningún lado, pero sí mandan
 * su lista al cliente: pegada como texto, o en una foto. Esto la convierte en
 * renglones que ella revisa y confirma, en vez de teclearlos uno por uno.
 *
 * Son los precios del proveedor real, con su descuento — no los de una tienda
 * en línea que vende otra cosa a otro precio.
 *
 * Igual que la lectura de tickets: el catálogo viaja como enum cerrado, así que
 * el modelo sólo puede elegir un material que existe o decir que no sabe. Nada
 * se guarda solo; lo que devuelve es una propuesta.
 */

const MAXIMO = 8 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const TOPE_TEXTO = 20_000
const TOPE_PRODUCTOS = 150

const INSTRUCCIONES = `Eres el capturista de una empresa de pintura y herrería en Hermosillo, Sonora.
Te llega la lista de precios que un proveedor mandó —pegada de WhatsApp, o la foto de una hoja— y
la conviertes en renglones para revisar.

Tu trabajo es COPIAR lo que la lista dice, no interpretarlo. Lo que no esté escrito va en null.

Reglas:
- Un renglón por material con precio. Las líneas que no son un material —encabezados, saludos,
  «precios sujetos a cambio», teléfonos— no van en la lista.
- «precio»: la cifra por unidad, tal cual. Si la lista trae precio con IVA y sin IVA, toma el que
  se paga: el que lleva IVA.
- «unidad»: la unidad EN QUE está dado ese precio, como venga escrita —tramo, metro, kilo, pieza,
  hoja, cubeta, litro—. Es importante: un PTR por tramo y un PTR por metro no son el mismo número,
  y aquí no se convierte nada.
- «producto»: elige del catálogo sólo si el renglón ES ese material, aunque venga abreviado o con
  la medida pegada. Si dudas, null: el sistema pregunta después. Vale más un null que un material
  equivocado, porque de ahí sale el precio con el que se cotiza.
- «descripcion»: el texto del renglón tal como viene en la lista.
- «aviso»: una frase corta SÓLO si algo salió mal —la foto no se lee, o eso no es una lista de
  precios—. Si se leyó bien, null.`

export async function POST(peticion: Request) {
  const perfil = await obtenerPerfil()
  if (!perfil || !['admin', 'administracion'].includes(perfil.rol)) {
    return Response.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en el entorno.' }, { status: 501 })
  }

  const formulario = await peticion.formData()
  const archivo = formulario.get('archivo')
  const pegado = ((formulario.get('texto') as string) || '').trim().slice(0, TOPE_TEXTO)

  if (!(archivo instanceof File) && !pegado) {
    return Response.json({ error: 'No llegó ni texto ni imagen.' }, { status: 400 })
  }
  if (archivo instanceof File) {
    if (archivo.size > MAXIMO) {
      return Response.json({ error: 'El archivo pesa demasiado.' }, { status: 413 })
    }
    if (!TIPOS.includes(archivo.type)) {
      return Response.json({ error: 'Ese archivo no se puede leer.' }, { status: 415 })
    }
  }

  // El catálogo sale del servidor, no del navegador: es la lista contra la que
  // se va a ligar y no puede depender de lo que mande el cliente.
  const supabase = await crearClienteServidor()
  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre')
    .eq('activo', true)
    .neq('tipo', 'insumo_taller')
    .order('nombre')
    .limit(TOPE_PRODUCTOS)

  const catalogo = productos ?? []

  const esquema = {
    type: 'object' as const,
    properties: {
      renglones: {
        type: 'array',
        description: 'Un renglón por material con precio',
        items: {
          type: 'object',
          properties: {
            descripcion: { type: 'string' },
            precio: { type: 'number' },
            unidad: { type: ['string', 'null'] },
            producto: {
              type: ['string', 'null'],
              enum: [...catalogo.map((p) => p.nombre), null],
            },
          },
          required: ['descripcion', 'precio', 'unidad', 'producto'],
        },
      },
      proveedor: { type: ['string', 'null'], description: 'Quién manda la lista, si lo dice' },
      aviso: { type: ['string', 'null'] },
    },
    required: ['renglones', 'proveedor', 'aviso'],
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const contenido: Anthropic.ContentBlockParam[] = []

    if (archivo instanceof File) {
      const datos = Buffer.from(await archivo.arrayBuffer()).toString('base64')
      contenido.push(
        archivo.type === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: datos } }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: archivo.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: datos,
              },
            },
      )
    }

    contenido.push({
      type: 'text',
      text: pegado
        ? `Convierte esta lista de precios en renglones:\n\n${pegado}`
        : 'Convierte esta lista de precios en renglones.',
    })

    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system: INSTRUCCIONES,
      tools: [
        {
          name: 'capturar_lista_precios',
          description: 'Entrega los renglones leídos de la lista del proveedor.',
          input_schema: esquema,
        },
      ],
      tool_choice: { type: 'tool', name: 'capturar_lista_precios' },
      messages: [{ role: 'user', content: contenido }],
    })

    const bloque = respuesta.content.find((b) => b.type === 'tool_use')
    if (!bloque || bloque.type !== 'tool_use') {
      return Response.json({ error: 'No se pudo leer la lista.' }, { status: 502 })
    }

    const leido = bloque.input as Record<string, unknown>
    const renglones = (Array.isArray(leido.renglones) ? leido.renglones : [])
      .map((r) => {
        const fila = r as Record<string, unknown>
        const nombre = typeof fila.producto === 'string' ? fila.producto : null
        return {
          descripcion: texto(fila.descripcion) ?? '',
          precio: numero(fila.precio),
          unidad: texto(fila.unidad),
          // El enum es cerrado: un nombre fuera de la lista es invención.
          producto_id: catalogo.find((p) => p.nombre === nombre)?.id ?? null,
          producto: nombre,
        }
      })
      .filter((r) => r.descripcion && r.precio)

    return Response.json({
      lectura: { renglones, proveedor: texto(leido.proveedor), aviso: texto(leido.aviso) },
    })
  } catch (e) {
    console.error('[lista-precios] lectura fallida', e)
    return Response.json({ error: 'No se pudo leer la lista.' }, { status: 502 })
  }
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
