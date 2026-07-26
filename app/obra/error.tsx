'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function ErrorObra({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[HaacoPro · obra]', error)
  }, [error])

  return (
    <div className="py-14 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangle size={22} />
      </span>
      <h1 className="text-base font-semibold text-tinta-900">No se pudo cargar</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-tinta-500">
        Revisa que tengas señal e intenta otra vez. Si sigue fallando, avísale a la oficina.
      </p>

      <div className="mt-6 space-y-2 px-4">
        <button
          type="button"
          onClick={reset}
          data-tap
          className="w-full rounded-2xl bg-haaco-700 px-4 py-3.5 text-base font-semibold text-white"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/obra"
          className="block w-full rounded-2xl border border-tinta-300 bg-white px-4 py-3.5 text-base font-semibold text-tinta-700"
        >
          Mis obras
        </Link>
      </div>
    </div>
  )
}
