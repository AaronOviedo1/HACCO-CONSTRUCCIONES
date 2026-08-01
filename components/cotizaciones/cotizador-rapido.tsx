'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowLeft, Check, Plus, Search, Send, Trash2, UserPlus } from 'lucide-react'
import { FormularioCliente } from '@/components/catalogos/formulario-cliente'
import { pesos } from '@/lib/format'
import {
  borradorVacio, importePartida, num, totalesCotizacion,
  type BorradorCotizacion, type PartidaBorrador,
} from '@/lib/cotizaciones'
import { cambiarEstatus, guardarCotizacion } from '@/app/admin/cotizaciones/acciones'
import type { Cliente, TextoProceso, TipoCotizacion } from '@/types/database'

type Paso = 'cliente' | 'tipo' | 'proceso' | 'partidas'

const PASOS: Paso[] = ['cliente', 'tipo', 'proceso', 'partidas']

const TIPOS: { valor: TipoCotizacion; titulo: string; nota: string }[] = [
  { valor: 'pintura', titulo: 'Pintura', nota: 'Anticipo 50%' },
  { valor: 'herreria', titulo: 'Herrería', nota: 'Anticipo 60%' },
  { valor: 'mixta', titulo: 'Mixta', nota: 'Pintura + herrería' },
]

/**
 * Levantamiento en sitio desde el iPad: cliente → tipo → bullets → partidas.
 * Botones grandes, teclado numérico y el total siempre a la vista.
 */
export function CotizadorRapido({
  clientes,
  textos,
}: {
  clientes: Cliente[]
  textos: TextoProceso[]
}) {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('cliente')
  const [doc, setDoc] = useState<BorradorCotizacion>(() => ({
    ...borradorVacio('pintura'),
    items: [{ descripcion: '', m2: '', precio_unitario: '' }],
  }))
  const [busqueda, setBusqueda] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const totales = useMemo(() => totalesCotizacion(doc), [doc])
  const cliente = clientes.find((c) => c.id === doc.cliente_id)

  const filtrados = busqueda.trim()
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : clientes.slice(0, 12)

  const elegirTipo = (tipo: TipoCotizacion) => {
    setDoc((d) => ({
      ...d,
      tipo,
      anticipo_pct: tipo === 'herreria' ? '60' : '50',
      procesos: textos.slice(0, 5).map((t) => ({ texto_proceso_id: t.id, contenido: t.contenido })),
    }))
    setPaso('proceso')
  }

  const alternarProceso = (texto: TextoProceso) =>
    setDoc((d) => ({
      ...d,
      procesos: d.procesos.some((p) => p.texto_proceso_id === texto.id)
        ? d.procesos.filter((p) => p.texto_proceso_id !== texto.id)
        : [...d.procesos, { texto_proceso_id: texto.id, contenido: texto.contenido }],
    }))

  const actualizarPartida = (i: number, campo: keyof PartidaBorrador, valor: string) =>
    setDoc((d) => ({
      ...d,
      items: d.items.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)),
    }))

  const guardar = (enviar: boolean) =>
    iniciar(async () => {
      setError(null)
      const r = await guardarCotizacion(null, doc)
      if (!r.ok) return setError(r.error)
      if (enviar) await cambiarEstatus(r.datos!.id, 'enviada')
      router.push(`/admin/cotizaciones/${r.datos!.id}`)
    })

  // -------------------------------------------------------------------------
  return (
    <div className="pb-40">
      <header className="mb-5 flex items-center gap-3">
        {paso !== 'cliente' && (
          <button
            type="button"
            onClick={() =>
              setPaso(paso === 'partidas' ? 'proceso' : paso === 'proceso' ? 'tipo' : 'cliente')
            }
            className="rounded-xl border border-tinta-300 bg-white p-3 text-tinta-600 transition hover:bg-tinta-50"
            aria-label="Regresar"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[26px] font-bold -tracking-[0.7px] text-tinta-900 lg:text-2xl lg:font-semibold lg:tracking-tight">
              Cotización rápida
            </h1>
            <span className="shrink-0 text-[11.5px] font-semibold text-tinta-500">
              Paso {PASOS.indexOf(paso) + 1} de {PASOS.length}
            </span>
          </div>
          <p className="truncate text-sm text-tinta-500">
            {cliente ? cliente.nombre : 'Levantamiento en sitio'}
            {paso !== 'cliente' && paso !== 'tipo' && ` · ${TIPOS.find((t) => t.valor === doc.tipo)?.titulo}`}
          </p>
        </div>
      </header>

      <Progreso paso={paso} />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* 1 · Cliente ------------------------------------------------------- */}
      {paso === 'cliente' && (
        <section>
          <div className="relative mb-4">
            <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-400" />
            <input
              type="search"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full rounded-2xl border-[0.5px] border-tinta-300 bg-white py-4 pl-12 pr-4 text-base text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setNuevoCliente(true)}
              className="flex items-center gap-3 rounded-[18px] border-2 border-dashed border-haaco-300 bg-haaco-50/50 px-5 py-5 text-left transition hover:bg-haaco-50"
            >
              <UserPlus size={22} className="text-haaco-600" />
              <span className="text-base font-semibold text-haaco-800">Cliente nuevo</span>
            </button>

            {filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setDoc((d) => ({
                    ...d,
                    cliente_id: c.id,
                    domicilio_obra: c.domicilio ?? '',
                    nombre_obra: d.nombre_obra || c.nombre,
                  }))
                  setPaso('tipo')
                }}
                className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-5 py-5 text-left transition hover:border-haaco-300 hover:bg-haaco-50/40 active:bg-haaco-50"
              >
                <span className="block text-base font-semibold text-tinta-900">{c.nombre}</span>
                {c.domicilio && (
                  <span className="mt-0.5 block truncate text-sm text-tinta-500">{c.domicilio}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 2 · Tipo ---------------------------------------------------------- */}
      {paso === 'tipo' && (
        <section className="grid gap-3 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => elegirTipo(t.valor)}
              className={`rounded-[18px] border-2 px-5 py-8 text-center transition ${
                doc.tipo === t.valor
                  ? 'border-haaco-500 bg-haaco-50'
                  : 'border-tinta-200 bg-white hover:border-haaco-300'
              }`}
            >
              <span className="block text-xl font-semibold text-tinta-900">{t.titulo}</span>
              <span className="mt-1 block text-sm text-tinta-500">{t.nota}</span>
            </button>
          ))}
        </section>
      )}

      {/* 3 · Bullets ------------------------------------------------------- */}
      {paso === 'proceso' && (
        <section>
          <p className="mb-3 text-sm text-tinta-500">
            Toca para incluir o quitar. Vienen preseleccionados los pasos de siempre.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {textos.map((t) => {
              const activo = doc.procesos.some((p) => p.texto_proceso_id === t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => alternarProceso(t)}
                  className={`flex items-start gap-3 rounded-[18px] border-2 px-4 py-4 text-left transition ${
                    activo ? 'border-haaco-500 bg-haaco-50' : 'border-tinta-200 bg-white'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      activo ? 'border-haaco-600 bg-haaco-600 text-white' : 'border-tinta-300'
                    }`}
                  >
                    {activo && <Check size={14} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-tinta-900">{t.titulo}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-tinta-500">{t.contenido}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setPaso('partidas')}
            className="mt-5 min-h-[54px] w-full rounded-[18px] bg-haaco-700 px-5 text-[17px] font-semibold text-white shadow-verde transition hover:bg-haaco-800"
          >
            Continuar a las partidas
          </button>
        </section>
      )}

      {/* 4 · Partidas ------------------------------------------------------ */}
      {paso === 'partidas' && (
        <section className="space-y-3">
          {doc.items.map((item, i) => (
            <div key={i} className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta-100 text-sm font-semibold text-tinta-500">
                  {i + 1}
                </span>
                <input
                  value={item.descripcion}
                  onChange={(e) => actualizarPartida(i, 'descripcion', e.target.value)}
                  placeholder="Exterior fachada"
                  className="min-w-0 flex-1 rounded-lg border border-tinta-300 px-3 py-2.5 text-base outline-none focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
                />
                {doc.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDoc((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}
                    className="shrink-0 rounded-lg p-2 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Quitar partida"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <CampoGrande
                  etiqueta="M²"
                  valor={item.m2}
                  onCambio={(v) => actualizarPartida(i, 'm2', v)}
                />
                <CampoGrande
                  etiqueta="Precio m²"
                  valor={item.precio_unitario}
                  onCambio={(v) => actualizarPartida(i, 'precio_unitario', v)}
                />
                <div className="rounded-xl bg-tinta-50 px-3 py-2">
                  <span className="block text-xs font-medium text-tinta-500">Importe</span>
                  <span className="mt-1 block truncate text-lg font-semibold tabular-nums text-tinta-900">
                    {pesos(importePartida(item))}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setDoc((d) => ({
                ...d,
                items: [...d.items, { descripcion: '', m2: '', precio_unitario: '' }],
              }))
            }
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-tinta-300 px-5 text-[15.5px] font-medium text-tinta-600 transition hover:bg-tinta-50"
          >
            <Plus size={20} />
            Otra partida
          </button>
        </section>
      )}

      {/* Total gigante ----------------------------------------------------- */}
      {(paso === 'partidas' || totales.total > 0) && (
        <div className="fixed inset-x-0 bottom-[var(--alto-tabs)] z-30 border-t-[0.5px] border-tinta-200 bg-white/95 px-4 py-4 backdrop-blur-xl lg:bottom-0 lg:pl-72">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-tinta-500">
                  {num(doc.iva_pct) > 0 ? `Total con IVA ${num(doc.iva_pct)}%` : 'Total sin IVA'}
                </p>
                <p className="text-4xl font-bold tabular-nums leading-none text-haaco-700">
                  {pesos(totales.total)}
                </p>
                <p className="mt-1 text-xs text-tinta-500">
                  Subtotal {pesos(totales.subtotal)} · anticipo {num(doc.anticipo_pct)}%{' '}
                  {pesos(totales.anticipo)}
                </p>
              </div>
            </div>

            {paso === 'partidas' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => guardar(false)}
                  disabled={pendiente || !doc.cliente_id}
                  className="min-h-[54px] flex-1 rounded-[18px] border-[0.5px] border-tinta-300 bg-white px-4 text-base font-semibold text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
                >
                  {pendiente ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button
                  type="button"
                  onClick={() => guardar(true)}
                  disabled={pendiente || !doc.cliente_id}
                  className="flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-haaco-700 px-4 text-base font-semibold text-white shadow-verde transition hover:bg-haaco-800 disabled:bg-haaco-300 disabled:shadow-none"
                >
                  <Send size={18} />
                  Guardar y enviar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <FormularioCliente
        abierto={nuevoCliente}
        onCerrar={() => setNuevoCliente(false)}
        onGuardado={(id) => {
          setDoc((d) => ({ ...d, cliente_id: id }))
          setPaso('tipo')
          router.refresh()
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
function Progreso({ paso }: { paso: Paso }) {
  const actual = PASOS.indexOf(paso)

  return (
    <div className="mb-5 flex gap-1.5">
      {PASOS.map((p, i) => (
        <div
          key={p}
          className={`h-[5px] flex-1 rounded-full transition ${
            i <= actual ? 'bg-haaco-700' : 'bg-tinta-200'
          }`}
        />
      ))}
    </div>
  )
}

function CampoGrande({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string
  valor: string
  onCambio: (v: string) => void
}) {
  return (
    <label className="block rounded-xl bg-tinta-50 px-3 py-2">
      <span className="block text-xs font-medium text-tinta-500">{etiqueta}</span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="0"
        className="mt-0.5 w-full bg-transparent text-lg font-semibold tabular-nums text-tinta-900 outline-none placeholder:text-tinta-300"
      />
    </label>
  )
}
