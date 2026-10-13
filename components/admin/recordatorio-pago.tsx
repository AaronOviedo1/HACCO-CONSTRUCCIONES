'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, CreditCard, X } from 'lucide-react'
import { hayNovedadesPorVer } from '@/components/novedades'
import type { RolUsuario } from '@/types/database'

const CLAVE = 'haaco:recordatorio-pago'
const DESTINO = '/admin/suscripcion'

/**
 * El recordatorio de la mensualidad, al entrar.
 *
 * La franja del tablero se deja de ver al segundo día; esto sale encima, una
 * vez al día y por aparato, mientras la mensualidad siga sin resolverse: o no
 * hay tarjeta registrada, o el cobro del 12 no entró. En cuanto se resuelve,
 * el servidor deja de mandarlo y no hay nada que apagar aquí.
 *
 * Como el aviso de novedades, la marca vive en el navegador y espera un
 * momento antes de salir. Si ese día también toca enseñar novedades, se
 * espera a la siguiente pantalla: dos hojas encimadas se cierran sin leer
 * ninguna.
 */
export function RecordatorioPago({
  rol,
  hoy,
  caso,
  diaDeCobro,
  fechaPausa,
}: {
  rol: RolUsuario
  /** La fecha de hoy en Hermosillo, dicha por el servidor: 2026-10-13. */
  hoy: string
  caso: 'sin_tarjeta' | 'impago'
  diaDeCobro: number
  /** Cuándo se pondría en pausa la app, ya escrita: «19 de octubre de 2026». */
  fechaPausa: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const ruta = usePathname()
  // En la pantalla donde se paga, el recordatorio sale sobrando.
  const enDestino = ruta.startsWith(DESTINO)

  useEffect(() => {
    if (enDestino) return
    try {
      if (localStorage.getItem(CLAVE) === hoy) return
    } catch {
      // Sin almacenamiento no hay forma de saber si ya salió hoy: mejor nada
      // que el mismo aviso en cada pantalla.
      return
    }
    if (hayNovedadesPorVer(rol)) return
    const t = setTimeout(() => setAbierto(true), 900)
    return () => clearTimeout(t)
  }, [enDestino, hoy, rol, ruta])

  const cerrar = () => {
    setAbierto(false)
    try {
      localStorage.setItem(CLAVE, hoy)
    } catch {}
  }

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      try {
        localStorage.setItem(CLAVE, hoy)
      } catch {}
    }
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [abierto, hoy])

  if (!abierto || enDestino) return null

  const impago = caso === 'impago'

  return (
    // z-[60]: por encima del «+» flotante del teléfono, igual que las novedades.
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta-950/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={cerrar} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recordatorio-pago-titulo"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl animate-sube sm:animate-none sm:rounded-2xl"
      >
        <span
          className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-tinta-300 sm:hidden"
          aria-hidden
        />

        <div className="flex items-start gap-3.5 px-5 pb-5 pt-4 sm:pt-5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              impago ? 'bg-red-50 text-red-700' : 'bg-haaco-50 text-haaco-700'
            }`}
          >
            {impago ? (
              <AlertTriangle size={22} aria-hidden />
            ) : (
              <CreditCard size={22} aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tinta-400">
              Recordatorio de pago
            </p>
            <h2
              id="recordatorio-pago-titulo"
              className="mt-1 text-[19px] font-bold leading-tight -tracking-[0.3px] text-tinta-900 sm:text-lg sm:font-semibold"
            >
              {impago
                ? 'No se pudo cobrar la mensualidad de la app'
                : 'La mensualidad de la app está pendiente'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-tinta-600">
              {impago
                ? fechaPausa
                  ? `El cargo del día ${diaDeCobro} no entró. Si el ${fechaPausa} sigue sin pagarse, la app se pone en pausa para todos.`
                  : `El cargo del día ${diaDeCobro} no entró. Revisa la tarjeta antes de que la app se ponga en pausa.`
                : `La mensualidad de HaacoPro se cobra el día ${diaDeCobro} de cada mes y todavía no hay una tarjeta registrada. Regístrala una vez y de ahí en adelante se cobra sola.`}
            </p>
          </div>

          <button
            type="button"
            onClick={cerrar}
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta-150 text-tinta-600 transition hover:bg-tinta-200 sm:bg-transparent sm:text-tinta-400 sm:hover:bg-tinta-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t-[0.5px] border-tinta-150 bg-tinta-50 px-5 py-3 pb-seguro sm:flex-row-reverse sm:pb-3">
          <Link
            href={DESTINO}
            onClick={cerrar}
            className={`w-full rounded-[14px] px-4 py-3 text-center text-[15.5px] font-semibold text-white transition sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium ${
              impago ? 'bg-red-700 hover:bg-red-800' : 'bg-haaco-700 hover:bg-haaco-800'
            }`}
          >
            {impago ? 'Ver cómo pagar' : 'Registrar tarjeta'}
          </Link>
          <button
            type="button"
            onClick={cerrar}
            className="w-full rounded-[14px] px-4 py-3 text-[15.5px] font-medium text-tinta-600 transition hover:bg-tinta-100 sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm"
          >
            Recordármelo mañana
          </button>
        </div>
      </div>
    </div>
  )
}
