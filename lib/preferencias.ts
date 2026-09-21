/**
 * Preferencias de lectura que viajan en cookie: el servidor las necesita para
 * pintar la pantalla ya como el usuario la dejó, y el cliente para escribirlas.
 * Viven en su propio módulo porque las tocan los dos lados.
 */

/** Meses plegados por lista. Ver `lib/meses-plegados.ts` y `components/meses.tsx`. */
export const COOKIE_MESES = 'haaco_meses'

/**
 * Si el alta de un pago en Cobranza viene con la casilla del recibo marcada.
 *
 * Vive en el navegador y no en cookie: no hay nada que pintar en el servidor
 * con esto, sólo con qué abre el diálogo. Cada quien la deja como trabaja —hay
 * clientes que piden su papel siempre y otros que nunca— y el sistema la
 * respeta la próxima vez.
 */
export const PREF_RECIBO_COBRANZA = 'haaco_recibo_cobranza'
