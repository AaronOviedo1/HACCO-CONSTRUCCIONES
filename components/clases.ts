/**
 * Clases de Tailwind que se repiten tal cual en decenas de sitios.
 *
 * Son cadenas y no componentes a propósito: cada botón conserva su `type`, su
 * `onClick` y su `disabled` donde ya estaban, y sólo deja de copiarse la lista
 * de clases. El archivo no lleva 'use client' para que sirva igual en
 * componentes de servidor y de navegador.
 *
 * Si un botón necesita una clase de más (`inline-flex`, `mr-auto`…), se
 * compone: `className={`mr-auto ${BOTON_SECUNDARIO}`}`.
 */

/** «Cancelar» y demás acciones secundarias del pie de un diálogo. */
export const BOTON_SECUNDARIO =
  'rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50'

/** «Guardar», «Registrar»: la acción principal del pie de un diálogo. */
export const BOTON_PRIMARIO =
  'rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300'

/**
 * Las pestañas de escritorio (`<nav>` de catálogo, cobranza, nómina…), para
 * `EnlacePestana`: la base y lo que cambia según esté puesta o no.
 */
export const CLASE_PESTANA = 'rounded-lg px-3 py-2 text-sm font-medium transition'
export const PESTANA_ACTIVA = 'bg-haaco-700 text-white'
export const PESTANA_INACTIVA = 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
