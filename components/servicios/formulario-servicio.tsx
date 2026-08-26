'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  AreaTexto, BotonGuardar, Campo, Casilla, Entrada, Hora, MensajeError, Numero, Seleccion,
} from '@/components/formulario'
import { CampoDomicilio } from '@/components/campo-domicilio'
import { SelectorFecha } from '@/components/filtro-fechas'
import { FormularioCliente } from '@/components/catalogos/formulario-cliente'
import { hoyISO, num } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { agendarServicio } from '@/app/admin/servicios/acciones'
import type { Cliente, VServicio } from '@/types/database'

export type Tecnico = { id: string; nombre: string; rol: string; oficio: string | null }

/**
 * Agendar la visita: lo primero que pasa y lo único que se captura en la
 * banqueta, con el cliente enfrente. Por eso es una página y no un diálogo, y
 * por eso pide lo mínimo —de quién es, qué tiene, cuándo se va y quién va—:
 * el diagnóstico y el precio se anotan después, cuando ya se sabe.
 */
export function FormularioServicio({
  servicio,
  clientes,
  tecnicos,
}: {
  /** Presente al corregir la cita; ausente al agendar. */
  servicio?: VServicio
  clientes: Cliente[]
  tecnicos: Tecnico[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)

  const [clienteId, setClienteId] = useState(servicio?.cliente_id ?? '')
  const [descripcion, setDescripcion] = useState(
    servicio?.descripcion ?? 'Reparación de portón eléctrico',
  )
  const [domicilio, setDomicilio] = useState(servicio?.domicilio ?? '')
  const [tecnicoId, setTecnicoId] = useState(servicio?.tecnico_id ?? '')
  const [fecha, setFecha] = useState(servicio?.fecha_visita ?? hoyISO())
  const [hora, setHora] = useState(servicio?.hora_visita?.slice(0, 5) ?? '')
  const [factura, setFactura] = useState(servicio?.requiere_factura ?? false)
  // Ir a ver un portón cuesta, y eso se cobra aunque el cliente no acepte el
  // presupuesto. Viene puesta la de siempre; se deja en cero cuando no se cobra.
  const [cuota, setCuota] = useState(String(servicio?.cuota_visita ?? 400))
  const [notas, setNotas] = useState(servicio?.notas ?? '')

  /** Al elegir cliente se hereda su domicilio y si pide factura. */
  const elegirCliente = (id: string) => {
    setClienteId(id)
    const cliente = clientes.find((c) => c.id === id)
    if (!cliente) return
    if (!domicilio.trim() && cliente.domicilio) setDomicilio(cliente.domicilio)
    setFactura(cliente.requiere_factura)
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await agendarServicio({
        id: servicio?.servicio_id,
        cliente_id: clienteId,
        descripcion,
        domicilio: domicilio || null,
        tecnico_id: tecnicoId || null,
        fecha_visita: fecha,
        hora_visita: hora || null,
        requiere_factura: factura,
        cuota_visita: num(cuota),
        notas: notas || null,
      })

      if (!salida.ok) {
        setError(salida.error)
        return
      }
      router.push(`/admin/servicios/${salida.datos!.id}`)
      router.refresh()
    })

  return (
    <form
      action={guardar}
      className="grid gap-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta sm:grid-cols-2"
    >
      <Campo
        etiqueta="Cliente"
        hijo={
          <span className="flex gap-2">
            <Seleccion
              value={clienteId}
              onChange={(e) => elegirCliente(e.target.value)}
              disabled={pendiente}
              required
            >
              <option value="">Elige el cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Seleccion>
            <button
              type="button"
              onClick={() => setNuevoCliente(true)}
              className="shrink-0 rounded-[14px] border border-tinta-300 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 lg:rounded-lg"
            >
              Nuevo
            </button>
          </span>
        }
      />

      <Campo
        etiqueta="Qué se va a revisar"
        hijo={
          <Entrada
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Reparación de portón eléctrico"
            disabled={pendiente}
            required
          />
        }
        ayuda="Como se lo diría a un compañero. Después se afina con el diagnóstico."
      />

      <Campo
        etiqueta="Dónde está el portón"
        hijo={
          <CampoDomicilio
            valor={domicilio}
            onCambio={setDomicilio}
            disabled={pendiente}
          />
        }
        ayuda="Se llena solo con el domicilio del cliente; cámbialo si el portón está en otro lado."
      />

      <Campo
        etiqueta="Día de la visita"
        ancho="medio"
        hijo={
          <span className="block">
            <SelectorFecha valor={fecha} onCambio={setFecha} disabled={pendiente} titulo="Día de la visita" />
          </span>
        }
      />

      <Campo
        etiqueta="Hora"
        ancho="medio"
        hijo={<Hora value={hora} onChange={(e) => setHora(e.target.value)} disabled={pendiente} />}
        ayuda="Opcional. Con hora, el aviso de la mañana la dice."
      />

      <Campo
        etiqueta="Quién va"
        ancho="medio"
        hijo={
          <Seleccion
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            disabled={pendiente}
          >
            <option value="">Todavía no se sabe</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.oficio ? ` · ${t.oficio}` : ''}
              </option>
            ))}
          </Seleccion>
        }
      />

      <Campo
        etiqueta="Costo de la visita"
        ancho="medio"
        hijo={
          <Numero
            value={cuota}
            onChange={(e) => setCuota(e.target.value)}
            placeholder="0.00"
            disabled={pendiente}
          />
        }
        ayuda={
          num(cuota) > 0
            ? `Se cobran ${pesos(num(cuota))} por ir, acepte o no el presupuesto.`
            : 'Sin costo: la visita no se le cobra al cliente.'
        }
      />

      <Casilla
        etiqueta="El cliente pide factura (se le suma el 16% de IVA)"
        checked={factura}
        onChange={(e) => setFactura(e.target.checked)}
        disabled={pendiente}
      />

      <Campo
        etiqueta="Notas"
        hijo={
          <AreaTexto
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Con quién hay que llegar, dónde estacionarse, qué dijo por teléfono…"
            disabled={pendiente}
          />
        }
      />

      <MensajeError mensaje={error} />

      <div className="sm:col-span-2">
        <BotonGuardar>
          <CalendarClock size={16} />
          {servicio ? 'Guardar la cita' : 'Agendar la visita'}
        </BotonGuardar>
      </div>

      {/* Dar de alta al cliente sin salirse: en la banqueta no hay tiempo de
          ir al catálogo y volver. */}
      {nuevoCliente && (
        <FormularioCliente
          abierto
          onCerrar={() => setNuevoCliente(false)}
          onGuardado={(id, requiereFactura) => {
            setClienteId(id)
            setFactura(requiereFactura)
            setNuevoCliente(false)
            router.refresh()
          }}
        />
      )}
    </form>
  )
}
