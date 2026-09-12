'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarPlus, Pencil, Plus } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, NumeroCorto, Opciones,
  PieConBorrado, Seleccion,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { fecha, pesos } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { diaDeRaya, etiquetaSemana, semanaDe } from '@/lib/finanzas'
import {
  cancelarRaya, generarRaya, guardarRaya, guardarSueldoSemanal,
} from '@/app/admin/finanzas-acciones'
import type { SueldoSemanal, VRayaSemanal } from '@/types/database'

type Persona = { id: string; nombre: string }
type Obra = { id: string; nombre: string; ot_numero: string | null }

/**
 * La raya de la semana: lo que se le debe a quien cobra sueldo fijo.
 *
 * Corre en paralelo a los contratos por avance —el cliente dijo que las dos
 * formas van a convivir— y se junta con ellos en el recibo, que es uno solo
 * por trabajador.
 */
export function PanelRayas({
  rayas, sueldos, gente, obras, semana,
}: {
  rayas: VRayaSemanal[]
  sueldos: SueldoSemanal[]
  gente: Persona[]
  obras: Obra[]
  semana: string
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)
  const [nuevoSueldo, setNuevoSueldo] = useState(false)

  const generar = () =>
    iniciar(async () => {
      setAviso(null)
      const r = await generarRaya(semana)
      if (!r.ok) return setAviso(r.error)
      setAviso(
        r.datos === 0
          ? 'Ya estaban armadas las rayas de esa semana.'
          : r.datos === 1
            ? `Se armó una raya de la semana ${etiquetaSemana(semana)}.`
            : `Se armaron ${r.datos} rayas de la semana ${etiquetaSemana(semana)}.`,
      )
      router.refresh()
    })

  const deLaSemana = rayas.filter((r) => r.semana === semana)
  const porPagar = deLaSemana.reduce((s, r) => s + Number(r.disponible), 0)
  const nombrePorId = new Map(gente.map((p) => [p.id, p.nombre]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-tinta-600">
          Semana {etiquetaSemana(semana)} · se raya el {fecha(diaDeRaya(semana))}
          {deLaSemana.length > 0 && ` · faltan por pagar ${pesos(porPagar)}`}
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={generar}
            disabled={pendiente}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-tinta-300 bg-white px-3.5 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50 lg:min-h-9 lg:rounded-lg"
          >
            <CalendarPlus size={16} />
            Armar la raya
          </button>
          <button
            type="button"
            onClick={() => setNuevoSueldo(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-haaco-700 px-3.5 text-sm font-medium text-white transition hover:bg-haaco-800 lg:min-h-9 lg:rounded-lg"
          >
            <Plus size={16} />
            Poner a sueldo
          </button>
        </div>
      </div>

      {aviso && (
        <p className="rounded-lg bg-haaco-50 px-4 py-2.5 text-sm text-haaco-800 ring-1 ring-haaco-200">
          {aviso}
        </p>
      )}

      <Tarjeta
        titulo={
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Raya {etiquetaSemana(semana)}</span>
            <span className="text-xs font-normal text-tinta-500">
              {deLaSemana.length} {deLaSemana.length === 1 ? 'persona' : 'personas'}
            </span>
          </span>
        }
        pie="Lo que cobra quien está a sueldo fijo. Los contratos por avance van en las otras pestañas."
      >
        {deLaSemana.length === 0 ? (
          <EstadoVacio
            titulo="Sin rayas esta semana"
            descripcion={
              sueldos.length === 0
                ? 'Primero pon a alguien a sueldo con el botón de arriba.'
                : 'Usa «Armar la raya» para sacarla de los sueldos dados de alta.'
            }
          />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {deLaSemana.map((r) => (
              <RenglonRaya key={r.raya_id} raya={r} obras={obras} />
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Quién está a sueldo"
        pie="Al cambiar el sueldo, las semanas ya armadas conservan el monto con el que salieron."
      >
        {sueldos.length === 0 ? (
          <EstadoVacio titulo="Nadie todavía" descripcion="Aquí aparecen los que cobran fijo cada semana." />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {sueldos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                <div className="min-w-0 flex-1 basis-full lg:basis-auto">
                  <p className="text-sm font-medium text-tinta-900">
                    {nombrePorId.get(s.trabajador_id) ?? 'Trabajador'}
                  </p>
                  <p className="mt-0.5 text-xs text-tinta-500">
                    {s.dias_base} días la semana
                    {Number(s.costo_haaco_pct) > 0 && ` · retiene ${s.costo_haaco_pct}%`}
                    {s.notas ? ` · ${s.notas}` : ''}
                  </p>
                </div>
                <span className="ml-auto font-medium tabular-nums text-tinta-900 lg:ml-0">
                  {pesos(s.monto_semanal)}
                </span>
                <BotonSueldo
                  sueldo={s}
                  gente={gente}
                  obras={obras}
                  nombre={nombrePorId.get(s.trabajador_id) ?? ''}
                />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {nuevoSueldo && (
        <FormularioSueldo gente={gente} obras={obras} onCerrar={() => setNuevoSueldo(false)} />
      )}
    </div>
  )
}

function RenglonRaya({ raya, obras }: { raya: VRayaSemanal; obras: Obra[] }) {
  const [editando, setEditando] = useState(false)
  const completa = Number(raya.dias_trabajados) >= Number(raya.dias_base)
  const sinObra = Number(raya.pct_asignado) === 0

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 lg:gap-3 lg:py-2.5">
      <div className="min-w-0 flex-1 basis-full lg:basis-auto">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta-900">
          {raya.trabajador}
          {!completa && (
            <Etiqueta tono="ambar">
              {raya.dias_trabajados} de {raya.dias_base} días
            </Etiqueta>
          )}
          {Number(raya.ajuste) !== 0 && (
            <Etiqueta tono="azul">
              {Number(raya.ajuste) > 0 ? '+' : ''}
              {pesos(raya.ajuste)}
            </Etiqueta>
          )}
          {raya.estatus === 'cerrada' && <Etiqueta tono="verde">cerrada</Etiqueta>}
          {sinObra && <Etiqueta tono="ambar">sin obra</Etiqueta>}
        </p>
        <p className="mt-0.5 truncate text-xs text-tinta-500">
          {raya.obras ?? 'No se cargó a ninguna obra: cuenta como gasto general.'}
        </p>
      </div>

      <span className="ml-auto font-medium tabular-nums text-tinta-900 lg:ml-0 lg:w-24 lg:text-right">
        {pesos(raya.total)}
      </span>
      <span className="text-xs tabular-nums text-tinta-500 lg:w-24 lg:text-right">
        {Number(raya.pagado) > 0 ? `pagado ${pesos(raya.pagado)}` : 'sin pagar'}
      </span>
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-tinta-200 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:min-h-9 lg:rounded-lg lg:px-2.5 lg:text-[13px]"
      >
        <Pencil size={14} />
        Editar
      </button>

      {editando && <FormularioRaya raya={raya} obras={obras} onCerrar={() => setEditando(false)} />}
    </li>
  )
}

// ---------------------------------------------------------------------------
function FormularioRaya({
  raya, obras, onCerrar,
}: {
  raya: VRayaSemanal
  obras: Obra[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [dias, setDias] = useState(String(raya.dias_trabajados))
  const [ajuste, setAjuste] = useState(String(raya.ajuste ?? 0))
  const [notas, setNotas] = useState(raya.notas ?? '')

  /* El reparto se edita entero y se manda entero, como el recibo: una obra que
     se quita deja de cargar. */
  const [reparto, setReparto] = useState<{ obra_id: string; pct: string }[]>(() => {
    const trozos = (raya.obras ?? '')
      .split(' · ')
      .map((t) => t.match(/^(.*) \(([\d.]+)%\)$/))
      .filter(Boolean) as RegExpMatchArray[]
    return trozos
      .map((m) => ({
        obra_id: obras.find((o) => o.nombre === m[1])?.id ?? '',
        pct: m[2],
      }))
      .filter((r) => r.obra_id)
  })

  const bruto = redondear(
    (Number(raya.monto_semanal) * num(dias)) / Number(raya.dias_base) + num(ajuste),
  )
  const total = redondear(bruto * (1 - Number(raya.costo_haaco_pct) / 100))
  const sumaPct = reparto.reduce((s, r) => s + num(r.pct), 0)

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarRaya({
        raya_id: raya.raya_id,
        dias_trabajados: num(dias),
        ajuste: num(ajuste),
        notas: notas.trim() || null,
        obras: reparto.filter((x) => x.obra_id && num(x.pct) > 0)
          .map((x) => ({ obra_id: x.obra_id, pct: num(x.pct) })),
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const cancelar = () =>
    iniciar(async () => {
      const r = await cancelarRaya(raya.raya_id)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Raya de ${raya.trabajador}`}
      descripcion={`Semana ${etiquetaSemana(raya.semana)}. Se paga el ${fecha(diaDeRaya(raya.semana))}.`}
    >
      <CuerpoDialogo>
        {/* `NumeroCorto` trae su propia etiqueta, así que no va dentro de un
            `Campo`: se pintaba el nombre dos veces, uno encima del otro. */}
        <div className="sm:col-span-1">
          <NumeroCorto
            etiqueta="Días trabajados"
            sufijo={`de ${raya.dias_base}`}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
          <p className="mt-1 text-xs text-tinta-400">Con menos días, el sueldo baja a proporción.</p>
        </div>
        <Campo
          etiqueta="Ajuste"
          ancho="medio"
          hijo={<Numero value={ajuste} onChange={(e) => setAjuste(e.target.value)} />}
          ayuda="Tiempo extra o un bono. En negativo, un descuento."
        />

        <Campo
          etiqueta="A qué obras se le carga"
          hijo={
            <div className="space-y-2">
              {reparto.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Seleccion
                    value={r.obra_id}
                    onChange={(e) =>
                      setReparto((l) => l.map((x, j) => (j === i ? { ...x, obra_id: e.target.value } : x)))
                    }
                  >
                    <option value="">Elegir obra…</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </Seleccion>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={r.pct}
                    onChange={(e) =>
                      setReparto((l) => l.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))
                    }
                    aria-label="Porcentaje de la semana"
                    className="w-20 rounded-[14px] border border-tinta-300 bg-white px-3 py-3 text-right tabular-nums text-tinta-900 outline-none transition focus:border-haaco-600 lg:rounded-lg lg:py-2 lg:text-sm"
                  />
                  <span className="text-sm text-tinta-500">%</span>
                  <button
                    type="button"
                    onClick={() => setReparto((l) => l.filter((_, j) => j !== i))}
                    aria-label="Quitar esta obra"
                    className="rounded-lg p-2 text-tinta-400 transition hover:bg-tinta-100 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setReparto((l) => [...l, { obra_id: '', pct: '' }])}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-haaco-700 transition hover:bg-haaco-50"
              >
                <Plus size={14} />
                Agregar obra
              </button>
            </div>
          }
          ayuda={
            sumaPct === 0
              ? 'Sin obras, la semana cuenta como gasto general de la empresa.'
              : sumaPct > 100
                ? `Va en ${sumaPct}% y no puede pasar de 100.`
                : sumaPct < 100
                  ? `Repartido ${sumaPct}%; el ${redondear(100 - sumaPct)}% restante queda como gasto general.`
                  : 'Repartido al 100%.'
          }
        />

        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        <div className="rounded-xl bg-tinta-50 px-4 py-3 text-sm sm:col-span-2">
          <div className="flex justify-between">
            <span className="text-tinta-600">Bruto</span>
            <span className="font-medium tabular-nums text-tinta-900">{pesos(bruto)}</span>
          </div>
          {Number(raya.costo_haaco_pct) > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-tinta-600">Costo Haaco {raya.costo_haaco_pct}%</span>
              <span className="tabular-nums text-tinta-600">−{pesos(bruto - total)}</span>
            </div>
          )}
          <div className="mt-1.5 flex justify-between border-t border-tinta-200 pt-1.5">
            <span className="font-medium text-tinta-700">Le toca</span>
            <span className="font-semibold tabular-nums text-tinta-900">{pesos(total)}</span>
          </div>
        </div>

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieConBorrado
        onCerrar={onCerrar}
        onGuardar={guardar}
        pendiente={pendiente}
        puedeGuardar={sumaPct <= 100}
        borrado={
          Number(raya.pagado) === 0
            ? {
                pregunta: `¿Cancelar la raya de ${raya.trabajador} de esta semana?`,
                onBorrar: cancelar,
              }
            : undefined
        }
      />
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function BotonSueldo({
  sueldo, gente, obras, nombre,
}: {
  sueldo: SueldoSemanal
  gente: Persona[]
  obras: Obra[]
  nombre: string
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-tinta-200 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 lg:min-h-9 lg:rounded-lg lg:px-2.5 lg:text-[13px]"
      >
        <Pencil size={14} />
        Editar
      </button>
      {abierto && (
        <FormularioSueldo
          sueldo={sueldo}
          nombre={nombre}
          gente={gente}
          obras={obras}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function FormularioSueldo({
  sueldo, nombre, gente, obras, onCerrar,
}: {
  sueldo?: SueldoSemanal
  nombre?: string
  gente: Persona[]
  obras: Obra[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [trabajador, setTrabajador] = useState(sueldo?.trabajador_id ?? '')
  const [monto, setMonto] = useState(String(sueldo?.monto_semanal ?? ''))
  const [dias, setDias] = useState(String(sueldo?.dias_base ?? 6))
  const [pct, setPct] = useState(String(sueldo?.costo_haaco_pct ?? 0))
  const [obra, setObra] = useState(sueldo?.obra_id ?? '')
  const [notas, setNotas] = useState(sueldo?.notas ?? '')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarSueldoSemanal({
        trabajador_id: trabajador,
        monto_semanal: num(monto),
        dias_base: Math.round(num(dias)) || 6,
        costo_haaco_pct: num(pct),
        obra_id: obra || null,
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
      titulo={sueldo ? `Sueldo de ${nombre}` : 'Poner a alguien a sueldo'}
      descripcion="Lo que cobra cada semana, aunque la obra vaya más rápido o más despacio."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Quién"
          hijo={
            <Seleccion
              value={trabajador}
              onChange={(e) => setTrabajador(e.target.value)}
              disabled={Boolean(sueldo)}
            >
              <option value="">Elegir…</option>
              {gente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Seleccion>
          }
          ayuda={sueldo ? 'Para cambiar de persona, da de alta otro sueldo.' : undefined}
        />
        <Campo
          etiqueta="Sueldo a la semana"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
        />
        <Campo
          etiqueta="Días de la semana"
          ancho="medio"
          hijo={
            <Opciones
              valor={dias}
              columnas={2}
              opciones={[
                ['6', 'Lunes a sábado'],
                ['5', 'Lunes a viernes'],
              ]}
              onCambio={setDias}
            />
          }
        />
        <Campo
          etiqueta="Obra de siempre"
          hijo={
            <Seleccion value={obra} onChange={(e) => setObra(e.target.value)}>
              <option value="">Repartir entre sus obras</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Seleccion>
          }
          ayuda="Sin obra fija, la semana se reparte sola entre las obras donde tenga contrato."
        />
        <div className="sm:col-span-1">
          <NumeroCorto
            etiqueta="Costo Haaco"
            sufijo="%"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <p className="mt-1 text-xs text-tinta-400">A sueldo normalmente no se retiene.</p>
        </div>
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieConBorrado
        onCerrar={onCerrar}
        onGuardar={guardar}
        pendiente={pendiente}
        puedeGuardar={Boolean(trabajador) && num(monto) > 0}
        guardar={sueldo ? 'Guardar el cambio' : 'Ponerlo a sueldo'}
      />
    </Dialogo>
  )
}

/** La semana de hoy, para cuando la URL no trae ninguna. */
export const semanaVigente = () => semanaDe(hoyISO())
