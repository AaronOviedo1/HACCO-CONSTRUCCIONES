'use client'

import { useRef, useState, useTransition } from 'react'
import { Check, Loader2, Phone } from 'lucide-react'
import { MensajeError, Numero, Seleccion } from '@/components/formulario'
import { pesos } from '@/lib/format'
import { antiguedad, COLOR_SEMAFORO, procedencia } from '@/lib/precios'
import { registrarPrecio } from '@/app/admin/precios/acciones'
import type { FilaRonda } from '@/app/admin/precios/datos'

/**
 * La lista de llamadas del día.
 *
 * Está con el teléfono en la mano: teclea el precio, Enter, y el foco salta al
 * siguiente. Sin diálogo por fila y sin ratón. El número del proveedor va como
 * enlace `tel:` porque marcar desde aquí es la mitad de la velocidad.
 *
 * Lo que teclea entra directo al catálogo: está viendo la cifra mientras se la
 * dictan, y hacerla aprobarla otra vez en una bandeja no protege de nada.
 */
export function RondaHoy({
  filas,
  proveedores,
}: {
  filas: FilaRonda[]
  proveedores: { id: string; nombre: string }[]
}) {
  const pendientes = filas.filter((f) => f.estado === 'pendiente')
  const listas = filas.filter((f) => f.estado !== 'pendiente')
  const campos = useRef<(HTMLInputElement | null)[]>([])

  if (filas.length === 0) {
    return (
      <p className="text-sm text-tinta-500">
        Hoy no hay nada que preguntar: todos los materiales que se siguen tienen precio
        reciente. La lista se arma sola cada mañana.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {pendientes.map((fila, i) => (
        <FilaPrecio
          key={fila.producto_id}
          fila={fila}
          proveedores={proveedores}
          refCampo={(el) => { campos.current[i] = el }}
          onListo={() => campos.current[i + 1]?.focus()}
        />
      ))}

      {listas.length > 0 && (
        <div className="pt-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-400">
            Ya preguntados hoy
          </p>
          <ul className="divide-y divide-tinta-100 rounded-[14px] border-[0.5px] border-tinta-200 bg-tinta-50/60">
            {listas.map((f) => (
              <li key={f.producto_id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-tinta-600">
                  <Check size={14} className="shrink-0 text-haaco-700" />
                  {f.producto}
                </span>
                {f.ultimo && (
                  <span className="shrink-0 tabular-nums text-tinta-500">
                    {pesos(f.ultimo.precio_neto)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FilaPrecio({
  fila,
  proveedores,
  refCampo,
  onListo,
}: {
  fila: FilaRonda
  proveedores: { id: string; nombre: string }[]
  refCampo: (el: HTMLInputElement | null) => void
  onListo: () => void
}) {
  const [precio, setPrecio] = useState('')
  const [proveedorId, setProveedorId] = useState(fila.proveedor_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const guardar = () => {
    const monto = Number(precio.replace(/[^\d.]/g, ''))
    if (!(monto > 0)) return
    setError(null)
    iniciar(async () => {
      const r = await registrarPrecio({
        producto_id: fila.producto_id,
        proveedor_id: proveedorId || null,
        precio_neto: monto,
        origen: 'llamada',
        aprobar: true,
      })
      if (!r.ok) return setError(r.error)
      setGuardado(true)
      onListo()
    })
  }

  if (guardado) {
    return (
      <div className="flex items-center gap-2 rounded-[14px] border-[0.5px] border-haaco-200 bg-haaco-50 px-3.5 py-2.5 text-sm text-haaco-900">
        <Check size={15} className="shrink-0" />
        <span className="min-w-0 truncate font-medium">{fila.producto}</span>
        <span className="ml-auto shrink-0 tabular-nums">{pesos(Number(precio))}</span>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] border-[0.5px] border-tinta-200 bg-white px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium text-tinta-800">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                COLOR_SEMAFORO[fila.ultimo?.semaforo ?? 'rojo']
              }`}
            />
            <span className="min-w-0 truncate">{fila.producto}</span>
            <span className="shrink-0 text-xs font-normal text-tinta-400">
              por {fila.unidad}
            </span>
          </p>
          <p className="mt-0.5 pl-3 text-[11px] leading-tight text-tinta-400">
            {fila.ultimo ? (
              <>
                <span className="tabular-nums">{pesos(fila.ultimo.precio_neto)}</span>
                {' · '}
                {procedencia(fila.ultimo)} · {antiguedad(fila.ultimo.dias)}
              </>
            ) : (
              (fila.motivo ?? 'Sin precio registrado')
            )}
            {fila.usos > 0 && ` · ${fila.usos} ${fila.usos === 1 ? 'cotización' : 'cotizaciones'} en 60 días`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {fila.telefono && (
            <a
              href={`tel:${fila.telefono.replace(/[^\d+]/g, '')}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-haaco-700 transition hover:bg-haaco-50 lg:h-9 lg:w-9"
              aria-label={`Llamar a ${fila.proveedor ?? 'el proveedor'}`}
            >
              <Phone size={16} />
            </a>
          )}

          <div className="w-36">
            <Seleccion
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              aria-label="Proveedor"
            >
              <option value="">¿A quién?</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Seleccion>
          </div>

          <div className="w-28">
            <Numero
              ref={refCampo}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  guardar()
                }
              }}
              placeholder={`$ por ${fila.unidad}`}
              disabled={pendiente}
            />
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={pendiente || !precio.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-haaco-700 text-white transition hover:bg-haaco-800 disabled:opacity-40 lg:h-9 lg:w-9"
            aria-label="Guardar el precio"
          >
            {pendiente ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
        </div>
      </div>

      {fila.ultimo?.unidad_distinta && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          El último precio se anotó por {fila.ultimo.unidad_observada} y el catálogo va por{' '}
          {fila.unidad}: pregunta por {fila.unidad}, aquí no se convierte solo.
        </p>
      )}
      <div className="mt-2 empty:mt-0"><MensajeError mensaje={error} /></div>
    </div>
  )
}
