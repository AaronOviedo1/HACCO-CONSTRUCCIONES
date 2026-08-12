import type { RolUsuario } from '@/types/database'

/**
 * Lo nuevo de cada entrega, contado como se lo contarías a quien lo va a usar.
 *
 * La regla al escribir aquí: nada de nombres de pantallas, tablas ni botones
 * que no existan a la vista. Cada renglón responde una sola pregunta —«¿qué
 * puedo hacer hoy que ayer no?»— y se lee en voz alta sin tropezar.
 *
 * Las entregas van de la más nueva a la más vieja. La de arriba es la que se
 * abre; las anteriores quedan plegadas, porque quien ya las leyó no tiene por
 * qué volver a pasarles por encima y quien no, sigue teniendo dónde.
 *
 * Al cambiar la versión de la primera entrega, el aviso vuelve a salir una vez
 * a cada quien. Es una fecha y no un número: si alguien pregunta «¿de cuándo es
 * esto?», ya está contestado.
 */
export type Novedad = {
  /** Dónde vive, dicho como se llama en el menú. */
  donde: string
  titulo: string
  texto: string
  /** A quién le sirve: a los demás ni se les enseña. */
  roles: RolUsuario[]
}

export type Entrega = {
  /** La marca que decide si el aviso vuelve a salir. */
  version: string
  fecha: string
  novedades: Novedad[]
}

const OFICINA: RolUsuario[] = ['admin', 'administracion']

const DEL_12_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Gastos',
    titulo: 'El concepto que se te ofrece ya es el de la obra que elegiste',
    texto:
      'Antes la lista traía los conceptos de todas las órdenes juntos, y como se repiten los nombres era fácil cargarle el gasto a la obra que no era. Ahora sólo salen los de la obra que pusiste arriba. Y aunque se intente por otro lado, el sistema ya no deja guardar un gasto en el concepto de otra obra.',
    roles: OFICINA,
  },
  {
    donde: 'Obras',
    titulo: 'El material que sacas del taller entra con IVA',
    texto:
      'Al sacar un insumo del taller a una obra, el renglón queda por lo que de verdad se pagó —impuesto incluido—, que es la cifra que el propio recuadro te enseña antes de darle. Antes entraba sin el impuesto y la obra se veía más barata de lo que salió. Lo que ya estaba capturado también se corrigió: 48 renglones en siete órdenes.',
    roles: OFICINA,
  },
]

const DEL_11_DE_AGOSTO: Novedad[] = [
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

/** De la más nueva a la más vieja: la primera es la que se abre. */
export const ENTREGAS: Entrega[] = [
  { version: '2026-08-12', fecha: '12 de agosto de 2026', novedades: DEL_12_DE_AGOSTO },
  { version: '2026-08-11', fecha: '11 de agosto de 2026', novedades: DEL_11_DE_AGOSTO },
]

export const VERSION_NOVEDADES = ENTREGAS[0].version

export const FECHA_NOVEDADES = ENTREGAS[0].fecha

/**
 * Las entregas que le tocan a un rol, sin las que se le quedarían en blanco:
 * un apartado plegado que al abrirlo no dice nada es peor que no estar.
 */
export const entregasDe = (rol: RolUsuario): Entrega[] =>
  ENTREGAS.map((e) => ({ ...e, novedades: e.novedades.filter((n) => n.roles.includes(rol)) }))
    .filter((e) => e.novedades.length > 0)
