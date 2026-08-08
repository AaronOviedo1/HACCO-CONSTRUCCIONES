'use client'

import { useState } from 'react'
import { pesosCortos } from '@/lib/format'
import { RUBROS } from '@/components/graficas/paleta'
import { apilar, marcasY, topeDe, trazoBarra } from '@/components/graficas/escala'
import { ALTO, ANCHO, EtiquetasX, Lienzo, Rejilla, ZonasDeToque } from '@/components/graficas/lienzo'
import { Leyenda } from '@/components/graficas/leyenda'

export type SemanaDePago = {
  etiqueta: string
  total: number
  partes: Record<string, number>
}

const FUENTES = [
  { clave: 'proveedores', nombre: 'Proveedores', color: RUBROS.material },
  { clave: 'nomina', nombre: 'Nómina', color: RUBROS.manoObra },
  { clave: 'fijos', nombre: 'Fijos', color: RUBROS.otros },
] as const

/**
 * De dónde va a salir el dinero en las próximas seis semanas.
 *
 * Antes esto sólo se podía armar visitando tres pantallas y sumando de cabeza:
 * las facturas de proveedor en cuentas por pagar, la cuadrilla en nómina y la
 * renta y los servicios en pagos fijos. Aquí caen las tres en la misma columna
 * y en la misma escala, así que la semana que aprieta se ve antes de que
 * llegue. Lo ya vencido se apila en la primera barra: eso se paga esta semana.
 */
export function CalendarioPagos({ semanas }: { semanas: SemanaDePago[] }) {
  const [activo, setActivo] = useState(0)

  const tope = topeDe(semanas.map((s) => s.total))
  const marcas = marcasY(tope)
  const slot = ANCHO / Math.max(1, semanas.length)
  const ancho = Math.min(44, slot - 22)

  const semana = semanas[activo] ?? semanas[0]
  const suma = semanas.reduce((s, x) => s + x.total, 0)

  return (
    <>
      <Leyenda
        periodo={activo === 0 ? 'esta semana' : `semana del ${semana?.etiqueta}`}
        series={FUENTES.map((f) => ({
          nombre: f.nombre,
          color: f.color,
          valor: semana?.partes[f.clave] ?? 0,
        }))}
        extra={
          <>
            <span className="text-[11px] text-tinta-600">
              Total{' '}
              <strong className="font-semibold tabular-nums text-tinta-900">
                {pesosCortos(semana?.total ?? 0)}
              </strong>
            </span>
            <span className="text-[11px] text-tinta-600">
              Seis semanas{' '}
            <strong className="font-semibold tabular-nums text-tinta-900">
                {pesosCortos(suma)}
              </strong>
            </span>
          </>
        }
      />

      <Lienzo marcas={marcas} arriba={8} etiqueta="Pagos que vencen en las próximas seis semanas, por fuente">
        <Rejilla marcas={marcas} />

        {semanas.map((s, i) => {
          const centro = i * slot + slot / 2
          const tramos = apilar(
            FUENTES.map((f) => s.partes[f.clave] ?? 0),
            tope,
            ALTO,
          )
          return (
            <g key={`${s.etiqueta}-${i}`}>
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
                    fill={FUENTES[j].color}
                  />
                ) : null,
              )}
            </g>
          )
        })}

        <ZonasDeToque n={semanas.length} onActivo={setActivo} desdeY={-8} />
      </Lienzo>

      <EtiquetasX etiquetas={semanas.map((s) => s.etiqueta)} activo={activo} onElegir={setActivo} />
    </>
  )
}
