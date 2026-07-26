'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'

export default function ErrorAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[HaacoPro]', error)
  }, [error])

  const esPermiso = /permission|policy|row-level|exclusiva de Dirección/i.test(error.message)

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangle size={22} />
      </span>

      <h1 className="text-lg font-semibold text-tinta-900">
        {esPermiso ? 'No tienes permiso para esto' : 'Algo salió mal en esta pantalla'}
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm text-tinta-500">
        {esPermiso
          ? 'Tu usuario no tiene acceso a esta información. Si crees que es un error, avísale a Dirección.'
          : 'Puedes intentar de nuevo. Si vuelve a pasar, toma nota de lo que estabas haciendo y avísale a Dirección.'}
      </p>

      {error.message && !esPermiso && (
        <p className="mx-auto mt-4 max-w-md overflow-x-auto rounded-lg bg-tinta-100 px-3 py-2 text-left font-mono text-xs text-tinta-600">
          {error.message}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
        >
          <RotateCw size={15} />
          Intentar de nuevo
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
