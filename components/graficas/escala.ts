/**
 * Aritmética de las gráficas: dónde cae cada cosa y cómo se dibuja una barra.
 *
 * Son funciones puras, sin React ni SVG, para que las use igual un componente
 * de servidor que uno de cliente.
 */

/** El techo de la escala, con un respiro arriba para que nada toque el borde. */
export function topeDe(valores: number[], holgura = 1.08): number {
  return Math.max(1, ...valores.map((v) => Math.abs(v))) * holgura
}

/**
 * Las marcas del eje vertical, de arriba hacia abajo. Tres bastan para dar
 * escala sin ensuciar el dibujo.
 */
export function marcasY(tope: number, cuantas = 3): number[] {
  return Array.from({ length: cuantas }, (_, i) => (tope * (cuantas - 1 - i)) / (cuantas - 1))
}

/** $530k, $8.2k o $640: la escala se lee de reojo, no se audita. */
export function etiquetaEscala(valor: number): string {
  const v = Math.abs(valor)
  if (v >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `$${Math.round(valor / 1000)}k`
  if (v >= 1000) return `$${(valor / 1000).toFixed(1)}k`
  return `$${Math.round(valor)}`
}

export type LadoRedondeado = 'arriba' | 'abajo' | 'ambos' | 'ninguno'

/**
 * Barra con las esquinas redondeadas sólo del lado que se pide.
 *
 * La punta que sale del eje se redondea y la que se apoya en él queda a ras:
 * una barra con las cuatro esquinas redondas flota y deja de leerse contra la
 * línea del cero. En una columna apilada, además, sólo el segmento de hasta
 * arriba lleva curva.
 */
export function trazoBarra(
  x: number,
  y: number,
  ancho: number,
  alto: number,
  lado: LadoRedondeado = 'arriba',
  radioMax = 4,
): string {
  const h = Math.max(0.5, alto)
  const r = Math.max(0, Math.min(radioMax, h / 2, ancho / 2))
  const x2 = x + ancho
  const y2 = y + h

  if (r === 0 || lado === 'ninguno') return `M${x} ${y} H${x2} V${y2} H${x} Z`

  const arriba = lado === 'arriba' || lado === 'ambos'
  const abajo = lado === 'abajo' || lado === 'ambos'

  const partes = [
    arriba
      ? `M${x} ${y + r} Q${x} ${y} ${x + r} ${y} H${x2 - r} Q${x2} ${y} ${x2} ${y + r}`
      : `M${x} ${y} H${x2}`,
    abajo
      ? `V${y2 - r} Q${x2} ${y2} ${x2 - r} ${y2} H${x + r} Q${x} ${y2} ${x} ${y2 - r}`
      : `V${y2} H${x}`,
    'Z',
  ]
  return partes.join(' ')
}

/**
 * Reparte los segmentos de una columna apilada de abajo hacia arriba.
 *
 * Devuelve la geometría de cada tramo con un hueco de 2 px entre uno y otro:
 * el aire separa mejor que un contorno y no engorda el dibujo. Los tramos en
 * cero desaparecen —no dejan ni la ranura— y el último con altura se lleva la
 * punta redondeada.
 */
export function apilar(
  valores: number[],
  tope: number,
  alto: number,
  base = alto,
  hueco = 2,
): { y: number; alto: number; corona: boolean }[] {
  const conAltura = valores.map((v) => (v > 0 ? Math.max(1.5, (v / tope) * alto) : 0))
  const ultimo = conAltura.reduce((ult, h, i) => (h > 0 ? i : ult), -1)

  let cursor = base
  return conAltura.map((h, i) => {
    if (h === 0) return { y: cursor, alto: 0, corona: false }
    const y = cursor - h
    cursor = y - hueco
    return { y, alto: h, corona: i === ultimo }
  })
}
