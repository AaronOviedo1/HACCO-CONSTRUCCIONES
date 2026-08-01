'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AreaTexto, Entrada } from '@/components/formulario'
import { pesos } from '@/lib/format'
import type { Sugerencia } from '@/lib/cotizaciones'

/**
 * Entrada de texto con sugerencias de lo ya cotizado: van apareciendo conforme
 * se teclea y al elegir una el padre rellena su precio o costo. El panel vive
 * en un portal para que el overflow de las tarjetas no lo recorte, igual que
 * el calendario.
 */

/** Minúsculas y sin acentos, para que «Herrería» encuentre «herreria». */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function EntradaSugerencias({
  valor,
  onCambio,
  onElegir,
  sugerencias,
  placeholder,
  disabled,
  className,
  multilinea,
  autoFocus,
}: {
  valor: string
  onCambio: (valor: string) => void
  /** Se elige una sugerencia: el padre pone el texto y el monto que traiga. */
  onElegir: (sugerencia: Sugerencia) => void
  sugerencias: Sugerencia[]
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Textarea que crece con el texto, para descripciones largas. */
  multilinea?: boolean
  autoFocus?: boolean
}) {
  const campo = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [abierta, setAbierta] = useState(false)
  const [resaltada, setResaltada] = useState(0)
  const [pos, setPos] = useState<React.CSSProperties | null>(null)

  // El textarea crece con el contenido, sin barra de scroll propia.
  useLayoutEffect(() => {
    const el = campo.current
    if (!multilinea || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [multilinea, valor])

  const texto = normalizar(valor.trim())
  const visibles = texto
    ? sugerencias
        .filter((s) => {
          const nombre = normalizar(s.texto)
          return nombre.includes(texto) && nombre !== texto
        })
        .slice(0, 8)
    : []
  const mostrar = abierta && !disabled && visibles.length > 0

  // Se coloca antes del paint, así que aunque `pos` quede de una apertura
  // anterior nunca se alcanza a ver en el lugar viejo.
  useLayoutEffect(() => {
    if (!mostrar) return

    const colocar = () => {
      const caja = campo.current?.getBoundingClientRect()
      if (!caja) return
      const alto = panel.current?.offsetHeight ?? 0
      const abajo = window.innerHeight - caja.bottom - 12
      const ancho = Math.min(Math.max(caja.width, 300), window.innerWidth - 16)
      const izquierda = Math.max(8, Math.min(caja.left, window.innerWidth - ancho - 8))
      // Cuelga del campo y, si no cabe hacia abajo, se voltea hacia arriba.
      setPos(
        alto <= abajo || abajo >= caja.top - 12
          ? { top: caja.bottom + 6, left: izquierda, width: ancho, maxHeight: Math.max(abajo, 160) }
          : { bottom: window.innerHeight - caja.top + 6, left: izquierda, width: ancho, maxHeight: caja.top - 12 },
      )
    }

    colocar()
    window.addEventListener('resize', colocar)
    window.addEventListener('scroll', colocar, true)
    return () => {
      window.removeEventListener('resize', colocar)
      window.removeEventListener('scroll', colocar, true)
    }
  }, [mostrar, valor])

  const elegir = (s: Sugerencia) => {
    onElegir(s)
    setAbierta(false)
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // En multilínea tampoco se permiten saltos: es una descripción corrida.
      e.preventDefault()
      if (mostrar) elegir(visibles[Math.min(resaltada, visibles.length - 1)])
      return
    }
    if (!mostrar) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltada((r) => (r + 1) % visibles.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltada((r) => (r - 1 + visibles.length) % visibles.length)
    } else if (e.key === 'Escape') {
      setAbierta(false)
    }
  }

  const propsCampo = {
    value: valor,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onCambio(e.target.value)
      setAbierta(true)
      setResaltada(0)
    },
    onFocus: () => setAbierta(true),
    onBlur: () => setAbierta(false),
    onKeyDown: alTeclear,
    placeholder,
    disabled,
    autoFocus,
    autoComplete: 'off',
  }

  return (
    <>
      {multilinea ? (
        <AreaTexto
          ref={campo as React.Ref<HTMLTextAreaElement>}
          rows={1}
          {...propsCampo}
          className={`!min-h-0 resize-none overflow-hidden ${className ?? ''}`}
        />
      ) : (
        <Entrada
          ref={campo as React.Ref<HTMLInputElement>}
          {...propsCampo}
          className={className}
        />
      )}

      {mostrar &&
        createPortal(
          <div
            ref={panel}
            style={pos ?? undefined}
            role="listbox"
            className={`fixed z-50 overflow-y-auto rounded-2xl border-[0.5px] border-tinta-200 bg-white py-1.5 shadow-xl ${
              pos ? '' : 'invisible'
            }`}
          >
            {visibles.map((s, i) => (
              <button
                key={s.texto}
                type="button"
                role="option"
                aria-selected={i === resaltada}
                // preventDefault para que el campo no pierda el foco al tocar.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(s)}
                onMouseEnter={() => setResaltada(i)}
                className={`flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left text-[14px] transition lg:text-sm ${
                  i === resaltada ? 'bg-haaco-50 text-haaco-900' : 'text-tinta-700'
                }`}
              >
                <span className="min-w-0 flex-1">{s.texto}</span>
                {s.monto != null && s.monto > 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-tinta-400">
                    {pesos(s.monto)}
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
