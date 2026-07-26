'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, ClipboardList, Plus, Send, X } from 'lucide-react'
import { pedirMaterial } from '@/app/obra/acciones'

type Renglon = { material: string; cantidad: string; unidad: string; notas: string }

const UNIDADES = ['pza', 'm', 'kg', 'tramo', 'lámina', 'litro', 'cubeta', 'rollo']

/** El herrero anota lo que necesita; a Pati le llega como solicitud pendiente. */
export function PedirMaterial({ obraId }: { obraId: string }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [renglones, setRenglones] = useState<Renglon[]>([
    { material: '', cantidad: '1', unidad: 'pza', notas: '' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const cambiar = (i: number, campo: keyof Renglon, valor: string) =>
    setRenglones((l) => l.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)))

  const enviar = () =>
    iniciar(async () => {
      setError(null)
      const r = await pedirMaterial(obraId, renglones)
      if (!r.ok) return setError(r.error)

      setRenglones([{ material: '', cantidad: '1', unidad: 'pza', notas: '' }])
      setAbierto(false)
      setListo(true)
      setTimeout(() => setListo(false), 3000)
      router.refresh()
    })

  if (!abierto) {
    return (
      <>
        {listo && (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-haaco-50 px-3 py-2.5 text-sm font-medium text-haaco-800">
            <Check size={16} />
            Lista enviada. Administración la va a cotizar.
          </p>
        )}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          data-tap
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-tinta-300 bg-white px-4 py-3.5 text-base font-semibold text-tinta-700 transition active:bg-tinta-50"
        >
          <ClipboardList size={18} />
          Solicitar material
        </button>
      </>
    )
  }

  return (
    <section className="rounded-2xl border border-tinta-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-tinta-900">Material que necesito</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1.5 text-tinta-400"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {renglones.map((r, i) => (
          <div key={i} className="rounded-xl border border-tinta-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={r.material}
                onChange={(e) => cambiar(i, 'material', e.target.value)}
                placeholder="PTR 1x1 calibre 14"
                className="min-w-0 flex-1 rounded-lg border border-tinta-300 px-3 py-2.5 text-base outline-none focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100"
              />
              {renglones.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRenglones((l) => l.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-lg p-2 text-tinta-400"
                  aria-label="Quitar"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={r.cantidad}
                onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                placeholder="Cant."
                className="rounded-lg border border-tinta-300 px-3 py-2.5 text-center text-base tabular-nums outline-none focus:border-haaco-500"
              />
              <select
                value={r.unidad}
                onChange={(e) => cambiar(i, 'unidad', e.target.value)}
                className="rounded-lg border border-tinta-300 px-2 py-2.5 text-base outline-none focus:border-haaco-500"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                value={r.notas}
                onChange={(e) => cambiar(i, 'notas', e.target.value)}
                placeholder="Nota"
                className="rounded-lg border border-tinta-300 px-3 py-2.5 text-base outline-none focus:border-haaco-500"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRenglones((l) => [...l, { material: '', cantidad: '1', unidad: 'pza', notas: '' }])}
        data-tap
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-tinta-300 px-4 py-3 text-base font-medium text-tinta-600"
      >
        <Plus size={18} />
        Otro material
      </button>

      <button
        type="button"
        onClick={enviar}
        disabled={pendiente || !renglones.some((r) => r.material.trim())}
        data-tap
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-haaco-700 px-4 py-3.5 text-base font-semibold text-white transition active:bg-haaco-800 disabled:bg-tinta-200 disabled:text-tinta-400"
      >
        <Send size={18} />
        {pendiente ? 'Enviando…' : 'Enviar lista'}
      </button>
    </section>
  )
}
