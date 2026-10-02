import { CreditCard, ExternalLink } from 'lucide-react'
import { requerirRol } from '@/lib/auth'
import { fechaLarga, pesos } from '@/lib/format'
import { crearStripe, stripeConfigurado } from '@/lib/stripe/cliente'
import { conImpago, etiquetaTarjeta, sinSuscripcion } from '@/lib/stripe/estado'
import { DIA_DE_COBRO } from '@/lib/stripe/fechas'
import { precioMensual } from '@/lib/stripe/precio'
import { crearClienteServidor } from '@/lib/supabase/server'
import { EncabezadoPagina, Etiqueta, Indicador, Tarjeta } from '@/components/ui'
import { CheckoutIncrustado } from '@/components/suscripcion/checkout-incrustado'
import { BotonActualizar } from '@/components/suscripcion/boton-actualizar'
import type { BloqueoApp, SuscripcionApp } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * La mensualidad de la app, para quien la paga.
 *
 * Tres caras: sin tarjeta (se registra aquí mismo), al corriente (qué tarjeta,
 * cuándo y cuánto) y con un cobro que no entró (cómo pagarlo antes de que la
 * app se ponga en pausa).
 */
export default async function PaginaSuscripcion() {
  await requerirRol(['admin'])

  const supabase = await crearClienteServidor()
  const [{ data: fila }, { data: bloqueo }] = await Promise.all([
    supabase.from('suscripcion_app').select('*').eq('id', true).maybeSingle<SuscripcionApp>(),
    supabase.rpc('bloqueo_app'),
  ])
  const candado: BloqueoApp | undefined = bloqueo?.[0]

  if (!stripeConfigurado() || !fila) {
    return (
      <>
        <EncabezadoPagina titulo="Suscripción" />
        <Tarjeta>
          <div className="px-5 py-6 text-sm text-tinta-600">
            <Etiqueta tono="ambar">Sin configurar</Etiqueta>
            <p className="mt-3">
              Falta configurar Stripe en el servidor (las variables STRIPE_SECRET_KEY,
              STRIPE_PRICE_ID y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). Mientras tanto la
              mensualidad se sigue pagando como hasta ahora.
            </p>
          </div>
        </Tarjeta>
      </>
    )
  }

  if (sinSuscripcion(fila.estado)) return <SinTarjeta />
  if (conImpago(fila.estado)) return <ConImpago fila={fila} candado={candado} />
  return <AlCorriente fila={fila} />
}

async function SinTarjeta() {
  const stripe = crearStripe()
  const precio = stripe ? await precioMensual(stripe) : null
  const monto = precio ? pesos(precio.montoCentavos / 100) : null

  return (
    <>
      <EncabezadoPagina
        titulo="Suscripción"
        descripcion="La mensualidad de HaacoPro, cobrada sola cada mes a la tarjeta que registres."
      />
      <Tarjeta titulo="Registrar la tarjeta">
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-haaco-50 text-haaco-700">
              <CreditCard size={22} aria-hidden />
            </span>
            <div className="text-sm text-tinta-600">
              <p className="text-base font-semibold text-tinta-900">
                {monto ? `${monto} al mes` : 'Mensualidad de la app'}
              </p>
              <p className="mt-1">
                Se cobra el día {DIA_DE_COBRO} de cada mes. Hoy no se cobra nada: sólo se guarda
                la tarjeta y el primer cargo cae el próximo {DIA_DE_COBRO}.
              </p>
              <p className="mt-1 text-tinta-500">
                El número de la tarjeta lo recibe Stripe directamente; aquí nunca se guarda.
              </p>
            </div>
          </div>
          <CheckoutIncrustado llavePublica={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''} />
        </div>
      </Tarjeta>
    </>
  )
}

function AlCorriente({ fila }: { fila: SuscripcionApp }) {
  const tarjeta = etiquetaTarjeta(fila.tarjeta_marca, fila.tarjeta_ultimos4)
  const monto = fila.monto_centavos != null ? pesos(fila.monto_centavos / 100) : '—'

  return (
    <>
      <EncabezadoPagina
        titulo="Suscripción"
        descripcion="La mensualidad se cobra sola. Aquí ves con qué tarjeta y cuándo."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador etiqueta="Tarjeta" valor={tarjeta ?? 'Sin tarjeta'} tono={tarjeta ? 'neutro' : 'ambar'} />
        <Indicador
          etiqueta="Próximo cobro"
          valor={fila.proximo_cobro ? fechaLarga(fila.proximo_cobro) : '—'}
          nota={fila.cancela_al_fin_periodo ? 'La suscripción termina ese día' : undefined}
          tono={fila.cancela_al_fin_periodo ? 'ambar' : 'verde'}
        />
        <Indicador etiqueta="Mensualidad" valor={monto} />
      </div>

      <Tarjeta className="mt-4" titulo="Tarjeta y recibos">
        <div className="space-y-3 px-4 py-4 text-sm text-tinta-600 sm:px-5">
          <p>
            Para cambiar la tarjeta o descargar los recibos de cada mes se abre el portal de
            Stripe. Se abre aparte y al cerrarlo vuelves aquí.
          </p>
          <EnlacePortal>Cambiar tarjeta o ver recibos</EnlacePortal>
          {fila.ultimo_pago_en && (
            <p className="text-xs text-tinta-500">Último pago: {fechaLarga(fila.ultimo_pago_en)}.</p>
          )}
        </div>
      </Tarjeta>

      <div className="mt-4">
        <BotonActualizar />
      </div>
    </>
  )
}

function ConImpago({ fila, candado }: { fila: SuscripcionApp; candado?: BloqueoApp }) {
  const bloqueada = candado?.bloqueada === true
  const fechaCandado = candado?.bloquea_el ? fechaLarga(candado.bloquea_el) : null
  const tarjeta = etiquetaTarjeta(fila.tarjeta_marca, fila.tarjeta_ultimos4)

  return (
    <>
      <EncabezadoPagina titulo="Suscripción" />
      <Tarjeta className="border-red-200">
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <div>
            <Etiqueta tono="rojo">{bloqueada ? 'App en pausa' : 'Cobro pendiente'}</Etiqueta>
            <p className="mt-3 text-base font-semibold text-tinta-900">
              No se pudo cobrar la mensualidad
              {fila.impago_desde ? ` del ${fechaLarga(fila.impago_desde)}` : ''}.
            </p>
            <p className="mt-1 text-sm text-tinta-600">
              {bloqueada
                ? 'La app está en pausa para todos hasta que se pague. En cuanto entre el pago, se abre sola.'
                : fechaCandado
                  ? `Stripe va a reintentar con la tarjeta ${tarjeta ?? 'registrada'}. Si el ${fechaCandado} sigue sin pagarse, la app se pone en pausa para todos.`
                  : `Stripe va a reintentar con la tarjeta ${tarjeta ?? 'registrada'}.`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {fila.factura_pendiente_url && (
              <a
                href={fila.factura_pendiente_url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-haaco-700 px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-haaco-900 lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
              >
                Pagar ahora
                <ExternalLink size={15} aria-hidden />
              </a>
            )}
            <EnlacePortal>Cambiar la tarjeta</EnlacePortal>
          </div>

          <p className="text-xs text-tinta-500">
            «Pagar ahora» abre la factura en Stripe y acepta cualquier tarjeta. Si ya pagaste y
            esto no cambia, toca «Ya pagué, actualizar».
          </p>
          <BotonActualizar>Ya pagué, actualizar</BotonActualizar>
        </div>
      </Tarjeta>
    </>
  )
}

function EnlacePortal({ children }: { children: string }) {
  return (
    <a
      href="/api/stripe/portal"
      target="_blank"
      rel="noopener"
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-tinta-300 bg-white px-4 py-2.5 text-[15px] font-semibold text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
    >
      {children}
      <ExternalLink size={15} aria-hidden />
    </a>
  )
}
