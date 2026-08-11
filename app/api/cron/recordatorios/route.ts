import webpush from 'web-push'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Los recordatorios de la mañana, al teléfono.
 *
 * Manda un aviso por cada pendiente que toca hoy o que se pasó de fecha sin
 * atender, a los aparatos que su dueño haya dado de alta. Uno por recordatorio
 * y no un resumen: un aviso que dice «tienes 4 pendientes» hay que abrirlo para
 * saber si urge, y el que dice «hablarle a Daniel, quedó de confirmar» se
 * resuelve leyéndolo.
 *
 * Corre sin sesión, así que no hay RLS que lo cubra: la puerta es el
 * CRON_SECRET y los datos salen de RPCs `security definer` estrechas, igual que
 * la ronda de precios —`service_role` no tiene lectura sobre las tablas de este
 * esquema y no debería tenerla—. La excepción de `proxy.ts` para /api/cron ya
 * cubre esta ruta.
 *
 * Una suscripción que el servicio de push ya no reconoce (404 o 410) se da de
 * baja en el momento: es un teléfono que se cambió o una app que se
 * desinstaló, y si se queda, cada mañana se intenta y cada mañana falla.
 */
export async function GET(peticion: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'Falta CRON_SECRET en el entorno.' }, { status: 501 })
  }
  if (peticion.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) {
    return Response.json(
      { error: 'Faltan las llaves VAPID: sin ellas no se pueden mandar avisos.' },
      { status: 501 },
    )
  }

  const supabase = crearClienteAdmin()
  if (!supabase) {
    return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 501 })
  }

  webpush.setVapidDetails(
    `mailto:${process.env.CORREO_AVISOS ?? 'avisos@haacopro.mx'}`,
    publica,
    privada,
  )

  const { data: avisos, error } = await supabase.rpc('avisos_de_recordatorios')
  if (error) {
    console.error('[cron recordatorios] no se pudieron leer', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!avisos?.length) return Response.json({ ok: true, avisos: 0 })

  let enviados = 0
  const caducadas = new Set<string>()
  const usadas = new Set<string>()

  for (const a of avisos) {
    // Un teléfono que ya falló no se vuelve a intentar en la misma corrida.
    if (caducadas.has(a.suscripcion_id)) continue

    const url = a.cotizacion_id
      ? `/admin/cotizaciones/${a.cotizacion_id}`
      : a.obra_id
        ? `/admin/obras/${a.obra_id}`
        : '/admin'

    const carga = JSON.stringify({
      titulo: a.vencido ? `Se pasó: ${a.titulo}` : a.titulo,
      cuerpo: a.nota ?? 'Tienes un recordatorio para hoy.',
      url,
      // Con la misma etiqueta, el aviso de mañana reemplaza al de hoy en vez
      // de apilar siete copias del mismo pendiente.
      etiqueta: `recordatorio-${a.recordatorio_id}`,
    })

    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        carga,
      )
      enviados++
      usadas.add(a.suscripcion_id)
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) caducadas.add(a.suscripcion_id)
      else console.error('[cron recordatorios] no se pudo enviar', codigo, e)
    }
  }

  if (caducadas.size > 0) {
    await supabase.rpc('olvidar_suscripciones', { p_ids: [...caducadas] })
  }
  if (usadas.size > 0) {
    await supabase.rpc('marcar_envio_push', { p_ids: [...usadas] })
  }

  return Response.json({
    ok: true,
    recordatorios: new Set(avisos.map((a) => a.recordatorio_id)).size,
    avisos: enviados,
    suscripciones_caducadas: caducadas.size,
  })
}
