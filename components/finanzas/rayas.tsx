'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarPlus, HandCoins, Pencil, Plus, Wallet } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, NumeroCorto, Opciones,
  PieConBorrado, PieDialogo, Seleccion, TextoPie,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { FiltroSemana, SelectorFecha } from '@/components/filtro-fechas'
import { DialogoPago, DialogoPrestamo } from '@/components/finanzas/nomina'
import { fecha, pesos } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { diaDeRaya, etiquetaSemana } from '@/lib/finanzas'
import {
  cancelarRaya, generarRaya, guardarRaya, guardarSueldoSemanal,
} from '@/app/admin/finanzas-acciones'
import type {
  Deduccion, VNominaContrato, VPrenomina, VRayaSemanal, VSueldoSemanal,
} from '@/types/database'

type Persona = { id: string; nombre: string }
type Obra = { id: string; nombre: string; ot_numero: string | null }

/**
 * Un renglón del reparto mientras se está capturando.
 *
 * El porcentaje viaja como texto y no como número: es lo que se está tecleando,
 * y convertirlo en cada pulsación convertía «5» en 5 antes de poder escribir el
 * «0» de «50».
 */
type Renglon = { obra_id: string; pct: string }

/**
 * Entre qué obras se reparte, en porcentaje.
 *
 * Lo usan las dos pantallas que reparten: la del trato —«entre estas tres anda
 * Jorge»— y la de una semana suelta, para corregirla cuando esa semana no fue
 * como las demás. Es el mismo gesto y tiene que verse y comportarse igual; si
 * se escribiera dos veces, en la segunda corrección ya no coincidirían.
 */
function RepartoObras({
  reparto, obras, onCambio,
}: {
  reparto: Renglon[]
  obras: Obra[]
  onCambio: (reparto: Renglon[]) => void
}) {
  /* Dos obras son 50 y 50; tres son 33.34, 33.33 y 33.33. El sobrante de la
     división se le carga al primero para que la suma dé 100 clavado y no 99.99,
     que se lee como un error de captura. */
  const partesIguales = () => {
    if (reparto.length === 0) return
    const parte = redondear(100 / reparto.length)
    onCambio(
      reparto.map((r, i) => ({
        ...r,
        pct: String(i === 0 ? redondear(100 - parte * (reparto.length - 1)) : parte),
      })),
    )
  }

  return (
    <div className="space-y-2">
      {reparto.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Seleccion
            value={r.obra_id}
            onChange={(e) =>
              onCambio(reparto.map((x, j) => (j === i ? { ...x, obra_id: e.target.value } : x)))
            }
          >
            <option value="">Elegir obra…</option>
            {/* Una obra ya elegida en otro renglón no se ofrece: dos renglones
                de la misma obra se suman en uno al guardar, y en pantalla
                parecían dos cosas distintas. */}
            {obras
              .filter((o) => o.id === r.obra_id || !reparto.some((x) => x.obra_id === o.id))
              .map((o) => (
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
              onCambio(reparto.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))
            }
            aria-label="Porcentaje del sueldo"
            className="w-20 rounded-[14px] border border-tinta-300 bg-white px-3 py-3 text-right tabular-nums text-tinta-900 outline-none transition focus:border-haaco-600 lg:rounded-lg lg:py-2 lg:text-sm"
          />
          <span className="text-sm text-tinta-500">%</span>
          <button
            type="button"
            onClick={() => onCambio(reparto.filter((_, j) => j !== i))}
            aria-label="Quitar esta obra"
            className="rounded-lg p-2 text-tinta-400 transition hover:bg-tinta-100 hover:text-red-700"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onCambio([...reparto, { obra_id: '', pct: '' }])}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-haaco-700 transition hover:bg-haaco-50"
        >
          <Plus size={14} />
          Agregar obra
        </button>
        {reparto.length > 1 && (
          <button
            type="button"
            onClick={partesIguales}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-tinta-600 transition hover:bg-tinta-100"
          >
            Partes iguales
          </button>
        )}
      </div>
    </div>
  )
}

/** Cómo va el reparto, dicho en una línea bajo el campo. */
function ayudaReparto(sumaPct: number, vacio: string): string {
  if (sumaPct === 0) return vacio
  if (sumaPct > 100) return `Va en ${sumaPct}% y no puede pasar de 100.`
  if (sumaPct < 100) {
    return `Repartido ${sumaPct}%; el ${redondear(100 - sumaPct)}% restante queda como gasto general.`
  }
  return 'Repartido al 100%.'
}

const renglonesDe = (reparto: { obra_id: string; pct: number }[] | null): Renglon[] =>
  (reparto ?? []).map((r) => ({ obra_id: r.obra_id, pct: String(r.pct) }))

const aGuardar = (reparto: Renglon[]) =>
  reparto
    .filter((x) => x.obra_id && num(x.pct) > 0)
    .map((x) => ({ obra_id: x.obra_id, pct: num(x.pct) }))

/**
 * La raya de la semana: lo que se le debe a quien cobra sueldo fijo.
 *
 * Corre en paralelo a los contratos por avance —el cliente dijo que las dos
 * formas van a convivir— y se junta con ellos en el recibo, que es uno solo
 * por trabajador.
 */
export function PanelRayas({
  rayas, canceladas, sueldos, gente, obras, semana, semanaDeHoy,
  contratos, prenomina, deducciones,
}: {
  rayas: VRayaSemanal[]
  /** Las canceladas de la semana que se está viendo: se enseñan, no se esconden. */
  canceladas: VRayaSemanal[]
  sueldos: VSueldoSemanal[]
  gente: Persona[]
  obras: Obra[]
  semana: string
  /** El lunes de la semana en curso, para el atajo de «Esta semana». */
  semanaDeHoy: string
  /* Los tres siguientes son para poder pagar y descontar préstamos sin salir de
     aquí: el recibo es uno solo por trabajador y puede llevar también sus obras
     a destajo, así que el diálogo de pago necesita verlo todo. */
  contratos: VNominaContrato[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)
  const [nuevoSueldo, setNuevoSueldo] = useState(false)

  /*
   * Armar la semana, y decir la verdad de lo que pasó.
   *
   * El aviso tenía una sola respuesta para los tres casos en que no nace nada
   * —ya estaban, estaban canceladas, o nadie estaba a sueldo entonces— y
   * contestaba siempre «ya estaban armadas». Con eso, quien canceló una semana
   * para rehacerla se quedaba mirando una lista vacía que le juraba estar
   * llena, y quien quiso armar una semana de antes del alta no tenía cómo
   * enterarse de que el trato empezaba después.
   */
  const generar = () =>
    iniciar(async () => {
      setAviso(null)
      const r = await generarRaya(semana)
      if (!r.ok) return setAviso(r.error)

      const { armadas = 0, rearmadas = 0, ya_estaban = 0, sin_sueldo = 0 } = r.datos ?? {}
      const nacidas = armadas + rearmadas

      setAviso(
        nacidas > 0
          ? (nacidas === 1
              ? `Se armó una raya de la semana ${etiquetaSemana(semana)}.`
              : `Se armaron ${nacidas} rayas de la semana ${etiquetaSemana(semana)}.`) +
            (rearmadas > 0
              ? rearmadas === 1
                ? ' Una estaba cancelada y volvió con el sueldo de hoy.'
                : ` ${rearmadas} estaban canceladas y volvieron con el sueldo de hoy.`
              : '')
          : ya_estaban > 0
            ? 'Ya estaban armadas las rayas de esa semana.'
            : sin_sueldo > 0
              ? `Nadie estaba a sueldo la semana ${etiquetaSemana(semana)}. ` +
                'Si ya trabajaba entonces, edita su sueldo y adelanta la fecha de «a sueldo desde».'
              : 'Todavía no hay nadie a sueldo. Ponlo con el botón de arriba.',
      )
      router.refresh()
    })

  const deLaSemana = rayas.filter((r) => r.semana === semana)
  const porPagar = deLaSemana.reduce((s, r) => s + Number(r.disponible), 0)

  /*
   * Lo que cada quien debe de préstamos, para poder verlo aquí.
   *
   *   «y tambien el poder realizar descuentos de prestamos desde esta opcion»
   *
   * El descuento se aplicaba —y se sigue aplicando— en el recibo, que es donde
   * baja el efectivo que se entrega. Lo que faltaba era que desde la semana se
   * viera que hay uno pendiente y se llegara al recibo de un toque: el sábado
   * se paga mirando esta pantalla, y el préstamo no se asomaba por ningún lado.
   */
  const pendientes = deducciones.filter((d) => !d.saldado)
  const prestamosDe = (trabajadorId: string) =>
    pendientes
      .filter((d) => d.trabajador_id === trabajadorId)
      .reduce((s, d) => s + Number(d.monto), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Con las flechas se llega a las semanas que quedaron pendientes: la
            raya se arma y se paga donde se está parado, no sólo en la de hoy. */}
        <FiltroSemana semana={semana} hoy={semanaDeHoy} />
        {deLaSemana.length > 0 && (
          <span className="text-sm text-tinta-600">faltan por pagar {pesos(porPagar)}</span>
        )}
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
              canceladas.length > 0
                ? 'La que había se canceló. Con «Armar la raya» vuelve, con el sueldo de hoy.'
                : sueldos.length === 0
                  ? 'Primero pon a alguien a sueldo con el botón de arriba.'
                  : 'Usa «Armar la raya» para sacarla de los sueldos dados de alta.'
            }
          />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {deLaSemana.map((r) => (
              <RenglonRaya
                key={r.raya_id}
                raya={r}
                obras={obras}
                prestamos={prestamosDe(r.trabajador_id)}
                contratos={contratos}
                prenomina={prenomina}
                deducciones={deducciones}
                rayas={rayas}
              />
            ))}
          </ul>
        )}

        {/* Las canceladas de la semana, a la vista.
            Escondidas, una semana cancelada era un callejón sin salida: no se
            veía, y «Armar la raya» chocaba con ella sin poder decirlo. */}
        {canceladas.length > 0 && (
          <ul className="divide-y divide-tinta-100 border-t border-tinta-100 bg-tinta-50/60">
            {canceladas.map((r) => (
              <li key={r.raya_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta-500">
                  {r.trabajador}
                  <Etiqueta tono="rojo">cancelada</Etiqueta>
                </p>
                <span className="ml-auto text-sm tabular-nums text-tinta-400 line-through">
                  {pesos(r.total)}
                </span>
                <p className="basis-full text-xs text-tinta-500">
                  Con «Armar la raya» vuelve, con el sueldo que esté vigente hoy.
                </p>
              </li>
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
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta-900">
                    {s.trabajador}
                    {prestamosDe(s.trabajador_id) > 0 && (
                      <Etiqueta tono="ambar">debe {pesos(prestamosDe(s.trabajador_id))}</Etiqueta>
                    )}
                  </p>
                  {/* A qué obras se le carga, que es lo que se vino a elegir:
                      sin verlo aquí no hay manera de saber si quedó como se
                      quería sin volver a abrir el diálogo. */}
                  <p className="mt-0.5 truncate text-xs text-tinta-500">
                    {s.obras ?? 'Se reparte solo entre las obras donde tenga contrato'}
                  </p>
                  {/* Desde cuándo cobra fijo es lo que decide qué semanas se le
                      pueden armar, y no se veía en ningún lado: quien quería
                      registrar una semana de antes no tenía cómo saber por qué
                      salía vacía. */}
                  <p className="mt-0.5 text-xs text-tinta-400">
                    {s.dias_base} días la semana · a sueldo desde el {fecha(s.vigencia_desde)}
                    {Number(s.costo_haaco_pct) > 0 && ` · retiene ${s.costo_haaco_pct}%`}
                    {s.notas ? ` · ${s.notas}` : ''}
                  </p>
                </div>
                <span className="ml-auto font-medium tabular-nums text-tinta-900 lg:ml-0">
                  {pesos(s.monto_semanal)}
                </span>
                <BotonPrestamo
                  prenomina={prenomina}
                  trabajadorId={s.trabajador_id}
                  nombre={s.trabajador}
                />
                <BotonSueldo sueldo={s} gente={gente} obras={obras} />
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

/** Apuntarle un préstamo a alguien sin salir de la raya. */
function BotonPrestamo({
  prenomina, trabajadorId, nombre,
}: {
  prenomina: VPrenomina[]
  trabajadorId: string
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
        <HandCoins size={14} />
        Préstamo
      </button>
      {abierto && (
        <DialogoPrestamo
          prenomina={prenomina}
          trabajadorInicial={trabajadorId}
          nombreInicial={nombre}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function RenglonRaya({
  raya, obras, prestamos, contratos, rayas, prenomina, deducciones,
}: {
  raya: VRayaSemanal
  obras: Obra[]
  /** Lo que debe de préstamos sin saldar, para poder verlo antes de pagarle. */
  prestamos: number
  contratos: VNominaContrato[]
  rayas: VRayaSemanal[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
}) {
  const [editando, setEditando] = useState(false)
  const [pagando, setPagando] = useState(false)
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
          {prestamos > 0 && <Etiqueta tono="ambar">debe {pesos(prestamos)}</Etiqueta>}
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
      {/* El sábado se paga mirando esta pantalla. El recibo se abre con la
          semana y sus préstamos ya marcados, y ahí se descuentan: no hay un
          segundo lugar donde se mueva ese dinero. */}
      {Number(raya.disponible) > 0 && (
        <button
          type="button"
          onClick={() => setPagando(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-haaco-700 px-3 text-sm font-medium text-white transition hover:bg-haaco-800 lg:min-h-9 lg:rounded-lg lg:px-2.5 lg:text-[13px]"
        >
          <Wallet size={14} />
          Pagar
        </button>
      )}

      {editando && <FormularioRaya raya={raya} obras={obras} onCerrar={() => setEditando(false)} />}
      {pagando && (
        <DialogoPago
          contratos={contratos}
          rayas={rayas}
          prenomina={prenomina}
          deducciones={deducciones}
          trabajadorInicial={raya.trabajador_id}
          rayaInicial={raya.raya_id}
          onCerrar={() => setPagando(false)}
        />
      )}
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

  /* Con abonos, el monto ya quedó en un recibo firmado: la base no deja mover
     los días ni el ajuste, y aquí se dice antes de que lo intenten. El reparto
     entre obras sí se corrige, porque no cambia lo que se le debe a nadie. */
  const conAbonos = Number(raya.pagado) > 0
  const [dias, setDias] = useState(String(raya.dias_trabajados))
  const [ajuste, setAjuste] = useState(String(raya.ajuste ?? 0))
  const [notas, setNotas] = useState(raya.notas ?? '')

  /* El reparto se edita entero y se manda entero, como el recibo: una obra que
     se quita deja de cargar. Sale de `obras_json`, que trae los ids; antes se
     deshacía con una expresión regular el texto «COLOSSUS (50.00%) · Pomona
     (50.00%)» y se buscaba cada obra por su nombre, lo que se rompía con dos
     obras homónimas —«Casa Hernández», de dos años distintos— o con un nombre
     que llevara « · ». */
  const [reparto, setReparto] = useState<Renglon[]>(() => renglonesDe(raya.obras_json))

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
        obras: aGuardar(reparto),
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
            disabled={conAbonos}
          />
          <p className="mt-1 text-xs text-tinta-400">
            {conAbonos
              ? 'Ya se pagó: para cambiar los días, cancela primero el recibo.'
              : 'Con menos días, el sueldo baja a proporción.'}
          </p>
        </div>
        <Campo
          etiqueta="Ajuste"
          ancho="medio"
          hijo={<Numero value={ajuste} onChange={(e) => setAjuste(e.target.value)} disabled={conAbonos} />}
          ayuda="Tiempo extra o un bono. En negativo, un descuento."
        />

        <Campo
          etiqueta="A qué obras se le carga"
          hijo={<RepartoObras reparto={reparto} obras={obras} onCambio={setReparto} />}
          ayuda={ayudaReparto(
            sumaPct,
            'Sin obras, la semana cuenta como gasto general de la empresa.',
          )}
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
  sueldo, gente, obras,
}: {
  sueldo: VSueldoSemanal
  gente: Persona[]
  obras: Obra[]
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
          gente={gente}
          obras={obras}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function FormularioSueldo({
  sueldo, gente, obras, onCerrar,
}: {
  sueldo?: VSueldoSemanal
  gente: Persona[]
  obras: Obra[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const [trabajador, setTrabajador] = useState(sueldo?.trabajador_id ?? '')
  const [monto, setMonto] = useState(String(sueldo?.monto_semanal ?? ''))
  const [dias, setDias] = useState(String(sueldo?.dias_base ?? 6))
  const [pct, setPct] = useState(String(sueldo?.costo_haaco_pct ?? 0))
  const [notas, setNotas] = useState(sueldo?.notas ?? '')
  /*
   * Desde cuándo cobra fijo.
   *
   * Era siempre «hoy», porque un sueldo se da de alta el día que empieza. Pero
   * lo primero que hay que hacer con esta pantalla es alcanzar el pasado:
   * semanas ya trabajadas y sin registrar, con un trato que para la base nació
   * antier. Puesto hacia atrás, esas semanas se pueden armar.
   */
  const [desde, setDesde] = useState(sueldo?.vigencia_desde ?? hoyISO())

  /*
   * Entre qué obras se reparte.
   *
   *   «se puede ajustar para poder seleccionar entre que obras se va a repartir
   *    el sueldo, actualmente solo me permite seleccionar entre todas, o solo
   *    una»
   *
   * Aquí había un desplegable de una sola obra, y por eso no había manera de
   * decir lo de en medio, que es lo normal: anda en dos de las cinco, y no
   * mitad y mitad. Es la misma lista de la raya, porque es lo mismo: lo que se
   * escribe aquí es lo que sale cada lunes.
   */
  const [reparto, setReparto] = useState<Renglon[]>(() => renglonesDe(sueldo?.obras_json ?? null))
  const sumaPct = reparto.reduce((s, r) => s + num(r.pct), 0)

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarSueldoSemanal({
        trabajador_id: trabajador,
        monto_semanal: num(monto),
        dias_base: Math.round(num(dias)) || 6,
        costo_haaco_pct: num(pct),
        obras: aGuardar(reparto),
        notas: notas.trim() || null,
        desde,
      })
      if (!r.ok) return setError(r.error)
      router.refresh()

      /*
       * Las semanas abiertas se reparten de nuevo con lo que se acaba de
       * decidir, y eso hay que decirlo: son renglones que cambian en la tarjeta
       * de arriba sin que nadie los tocara ahí. Si no cambió ninguna, no hay
       * nada que contar y el diálogo se cierra como siempre.
       */
      const ajustadas = r.datos?.rayas_ajustadas ?? 0
      if (ajustadas === 0) return onCerrar()
      setHecho(
        `Guardado. Se repartió de nuevo ${ajustadas === 1 ? 'la semana que sigue abierta' : `las ${ajustadas} semanas que siguen abiertas`} y sin pagar. ` +
          'Las ya pagadas se quedaron como estaban; ésas se corrigen desde su propio renglón.',
      )
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={sueldo ? `Sueldo de ${sueldo.trabajador}` : 'Poner a alguien a sueldo'}
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
          etiqueta="A sueldo desde"
          ancho="medio"
          hijo={<SelectorFecha valor={desde} onCambio={setDesde} />}
          ayuda="De aquí en adelante se le pueden armar sus semanas. Ponlo antes si le vas a registrar semanas ya trabajadas."
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
          etiqueta="Entre qué obras se reparte"
          hijo={<RepartoObras reparto={reparto} obras={obras} onCambio={setReparto} />}
          ayuda={ayudaReparto(
            sumaPct,
            'Sin ninguna, cada semana se reparte sola entre las obras donde tenga contrato.',
          )}
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

      {hecho ? (
        <PieDialogo>
          <TextoPie>{hecho}</TextoPie>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
          >
            Listo
          </button>
        </PieDialogo>
      ) : (
        <PieConBorrado
          onCerrar={onCerrar}
          onGuardar={guardar}
          pendiente={pendiente}
          puedeGuardar={Boolean(trabajador) && num(monto) > 0 && sumaPct <= 100}
          guardar={sueldo ? 'Guardar el cambio' : 'Ponerlo a sueldo'}
        />
      )}
    </Dialogo>
  )
}
