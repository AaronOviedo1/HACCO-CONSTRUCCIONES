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
          <p className="mb-3 flex items-center gap-2.5 rounded-[14px] border-[0.5px] border-haaco-200 bg-haaco-50 p-3 text-[14.5px] font-semibold text-haaco-800">
            <Check size={18} />
            Lista enviada. Administración la va a cotizar.
          </p>
        )}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          data-tap
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[18px] border-[0.5px] border-tinta-300 bg-white px-4 text-base font-semibold text-tinta-700 transition active:bg-tinta-50"
        >
          <ClipboardList size={19} />
          Solicitar material
        </button>
      </>
    )
  }

  return (
    <section className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold -tracking-[0.4px]">Material que necesito</h2>
          <p className="mb-3 mt-1 text-[13.5px] leading-snug text-tinta-500">
            Administración lo cotiza y te avisa cuando esté comprado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta-150 text-tinta-600"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-[14px] bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {renglones.map((r, i) => (
          <div key={i} className="rounded-[18px] border-[0.5px] border-tinta-200 p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <input
                value={r.material}
                onChange={(e) => cambiar(i, 'material', e.target.value)}
                placeholder="PTR 1x1 calibre 14"
                className="min-w-0 flex-1 rounded-[12px] border border-tinta-300 px-3.5 py-3 text-base outline-none focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
              />
              {renglones.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRenglones((l) => l.filter((_, j) => j !== i))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-tinta-400"
                  aria-label="Quitar"
                >
                  <X size={17} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-[1fr_1.1fr_1.3fr] gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={r.cantidad}
                onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                placeholder="Cant."
                className="rounded-[12px] border border-tinta-300 px-2 py-3 text-center text-base tabular-nums outline-none focus:border-haaco-600"
              />
              <select
                value={r.unidad}
                onChange={(e) => cambiar(i, 'unidad', e.target.value)}
                className="rounded-[12px] border border-tinta-300 bg-white px-2 py-3 text-base outline-none focus:border-haaco-600"
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
                className="rounded-[12px] border border-tinta-300 px-2.5 py-3 text-base outline-none focus:border-haaco-600"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRenglones((l) => [...l, { material: '', cantidad: '1', unidad: 'pza', notas: '' }])}
        data-tap
        className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-tinta-300 px-4 text-[15.5px] font-medium text-tinta-600"
      >
        <Plus size={18} />
        Otro material
      </button>

      <button
        type="button"
        onClick={enviar}
        disabled={pendiente || !renglones.some((r) => r.material.trim())}
        data-tap
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-[18px] bg-haaco-700 px-4 text-[17px] font-semibold text-white shadow-verde transition active:bg-haaco-800 disabled:bg-tinta-200 disabled:text-tinta-400 disabled:shadow-none"
      >
        <Send size={19} />
        {pendiente ? 'Enviando…' : 'Enviar lista'}
      </button>
    </section>
  )
}
