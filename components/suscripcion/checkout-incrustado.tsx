'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { Boton } from '@/components/ui'
import { MensajeError } from '@/components/formulario'
import { confirmarCheckout, crearSesionCheckout } from '@/app/admin/suscripcion/acciones'

/** Stripe se carga una sola vez por pestaña, por mucho que se monte el botón. */
let stripePromesa: Promise<Stripe | null> | null = null
function cargarStripe(llavePublica: string) {
  stripePromesa ??= loadStripe(llavePublica)
  return stripePromesa
}

/**
 * El formulario de Stripe dentro de la app.
 *
 * Incrustado y no redirigido a propósito: con la app instalada en el iPhone,
 * salir a checkout.stripe.com abre un navegador aparte y el regreso es torpe.
 * Aquí la tarjeta se captura en un iframe de Stripe —el número nunca pasa por
 * nuestro servidor— y al terminar la pantalla se refresca sola.
 */
export function CheckoutIncrustado({ llavePublica }: { llavePublica: string }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, empezar] = useTransition()
  const router = useRouter()

  // `onComplete` queda capturado cuando Stripe arranca: el id de la sesión
  // tiene que vivir en un ref para que lo vea aunque llegue después.
  const sesionId = useRef<string | null>(null)

  const fetchClientSecret = async () => {
    const r = await crearSesionCheckout()
    if ('error' in r) {
      setError(r.error)
      setAbierto(false)
      throw new Error(r.error)
    }
    sesionId.current = r.sessionId
    return r.clientSecret
  }

  const onComplete = () => {
    empezar(async () => {
      if (sesionId.current) {
        const r = await confirmarCheckout(sesionId.current)
        if (r.error) setError(r.error)
      }
      router.refresh()
    })
  }

  if (!abierto) {
    return (
      <div className="space-y-3">
        <Boton type="button" onClick={() => { setError(null); setAbierto(true) }} className="w-full sm:w-auto">
          Registrar tarjeta
        </Boton>
        <MensajeError mensaje={error} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <EmbeddedCheckoutProvider
        stripe={cargarStripe(llavePublica)}
        options={{ fetchClientSecret, onComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
      {confirmando && (
        <p className="text-sm text-tinta-500">Guardando la tarjeta…</p>
      )}
      <MensajeError mensaje={error} />
    </div>
  )
}
