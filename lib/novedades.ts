import type { RolUsuario } from '@/types/database'

/**
 * Lo nuevo de esta versión, contado como se lo contarías a quien lo va a usar.
 *
 * La regla al escribir aquí: nada de nombres de pantallas, tablas ni botones
 * que no existan a la vista. Cada renglón responde una sola pregunta —«¿qué
 * puedo hacer hoy que ayer no?»— y se lee en voz alta sin tropezar.
 *
 * Al cambiar `VERSION`, el aviso vuelve a salir una vez a cada quien. Es una
 * fecha y no un número: si alguien pregunta «¿de cuándo es esto?», ya está
 * contestado.
 */
export const VERSION_NOVEDADES = '2026-08-11'

export const FECHA_NOVEDADES = '11 de agosto de 2026'

export type Novedad = {
  /** Dónde vive, dicho como se llama en el menú. */
  donde: string
  titulo: string
  texto: string
  /** A quién le sirve: a los demás ni se les enseña. */
  roles: RolUsuario[]
}

const OFICINA: RolUsuario[] = ['admin', 'administracion']

export const NOVEDADES: Novedad[] = [
  {
    donde: 'Nómina',
    titulo: 'Págale por porcentaje, no nada más por cantidad',
    texto:
      'Escribe 30 % y el sistema saca solo cuánto es de ese contrato. Si prefieres poner la cantidad directa, se sigue pudiendo: hay un botoncito para cambiar entre $ y %.',
    roles: OFICINA,
  },
  {
    donde: 'Nómina',
    titulo: 'El recibo se le manda por WhatsApp',
    texto:
      'Después de pagarle, un botón manda el recibo al chat del trabajador. Ya no hay que imprimirlo ni pasárselo a mano.',
    roles: OFICINA,
  },
  {
    donde: 'Nómina',
    titulo: 'Lo que ya quedó pagado deja de estorbar',
    texto:
      'Cuando a un contrato ya no se le debe nada, se sale de la lista para que sólo veas lo que falta por pagar. No se borra: está en «Saldados», a un toque.',
    roles: OFICINA,
  },
  {
    donde: 'Nómina',
    titulo: 'Un abono mal capturado ya se corrige',
    texto:
      'Si le pusiste de más, de menos, o se lo cargaste a quien no era, se arregla o se cancela. Lo que le quedaba por cobrar y sus préstamos vuelven solos a donde estaban.',
    roles: OFICINA,
  },
  {
    donde: 'Cotizaciones',
    titulo: 'Ponle fecha para acordarte de hablarle al cliente',
    texto:
      'Le pones fecha y una nota a la cotización. Ese día te aparece en la pantalla de inicio y el teléfono te avisa, aunque no tengas la app abierta. Si quieres, también se agrega a tu Google Calendar.',
    roles: OFICINA,
  },
  {
    donde: 'Cotizaciones',
    titulo: 'La lista corrida, sin cortarla por meses',
    texto:
      'El concentrado ya no parte todo por mes. Es una sola lista, con lo que sigue vivo, en el mismo orden en que se fue capturando.',
    roles: ['admin', 'administracion', 'contador'],
  },
  {
    donde: 'Obras',
    titulo: 'Todo lo que capturas se puede corregir',
    texto:
      'Los datos de la obra, el material que se compró, la caja chica, los avances y las notas de bitácora ya se editan y se borran. Antes se capturaban y ahí se quedaban. Queda anotado quién lo cambió y cuándo.',
    roles: OFICINA,
  },
  {
    donde: 'Catálogo',
    titulo: 'Cada material te dice a cómo lo pagaste la última vez',
    texto:
      'Abre cualquier producto y arriba de las notas verás cuánto costó la última vez, de qué factura salió y hace cuántos días. Abajo, los precios de antes, para ver cómo se ha ido moviendo.',
    roles: OFICINA,
  },
  {
    donde: 'Catálogo',
    titulo: 'Si corriges un precio, el anterior ya no se pierde',
    texto:
      'Cuando le hablas al proveedor y te dan otro precio, lo cambias como siempre. La diferencia es que ahora el precio viejo se queda apuntado, con la fecha y con tu nombre. Y cada factura que capturas va dejando el suyo sola.',
    roles: OFICINA,
  },
  {
    donde: 'Gastos',
    titulo: 'La factura de insumos entra al taller de una vez',
    texto:
      'Capturas la factura del proveedor y el material se da de alta en el taller sin volver a teclearlo. Y si es a crédito, se abre una sola cuenta por pagar y no una por cada renglón.',
    roles: OFICINA,
  },
  {
    donde: 'En todas',
    titulo: 'La pantalla de inicio y el botón de crear',
    texto:
      'El inicio se lee de un vistazo, sin sacar cuentas. Y abajo hay un «+» para cotizar, abrir una obra o capturar un gasto sin ir a buscarlo al menú.',
    roles: ['admin', 'administracion', 'contador'],
  },
]

export const novedadesDe = (rol: RolUsuario) => NOVEDADES.filter((n) => n.roles.includes(rol))
