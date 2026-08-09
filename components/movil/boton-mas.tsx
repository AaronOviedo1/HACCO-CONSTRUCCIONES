'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ICONO } from '@/lib/nav'

/**
 * El botón de crear del teléfono.
 *
 * Las tres cosas que se dan de alta a diario —cotizar, abrir obra, capturar un
 * gasto— viven cada una en su pantalla, y llegar a ellas eran dos o tres
 * toques. Este «+» flota arriba a la derecha de la pastilla de pestañas y las
 * despliega juntas, que es donde el pulgar espera el atajo de crear.
 *
 * «Nueva obra» lleva a las cotizaciones y no a un formulario: en este negocio
 * una obra sólo nace aprobando una cotización (el esquema lo exige), así que
 * el atajo lleva a donde está el botón de aprobar.
 *
 * En las pantallas que ya traen su propia barra de acciones fija —el cotizador
 * y el editor— se quita de en medio: ahí el trabajo ya empezó y taparía el
 * botón de enviar.
 */

const ACCIONES = [
  {
    href: '/admin/cotizar-rapido',
    titulo: 'Cotización rápida',
    detalle: 'Levantamiento en sitio',
    icono: ICONO.rayo,
  },
  {
    href: '/admin/cotizaciones',
    titulo: 'Nueva obra',
    detalle: 'Aprueba una cotización',
    icono: ICONO.obras,
  },
  {
    href: '/admin/gastos?nuevo=1',
    titulo: 'Nuevo gasto',
    detalle: 'Ticket o factura de hoy',
    icono: ICONO.dinero,
  },
]

/** Pantallas con barra de acciones fija propia: el «+» estorbaría encima. */
const SIN_BOTON = ['/admin/cotizar-rapido', '/admin/cotizaciones/']

export function BotonMas() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)

  // Navegar cierra el menú; si no, al volver atrás seguiría desplegado.
  useEffect(() => setAbierto(false), [pathname])

  if (SIN_BOTON.some((p) => pathname.startsWith(p))) return null

  return (
    <>
      {/* El velo aquieta la pantalla mientras el menú está abierto y cierra
          con cualquier toque fuera. Vive bajo el z-50 del menú pero encima de
          la pastilla: las pestañas también quedan en pausa. */}
      <div
        aria-hidden
        onClick={() => setAbierto(false)}
        className={`fixed inset-0 z-40 bg-tinta-900/25 transition-opacity duration-200 lg:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-2.5 lg:hidden"
        style={{ bottom: 'var(--alto-tabs)' }}
      >
        <div
          role="menu"
          aria-label="Crear"
          className={`cristal cristal-brillo relative w-[16.5rem] origin-bottom-right rounded-[1.375rem] p-1.5 transition-[opacity,transform] duration-[260ms] ease-suave motion-reduce:transition-none ${
            abierto ? 'visible opacity-100' : 'invisible translate-y-2 scale-90 opacity-0'
          }`}
        >
          {ACCIONES.map((a) => (
            <Link
              key={a.href}
              role="menuitem"
              href={a.href}
              onClick={() => setAbierto(false)}
              className="flex items-center gap-3 rounded-[1rem] px-3 py-2.5 transition-colors active:bg-haaco-700/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-haaco-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d={a.icono}
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-tinta-900">{a.titulo}</span>
                <span className="block truncate text-xs text-tinta-500">{a.detalle}</span>
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar el menú de crear' : 'Crear'}
          onClick={() => setAbierto((a) => !a)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-haaco-700 text-white shadow-verde transition-transform duration-300 ease-suave active:scale-90 motion-reduce:transition-none"
        >
          {/* El «+» gira a «×» para decir que el mismo dedo lo cierra. */}
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`transition-transform duration-300 ease-suave motion-reduce:transition-none ${
              abierto ? 'rotate-45' : ''
            }`}
          >
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  )
}
