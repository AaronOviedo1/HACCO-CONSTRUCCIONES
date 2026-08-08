/**
 * Colores de las gráficas del tablero.
 *
 * No se eligen a ojo: cada juego pasó el validador de paleta (banda de
 * luminosidad, piso de croma, separación bajo daltonismo y contraste contra el
 * fondo). Si se toca un tono hay que volver a correrlo:
 *
 *   node scripts/validate_palette.js "#10462c,#2d8a56,#7fc19b" --mode light --ordinal
 *
 * Van en hexadecimal y no como `var(--color-haaco-…)` porque varios entran
 * dentro del `fill` de un SVG y en atributos de estilo donde la variable de
 * Tailwind no siempre resuelve.
 */

/**
 * Cotizaciones del mes, de lo cerrado a lo perdido. Es una escala ordenada de
 * un solo verde: el tono dice qué tan cerca quedó el trato, no de qué se trata.
 */
export const COTIZACIONES = {
  vendido: '#10462c',
  enJuego: '#2d8a56',
  enfriado: '#7fc19b',
} as const

/** Dinero que entra contra el que sale. Verde y azul se distinguen sin color. */
export const FLUJO = {
  entra: '#2d8a56',
  sale: '#075985',
} as const

/**
 * Los tres cajones en los que se va el dinero de una obra, y las tres fuentes
 * de las que salen los pagos de la semana. Es la misma terna a propósito: mano
 * de obra y nómina son lo mismo visto de dos lados.
 */
export const RUBROS = {
  manoObra: '#2d8a56',
  material: '#075985',
  otros: '#b45309',
} as const

/**
 * Antigüedad de la cobranza. El «al día» es el verde de la casa; la mora es una
 * escala de un solo naranja que se va oscureciendo.
 *
 * El primer tramo de mora queda en 2.2:1 contra el fondo, por debajo del piso
 * de 3:1, así que sus barras llevan la cifra escrita al lado a fuerza: el color
 * solo no basta para leerlas.
 */
export const MORA = {
  alDia: '#2d8a56',
  reciente: '#fb923c',
  media: '#ea580c',
  vieja: '#9a3412',
} as const

/** Gris de la rejilla y de las pistas de fondo, un paso arriba del papel. */
export const CHROME = {
  rejilla: 'var(--color-tinta-100)',
  eje: 'var(--color-tinta-200)',
  pista: 'var(--color-tinta-150)',
} as const
