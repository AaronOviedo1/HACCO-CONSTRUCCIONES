import Link from 'next/link'
import { Etiqueta } from '@/components/ui'
import { BarraProgreso } from '@/components/movil/piezas'
import { PuntoAbriendo } from '@/components/enlace-abriendo'
import { pesosCortos, porcentaje } from '@/lib/format'
import { ESTATUS_OBRA } from '@/lib/obras'
import type { EstatusObra } from '@/types/database'

/**
 * La obra como se ve en el teléfono: una tarjeta por orden de trabajo.
 * Dirección ve el dinero (cotizado, real, utilidad); la cuadrilla ve el botón
 * que de verdad usa, que es subir el avance del día.
 */
export function TarjetaObraMovil({
  href,
  nombre,
  ot,
  cliente,
  domicilio,
  estatus,
  avance,
  dinero,
  accion,
}: {
  href: string
  nombre: string
  ot: string | null
  cliente?: string | null
  domicilio?: string | null
  estatus: EstatusObra
  avance: number
  /** Sólo Dirección y Administración: el concentrado de la obra. */
  dinero?: { cotizado: number; gastado: number; utilidad: number }
  /** Sólo cuadrilla: la banda de acción al pie. */
  accion?: { texto: string; href: string }
}) {
  const pctUtilidad = dinero && dinero.cotizado > 0 ? (dinero.utilidad / dinero.cotizado) * 100 : 0
  const colorUtilidad =
    pctUtilidad < 0 ? 'text-red-600' : pctUtilidad < 15 ? 'text-amber-600' : 'text-haaco-600'

  return (
    <div className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white shadow-tarjeta">
      {/* Sin prefetch: la pantalla de la obra es dinámica, así que cada tarjeta
          que asoma se renderizaría entera nada más por hacer scroll. Se pide al
          tocarla, y el «OT» acusa el toque mientras llega. */}
      <Link href={href} prefetch={false} className="block rounded-[20px] px-4 pb-3.5 pt-4 transition active:bg-tinta-50">
        <div className="flex items-start justify-between gap-2.5">
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-snug -tracking-[0.3px]">
              {nombre}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] text-tinta-400">
              OT {ot ?? '—'}
              <PuntoAbriendo />
              {cliente && ` · ${cliente}`}
            </span>
          </span>
          <Etiqueta tono={ESTATUS_OBRA[estatus].tono}>{ESTATUS_OBRA[estatus].texto}</Etiqueta>
        </div>

        {domicilio && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-tinta-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden>
              <path
                d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.9" />
            </svg>
            <span className="truncate">{domicilio}</span>
          </p>
        )}

        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-[11.5px]">
            <span className="text-tinta-500">Avance</span>
            <span className="font-semibold tabular-nums text-tinta-800">{avance}%</span>
          </div>
          <BarraProgreso pct={avance} />
        </div>

        {dinero && (
          <div className="mt-3 flex gap-2.5 border-t-[0.5px] border-tinta-100 pt-3">
            <Columna etiqueta="Cotizado" valor={pesosCortos(dinero.cotizado)} />
            <Columna etiqueta="Real" valor={pesosCortos(dinero.gastado)} className="text-tinta-500" />
            <Columna
              etiqueta="Utilidad"
              valor={pesosCortos(dinero.utilidad)}
              className={colorUtilidad}
              extra={porcentaje(pctUtilidad, 0)}
            />
          </div>
        )}
      </Link>

      {accion && (
        <Link
          href={accion.href}
          className="mx-4 mb-3.5 flex items-center justify-between rounded-[13px] bg-haaco-50 px-3.5 py-3 text-[14.5px] font-semibold text-haaco-800 transition active:bg-haaco-100"
        >
          <span className="flex items-center gap-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4.4 8.4h3l1.4-2h6.4l1.4 2h3v10.8H4.4z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13.2" r="3.4" stroke="currentColor" strokeWidth="1.9" />
            </svg>
            {accion.texto}
          </span>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden>
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      )}
    </div>
  )
}

function Columna({
  etiqueta,
  valor,
  extra,
  className = '',
}: {
  etiqueta: string
  valor: string
  extra?: string
  className?: string
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[9.5px] uppercase tracking-[0.06em] text-tinta-400">{etiqueta}</span>
      <span className={`mt-0.5 block truncate text-[13.5px] font-semibold tabular-nums ${className}`}>
        {valor}
        {extra && <span className="ml-1 text-[10.5px] font-medium text-tinta-400">{extra}</span>}
      </span>
    </span>
  )
}
