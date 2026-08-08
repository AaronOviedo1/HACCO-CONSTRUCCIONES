'use client'

import { useState } from 'react'
import { pesosCortos } from '@/lib/format'
import { FLUJO } from '@/components/graficas/paleta'
import { topeDe, trazoBarra } from '@/components/graficas/escala'
import { ANCHO, EtiquetasX, Lienzo, Rejilla, ZonasDeToque } from '@/components/graficas/lienzo'
import { Leyenda } from '@/components/graficas/leyenda'

/**
 * Lo que entra contra lo que sale, mes a mes.
 *
 * Ingresos = lo cobrado a clientes; egresos = gastos más nómina pagada. Antes
 * eran dos barras hombro con hombro y para saber si el mes dejó dinero había
 * que comparar dos alturas a ojo. Ahora cuelgan del cero: lo que entra sube y
 * lo que sale baja, sobre la misma escala de pesos. El mes que se pasó de
 * gastos se ve panzón para abajo sin leer una sola cifra.
 */
export function GraficaFlujo({ meses }: { meses: { m: string; entra: number; sale: number }[] }) {
  const [activo, setActivo] = useState(meses.length - 1)

  // Media altura para cada lado: el cero queda justo en medio y las dos
  // mitades comparten escala, que es lo que hace honesto el espejo.
  const mitad = 95
  const alto = mitad * 2
  const tope = topeDe(meses.flatMap((x) => [x.entra, x.sale]))
  const marcas = [tope, 0, tope]

  const slot = ANCHO / Math.max(1, meses.length)
  const ancho = Math.min(34, slot - 22)

  const mes = meses[activo] ?? meses[meses.length - 1]
  const balance = (mes?.entra ?? 0) - (mes?.sale ?? 0)

  return (
    <>
      <Leyenda
        periodo={mes?.m}
        series={[
          { nombre: 'Ingresos', color: FLUJO.entra, valor: mes?.entra ?? 0 },
          { nombre: 'Egresos', color: FLUJO.sale, valor: mes?.sale ?? 0 },
        ]}
        extra={
          <span className="text-[11px] text-tinta-600">
            Balance{' '}
            <strong
              className={`font-semibold tabular-nums ${
                balance < 0 ? 'text-red-600' : 'text-haaco-700'
              }`}
            >
              {balance < 0 ? '−' : '+'}
              {pesosCortos(Math.abs(balance))}
            </strong>
          </span>
        }
      />

      <Lienzo
        marcas={marcas}
        alto={alto}
        arriba={8}
        abajo={8}
        etiqueta={`Ingresos contra egresos en los últimos ${meses.length} meses`}
      >
        <Rejilla marcas={marcas} alto={alto} cero={mitad} />

        {meses.map((x, i) => {
          const izq = i * slot + slot / 2 - ancho / 2
          const hEntra = x.entra > 0 ? Math.max(1.5, (x.entra / tope) * mitad) : 0
          const hSale = x.sale > 0 ? Math.max(1.5, (x.sale / tope) * mitad) : 0
          return (
            <g key={`${x.m}-${i}`}>
              {/* Un hueco de 2 px a cada lado del cero: la línea del eje
                  tiene que seguir viéndose entre las dos mitades. */}
              {hEntra > 0 && (
                <path
                  d={trazoBarra(izq, mitad - 2 - hEntra, ancho, hEntra, 'arriba')}
                  fill={FLUJO.entra}
                />
              )}
              {hSale > 0 && (
                <path
                  d={trazoBarra(izq, mitad + 2, ancho, hSale, 'abajo')}
                  fill={FLUJO.sale}
                />
              )}
            </g>
          )
        })}

        <ZonasDeToque n={meses.length} alto={alto} onActivo={setActivo} desdeY={-8} />
      </Lienzo>

      <EtiquetasX etiquetas={meses.map((x) => x.m)} activo={activo} onElegir={setActivo} />
    </>
  )
}
