import type { CSSProperties } from 'react'
import { LOGO_CAJA, LOGO_TRAZO, WORDMARK_CAJA, WORDMARK_TRAZO } from '@/lib/marca'

/**
 * Pantalla de entrada de la PWA instalada: el imagotipo se levanta como lo que
 * dibuja —una estructura— y se aparta solo.
 *
 * Va sin una línea de JavaScript, y es a propósito. Quién la ve lo decide
 * `@media (display-mode: standalone)` y cuándo se va, una animación con
 * `forwards` que acaba en `visibility: hidden`. Si dependiera de un efecto de
 * React y la hidratación fallara, esta pantalla taparía la app para siempre.
 * El respaldo `html[data-standalone]` cubre los iPhone anteriores a iOS 16.4,
 * que no entienden esa media query (ver el script de app/layout.tsx).
 *
 * Cuelga del layout raíz, no del shell autenticado: así también cubre el login
 * y no espera a que Supabase resuelva la sesión.
 *
 * ---------------------------------------------------------------------------
 * Cómo se anima un dibujo que no tiene piezas
 *
 * El símbolo del manual es UN trazado y UNA sola componente conexa: las seis
 * astas y los tres travesaños están unidos por el barrido del suelo, así que no
 * hay nada que animar por separado. Redibujarlo por partes sería cambiar los
 * trazos del diseñador por una copia.
 *
 * Lo que se hace en vez de eso: se dibuja SIEMPRE el trazo original —tantas
 * veces como piezas, con `<use>`— y cada copia se recorta a su región. Animando
 * el recorte se revela la pieza sin tocar ni un punto del dibujo. Las regiones
 * salen de las coordenadas literales del trazado (abajo van anotadas una a una)
 * y se solapan un pelo para que no queden costuras de antialias entre ellas.
 * La unión de las regiones reconstruye el símbolo con 0,024/255 de diferencia
 * media y 0,036 % de píxeles distintos: lo que se ve al final es el original.
 * ---------------------------------------------------------------------------
 */

/**
 * Las seis astas. `x0`/`x1` es la franja de cada columna —las fronteras van a
 * medio camino entre asta y asta— y `base`, la altura a la que el asta se funde
 * con el suelo, leída del propio trazado. Crecen desde ahí.
 */
const ASTAS = [
  { x0: -2.3,  ancho: 13.2,  base: 193.2 }, // asta 1 · L 5.24 192.6
  { x0: 10.3,  ancho: 16.6,  base: 187.5 }, // asta 2 · L 16.04 186.9
  { x0: 26.3,  ancho: 11.24, base: 179.77 }, // asta 3 · L 32 179.17
  { x0: 98.23, ancho: 11.17, base: 155.02 }, // asta 4 · C … 103.75 154.42
  { x0: 108.8, ancho: 16.7,  base: 152.67 }, // asta 5 · L 114.55 152.07
  { x0: 124.9, ancho: 15.4,  base: 149.88 }, // asta 6 · L 130.6 149.28
]

/**
 * Los tres travesaños de la ventana central, de abajo arriba: se tienden en ese
 * orden, como se levanta una obra. Cada uno es un paralelogramo que envuelve su
 * banda sin rozar la vecina; las `y` están medidas en los dos bordes de la
 * ventana (x 37,24 y x 98,53), donde las bandas reales caen así:
 *   travesaño de abajo  der 94,50–99,75  izq 106,88–112,63
 *   travesaño de enmedio der 77,63–82,88  izq  89,75– 95,50
 *   travesaño de arriba  der 61,13–66,38  izq  74,25– 80,00
 */
const VENTANA = { xi: 36.94, xd: 98.83 }
const VIGAS = [
  { yi0: 103.2, yd0: 90.2, yd1: 103.3, yi1: 116.8 },
  { yi0: 86.2,  yd0: 73.2, yd1: 86.3,  yi1: 99.8 },
  { yi0: 69.2,  yd0: 55.7, yd1: 69.3,  yi1: 82.8 },
]
/**
 * `holgura` ensancha el paralelogramo por los dos lados. Va a 0 en el recorte
 * que define la pieza —ahí tiene que morder justo, o al tenderse el travesaño
 * asomaría un trozo del asta vecina— y a 12 en el hueco que se le abre a la
 * máscara del suelo: así los cantos verticales de la máscara caen debajo de los
 * rectángulos de las astas en vez de quedar al aire sobre el fondo, donde su
 * antialias dejaba una raya de un píxel al 6 % de opacidad. */
const vigaPath = (v: (typeof VIGAS)[number], holgura = 0) => {
  const xi = VENTANA.xi - holgura
  const xd = VENTANA.xd + holgura
  return `M ${xi} ${v.yi0} L ${xd} ${v.yd0} L ${xd} ${v.yd1} L ${xi} ${v.yi1} Z`
}

/** El recorte de cada asta sube hasta −6 y no hasta 0: el resorte de subida se
 *  pasa un 1,5 % de largo antes de asentarse, y si el recorte acabara en el
 *  filo del dibujo ese sobrepaso le cortaría la punta. */
const TECHO = -6

export function Splash() {
  return (
    <div className="hp-splash" aria-hidden>
      <div className="hp-marca">
        <svg
          className="hp-simbolo"
          viewBox={`0 0 ${LOGO_CAJA.ancho} ${LOGO_CAJA.alto}`}
          fill="currentColor"
        >
          <defs>
            <path id="hp-trazo" d={LOGO_TRAZO} />

            {/* El suelo es «todo lo demás»: el lienzo entero menos las regiones
                de astas y travesaños, que se animan por su cuenta. */}
            <mask id="hp-reg-suelo" maskUnits="userSpaceOnUse" x="-3" y="-3" width="171" height="208">
              <rect x="-3" y="-3" width="171" height="208" fill="#fff" />
              {ASTAS.map((a, i) => (
                <rect key={i} x={a.x0} y={TECHO} width={a.ancho} height={a.base - TECHO} fill="#000" />
              ))}
              {VIGAS.map((v, j) => (
                <path key={j} d={vigaPath(v, 12)} fill="#000" />
              ))}
            </mask>

            {ASTAS.map((a, i) => (
              <clipPath key={i} id={`hp-reg-a${i}`}>
                <rect x={a.x0} y={TECHO} width={a.ancho} height={a.base - TECHO} />
              </clipPath>
            ))}
            {VIGAS.map((v, j) => (
              <clipPath key={j} id={`hp-reg-v${j}`}>
                <path d={vigaPath(v)} />
              </clipPath>
            ))}

            {/* Los barridos. Un rect que se estira en X descubre lo que hay
                debajo; el dibujo no se mueve ni se deforma. */}
            <clipPath id="hp-barre-suelo">
              <rect className="hp-barre hp-barre-suelo" x="-3" y="-3" width="171" height="208" />
            </clipPath>
            {VIGAS.map((_, j) => (
              <clipPath key={j} id={`hp-barre-v${j}`}>
                <rect
                  className="hp-barre hp-barre-viga"
                  x={VENTANA.xi}
                  y="-3"
                  width={VENTANA.xd - VENTANA.xi}
                  height="208"
                  style={{ '--hp-j': j } as CSSProperties}
                />
              </clipPath>
            ))}
          </defs>

          {/* 1 · el suelo se traza de izquierda a derecha */}
          <g mask="url(#hp-reg-suelo)">
            <g clipPath="url(#hp-barre-suelo)">
              <use href="#hp-trazo" />
            </g>
          </g>

          {/* 2 · las seis astas crecen desde el suelo, escalonadas */}
          {ASTAS.map((a, i) => (
            <g key={i} clipPath={`url(#hp-reg-a${i})`}>
              <g className="hp-asta" style={{ '--hp-i': i, '--hp-base': a.base } as CSSProperties}>
                <use href="#hp-trazo" />
              </g>
            </g>
          ))}

          {/* 3 · los travesaños se tienden, de abajo arriba */}
          {VIGAS.map((_, j) => (
            <g key={j} clipPath={`url(#hp-reg-v${j})`}>
              <g clipPath={`url(#hp-barre-v${j})`}>
                <use href="#hp-trazo" />
              </g>
            </g>
          ))}
        </svg>

        {/* 4 · y el nombre surge, con el mismo gesto con el que entra el login */}
        <svg
          className="hp-nombre"
          viewBox={`0 0 ${WORDMARK_CAJA.ancho} ${WORDMARK_CAJA.alto}`}
          fill="currentColor"
        >
          <path d={WORDMARK_TRAZO} />
        </svg>
      </div>
    </div>
  )
}
