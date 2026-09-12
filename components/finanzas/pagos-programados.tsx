'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones,
  PieConBorrado, PieDialogo, Seleccion, TextoPie,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { fecha, pesos } from '@/lib/format'
import { num } from '@/lib/cotizaciones'
import {
  CATEGORIAS_PAGO_FIJO, METODO_PAGO, METODO_PAGO_SIN_CAJA, PERIODICIDAD_PAGO,
} from '@/lib/finanzas'
import {
  archivarPagoProgramado, eliminarPagoProgramado, guardarPagoProgramado, pagosPorCorregir,
  type PagoPorCorregir,
} from '@/app/admin/finanzas-acciones'
import type {
  MetodoPago, PeriodicidadPago, TipoPagoProgramado, VPagoProgramado,
} from '@/types/database'

type Trabajador = { id: string; nombre: string }

/**
 * La lista de a quién se le paga cada quincena.
 *
 * Se separa en «Personal» y «Servicios» porque es como la revisa la empresa;
 * la categoría es otra cosa —la que agrupa el resumen del contador— y por eso
 * no se usa para partir la pantalla.
 */
export function CatalogoProgramados({
  programados,
  trabajadores,
}: {
  programados: VPagoProgramado[]
  trabajadores: Trabajador[]
}) {
  const [nuevo, setNuevo] = useState<TipoPagoProgramado | null>(null)

  const activos = programados.filter((p) => p.activo)
  const bajas = programados.filter((p) => !p.activo)
  const personal = activos.filter((p) => p.tipo === 'personal')
  const servicios = activos.filter((p) => p.tipo === 'servicio')
  const porQuincena = activos
    .filter((p) => p.periodicidad === 'quincenal')
    .reduce((s, p) => s + Number(p.monto), 0)
  const porMes = activos.reduce(
    (s, p) => s + Number(p.monto) * (p.periodicidad === 'quincenal' ? 2 : 1),
    0,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tinta-600">
          {activos.length === 0
            ? 'Todavía no hay nadie en la lista.'
            : `${activos.length} en la lista · ${pesos(porQuincena)} cada quincena · ${pesos(porMes)} al mes`}
        </p>
        <div className="flex gap-2">
          <BotonNuevo tipo="personal" onClick={() => setNuevo('personal')} />
          <BotonNuevo tipo="servicio" onClick={() => setNuevo('servicio')} />
        </div>
      </div>

      <GrupoProgramados
        titulo="Personal"
        pie="Sueldos y apoyos que se pagan cada quincena. Es distinto de la nómina de oficiales por avance."
        lista={personal}
        trabajadores={trabajadores}
        vacio="Agrega a quien cobra fijo cada quincena."
      />
      <GrupoProgramados
        titulo="Servicios y mensualidades"
        pie="Internet, renta, seguros, el contador."
        lista={servicios}
        trabajadores={trabajadores}
        vacio="Agrega el internet, la renta o lo que se pague cada mes."
      />

      {bajas.length > 0 && (
        <GrupoProgramados
          titulo="Dados de baja"
          pie="Ya no salen en las quincenas nuevas. Lo que se les pagó sigue en el historial."
          lista={bajas}
          trabajadores={trabajadores}
          vacio=""
          apagado
        />
      )}

      {nuevo && (
        <FormularioProgramado
          tipoInicial={nuevo}
          trabajadores={trabajadores}
          onCerrar={() => setNuevo(null)}
        />
      )}
    </div>
  )
}

function BotonNuevo({ tipo, onClick }: { tipo: TipoPagoProgramado; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-haaco-700 px-3.5 text-sm font-medium text-white transition hover:bg-haaco-800 lg:min-h-9 lg:rounded-lg"
    >
      <Plus size={16} />
      {tipo === 'personal' ? 'Personal' : 'Servicio'}
    </button>
  )
}

function GrupoProgramados({
  titulo, pie, lista, trabajadores, vacio, apagado = false,
}: {
  titulo: string
  pie: string
  lista: VPagoProgramado[]
  trabajadores: Trabajador[]
  vacio: string
  apagado?: boolean
}) {
  return (
    <Tarjeta
      titulo={
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>{titulo}</span>
          {lista.length > 0 && (
            <span className="text-xs font-normal text-tinta-500">
              {pesos(lista.reduce((s, p) => s + Number(p.monto), 0))}
            </span>
          )}
        </span>
      }
      pie={pie}
    >
      {lista.length === 0 ? (
        <EstadoVacio titulo="Sin nadie todavía" descripcion={vacio} />
      ) : (
        <ul className="divide-y divide-tinta-100">
          {lista.map((p) => (
            <RenglonProgramado key={p.id} programado={p} trabajadores={trabajadores} apagado={apagado} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function RenglonProgramado({
  programado, trabajadores, apagado,
}: {
  programado: VPagoProgramado
  trabajadores: Trabajador[]
  apagado: boolean
}) {
  const [editando, setEditando] = useState(false)
  const deBaja = programado.trabajador_activo === false

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 lg:gap-3 lg:py-2.5">
      <div className="min-w-0 flex-1 basis-full lg:basis-auto">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta-900">
          <span className={apagado ? 'text-tinta-500' : undefined}>{programado.beneficiario}</span>
          <Etiqueta tono="gris">{programado.categoria}</Etiqueta>
          {programado.periodicidad !== 'quincenal' && (
            <Etiqueta tono="azul">{PERIODICIDAD_PAGO[programado.periodicidad]}</Etiqueta>
          )}
          {deBaja && <Etiqueta tono="rojo">dado de baja</Etiqueta>}
        </p>
        {(programado.descripcion || programado.notas) && (
          <p className="mt-0.5 truncate text-xs text-tinta-500">
            {programado.descripcion}
            {programado.descripcion && programado.notas ? ' · ' : ''}
            {programado.notas}
          </p>
        )}
      </div>

      <span className="text-xs text-tinta-500">{METODO_PAGO[programado.metodo]}</span>
      <span className="ml-auto font-medium tabular-nums text-tinta-900 lg:ml-0 lg:w-24 lg:text-right">
        {pesos(programado.monto)}
      </span>
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-tinta-200 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:min-h-9 lg:rounded-lg lg:px-2.5 lg:text-[13px]"
      >
        <Pencil size={14} />
        Editar
      </button>

      {editando && (
        <FormularioProgramado
          programado={programado}
          trabajadores={trabajadores}
          onCerrar={() => setEditando(false)}
        />
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
function FormularioProgramado({
  programado, tipoInicial, trabajadores, onCerrar,
}: {
  programado?: VPagoProgramado
  tipoInicial?: TipoPagoProgramado
  trabajadores: Trabajador[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoPagoProgramado>(
    programado?.tipo ?? tipoInicial ?? 'servicio',
  )
  const [trabajadorId, setTrabajadorId] = useState(programado?.trabajador_id ?? '')
  const [beneficiario, setBeneficiario] = useState(programado?.beneficiario ?? '')
  const [categoria, setCategoria] = useState(
    programado?.categoria ?? (tipoInicial === 'personal' ? 'Nómina' : 'Servicio'),
  )
  const [monto, setMonto] = useState(String(programado?.monto ?? ''))
  const [metodo, setMetodo] = useState<MetodoPago>(programado?.metodo ?? 'transferencia')
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadPago>(
    programado?.periodicidad ?? 'quincenal',
  )
  const [descripcion, setDescripcion] = useState(programado?.descripcion ?? '')
  const [notas, setNotas] = useState(programado?.notas ?? '')
  const [activo, setActivo] = useState(programado?.activo ?? true)

  /*
   * Sólo el monto pregunta antes de propagar. El nombre, la categoría o el
   * método se corrigen en las quincenas por venir sin consultar —son
   * cosméticos—, pero el monto es una cifra que alguien puede estar leyendo,
   * así que se dice en voz alta qué se va a mover.
   */
  const montoCambio = Boolean(programado) && num(monto) !== Number(programado?.monto ?? 0)
  const [porCorregir, setPorCorregir] = useState<PagoPorCorregir[] | null>(null)

  const enviar = (propagar: boolean) =>
    iniciar(async () => {
      setError(null)
      const r = await guardarPagoProgramado(
        {
          id: programado?.id,
          tipo,
          trabajador_id: tipo === 'personal' && trabajadorId ? trabajadorId : null,
          beneficiario,
          categoria,
          monto: num(monto),
          metodo,
          periodicidad,
          descripcion: descripcion.trim() || null,
          notas: notas.trim() || null,
          activo,
        },
        propagar,
      )
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  /*
   * Antes de preguntar se va a ver qué hay de verdad por corregir. Si no hay
   * nada —todo lo de esa persona ya se pagó— no se pregunta: se guarda y ya.
   */
  const guardar = () => {
    if (!montoCambio || !programado) return enviar(false)
    iniciar(async () => {
      setError(null)
      const r = await pagosPorCorregir(programado.id)
      if (!r.ok) return setError(r.error)
      const lista = r.datos ?? []
      if (lista.length === 0) return enviar(false)
      setPorCorregir(lista)
    })
  }

  const archivar = () =>
    iniciar(async () => {
      if (!programado) return
      const r = await archivarPagoProgramado(programado.id, false)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!programado) return
      const r = await eliminarPagoProgramado(programado.id)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const titulo = programado
    ? 'Editar de la lista'
    : tipo === 'personal'
      ? 'Agregar personal'
      : 'Agregar servicio'

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion="Esto es la lista fija: de aquí salen los pagos de cada quincena."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Qué es"
          ancho="medio"
          hijo={
            <Opciones
              valor={tipo}
              columnas={2}
              opciones={[
                ['personal', 'Personal'],
                ['servicio', 'Servicio'],
              ]}
              onCambio={(v) => {
                const nuevo = v as TipoPagoProgramado
                setTipo(nuevo)
                if (nuevo === 'servicio') setTrabajadorId('')
                if (!programado) setCategoria(nuevo === 'personal' ? 'Nómina' : 'Servicio')
              }}
            />
          }
        />
        <Campo
          etiqueta="Cada cuándo"
          ancho="medio"
          hijo={
            <Seleccion
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadPago)}
            >
              {Object.entries(PERIODICIDAD_PAGO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />

        <Campo
          etiqueta="Beneficiario"
          hijo={
            <Entrada
              value={beneficiario}
              onChange={(e) => setBeneficiario(e.target.value)}
              placeholder={tipo === 'personal' ? 'Nombre de quien cobra' : 'Telmex, Telcel, renta de bodega…'}
              autoFocus
            />
          }
        />

        {tipo === 'personal' && trabajadores.length > 0 && (
          <Campo
            etiqueta="Ficha del trabajador"
            hijo={
              <Seleccion
                value={trabajadorId}
                onChange={(e) => {
                  setTrabajadorId(e.target.value)
                  const elegido = trabajadores.find((t) => t.id === e.target.value)
                  if (elegido && !beneficiario.trim()) setBeneficiario(elegido.nombre)
                }}
              >
                <option value="">Sin ligar</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Seleccion>
            }
            ayuda="Opcional: sirve para llegar a su ficha desde aquí."
          />
        )}

        <Campo
          etiqueta="Categoría"
          ancho="medio"
          hijo={
            <Seleccion value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_PAGO_FIJO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Seleccion>
          }
          ayuda="Así se agrupa en el resumen del contador."
        />
        <Campo
          etiqueta="Monto por pago"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
          ayuda="Es el que sale por omisión; se puede corregir quincena por quincena."
        />
        <Campo
          etiqueta="Método"
          ancho="medio"
          hijo={
            <Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {Object.entries(METODO_PAGO_SIN_CAJA).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Descripción"
          hijo={<Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        {programado && !activo && (
          <Casilla
            etiqueta="Volver a la lista"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
        )}
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      {porCorregir ? (
        <PieDialogo>
          <TextoPie>
            Le cambiaste el monto de {pesos(programado?.monto ?? 0)} a {pesos(num(monto))}.
            ¿Corrijo también {porCorregir.length === 1 ? 'este pago' : `estos ${porCorregir.length} pagos`},
            que todavía no se pagan?
            <span className="mt-1 block text-tinta-800">
              {porCorregir.slice(0, 4).map((p) => (
                <span key={p.id} className="mr-3 inline-block whitespace-nowrap tabular-nums">
                  {fecha(p.quincena)} · {pesos(p.monto)}
                </span>
              ))}
              {porCorregir.length > 4 && <span>y {porCorregir.length - 4} más</span>}
            </span>
          </TextoPie>
          <button
            type="button"
            onClick={() => enviar(false)}
            disabled={pendiente}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
          >
            Dejarlos como están
          </button>
          <button
            type="button"
            onClick={() => enviar(true)}
            disabled={pendiente}
            className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
          >
            {pendiente ? 'Guardando…' : 'Sí, corregirlos'}
          </button>
        </PieDialogo>
      ) : (
        <PieConBorrado
          onCerrar={onCerrar}
          onGuardar={guardar}
          pendiente={pendiente}
          puedeGuardar={Boolean(beneficiario.trim())}
          borrado={
            programado && programado.activo
              ? {
                  pregunta:
                    programado.pagos_generados > 0
                      ? `Ya generó ${programado.pagos_generados} pagos. Se puede sacar de la lista sin perderlos.`
                      : `¿Quitar a ${programado.beneficiario} de la lista?`,
                  onBorrar: programado.pagos_generados > 0 ? archivar : borrar,
                }
              : undefined
          }
        />
      )}
    </Dialogo>
  )
}
