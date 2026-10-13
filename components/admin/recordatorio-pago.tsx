'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, CreditCard, X } from 'lucide-react'
import { hayNovedadesPorVer } from '@/components/novedades'
import type { RolUsuario } from '@/types/database'

const DESTINO = '/admin/suscripcion'

/** 7 → «séptimo». Fuera de la tabla, el número con su º. */
const ORDINALES: Record<number, string> = {
  3: 'tercer',
  5: 'quinto',
  7: 'séptimo',
  10: 'décimo',
  15: 'decimoquinto',
}

/**
 * El recordatorio de la mensualidad, cada vez que se entra a la app.
 *
 * La franja del tablero se deja de ver al segundo día; esto sale encima
 * mientras la mensualidad siga sin resolverse: o no hay tarjeta registrada, o
 * el cobro del 12 no entró. En cuanto se resuelve, el servidor deja de
 * mandarlo y no hay nada que apagar aquí.
 *
 * «Cada vez que se entra» es cada vez que la app se abre o se recarga, no cada
 * pantalla: lo cerrado se recuerda en estado, que vive lo que vive el layout,
 * y no en el navegador. Así al moverse por el panel no vuelve a salir, y al
 * abrir la app de nuevo sí.
 *
 * Espera un momento antes de salir, como el aviso de novedades, y si ese día
 * también toca enseñar novedades se espera a la siguiente pantalla: dos hojas
 * encimadas se cierran sin leer ninguna.
 *
 * A Dirección le ofrece ir a pagar. A Administración sólo le avisa: la
 * pantalla de Suscripción no es suya.
 */
export function RecordatorioPago({
  rol,
  caso,
  diaDeCobro,
  diasDeGracia,
  fechaBloqueo,
}: {
  rol: RolUsuario
  caso: 'sin_tarjeta' | 'impago'
  diaDeCobro: number
  diasDeGracia: number
  /** Cuándo se bloquearía la app, ya escrita: «19 de octubre de 2026». */
  fechaBloqueo: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [cerrado, setCerrado] = useState(false)
  const ruta = usePathname()
  // En la pantalla donde se paga, el recordatorio sale sobrando.
  const enDestino = ruta.startsWith(DESTINO)

  useEffect(() => {
    if (cerrado || enDestino) return
    if (hayNovedadesPorVer(rol)) return
    const t = setTimeout(() => setAbierto(true), 900)
    return () => clearTimeout(t)
  }, [cerrado, enDestino, rol, ruta])

  const cerrar = () => {
    setAbierto(false)
    setCerrado(true)
  }

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      setCerrado(true)
    }
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [abierto])

  if (!abierto || enDestino) return null

  const impago = caso === 'impago'
  const paga = rol === 'admin'
  const ordinal = ORDINALES[diasDeGracia] ?? `${diasDeGracia}º`

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
                ? `El cargo del día ${diaDeCobro} no entró.`
                : `La mensualidad de HaacoPro se cobra el día ${diaDeCobro} de cada mes y todavía no hay una tarjeta registrada.`}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-tinta-900">
              El acceso a la app se bloquea al {ordinal} día sin pago
              {fechaBloqueo ? `: el ${fechaBloqueo}.` : '.'}
            </p>
            {!paga && (
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                El pago lo hace Dirección, en Más → Suscripción.
              </p>
            )}
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
          {paga ? (
            <>
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
                Ahora no
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={cerrar}
              className="w-full rounded-[14px] bg-haaco-700 px-4 py-3 text-[15.5px] font-semibold text-white transition hover:bg-haaco-800 sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
