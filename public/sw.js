/**
 * Service worker de HaacoPro.
 *
 * Hace una sola cosa: recibir la notificación y abrir la pantalla que le toca.
 * No cachea nada. El sistema es de datos vivos —lo que se cotizó hoy, lo que
 * falta cobrar— y una cáscara guardada en el teléfono sólo serviría para
 * enseñar cifras de ayer.
 *
 * Va en /public para que se sirva desde la raíz: un service worker sólo manda
 * sobre las rutas que cuelgan de donde vive, y desde /_next no vería nada.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : '' }
  }

  const titulo = datos.titulo || 'HaacoPro'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      // Con la misma etiqueta, un aviso nuevo del mismo pendiente reemplaza al
      // anterior en vez de apilarse.
      tag: datos.etiqueta || 'haacopro',
      data: { url: datos.url || '/admin' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/admin'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya está abierta se reusa esa ventana: abrir otra deja al
      // usuario con dos copias del sistema y sin saber cuál es la buena.
      for (const ventana of ventanas) {
        if (ventana.url.includes(destino) && 'focus' in ventana) return ventana.focus()
      }
      for (const ventana of ventanas) {
        if ('navigate' in ventana) return ventana.navigate(destino).then((v) => v && v.focus())
      }
      return self.clients.openWindow(destino)
    }),
  )
})
