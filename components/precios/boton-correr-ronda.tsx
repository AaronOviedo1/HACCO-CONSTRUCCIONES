'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { correrRonda } from '@/app/admin/precios/acciones'

/**
 * Rehace la lista del día a mano.
 *
 * En producción la arma el cron a las siete de la mañana; esto es para verla
 * hoy sin esperar a mañana —y para que en local, donde no hay cron, exista del
 * todo—. Es idempotente por fecha: correrla dos veces no mueve nada ni pisa lo
 * que ya se preguntó.
 */
export function BotonCorrerRonda() {
  const router = useRouter()
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  return (
    <div className="flex items-center gap-2">
      {aviso && <span className="text-xs text-tinta-500">{aviso}</span>}
      <button
        type="button"
        onClick={() =>
          iniciar(async () => {
            const r = await correrRonda()
            setAviso(
              r.ok
                ? `${r.datos?.cuantos ?? 0} en la lista de hoy`
                : r.error,
            )
            router.refresh()
          })
        }
        disabled={pendiente}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-tinta-200 bg-white px-3 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50 disabled:opacity-40 lg:min-h-0 lg:py-2"
      >
        {pendiente ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        Rehacer la lista
      </button>
    </div>
  )
}
