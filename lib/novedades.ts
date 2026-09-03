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
/** Dónde está el cambio, en porcentaje del ancho y alto de la imagen. */
export type Marca = { x: number; y: number }

/** Una captura ya optimizada bajo public/novedades/<version>/. */
export type Captura = {
  /** Ruta pública: '/novedades/2026-08-12/gastos-concepto-escritorio.webp'. */
  ruta: string
  /** Medidas intrínsecas del WebP: reservan el hueco y la lámina no salta. */
  ancho: number
  alto: number
  /** Sin marca, la captura habla por sí sola. */
  marca?: Marca
}

/**
 * La imagen que acompaña a una novedad. La app no se ve igual en el teléfono
 * que en la computadora, así que cada tamaño trae su propia captura —con su
 * propia marca, porque el mismo botón vive en otro lugar—. Si sólo hay una,
 * se enseña en los dos tamaños. Al menos una de las dos debe venir.
 */
export type Figura = {
  /** Pie de foto y texto alternativo: qué se está viendo. */
  pie: string
  movil?: Captura
  escritorio?: Captura
}

export type Novedad = {
  /** Dónde vive, dicho como se llama en el menú. */
  donde: string
  titulo: string
  texto: string
  /** A quién le sirve: a los demás ni se les enseña. */
  roles: RolUsuario[]
  /** Opcional: las entregas viejas no traen imagen y no pasa nada. */
  figura?: Figura
}

export type Entrega = {
  /** La marca que decide si el aviso vuelve a salir. */
  version: string
  fecha: string
  novedades: Novedad[]
}

const OFICINA: RolUsuario[] = ['admin', 'administracion']
const TODOS: RolUsuario[] = ['admin', 'administracion', 'contador', 'cuadrilla']

const DEL_3_DE_SEPTIEMBRE: Novedad[] = [
  {
    donde: 'Cotizaciones',
    titulo: 'Los términos y condiciones ya se escriben desde aquí',
    texto:
      'Al pie de la cotización, junto a las notas, hay un cuadro de «Términos y condiciones». Lo que escribas ahí sale al final del PDF, debajo de la firma y en letra chica, que es donde le toca ir —hasta hoy sólo cabía metiéndolo en la línea de calidad y salía a media hoja—. Cada cotización lleva los suyos y se pueden cambiar sin tocar las demás. Si un texto es el que vas a usar siempre, el botón «Dejar estos como los de siempre» lo guarda para las cotizaciones nuevas; «Volver a los de siempre» te regresa a él si lo cambiaste de más. Una cotización de antes llega en blanco y no imprime el bloque: el botón «Poner los de siempre» se lo pone.',
    roles: OFICINA,
  },
  {
    donde: 'Toda la app',
    titulo: 'En el celular y en el iPad la app vuelve a responder',
    texto:
      'A quien la abría desde el icono de la pantalla de inicio se le quedaba muerta: se veía todo bien pero no había forma de tocar nada, ni de quitar el aviso de novedades. Era la pantalla verde de bienvenida, que se desvanecía a la vista pero seguía puesta encima tapando los toques. Ya se aparta de verdad.',
    roles: TODOS,
  },
]

const DEL_26_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Obras · Contratos',
    titulo: 'Un oficial puede llevar varios pagarés',
    texto:
      'Antes, en cuanto un contrato tenía un pagaré ya no dejaba firmar otro —ni siquiera si ese primero estaba cancelado y la herramienta ya había vuelto al taller—. Ahora el botón sigue ahí siempre: dice «Otro pagaré» y arma uno nuevo con lo que se lleva esta vez. Cada pagaré se ve por separado en el contrato, con su fecha, su valor y su PDF, y en Documentos salen todos en la lista.',
    roles: OFICINA,
  },
  {
    donde: 'Obras · Contratos',
    titulo: 'El pagaré se corrige sin tener que cancelarlo',
    texto:
      'Si al capturarlo se coló una herramienta de más o faltó alguna, ya no hay que cancelar todo y volver a empezar: en el pagaré hay un botón «Corregir» que abre la misma lista con lo que trae marcado. Lo que quitas regresa al taller y deja de contar en el valor del pagaré; lo que agregas sale con el oficial. Ojo con la diferencia: «Devolver» es que el oficial trajo la herramienta de vuelta y el renglón se queda tachado; «Corregir» es que ese renglón nunca debió estar. Sólo se corrigen los pagarés activos, y una herramienta no puede quedar prestada en dos pagarés a la vez.',
    roles: OFICINA,
  },
]

const DEL_25_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Servicios',
    titulo: 'Las reparaciones de portones ya se llevan en la app',
    texto:
      'Hay una pantalla nueva para los servicios a portones eléctricos, la que se llevaba en su propia hoja de Excel. Se agenda la visita con el día y la hora en que puede ir el técnico, se anota lo que encontró, se arma el presupuesto y, cuando el cliente dice que sí, se marca reparado y se cobra. Cada servicio enseña en qué paso va y qué toca hacer ahora, con un solo botón grande.',
    roles: OFICINA,
  },
  {
    donde: 'Servicios',
    titulo: 'La cita del técnico te la recuerda el teléfono',
    texto:
      'Al agendar una visita queda apuntada sola: sale en «lo que toca hoy» del tablero con su hora y llega como aviso al teléfono a las siete de la mañana, igual que los recordatorios de las cotizaciones. Si cambias el día, el aviso se mueve con él —no se duplica—, y en cuanto capturas el diagnóstico deja de sonar. También se puede pasar al Google Calendar de un toque.',
    roles: OFICINA,
  },
  {
    donde: 'Servicios',
    titulo: 'El presupuesto se manda por WhatsApp con su folio',
    texto:
      'Las reparaciones llevan su propia serie de folios —S-1, S-2— aparte de las cotizaciones. El presupuesto sale en PDF con el membrete de siempre, con el diagnóstico impreso arriba para que se vea de dónde sale el precio, y con la garantía y la vigencia al pie. Se abre, se descarga o se manda directo al cliente por WhatsApp.',
    roles: OFICINA,
  },
  {
    donde: 'Servicios',
    titulo: 'La visita se cobra aunque el cliente no acepte',
    texto:
      'Cada servicio nace con los $400 de la visita puestos, y se pueden cambiar o dejar en cero cuando no se le cobran. Si el cliente aprueba, los $400 van dentro del total; si dice que no, el servicio se queda debiendo nada más la visita y sale un botón para cobrarla —antes ese dinero no aparecía por ningún lado—. En el presupuesto que se le manda, la visita va como un renglón más y una condición dice que se cubre aun cuando no acepte.',
    roles: OFICINA,
  },
  {
    donde: 'Servicios',
    titulo: 'Los trabajos grandes ya admiten anticipo',
    texto:
      'En cuanto el cliente aprueba se puede registrar un cobro, sin esperar a que el trabajo quede. El servicio se marca «Con anticipo» y sigue debiendo el resto, que se cobra al terminar como siempre. En el papel del presupuesto se dice que en trabajos mayores se pide anticipo para surtir el material.',
    roles: OFICINA,
  },
  {
    donde: 'Servicios',
    titulo: 'El preventivo de seis meses se agenda de un botón',
    texto:
      'Al cerrar una reparación aparece «Agendar el preventivo» con la fecha ya contada seis meses adelante. Se toca y queda la visita agendada con el mismo cliente, el mismo domicilio y su aviso, sin capturar nada. De cada portón sale un solo preventivo, así que no se duplica, y en la lista hay un filtro para verlos todos juntos.',
    roles: OFICINA,
  },
  {
    donde: 'Inicio',
    titulo: 'Lo que se cobra de reparaciones ya cuenta en el dinero',
    texto:
      'Una reparación aprobada suma a lo vendido del mes y lo que falta de ella entra en el por cobrar, igual que una obra. En Cobranza tiene su propio bloque abajo —un portón no lleva anticipo ni abonos, se cobra al terminar—, pero los totales de arriba ya lo traen dentro. En el cierre del contador va en su renglón aparte, para que la utilidad de obra siga midiéndose contra las obras.',
    roles: OFICINA,
  },
  {
    donde: 'Al abrir la app',
    titulo: 'La app instalada abre con el logo levantándose',
    texto:
      'A quien tiene HaacoPro agregada a la pantalla de inicio, ahora le abre con el logo dibujándose solo: primero el trazo de abajo, luego las columnas subiendo una tras otra y al final el nombre. Dura dos segundos y se quita solo; no hay que tocar nada ni esperar. Es sólo para la app instalada: si entras desde el navegador, todo sigue igual que siempre. Y a quien tenga puesto en su teléfono que las animaciones le molestan, le sale el logo ya puesto, sin movimiento.',
    roles: TODOS,
  },
]

const DEL_18_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Gastos',
    titulo: 'El ahorro del ticket ya no se descuenta dos veces',
    texto:
      'Hay tickets donde los precios ya vienen rebajados y de todos modos anuncian el ahorro al pie —el «Ahorro por promoción» de las tiendas de pintura—. La foto lo restaba otra vez y los conceptos salían cortos por ese monto. Ahora manda el total: si la cuenta del papel no cierra restando el descuento, es que ya venía incluido y se respeta. En el renglón del comprobante lo dice, «ya incluido», para que se vea de dónde salió la suma.',
    roles: OFICINA,
  },
  {
    donde: 'Gastos',
    titulo: 'Los conceptos del ticket se capturan como vienen impresos',
    texto:
      'En cada concepto va el importe tal como lo dice el papel, sin el IVA encima: así se compara de un vistazo contra el renglón de la factura. El IVA que le toca se anota abajo del importe, chiquito, junto con lo que suma —y eso último es lo que se guarda como gasto—. Si corriges un importe, su IVA se rehace solo. Las piezas ya no ocupan media pantalla: quedan en una casilla angosta con su «pzas» al lado, y el ancho se va al importe.',
    roles: OFICINA,
  },
  {
    donde: 'Inicio',
    titulo: 'Lo vendido se cuenta en el mes en que el cliente dijo que sí',
    texto:
      'Antes la venta se anotaba en el mes en que se escribió la cotización, no en el que se aprobó: una cotización de julio que el cliente aceptó en agosto sumaba a julio, y agosto se veía flojo sin serlo. Ahora manda la fecha de aprobación. Con eso, agosto pasa de $124,701 a $346,749 y del 24% al 65% de la meta: son tres obras que ya estaban vendidas y no se veían. De pasada, el mes deja de cambiar solo a las cinco de la tarde del último día.',
    roles: OFICINA,
  },
  {
    donde: 'Cobranza',
    titulo: 'El por cobrar ya cuadra con sumar la lista a mano',
    texto:
      'Cuando un cliente paga de más, ese saldo a favor se estaba restando de lo que deben los demás, así que el total nunca daba lo mismo que sumar los renglones de la lista. Ya no: por cobrar es la suma de lo que deben y nada más, y lo pagado de más se dice aparte. Son $301,784 en lugar de $290,350. El panel y la pantalla de cobranza ahora enseñan el mismo número, que antes tampoco pasaba.',
    roles: OFICINA,
  },
]

const DEL_13_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Cotizaciones',
    titulo: 'La utilidad de herrería ya se calcula sobre el precio',
    texto:
      'Si le pones 35 de utilidad a un concepto de herrería, ahora el 35% del precio de venta es lo que queda de ganancia, como se saca a mano en obra. Antes el sistema nada más le sumaba el 35 al costo, y en el precio real la utilidad quedaba más chica. Con los mismos números, el precio sale más arriba. Y los materiales del rubro «Otro» ya entran al precio: antes se veían en la pantalla pero se caían al guardar.',
    roles: OFICINA,
    figura: {
      pie: 'El concepto de herrería: con 35 de utilidad, el precio de venta ya es el que deja ese porcentaje.',
      movil: {
        ruta: '/novedades/2026-08-13/herreria-utilidad-movil.webp',
        ancho: 1080,
        alto: 2340,
        marca: { x: 77.8, y: 50.0 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-13/herreria-utilidad-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 63.7, y: 50.0 },
      },
    },
  },
  {
    donde: 'Gastos',
    titulo: 'Págalo de caja chica y el saldo baja solo',
    texto:
      'En Método ya aparece «Caja chica». El gasto se captura como siempre y su salida queda anotada sola en la caja, con el saldo descontado al momento: se acabó capturarlo dos veces. Si el gasto se corrige o se borra, la caja se ajusta con él. En la pantalla de caja chica esos movimientos salen marcados «Desde gastos».',
    roles: OFICINA,
    figura: {
      pie: 'El gasto nuevo con método «Caja chica»: siempre de contado, y el saldo de la caja baja solo.',
      movil: {
        ruta: '/novedades/2026-08-13/gasto-caja-movil.webp',
        ancho: 1080,
        alto: 2340,
        marca: { x: 50.0, y: 65.1 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-13/gasto-caja-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 39.9, y: 75.3 },
      },
    },
  },
  {
    donde: 'Cotizaciones',
    titulo: 'El nombre de la pintura se pone solo en la descripción',
    texto:
      'Los renglones del proceso que traen {PRODUCTO} ya no se llenan a mano: al elegir la pintura de la partida, el renglón de pintura toma su nombre solito, y si cambias de pintura se corrige. Para el sellador, el esmalte o el impermeabilizante, cada renglón trae una lista para escoger su producto del catálogo de un toque. Ya no se va ninguna cotización con el hueco sin llenar.',
    roles: OFICINA,
    figura: {
      pie: 'El renglón de sellador con su lista «Poner producto…» para escoger la cubeta del catálogo.',
      movil: {
        ruta: '/novedades/2026-08-13/producto-bullets-movil.webp',
        ancho: 1080,
        alto: 2340,
        marca: { x: 48.6, y: 48.9 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-13/producto-bullets-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 45.4, y: 35.5 },
      },
    },
  },
]

const DEL_12_DE_AGOSTO: Novedad[] = [
  {
    donde: 'Gastos',
    titulo: 'El concepto que se te ofrece ya es el de la obra que elegiste',
    texto:
      'Antes la lista traía los conceptos de todas las órdenes juntos, y como se repiten los nombres era fácil cargarle el gasto a la obra que no era. Ahora sólo salen los de la obra que pusiste arriba. Y aunque se intente por otro lado, el sistema ya no deja guardar un gasto en el concepto de otra obra.',
    roles: OFICINA,
    figura: {
      pie: 'El formulario de gasto: con la obra ya puesta, en Concepto sólo salen los de esa obra.',
      movil: {
        ruta: '/novedades/2026-08-12/gastos-concepto-movil.webp',
        ancho: 1080,
        alto: 2341,
        marca: { x: 50.0, y: 56.6 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-12/gastos-concepto-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 38.8, y: 51.1 },
      },
    },
  },
  {
    donde: 'Obras',
    titulo: 'El material que sacas del taller entra con IVA',
    texto:
      'Al sacar un insumo del taller a una obra, el renglón queda por lo que de verdad se pagó —impuesto incluido—, que es la cifra que el propio recuadro te enseña antes de darle. Antes entraba sin el impuesto y la obra se veía más barata de lo que salió. Lo que ya estaba capturado también se corrigió: 48 renglones en siete órdenes.',
    roles: OFICINA,
    figura: {
      pie: 'La salida del taller avisa cuánto se cargará a la obra: el costo con IVA, el de verdad.',
      movil: {
        ruta: '/novedades/2026-08-12/taller-iva-movil.webp',
        ancho: 1080,
        alto: 2341,
        marca: { x: 45.8, y: 84.6 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-12/taller-iva-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 44.7, y: 69.1 },
      },
    },
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
    figura: {
      pie: 'La vista «Concentrado»: una sola lista corrida, sin cortes por mes.',
      movil: {
        ruta: '/novedades/2026-08-11/cotizaciones-corrida-movil.webp',
        ancho: 1080,
        alto: 2341,
        marca: { x: 39.7, y: 43.5 },
      },
      escritorio: {
        ruta: '/novedades/2026-08-11/cotizaciones-corrida-escritorio.webp',
        ancho: 1600,
        alto: 1000,
        marca: { x: 31.9, y: 27.6 },
      },
    },
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
    figura: {
      pie: 'El inicio nuevo. En el teléfono, el «+» de abajo crea cotización, obra o gasto.',
      movil: {
        ruta: '/novedades/2026-08-11/inicio-boton-movil.webp',
        ancho: 1080,
        alto: 2341,
        marca: { x: 88.6, y: 87.3 },
      },
      // El «+» sólo vive en el teléfono: en la computadora la captura habla sola.
      escritorio: {
        ruta: '/novedades/2026-08-11/inicio-boton-escritorio.webp',
        ancho: 1600,
        alto: 1000,
      },
    },
  },
]

/** De la más nueva a la más vieja: la primera es la que se abre. */
export const ENTREGAS: Entrega[] = [
  { version: '2026-09-03', fecha: '3 de septiembre de 2026', novedades: DEL_3_DE_SEPTIEMBRE },
  { version: '2026-08-26', fecha: '26 de agosto de 2026', novedades: DEL_26_DE_AGOSTO },
  { version: '2026-08-25', fecha: '25 de agosto de 2026', novedades: DEL_25_DE_AGOSTO },
  { version: '2026-08-18', fecha: '18 de agosto de 2026', novedades: DEL_18_DE_AGOSTO },
  { version: '2026-08-13', fecha: '13 de agosto de 2026', novedades: DEL_13_DE_AGOSTO },
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
