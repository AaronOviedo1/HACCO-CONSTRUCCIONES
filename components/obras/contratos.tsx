'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { FileDown, PenLine, Plus, Trash2, UserRoundCog, Wrench, X } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { fecha, pesos, porcentaje } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { GRUPOS_TRABAJOS, leerReparaciones, resumirTrabajos } from '@/lib/obras'
import { REGLAS } from '@/lib/empresa'
import {
  cancelarPagare, crearPagare, devolverHerramienta, eliminarContrato, firmarContrato,
  guardarContrato, reasignarContrato,
} from '@/app/admin/obras/acciones'
import type { ContratoOficial, Profile } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

type Reparacion = { descripcion: string; importe: string }

export function PanelContratos({ datos }: { datos: DatosObra }) {
  const [nuevo, setNuevo] = useState(false)
  const [editando, setEditando] = useState<ContratoOficial | null>(null)
  const [pagareDe, setPagareDe] = useState<ContratoOficial | null>(null)
  const [reasignando, setReasignando] = useState<ContratoOficial | null>(null)
  const cerrada = datos.concentrado.estatus === 'cerrada'

  // Con `trabajadores` y no con `oficiales`: si un pintor se dio de baja, su
  // contrato firmado tiene que seguir mostrando su nombre.
  const porTrabajador = new Map(datos.trabajadores.map((o) => [o.id, o]))

  return (
    <div className="space-y-4">
      {datos.contratos.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Sin contratos de mano de obra"
            descripcion="El contrato por obra determinada fija los trabajos, los m² y la tarifa. Al crearlo aparece solo en Nómina."
            accion={
              !cerrada ? (
                <button
                  type="button"
                  onClick={() => setNuevo(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  <Plus size={16} />
                  Nuevo contrato
                </button>
              ) : undefined
            }
          />
        </Tarjeta>
      ) : (
        <>
          {datos.contratos.map((contrato) => {
            const oficial = porTrabajador.get(contrato.trabajador_id)
            const pagare = datos.pagares.find((p) => p.contrato_id === contrato.id)
            const items = datos.pagareItems.filter((i) => i.pagare_id === pagare?.id)
            const nomina = datos.nomina.find((n) => n.contrato_id === contrato.id)

            return (
              <TarjetaContrato
                key={contrato.id}
                contrato={contrato}
                oficial={oficial}
                pagare={pagare}
                items={items}
                herramientas={datos.herramientas}
                pagado={Number(nomina?.pagado ?? 0)}
                pctPagado={Number(nomina?.pct_pagado ?? 0)}
                obraId={datos.obra.id}
                cerrada={cerrada}
                onEditar={() => setEditando(contrato)}
                onPagare={() => setPagareDe(contrato)}
                onReasignar={() => setReasignando(contrato)}
              />
            )
          })}

          {!cerrada && (
            <button
              type="button"
              onClick={() => setNuevo(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-tinta-300 px-4 py-2.5 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50"
            >
              <Plus size={16} />
              Otro contrato
            </button>
          )}
        </>
      )}

      {(nuevo || editando) && (
        <FormularioContrato
          obraId={datos.obra.id}
          trabajadores={datos.trabajadores}
          contrato={editando ?? undefined}
          onCerrar={() => {
            setNuevo(false)
            setEditando(null)
          }}
        />
      )}

      {pagareDe && (
        <FormularioPagare
          obraId={datos.obra.id}
          contrato={pagareDe}
          oficial={porTrabajador.get(pagareDe.trabajador_id)}
          herramientas={datos.herramientas}
          onCerrar={() => setPagareDe(null)}
        />
      )}

      {reasignando && (
        <DialogoReasignar
          obraId={datos.obra.id}
          contrato={reasignando}
          sale={porTrabajador.get(reasignando.trabajador_id)}
          candidatos={datos.oficiales.filter((o) => o.id !== reasignando.trabajador_id)}
          nomina={datos.nomina.find((n) => n.contrato_id === reasignando.id)}
          onCerrar={() => setReasignando(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function TarjetaContrato({
  contrato, oficial, pagare, items, herramientas, pagado, pctPagado, obraId, cerrada,
  onEditar, onPagare, onReasignar,
}: {
  contrato: ContratoOficial
  oficial?: Profile
  pagare?: DatosObra['pagares'][number]
  items: DatosObra['pagareItems']
  herramientas: DatosObra['herramientas']
  pagado: number
  pctPagado: number
  obraId: string
  cerrada: boolean
  onEditar: () => void
  onPagare: () => void
  onReasignar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const trabajos = resumirTrabajos(contrato.trabajos)
  const reparaciones = leerReparaciones(contrato.reparaciones)
  const porCodigo = new Map(herramientas.map((h) => [h.id, h]))

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la operación.')
      router.refresh()
    })

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tinta-100 px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-tinta-900">{oficial?.nombre ?? 'Oficial'}</h3>
            <Etiqueta tono={contrato.estatus === 'activo' ? 'verde' : 'gris'}>
              {contrato.estatus === 'activo' ? 'Activo' : 'Cerrado'}
            </Etiqueta>
            {oficial?.es_externo && <Etiqueta tono="ambar">Externo</Etiqueta>}
            {oficial?.oficio && <Etiqueta tono="gris">{oficial.oficio}</Etiqueta>}
          </div>
          <p className="mt-0.5 text-xs text-tinta-500">
            {contrato.fecha_inicia ? `Inicia ${fecha(contrato.fecha_inicia)}` : 'Sin fecha de inicio'}
            {contrato.fecha_finaliza && ` · Finaliza ${fecha(contrato.fecha_finaliza)}`}
            {contrato.fecha_cierre && ` · Cerrado ${fecha(contrato.fecha_cierre)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={`/api/contratos/${contrato.id}/pdf`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            <FileDown size={14} />
            Contrato
          </a>
          {!cerrada && (
            <>
              {!pagare && (
                <button
                  type="button"
                  onClick={onPagare}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                >
                  <Wrench size={14} />
                  Pagaré
                </button>
              )}
              {contrato.estatus === 'activo' && (
                <button
                  type="button"
                  onClick={onReasignar}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                  title="Pasarle lo que falta a otro oficial"
                >
                  <UserRoundCog size={14} />
                  Reasignar
                </button>
              )}
              <button
                type="button"
                onClick={onEditar}
                className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
                aria-label="Editar contrato"
              >
                <PenLine size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`¿Eliminar el contrato de ${oficial?.nombre}?`)) return
                  accion(() => eliminarContrato(obraId, contrato.id))
                }}
                disabled={pendiente}
                className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Eliminar contrato"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="border-b border-tinta-100 bg-red-50 px-5 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-400">
            Trabajos a realizar
          </p>
          {trabajos.length === 0 ? (
            <p className="text-sm text-tinta-400">Sin trabajos marcados.</p>
          ) : (
            <ul className="space-y-0.5 text-sm text-tinta-700">
              {trabajos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {reparaciones.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-tinta-400">
                Reparaciones
              </p>
              <ul className="space-y-0.5 text-sm text-tinta-700">
                {reparaciones.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{r.descripcion || `Reparación ${i + 1}`}</span>
                    <span className="tabular-nums text-tinta-500">{pesos(r.importe)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <dl className="space-y-1.5 text-sm">
          <Renglon
            etiqueta={`${Number(contrato.m2)} m² × ${pesos(contrato.tarifa_m2)}`}
            valor={pesos(Number(contrato.m2) * Number(contrato.tarifa_m2))}
          />
          {Number(contrato.otros_importe) > 0 && (
            <Renglon etiqueta="Otros" valor={pesos(contrato.otros_importe)} />
          )}
          {Number(contrato.reparaciones_importe) > 0 && (
            <Renglon etiqueta="Reparaciones" valor={pesos(contrato.reparaciones_importe)} />
          )}
          <Renglon etiqueta="Subtotal" valor={pesos(contrato.subtotal)} fuerte />
          <Renglon
            etiqueta={`Costo Haaco ${Number(contrato.costo_haaco_pct)}%`}
            valor={`− ${pesos(contrato.retencion_haaco)}`}
          />
          <Renglon etiqueta="Total a pagar al oficial" valor={pesos(contrato.total_pagar)} destacado />
          <div className="!mt-3 border-t border-tinta-100 pt-2">
            <Renglon
              etiqueta="Pagado en nómina"
              valor={`${pesos(pagado)} · ${porcentaje(pctPagado, 0)}`}
            />
          </div>
        </dl>
      </div>

      {/* Firmas */}
      <div className="flex flex-wrap items-center gap-4 border-t border-tinta-100 bg-tinta-50/60 px-5 py-2.5 text-xs">
        <Firma
          etiqueta="Firma del oficial"
          firmado={contrato.firma_oficial_at}
          onFirmar={() => accion(() => firmarContrato(obraId, contrato.id, 'oficial'))}
          bloqueado={cerrada || pendiente}
        />
        <Firma
          etiqueta="Firma del Director General"
          firmado={contrato.firma_director_at}
          onFirmar={() => accion(() => firmarContrato(obraId, contrato.id, 'director'))}
          bloqueado={cerrada || pendiente}
        />
      </div>

      {/* Pagaré */}
      {pagare && (
        <div className="border-t border-tinta-100 px-5 py-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-tinta-900">
                Pagaré por {pesos(pagare.valor_total)}
              </span>
              <Etiqueta tono={pagare.estatus === 'activo' ? 'azul' : 'gris'}>
                {pagare.estatus === 'activo' ? 'Activo' : 'Cancelado'}
              </Etiqueta>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`/api/pagares/${pagare.id}/pdf`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
              >
                <FileDown size={14} />
                Pagaré
              </a>
              {pagare.estatus === 'activo' && !cerrada && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('¿Cancelar el pagaré? Todas las herramientas regresan al taller.')) return
                    accion(() => cancelarPagare(obraId, pagare.id))
                  }}
                  disabled={pendiente}
                  className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  Cancelar y devolver todo
                </button>
              )}
            </div>
          </div>

          <ul className="grid gap-1 sm:grid-cols-2">
            {items.map((item) => {
              const h = porCodigo.get(item.herramienta_id)
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-tinta-50 px-2.5 py-1.5 text-xs"
                >
                  <span className={item.devuelta ? 'text-tinta-400 line-through' : 'text-tinta-700'}>
                    <span className="font-mono">{h?.codigo}</span> {h?.nombre}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-tinta-500">{pesos(item.valor_unitario)}</span>
                    {!item.devuelta && !cerrada && (
                      <button
                        type="button"
                        onClick={() => accion(() => devolverHerramienta(obraId, item.id))}
                        disabled={pendiente}
                        className="rounded px-1.5 py-0.5 font-medium text-haaco-700 hover:bg-haaco-50"
                      >
                        Devolver
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Tarjeta>
  )
}

function Renglon({
  etiqueta, valor, fuerte, destacado,
}: {
  etiqueta: string
  valor: string
  fuerte?: boolean
  destacado?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={destacado ? 'font-semibold text-tinta-900' : 'text-tinta-600'}>{etiqueta}</dt>
      <dd
        className={`tabular-nums ${
          destacado
            ? 'text-base font-semibold text-haaco-700'
            : fuerte
              ? 'font-semibold text-tinta-900'
              : 'text-tinta-700'
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}

function Firma({
  etiqueta, firmado, onFirmar, bloqueado,
}: {
  etiqueta: string
  firmado: string | null
  onFirmar: () => void
  bloqueado: boolean
}) {
  if (firmado) {
    return (
      <span className="text-haaco-700">
        ✓ {etiqueta} · {fecha(firmado)}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onFirmar}
      disabled={bloqueado}
      className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1 font-medium text-tinta-600 transition hover:bg-white disabled:opacity-50"
    >
      Registrar {etiqueta.toLowerCase()}
    </button>
  )
}

// ---------------------------------------------------------------------------
function FormularioContrato({
  obraId, trabajadores, contrato, onCerrar,
}: {
  obraId: string
  /** Los que siguen laborando más quien ya firmó aquí, aunque esté de baja. */
  trabajadores: Profile[]
  contrato?: ContratoOficial
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [trabajadorId, setTrabajadorId] = useState(contrato?.trabajador_id ?? '')
  const [trabajos, setTrabajos] = useState<Record<string, string[]>>(
    (contrato?.trabajos as Record<string, string[]>) ?? {},
  )
  const [m2, setM2] = useState(String(contrato?.m2 ?? ''))
  const [tarifa, setTarifa] = useState(String(contrato?.tarifa_m2 ?? ''))
  const [otros, setOtros] = useState(String(contrato?.otros_importe ?? ''))
  const [haaco, setHaaco] = useState(String(contrato?.costo_haaco_pct ?? REGLAS.costoHaacoPct))
  const [inicia, setInicia] = useState(contrato?.fecha_inicia ?? '')
  const [finaliza, setFinaliza] = useState(contrato?.fecha_finaliza ?? '')
  const [notas, setNotas] = useState(contrato?.notas ?? '')
  const [reparaciones, setReparaciones] = useState<Reparacion[]>(
    leerReparaciones(contrato?.reparaciones).map((r) => ({
      descripcion: r.descripcion,
      importe: String(r.importe),
    })),
  )

  // Al editar el contrato de alguien que ya se dio de baja, su nombre tiene que
  // seguir en la lista: si no, el selector saldría vacío y guardar se lo
  // reasignaría en silencio al primero de la lista.
  const elegibles = trabajadores.filter(
    (t) => t.activo || t.id === contrato?.trabajador_id,
  )
  const oficial = elegibles.find((o) => o.id === trabajadorId)

  const totales = useMemo(() => {
    const reparacionesImporte = reparaciones.reduce((s, r) => s + num(r.importe), 0)
    const subtotal = redondear(num(m2) * num(tarifa) + num(otros) + reparacionesImporte)
    const retencion = redondear(subtotal * (num(haaco) / 100))
    return { reparacionesImporte, subtotal, retencion, total: redondear(subtotal - retencion) }
  }, [m2, tarifa, otros, haaco, reparaciones])

  const alternar = (grupo: string, clave: string) =>
    setTrabajos((t) => {
      const actuales = t[grupo] ?? []
      return {
        ...t,
        [grupo]: actuales.includes(clave)
          ? actuales.filter((c) => c !== clave)
          : [...actuales, clave],
      }
    })

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarContrato(obraId, {
        id: contrato?.id,
        trabajador_id: trabajadorId,
        trabajos,
        m2: num(m2),
        tarifa_m2: num(tarifa),
        otros_importe: num(otros),
        reparaciones: reparaciones.map((x) => ({
          descripcion: x.descripcion.trim(),
          importe: num(x.importe),
        })),
        costo_haaco_pct: num(haaco),
        fecha_inicia: inicia || null,
        fecha_finaliza: finaliza || null,
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
      ancho="xl"
      titulo={contrato ? 'Editar contrato' : 'Contrato por obra determinada'}
      descripcion="Marca los trabajos, captura los m² y la tarifa. El total sale con la retención Costo Haaco."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Oficial"
          ancho="medio"
          hijo={
            <Seleccion
              value={trabajadorId}
              onChange={(e) => {
                const id = e.target.value
                setTrabajadorId(id)
                // Los externos normalmente van sin retención.
                const elegido = elegibles.find((o) => o.id === id)
                if (elegido) setHaaco(elegido.es_externo ? '0' : String(REGLAS.costoHaacoPct))
              }}
            >
              <option value="">Elegir oficial…</option>
              {elegibles.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                  {o.oficio ? ` · ${o.oficio}` : ''}
                  {o.es_externo ? ' (externo)' : ''}
                  {!o.activo ? ' · dado de baja' : ''}
                </option>
              ))}
            </Seleccion>
          }
          ayuda={oficial?.es_externo ? 'Externo: por defecto sin retención.' : undefined}
        />
        <div className="grid grid-cols-2 gap-4 sm:col-span-1">
          <Campo
            etiqueta="Inicia"
            hijo={<SelectorFecha valor={inicia} onCambio={setInicia} />}
          />
          <Campo
            etiqueta="Finaliza"
            hijo={<SelectorFecha valor={finaliza} onCambio={setFinaliza} />}
          />
        </div>

        {/* Checklist de trabajos */}
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Trabajos a realizar</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {GRUPOS_TRABAJOS.map((grupo) => (
              <div key={grupo.clave} className="rounded-xl border border-tinta-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  {grupo.titulo}
                </p>
                <ul className="space-y-1">
                  {grupo.opciones.map((o) => {
                    const marcada = (trabajos[grupo.clave] ?? []).includes(o.clave)
                    return (
                      <li key={o.clave}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-tinta-700">
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={() => alternar(grupo.clave, o.clave)}
                            className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
                          />
                          {o.texto}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Reparaciones */}
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Reparaciones</p>
          <div className="space-y-1.5">
            {reparaciones.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5">
                <div className="col-span-8">
                  <Entrada
                    value={r.descripcion}
                    onChange={(e) =>
                      setReparaciones((l) =>
                        l.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)),
                      )
                    }
                    placeholder={`Reparación ${i + 1}`}
                  />
                </div>
                <div className="col-span-3">
                  <Numero
                    value={r.importe}
                    onChange={(e) =>
                      setReparaciones((l) =>
                        l.map((x, j) => (j === i ? { ...x, importe: e.target.value } : x)),
                      )
                    }
                    placeholder="$"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setReparaciones((l) => l.filter((_, j) => j !== i))}
                    className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Quitar reparación"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {reparaciones.length < 4 && (
            <button
              type="button"
              onClick={() => setReparaciones((l) => [...l, { descripcion: '', importe: '' }])}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-haaco-700 hover:underline"
            >
              <Plus size={14} />
              Agregar reparación
            </button>
          )}
        </div>

        {/* Cálculo */}
        <div className="grid grid-cols-2 gap-4 sm:col-span-1">
          <Campo etiqueta="M²" hijo={<Numero value={m2} onChange={(e) => setM2(e.target.value)} />} />
          <Campo
            etiqueta="Tarifa por m²"
            hijo={<Numero value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="12.50" />}
          />
          <Campo etiqueta="Otros" hijo={<Numero value={otros} onChange={(e) => setOtros(e.target.value)} />} />
          <Campo
            etiqueta="Costo Haaco %"
            hijo={<Numero value={haaco} onChange={(e) => setHaaco(e.target.value)} />}
          />
        </div>

        <div className="rounded-xl bg-tinta-50 px-4 py-3 sm:col-span-1">
          <dl className="space-y-1.5 text-sm">
            <Renglon
              etiqueta={`${num(m2)} m² × ${pesos(num(tarifa))}`}
              valor={pesos(num(m2) * num(tarifa))}
            />
            <Renglon etiqueta="Otros" valor={pesos(num(otros))} />
            <Renglon etiqueta="Reparaciones" valor={pesos(totales.reparacionesImporte)} />
            <Renglon etiqueta="Subtotal" valor={pesos(totales.subtotal)} fuerte />
            <Renglon etiqueta={`Costo Haaco ${num(haaco)}%`} valor={`− ${pesos(totales.retencion)}`} />
            <Renglon etiqueta="Total al oficial" valor={pesos(totales.total)} destacado />
          </dl>
        </div>

        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
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
          disabled={pendiente || !trabajadorId}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar contrato'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function FormularioPagare({
  obraId, contrato, oficial, herramientas, onCerrar,
}: {
  obraId: string
  contrato: ContratoOficial
  oficial?: Profile
  herramientas: DatosObra['herramientas']
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  const disponibles = herramientas.filter(
    (h) => h.estado === 'disponible' || elegidas.includes(h.id),
  )
  const filtradas = busqueda.trim()
    ? disponibles.filter((h) =>
        `${h.codigo} ${h.nombre} ${h.marca ?? ''}`.toLowerCase().includes(busqueda.trim().toLowerCase()),
      )
    : disponibles

  const total = elegidas.reduce(
    (s, id) => s + Number(herramientas.find((h) => h.id === id)?.valor ?? 0),
    0,
  )

  const crear = () =>
    iniciar(async () => {
      setError(null)
      const r = await crearPagare(obraId, contrato.id, elegidas)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`Pagaré de herramientas · ${oficial?.nombre ?? ''}`}
      descripcion="Al firmarlo, cada herramienta pasa a «En obra» con el oficial hasta que la devuelva."
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-tinta-100 px-5 py-3">
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre…"
            autoFocus
          />
        </div>

        <ul className="flex-1 divide-y divide-tinta-100 overflow-y-auto">
          {filtradas.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-tinta-500">
              No hay herramienta disponible con ese texto.
            </li>
          )}
          {filtradas.map((h) => {
            const marcada = elegidas.includes(h.id)
            return (
              <li key={h.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition hover:bg-tinta-50">
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() =>
                      setElegidas((l) => (marcada ? l.filter((x) => x !== h.id) : [...l, h.id]))
                    }
                    className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
                  />
                  <span className="w-20 shrink-0 font-mono text-xs font-medium text-tinta-900">
                    {h.codigo}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta-700">
                    {h.nombre}
                    {h.marca && <span className="ml-1.5 text-tinta-400">{h.marca}</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-tinta-500">
                    {h.valor == null ? '—' : pesos(h.valor)}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {error && (
          <p role="alert" className="border-t border-tinta-100 bg-red-50 px-5 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <PieDialogo>
          <div className="mr-auto">
            <p className="text-xs text-tinta-500">
              {elegidas.length} {elegidas.length === 1 ? 'herramienta' : 'herramientas'}
            </p>
            <p className="text-lg font-semibold tabular-nums text-haaco-700">{pesos(total)}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crear}
            disabled={pendiente || elegidas.length === 0}
            className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
          >
            {pendiente ? 'Generando…' : 'Generar pagaré'}
          </button>
        </PieDialogo>
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
/**
 * Pasarle lo que falta de la obra a otro oficial.
 *
 * No cambia de nombre el contrato: lo corta. El que se va se queda con los
 * metros que ejecutó —y con sus recibos—, y el que entra arranca uno nuevo por
 * el resto. La suma de los dos sigue siendo el trabajo completo.
 *
 * Los metros del corte se capturan a mano. Se sugiere lo proporcional a lo ya
 * pagado, pero es el administrador quien sabe cuánto alcanzó a hacer.
 */
function DialogoReasignar({
  obraId, contrato, sale, candidatos, nomina, onCerrar,
}: {
  obraId: string
  contrato: ContratoOficial
  sale?: Profile
  candidatos: Profile[]
  nomina?: DatosObra['nomina'][number]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pagado = Number(nomina?.pagado ?? 0)
  const totalContrato = Number(contrato.total_pagar)
  const m2Total = Number(contrato.m2)

  // Los metros que corresponden a lo que ya se le pagó: el punto de partida.
  const sugerido =
    totalContrato > 0 ? redondear((m2Total * pagado) / totalContrato) : 0

  const [entra, setEntra] = useState('')
  const [fechaCorte, setFechaCorte] = useState(contrato.fecha_finaliza ?? hoyISO())
  const [m2Corte, setM2Corte] = useState(String(sugerido))
  const [motivo, setMotivo] = useState('')

  const corte = num(m2Corte)
  const restante = redondear(m2Total - corte)

  // Espejo de las columnas generadas del contrato, para verlo antes de aplicar.
  const tarifa = Number(contrato.tarifa_m2)
  const pct = Number(contrato.costo_haaco_pct)
  const extras = Number(contrato.otros_importe) + Number(contrato.reparaciones_importe)
  const totalCerrado = redondear((corte * tarifa + extras) * (1 - pct / 100))
  const oficialEntra = candidatos.find((c) => c.id === entra)
  const pctEntra = oficialEntra?.es_externo ? 0 : pct
  const totalNuevo = redondear(restante * tarifa * (1 - pctEntra / 100))

  const cortaDeMas = totalCerrado < pagado
  const sinResto = restante <= 0

  const reasignar = () =>
    iniciar(async () => {
      setError(null)
      const r = await reasignarContrato(obraId, {
        contrato_id: contrato.id,
        nuevo_trabajador_id: entra,
        fecha: fechaCorte,
        m2_ejecutados: corte,
        motivo: motivo.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`Reasignar el contrato de ${sale?.nombre ?? 'el oficial'}`}
      descripcion="Se le cierra por lo que ejecutó y se abre uno nuevo por lo que falta."
    >
      <CuerpoDialogo>
        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-tinta-50 px-4 py-3 text-sm sm:col-span-2">
          <div>
            <dt className="text-xs text-tinta-500">Contratado</dt>
            <dd className="tabular-nums text-tinta-900">
              {m2Total} m² · {pesos(totalContrato)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-500">Ya pagado</dt>
            <dd className="tabular-nums text-tinta-900">{pesos(pagado)}</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-500">Por pagar</dt>
            <dd className="font-semibold tabular-nums text-haaco-700">
              {pesos(Number(nomina?.por_pagar ?? totalContrato - pagado))}
            </dd>
          </div>
        </dl>

        <Campo
          etiqueta="Oficial que entra"
          hijo={
            <Seleccion value={entra} onChange={(e) => setEntra(e.target.value)}>
              <option value="">Elegir oficial…</option>
              {candidatos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                  {o.oficio ? ` · ${o.oficio}` : ''}
                  {o.es_externo ? ' (externo)' : ''}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Fecha del corte"
          ancho="medio"
          hijo={<SelectorFecha valor={fechaCorte} onCambio={setFechaCorte} />}
        />
        <Campo
          etiqueta="M² que alcanzó a hacer"
          ancho="medio"
          hijo={<Numero value={m2Corte} onChange={(e) => setM2Corte(e.target.value)} />}
          ayuda={
            sugerido > 0
              ? `Sugerido ${sugerido} m², lo que corresponde a lo que ya se le pagó.`
              : 'Todavía no tiene abonos: si no ejecutó nada, deja 0.'
          }
        />
        <Campo
          etiqueta="Motivo"
          hijo={
            <AreaTexto
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Se dio de baja; ya no laboró con nosotros…"
            />
          }
          ayuda="Queda en la bitácora y en las notas de los dos contratos."
        />

        <div className="space-y-2 rounded-xl bg-haaco-50 px-4 py-3 text-sm sm:col-span-2">
          <p className="flex flex-wrap justify-between gap-2">
            <span className="text-tinta-600">
              {sale?.nombre ?? 'El que sale'} queda en <strong>{corte} m²</strong>
            </span>
            <span className="tabular-nums text-tinta-900">
              {pesos(totalCerrado)} · pagado {pesos(pagado)} · por pagar{' '}
              <strong className={totalCerrado - pagado > 0 ? 'text-amber-700' : 'text-haaco-700'}>
                {pesos(redondear(Math.max(0, totalCerrado - pagado)))}
              </strong>
            </span>
          </p>
          <p className="flex flex-wrap justify-between gap-2 border-t border-haaco-200 pt-2">
            <span className="text-tinta-600">
              {oficialEntra?.nombre ?? 'El que entra'} arranca con{' '}
              <strong>{restante > 0 ? restante : 0} m²</strong>
            </span>
            <span className="font-semibold tabular-nums text-haaco-700">
              {pesos(restante > 0 ? totalNuevo : 0)}
            </span>
          </p>
        </div>

        {cortaDeMas && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
            Con {corte} m² el contrato queda en {pesos(totalCerrado)}, por debajo de los{' '}
            {pesos(pagado)} que ya se le pagaron. Sube los metros ejecutados.
          </p>
        )}
        {sinResto && !cortaDeMas && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
            No queda nada por reasignar: el corte se lleva los {m2Total} m² completos.
          </p>
        )}
        {contrato.otros_importe > 0 || contrato.reparaciones_importe > 0 ? (
          <p className="text-xs text-tinta-500 sm:col-span-2">
            Los {pesos(extras)} de otros trabajos y reparaciones se quedan con{' '}
            {sale?.nombre ?? 'quien sale'}: ya se ejecutaron. Si hay que moverlos, edita el
            contrato antes de reasignar.
          </p>
        ) : null}

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
          onClick={reasignar}
          disabled={pendiente || !entra || cortaDeMas || sinResto}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          <UserRoundCog size={15} />
          {pendiente ? 'Reasignando…' : 'Reasignar contrato'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
