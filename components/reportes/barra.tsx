'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { FiltroMes } from '@/components/filtro-fechas'
import { etiquetaMes } from '@/lib/finanzas'

/** Descarga el archivo sin sacar al usuario de la página. */
async function descargar(url: string, nombre: string) {
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error(await respuesta.text())

  const blob = await respuesta.blob()
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

export function BarraReportes({ mes, soloLectura }: { mes: string; soloLectura: boolean }) {
  const [bajando, setBajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bajarLibro = async () => {
    setError(null)
    setBajando(true)
    try {
      await descargar(
        `/api/reportes/excel?mes=${mes}`,
        `Cierre ${etiquetaMes(mes).replace(' de ', ' ')}.xlsx`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.')
    } finally {
      setBajando(false)
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* El cierre del contador es mensual: aquí se elige mes, no rango. */}
        <FiltroMes mes={mes} titulo="Mes del cierre" />

        <nav className="hidden flex-wrap gap-1 sm:flex">
          {[
            ['financiero', 'Financiero'],
            ['obras', 'Obras'],
            ['cotizaciones', 'Cotizaciones'],
            ['cobranza', 'Cobranza'],
            ['movimientos', 'Movimientos'],
          ].map(([ancla, texto]) => (
            <a
              key={ancla}
              href={`#${ancla}`}
              className="rounded-lg px-2.5 py-2 text-sm text-tinta-500 transition hover:bg-tinta-100 hover:text-tinta-800"
            >
              {texto}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={bajarLibro}
          disabled={bajando}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {bajando ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          {bajando ? 'Generando…' : 'Descargar cierre completo'}
        </button>
      </div>

      {soloLectura && (
        <p className="mb-4 rounded-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-900 ring-1 ring-sky-200">
          Estás como <strong>Contador</strong>: acceso de sólo lectura a reportes y exportación.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </>
  )
}

export function BotonHoja({ mes, hoja, titulo }: { mes: string; hoja: string; titulo: string }) {
  const [bajando, setBajando] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        setBajando(true)
        try {
          await descargar(
            `/api/reportes/excel?mes=${mes}&hoja=${hoja}`,
            `${titulo} ${etiquetaMes(mes).replace(' de ', ' ')}.xlsx`,
          )
        } finally {
          setBajando(false)
        }
      }}
      disabled={bajando}
      className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
    >
      {bajando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      Excel
    </button>
  )
}
