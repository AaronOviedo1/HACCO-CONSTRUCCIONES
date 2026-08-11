'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo,
} from '@/components/formulario'
import { CampoDomicilio } from '@/components/campo-domicilio'
import { SelectorFecha } from '@/components/filtro-fechas'
import { num } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { actualizarObra } from '@/app/admin/obras/acciones'
import type { Obra } from '@/types/database'

/**
 * Corregir los datos de la OT.
 *
 * Una obra nace de aprobar una cotización, y hasta ahora nacía con lo que
 * traía y así se quedaba: el nombre mal escrito, el domicilio que resultó ser
 * otro o la fecha de entrega que se movió no tenían dónde corregirse. El
 * estatus sí se cambiaba —los botones de arriba—, pero era lo único.
 *
 * El monto cotizado se puede tocar porque hay obras que se abrieron antes de
 * cerrar el precio, pero se avisa: de ahí cuelga la cobranza.
 */
export function BotonEditarObra({ obra }: { obra: Obra }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Corregir los datos de la obra"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border-[0.5px] border-tinta-300 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 lg:min-h-0 lg:rounded-lg lg:py-2"
      >
        <Pencil size={14} />
        Editar
      </button>

      {abierto && <FormularioObra obra={obra} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

function FormularioObra({ obra, onCerrar }: { obra: Obra; onCerrar: () => void }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState(obra.nombre)
  const [domicilio, setDomicilio] = useState(obra.domicilio ?? '')
  const [monto, setMonto] = useState(String(Number(obra.monto_cotizado)))
  const [entrega, setEntrega] = useState(obra.fecha_estimada_entrega ?? '')
  const [notas, setNotas] = useState(obra.notas ?? '')

  const montoCambia = num(monto) !== Number(obra.monto_cotizado)

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      if (!nombre.trim()) return setError('La obra necesita un nombre.')
      if (num(monto) < 0) return setError('El monto cotizado no puede ser negativo.')

      const r = await actualizarObra(obra.id, {
        nombre: nombre.trim(),
        domicilio: domicilio.trim() || null,
        monto_cotizado: num(monto),
        fecha_estimada_entrega: entrega || null,
        notas: notas.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Datos de la obra"
      descripcion="El estatus se cambia con los botones de la OT; aquí va lo demás."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Nombre de la obra"
          hijo={<Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />}
        />
        <Campo
          etiqueta="Domicilio"
          hijo={<CampoDomicilio valor={domicilio} onCambio={setDomicilio} />}
        />
        <Campo
          etiqueta="Monto cotizado"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
          ayuda={
            montoCambia
              ? `Era ${pesos(obra.monto_cotizado)}. De aquí cuelga la cobranza de la obra.`
              : 'De aquí cuelga la cobranza de la obra.'
          }
        />
        <Campo
          etiqueta="Entrega estimada"
          ancho="medio"
          hijo={<SelectorFecha valor={entrega} onCambio={setEntrega} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
