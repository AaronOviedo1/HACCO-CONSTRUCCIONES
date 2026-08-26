'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Banknote, Paperclip, Pencil, Trash2 } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, Opciones, PieDialogo,
} from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import { METODO_PAGO, METODO_PAGO_SIN_CAJA } from '@/lib/finanzas'
import {
  actualizarCobroServicio, eliminarCobroServicio, registrarCobroServicio,
} from '@/app/admin/servicios/acciones'
import type { MetodoPago, ServicioPago, VServicio } from '@/types/database'

/**
 * El cobro de la reparación.
 *
 * Hermano chico del de cobranza: sin anticipo ni liquidación —una reparación
 * se cobra al terminar— y sin recibo, que es papel de obra. Lo que sí conserva
 * es poder corregir el pago: el error de siempre es teclear un dígito de más,
 * y borrarlo y recapturarlo deja hueco en el corte del día.
 */
export function DialogoCobro({
  servicio,
  pagos,
  etiqueta,
}: {
  servicio: VServicio
  pagos: ServicioPago[]
  etiqueta?: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editado, setEditado] = useState<ServicioPago | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)

  const campoMonto = useRef<HTMLInputElement>(null)
  const saldo = Number(servicio.saldo)

  /** Al abrir, el monto sugerido es lo que falta: casi siempre se cobra todo. */
  const valoresDeAlta = () => {
    setMonto(saldo > 0 ? String(saldo) : '')
    setMetodo('transferencia')
    setFechaPago(hoyISO())
    setNotas('')
    setArchivo(null)
    setEditado(null)
    setConfirmando(false)
  }

  const abrir = () => {
    valoresDeAlta()
    setError(null)
    setAbierto(true)
  }

  const corregir = (p: ServicioPago) => {
    setEditado(p)
    setConfirmando(false)
    setMonto(String(p.monto))
    setMetodo(p.metodo)
    setFechaPago(p.fecha)
    setNotas(p.notas ?? '')
    setArchivo(null)
  }

  // Lo que se viene a corregir es el monto: el cursor cae ahí con el número ya
  // escrito y seleccionado, para teclear el bueno encima.
  useEffect(() => {
    if (!editado) return
    campoMonto.current?.focus()
    campoMonto.current?.select()
  }, [editado])

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      // Al corregir sin adjuntar nada, el comprobante que ya traía se queda.
      let ruta: string | null = editado?.comprobante_path ?? null

      if (archivo) {
        setSubiendo(true)
        const supabase = crearClienteNavegador()
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        ruta = `${servicio.servicio_id}/${Date.now()}.${extension}`

        const { error: errorSubida } = await supabase.storage
          .from('comprobantes')
          .upload(ruta, archivo, { contentType: archivo.type })

        setSubiendo(false)
        if (errorSubida) {
          setError(`No se pudo subir el comprobante: ${errorSubida.message}`)
          return
        }
      }

      const datos = {
        monto: num(monto),
        metodo,
        fecha: fechaPago,
        comprobante_path: ruta,
        notas: notas.trim() || null,
      }

      const salida = editado
        ? await actualizarCobroServicio(editado.id, servicio.servicio_id, datos)
        : await registrarCobroServicio({ servicio_id: servicio.servicio_id, ...datos })

      if (!salida.ok) {
        setError(salida.error)
        return
      }

      // Al dar de alta, cerrar es la señal de que quedó. Al corregir no: se
      // vuelve a la lista para revisar que ahora sí cuadre.
      if (editado) valoresDeAlta()
      else setAbierto(false)
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!editado) return
      const salida = await eliminarCobroServicio(editado.id, servicio.servicio_id)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      valoresDeAlta()
      router.refresh()
    })

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-5 text-[15px] font-semibold text-white transition hover:bg-haaco-800 lg:min-h-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-sm"
      >
        <Banknote size={16} />
        {etiqueta ?? (pagos.length > 0 ? 'Otro cobro' : 'Registrar cobro')}
      </button>

      <Dialogo
        abierto={abierto}
        titulo={editado ? 'Corregir el cobro' : 'Registrar cobro'}
        descripcion={`${servicio.folio ?? ''} · ${servicio.cliente} · ${
          saldo > 0 ? `faltan ${pesos(saldo)}` : 'ya está saldado'
        }`}
        onCerrar={() => setAbierto(false)}
      >
        <CuerpoDialogo>
          <Campo
            etiqueta="Monto"
            ancho="medio"
            hijo={
              <Numero
                ref={campoMonto}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                disabled={pendiente}
              />
            }
            ayuda={saldo > 0 ? `Viene con lo que falta: ${pesos(saldo)}` : undefined}
          />

          <Campo
            etiqueta="Fecha del pago"
            ancho="medio"
            hijo={
              <span className="block">
                <SelectorFecha
                  valor={fechaPago}
                  onCambio={setFechaPago}
                  disabled={pendiente}
                  titulo="Fecha del pago"
                />
              </span>
            }
          />

          <Campo
            etiqueta="Método"
            hijo={
              <Opciones
                valor={metodo}
                columnas={2}
                opciones={Object.entries(METODO_PAGO_SIN_CAJA) as [MetodoPago, string][]}
                onCambio={setMetodo}
                deshabilitado={pendiente}
              />
            }
          />

          <Campo
            etiqueta="Comprobante"
            hijo={
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[14px] border border-dashed border-tinta-300 px-3.5 text-sm text-tinta-600 transition hover:border-haaco-400 lg:rounded-lg">
                <Paperclip size={16} />
                {archivo ? archivo.name : 'Adjuntar la ficha o la transferencia'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  disabled={pendiente}
                />
              </label>
            }
          />

          <Campo
            etiqueta="Notas"
            hijo={
              <AreaTexto
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Quién pagó, a qué cuenta, qué quedó pendiente…"
                disabled={pendiente}
              />
            }
          />

          {pagos.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-tinta-700">Lo ya cobrado</p>
              <ul className="divide-y divide-tinta-100 overflow-hidden rounded-[14px] border-[0.5px] border-tinta-200">
                {pagos.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ${
                      editado?.id === p.id ? 'bg-haaco-50' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium tabular-nums text-tinta-900">
                        {pesos(p.monto)}
                      </span>
                      <span className="block truncate text-xs text-tinta-400">
                        {formatoFecha(p.fecha)} · {METODO_PAGO[p.metodo]}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => corregir(p)}
                      className="shrink-0 rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
                      aria-label={`Corregir el cobro de ${pesos(p.monto)}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MensajeError mensaje={error} />
        </CuerpoDialogo>

        <PieDialogo>
          {editado &&
            (confirmando ? (
              <>
                <p className="mr-auto text-sm text-tinta-600 sm:flex-none">
                  ¿Quitar el cobro de {pesos(editado.monto)}?
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
                >
                  No, conservar
                </button>
                <button
                  type="button"
                  onClick={borrar}
                  disabled={pendiente}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  <Trash2 size={15} />
                  Sí, quitar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <Trash2 size={15} />
                Quitar
              </button>
            ))}

          {!confirmando && (
            <>
              <button
                type="button"
                onClick={() => (editado ? valoresDeAlta() : setAbierto(false))}
                className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
              >
                {editado ? 'Dejarlo como estaba' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={pendiente || subiendo}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-5 text-[15px] font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300 lg:min-h-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-sm"
              >
                {subiendo ? 'Subiendo…' : pendiente ? 'Guardando…' : editado ? 'Guardar cambio' : 'Registrar cobro'}
              </button>
            </>
          )}
        </PieDialogo>
      </Dialogo>
    </>
  )
}
