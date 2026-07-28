'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'

/**
 * Domicilio con sugerencias de Google.
 *
 * Se escribe como siempre, pero a partir de tres letras propone direcciones
 * reales de México —con Hermosillo primero— para que la obra quede escrita
 * igual en la cotización, en el contrato y en el mapa que abre la cuadrilla.
 * Si Google no contesta, el campo sigue siendo un campo de texto normal.
 */
export function CampoDomicilio({
  valor,
  onCambio,
  placeholder = 'Calle, número, colonia',
  disabled,
  filas = 2,
}: {
  valor: string
  onCambio: (valor: string) => void
  placeholder?: string
  disabled?: boolean
  filas?: number
}) {
  const [sugerencias, setSugerencias] = useState<{ id: string; texto: string }[]>([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const caja = useRef<HTMLDivElement>(null)
  // Google cobra por sesión de búsqueda: un token agrupa lo que se teclea
  // hasta que se elige una dirección.
  const sesion = useRef<string>(crypto.randomUUID())
  const escrito = useRef(false)

  useEffect(() => {
    if (!escrito.current || disabled) return
    const texto = valor.trim()

    // Todo el trabajo va dentro del temporizador: así no se dispara un render
    // en cadena por cada tecla.
    const t = setTimeout(async () => {
      if (texto.length < 3) {
        setSugerencias([])
        setAbierto(false)
        return
      }
      setBuscando(true)
      try {
        const r = await fetch(
          `/api/lugares?q=${encodeURIComponent(texto)}&sesion=${sesion.current}`,
        )
        const datos = await r.json()
        setSugerencias(datos.sugerencias ?? [])
        setAviso(datos.error ? 'Google no está respondiendo; escribe la dirección a mano.' : null)
        setAbierto(true)
      } catch {
        setAviso('Google no está respondiendo; escribe la dirección a mano.')
      } finally {
        setBuscando(false)
      }
    }, 350)

    return () => clearTimeout(t)
  }, [valor, disabled])

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const elegir = (texto: string) => {
    escrito.current = false
    onCambio(texto)
    setSugerencias([])
    setAbierto(false)
    sesion.current = crypto.randomUUID()
  }

  return (
    <div className="relative" ref={caja}>
      <textarea
        rows={filas}
        value={valor}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          escrito.current = true
          onCambio(e.target.value)
        }}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        className="w-full rounded-[14px] border border-tinta-300 bg-white px-3.5 py-3 text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200 disabled:bg-tinta-50 disabled:text-tinta-400 lg:rounded-lg lg:px-3 lg:py-2 lg:text-sm"
      />

      {buscando && (
        <Loader2
          size={15}
          className="absolute right-3 top-3 animate-spin text-tinta-400"
          aria-hidden
        />
      )}

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-[14px] border-[0.5px] border-tinta-200 bg-white shadow-lg lg:rounded-lg">
          {sugerencias.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => elegir(s.texto)}
                className="flex w-full items-start gap-2 border-b-[0.5px] border-tinta-100 px-3.5 py-2.5 text-left text-sm text-tinta-700 transition last:border-b-0 hover:bg-haaco-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-tinta-400" />
                {s.texto}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-xs text-tinta-400">{aviso ?? 'Escribe y elige de las sugerencias'}</span>
        {valor.trim() && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(valor)}`}
            target="_blank"
            rel="noopener"
            className="shrink-0 text-xs font-medium text-haaco-700 hover:underline"
          >
            Ver en el mapa
          </a>
        )}
      </div>
    </div>
  )
}
