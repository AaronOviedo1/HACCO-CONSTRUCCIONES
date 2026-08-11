'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { borrarSuscripcionPush, guardarSuscripcionPush } from '@/app/admin/recordatorios-acciones'

/**
 * Activar los avisos en este teléfono.
 *
 * Web Push necesita tres cosas del navegador y ninguna se puede pedir desde el
 * servidor: registrar el service worker, que la persona conceda el permiso, y
 * la suscripción que sale de las dos anteriores. Por eso vive aquí y se
 * enciende con un toque, no solo.
 *
 * En iPhone hay una condición que no se puede rodear: Safari sólo permite
 * notificaciones si la app está agregada a la pantalla de inicio. Se detecta y
 * se dice, porque el botón sin eso falla sin explicar nada.
 */
type Estado = 'cargando' | 'no-soportado' | 'hace-falta-instalar' | 'apagado' | 'bloqueado' | 'encendido'

export function ActivarAvisos({ llavePublica }: { llavePublica: string }) {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    let vivo = true

    const revisar = async () => {
      if (!llavePublica) return vivo && setEstado('no-soportado')
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        // En iPhone la API no existe hasta que la app está en la pantalla de
        // inicio: es lo mismo que «no soportado» pero con arreglo.
        const esApple = /iphone|ipad|ipod/i.test(navigator.userAgent)
        const instalada = window.matchMedia('(display-mode: standalone)').matches
        return vivo && setEstado(esApple && !instalada ? 'hace-falta-instalar' : 'no-soportado')
      }
      if (Notification.permission === 'denied') return vivo && setEstado('bloqueado')

      const registro = await navigator.serviceWorker.getRegistration()
      const suscripcion = await registro?.pushManager.getSubscription()
      if (vivo) setEstado(suscripcion ? 'encendido' : 'apagado')
    }

    revisar().catch(() => vivo && setEstado('no-soportado'))
    return () => {
      vivo = false
    }
  }, [llavePublica])

  const encender = async () => {
    setError(null)
    setTrabajando(true)
    try {
      const registro = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado')
        return
      }

      // `subscribe` habla con el servicio de push del navegador y, si ese
      // servicio no contesta —sin red, o un Chrome sin cuenta—, la promesa se
      // queda colgada sin rechazar nunca. Sin este límite el botón se queda en
      // «Un momento…» para siempre y no hay manera de volver a intentarlo.
      const suscripcion = await conLimite(
        registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: aBytes(llavePublica),
        }),
        15_000,
        'El navegador no respondió. Revisa la conexión y vuelve a intentarlo.',
      )

      const json = suscripcion.toJSON() as { keys?: { p256dh?: string; auth?: string } }
      const r = await guardarSuscripcionPush({
        endpoint: suscripcion.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        agente: navigator.userAgent.slice(0, 200),
      })
      if (!r.ok) throw new Error(r.error)
      setEstado('encendido')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron activar los avisos.')
    } finally {
      setTrabajando(false)
    }
  }

  const apagar = async () => {
    setError(null)
    setTrabajando(true)
    try {
      const registro = await navigator.serviceWorker.getRegistration()
      const suscripcion = await registro?.pushManager.getSubscription()
      if (suscripcion) {
        await borrarSuscripcionPush(suscripcion.endpoint)
        await suscripcion.unsubscribe()
      }
      setEstado('apagado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron apagar los avisos.')
    } finally {
      setTrabajando(false)
    }
  }

  if (estado === 'cargando' || estado === 'no-soportado') return null

  const marco =
    'flex w-full items-center gap-3 rounded-[16px] border-[0.5px] border-tinta-200 bg-white px-4 py-3 text-left'

  if (estado === 'hace-falta-instalar') {
    return (
      <div className={marco}>
        <Bell size={18} className="shrink-0 text-tinta-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-tinta-800">Avisos en este teléfono</span>
          <span className="block text-xs text-tinta-500">
            Para que suenen en el iPhone, agrega HaacoPro a la pantalla de inicio: Compartir →
            Agregar a inicio. Después vuelve aquí.
          </span>
        </span>
      </div>
    )
  }

  if (estado === 'bloqueado') {
    return (
      <div className={marco}>
        <BellOff size={18} className="shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-tinta-800">Avisos bloqueados</span>
          <span className="block text-xs text-tinta-500">
            Este teléfono los tiene rechazados. Se vuelven a permitir desde los ajustes del
            navegador, en las notificaciones del sitio.
          </span>
        </span>
      </div>
    )
  }

  const encendido = estado === 'encendido'

  return (
    <div>
      <button
        type="button"
        onClick={encendido ? apagar : encender}
        disabled={trabajando}
        className={`${marco} transition active:bg-tinta-50 disabled:opacity-60`}
      >
        {encendido ? (
          <BellRing size={18} className="shrink-0 text-haaco-700" />
        ) : (
          <Bell size={18} className="shrink-0 text-tinta-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-tinta-800">
            Avisos en este teléfono
          </span>
          <span className="block text-xs text-tinta-500">
            {trabajando
              ? 'Un momento…'
              : encendido
                ? 'Encendidos. Los recordatorios del día llegan a las 7 de la mañana.'
                : 'Apagados. Tócalo para que los recordatorios te lleguen aunque no abras la app.'}
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-haaco-700">
          {encendido ? 'Apagar' : 'Activar'}
        </span>
      </button>
      {error && <p className="mt-1.5 px-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Le pone tope a una promesa que puede no resolver nunca. */
function conLimite<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error(mensaje)), ms)),
  ])
}

/**
 * La llave VAPID viaja en base64url y `subscribe` la pide en bytes.
 *
 * El buffer se crea aparte y con tipo explícito: un `Uint8Array` suelto se
 * escribe como `ArrayBufferLike`, que puede ser compartido, y `applicationServerKey`
 * sólo acepta uno normal.
 */
function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length))
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}
