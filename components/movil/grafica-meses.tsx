'use client'

import { useState } from 'react'
import { pesosCortos } from '@/lib/format'
import { COTIZACIONES } from '@/components/graficas/paleta'
import { apilar, marcasY, topeDe, trazoBarra } from '@/components/graficas/escala'
import { ALTO, ANCHO, EtiquetasX, Lienzo, Rejilla, ZonasDeToque } from '@/components/graficas/lienzo'
import { Leyenda } from '@/components/graficas/leyenda'

export type MesCotizado = {
  m: string
  /** Aprobadas y terminadas: el cliente dijo que sí. */
  vendido: number
  /** Sin resolver pero todavía dentro de vigencia. */
  enJuego: number
  /** Rechazadas, y las que se quedaron sin contestar hasta que venció el precio. */
  enfriado: number
}

/**
 * Lo cotizado del mes, partido en lo que se cerró y lo que no.
 *
 * Antes eran dos líneas encimadas, y ahí estaba el error: lo aprobado no es
 * una serie que corra junto a lo cotizado, es un pedazo suyo. Dos líneas que
 * nunca se pueden cruzar obligan a restar de cabeza para saber lo único que
 * importa. Aquí la altura de la columna **es** lo cotizado y el tramo de
 * abajo, el más oscuro, es lo que se vendió: la proporción se lee sola.
 */
export function GraficaMeses({ meses, meta = 0 }: { meses: MesCotizado[]; meta?: number }) {
  const [activo, setActivo] = useState(meses.length - 1)

  const totales = meses.map((x) => x.vendido + x.enJuego + x.enfriado)
  // La meta entra en la escala: si nunca se ha alcanzado, la raya tiene que
  // caber igual o la gráfica mentiría por arriba.
  const tope = topeDe([...totales, meta], 1.12)
  const marcas = marcasY(tope)
  const yMeta = meta > 0 ? ALTO - (meta / tope) * ALTO : null

  const slot = ANCHO / Math.max(1, meses.length)
  const ancho = Math.min(44, slot - 20)

  const mes = meses[activo] ?? meses[meses.length - 1]
  const total = totales[activo] ?? 0
  const cierre = total > 0 ? Math.round(((mes?.vendido ?? 0) / total) * 100) : null

  return (
    <>
      <Leyenda
        periodo={mes?.m}
        series={[
          { nombre: 'Vendido', color: COTIZACIONES.vendido, valor: mes?.vendido ?? 0 },
          { nombre: 'En juego', color: COTIZACIONES.enJuego, valor: mes?.enJuego ?? 0 },
          { nombre: 'Se enfrió', color: COTIZACIONES.enfriado, valor: mes?.enfriado ?? 0 },
        ]}
        extra={
          <>
            <span className="text-[11px] text-tinta-600">
              Total{' '}
              <strong className="font-semibold tabular-nums text-tinta-900">
                {pesosCortos(total)}
              </strong>
            </span>
            {cierre !== null && (
              <span className="text-[11px] text-tinta-600">
                Cierre{' '}
                <strong className="font-semibold tabular-nums text-haaco-700">{cierre}%</strong>
              </span>
            )}
            {meta > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
                <span
                  className="h-0 w-3.5 shrink-0 border-t-2 border-dashed border-haaco-700"
                  aria-hidden
                />
                Meta
                <strong className="font-semibold tabular-nums text-tinta-900">
                  {pesosCortos(meta)}
                </strong>
              </span>
            )}
          </>
        }
      />

      <Lienzo
        marcas={marcas}
        arriba={8}
        etiqueta={`Lo cotizado en los últimos ${meses.length} meses, partido en vendido, en juego y enfriado`}
      >
        <Rejilla marcas={marcas} />

        {meses.map((x, i) => {
          const centro = i * slot + slot / 2
          const tramos = apilar([x.vendido, x.enJuego, x.enfriado], tope, ALTO)
          const colores = [COTIZACIONES.vendido, COTIZACIONES.enJuego, COTIZACIONES.enfriado]
          return (
            <g key={`${x.m}-${i}`}>
              {tramos.map((t, j) =>
                t.alto > 0 ? (
                  <path
                    key={j}
                    d={trazoBarra(
                      centro - ancho / 2,
                      t.y,
                      ancho,
                      t.alto,
                      t.corona ? 'arriba' : 'ninguno',
                    )}
                    fill={colores[j]}
                  />
                ) : null,
              )}
            </g>
          )
        })}

        {/* La meta del mes, cruzada de lado a lado. Va sin rótulo encima:
            cualquier lugar donde se escriba choca con alguna columna, así que
            la cifra vive arriba, en la leyenda. */}
        {yMeta != null && (
          <line
            x1="0"
            y1={yMeta}
            x2={ANCHO}
            y2={yMeta}
            stroke="var(--color-haaco-700)"
            strokeWidth="1.6"
            strokeDasharray="7 5"
          />
        )}

        <ZonasDeToque n={meses.length} onActivo={setActivo} desdeY={-8} />
      </Lienzo>

      <EtiquetasX etiquetas={meses.map((x) => x.m)} activo={activo} onElegir={setActivo} />
    </>
  )
}
