'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Sparkles, X } from 'lucide-react'
import { FECHA_NOVEDADES, VERSION_NOVEDADES, entregasDe } from '@/lib/novedades'
import type { Captura, Figura, Marca, Novedad } from '@/lib/novedades'
import type { RolUsuario } from '@/types/database'

const CLAVE = 'haaco:novedades-vistas'

const marcarVistas = () => {
  try {
    localStorage.setItem(CLAVE, VERSION_NOVEDADES)
  } catch {}
}

/**
 * Lo nuevo de esta versión, la primera vez que alguien entra después de que
 * subió.
 *
 * La marca va en el propio navegador y no en la base: es un aviso, no un dato
 * de la empresa, y así el que trabaja en dos aparatos lo ve en los dos —que es
 * lo que se quiere— sin una tabla de por medio.
 *
 * No sale de golpe al pintar la pantalla: espera a que el usuario lleve un
 * momento adentro. Un diálogo que aparece encima de lo que apenas se está
 * cargando se cierra por reflejo, sin leerlo.
 */
export function Novedades({ rol }: { rol: RolUsuario }) {
  const [abierto, setAbierto] = useState(false)
  const cuantas = entregasDe(rol).length

  useEffect(() => {
    if (cuantas === 0) return
    try {
      if (localStorage.getItem(CLAVE) === VERSION_NOVEDADES) return
    } catch {
      // Navegador con el almacenamiento bloqueado: mejor no enseñar nada que
      // enseñarlo en cada carga.
      return
    }
    const t = setTimeout(() => setAbierto(true), 900)
    return () => clearTimeout(t)
  }, [cuantas])

  if (!abierto) return null

  return (
    <HojaNovedades
      rol={rol}
      onCerrar={() => {
        setAbierto(false)
        marcarVistas()
      }}
    />
  )
}

/**
 * El mismo aviso, pero pedido a mano.
 *
 * Quien lo cerró sin leerlo —o quien quiere volver a ver cómo era una cosa—
 * tiene dónde. Un aviso que sólo existe una vez y para siempre no sirve de
 * nada al que ese día andaba de prisa.
 *
 * Va en los dos lados: en «Más» para el teléfono y al pie de la barra lateral
 * en el escritorio, que es donde vive lo de «esta app» y donde no hay ninguna
 * pantalla «Más» a la que ir.
 */
export function BotonNovedades({
  rol,
  variante = 'menu',
}: {
  rol: RolUsuario
  variante?: 'menu' | 'lateral'
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {variante === 'lateral' ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-haaco-100/80 transition hover:bg-white/8 hover:text-white"
        >
          <Sparkles size={17} className="text-haaco-200/70" />
          Novedades
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex min-h-[52px] w-full items-center gap-3 border-b-[0.5px] border-tinta-100 px-4 text-left text-[15.5px] transition last:border-b-0 active:bg-tinta-50"
        >
          <span className="flex-1">Novedades</span>
          <span className="text-[13px] text-tinta-400">{FECHA_NOVEDADES}</span>
        </button>
      )}

      {abierto && (
        <HojaNovedades
          rol={rol}
          onCerrar={() => {
            setAbierto(false)
            marcarVistas()
          }}
        />
      )}
    </>
  )
}

function HojaNovedades({ rol, onCerrar }: { rol: RolUsuario; onCerrar: () => void }) {
  const [reciente, ...anteriores] = entregasDe(rol)
  const cuerpoRef = useRef<HTMLDivElement>(null)

  /*
   * Si la entrega de hoy trae aunque sea una captura, se cuenta lámina por
   * lámina; si no —roles a los que no les tocó imagen, o una entrega de puro
   * texto—, la lista de siempre.
   */
  const conFiguras = (reciente?.novedades ?? []).some((n) => n.figura)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    // z-[60] y no z-50: el «+» flotante del teléfono vive en z-50 después de
    // esta hoja en el DOM, y le taparía la flecha de «Siguiente» al recorrido.
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta-950/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lo nuevo"
        className={`relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl animate-sube sm:animate-none sm:rounded-2xl ${conFiguras ? 'sm:max-w-2xl' : ''}`}
      >
        <span
          className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-tinta-300 sm:hidden"
          aria-hidden
        />

        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4 sm:pt-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-haaco-700">
              <Sparkles size={13} />
              Lo nuevo
            </p>
            <h2 className="mt-1 text-[22px] font-bold leading-tight -tracking-[0.5px] text-tinta-900 sm:text-xl sm:font-semibold">
              Esto ya lo puedes hacer
            </h2>
            <p className="mt-0.5 text-sm text-tinta-500">
              Cambios del {reciente?.fecha ?? FECHA_NOVEDADES}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta-150 text-tinta-600 transition hover:bg-tinta-200 sm:bg-transparent sm:text-tinta-400 sm:hover:bg-tinta-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={cuerpoRef} className="flex-1 overflow-y-auto border-t-[0.5px] border-tinta-150">
          {conFiguras && reciente ? (
            <RecorridoNovedades
              novedades={reciente.novedades}
              alCambiar={() => cuerpoRef.current?.scrollTo({ top: 0 })}
            />
          ) : (
            <ListaNovedades novedades={reciente?.novedades ?? []} />
          )}
          {anteriores.map((e) => (
            <EntregaPlegada key={e.version} fecha={e.fecha} novedades={e.novedades} />
          ))}
        </div>

        <div className="border-t-[0.5px] border-tinta-150 bg-tinta-50 px-5 py-3 pb-seguro sm:pb-3">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-[14px] bg-haaco-700 px-4 py-3 text-[15.5px] font-semibold text-white transition hover:bg-haaco-800 sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

function ListaNovedades({ novedades }: { novedades: Novedad[] }) {
  return (
    <ul className="divide-y divide-tinta-100">
      {novedades.map((n) => (
        <li key={n.titulo} className="px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-tinta-400">
            {n.donde}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tinta-900">{n.titulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-tinta-600">{n.texto}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * La entrega de hoy contada lámina por lámina: una novedad a la vez, con su
 * captura de pantalla y un anillo señalando dónde está el cambio.
 *
 * El recorrido vive en estado y no en un carril con scroll: las láminas miden
 * distinto, y dentro de un diálogo de alto acotado la única que debe mandar
 * sobre el alto es la que se está viendo. Se avanza con las flechas, los
 * puntos, el teclado o deslizando el dedo. El umbral del gesto es el mismo del
 * recorrido HTML que se le manda al cliente: 60px, y tiene que ser bastante
 * más horizontal que vertical para no pelearse con el scroll de la hoja.
 */
function RecorridoNovedades({
  novedades,
  alCambiar,
}: {
  novedades: Novedad[]
  alCambiar?: () => void
}) {
  const [actual, setActual] = useState(0)
  const [ampliada, setAmpliada] = useState<{ captura: Captura; pie: string } | null>(null)
  const toque = useRef<{ x: number; y: number } | null>(null)

  const total = novedades.length
  const novedad = novedades[actual]

  const ir = (i: number) => {
    const destino = Math.max(0, Math.min(total - 1, i))
    if (destino === actual) return
    setActual(destino)
    alCambiar?.()
  }

  // Sin lista de dependencias a propósito: se re-engancha en cada render y así
  // siempre ve la lámina actual, sin duplicar la lógica de `ir` aquí adentro.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (ampliada) return
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
        return
      const saltos: Record<string, number> = {
        ArrowRight: actual + 1,
        ArrowLeft: actual - 1,
        Home: 0,
        End: total - 1,
      }
      if (e.key in saltos) {
        e.preventDefault()
        ir(saltos[e.key])
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  })

  // Las capturas de las láminas vecinas se piden desde ya: al avanzar, la
  // imagen debe estar esperando y no al revés.
  useEffect(() => {
    for (const vecina of [novedades[actual - 1], novedades[actual + 1]]) {
      for (const captura of [vecina?.figura?.movil, vecina?.figura?.escritorio]) {
        if (captura) new Image().src = captura.ruta
      }
    }
  }, [actual, novedades])

  const alTocar = (e: React.TouchEvent) => {
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const alSoltar = (e: React.TouchEvent) => {
    if (!toque.current) return
    const dx = e.changedTouches[0].clientX - toque.current.x
    const dy = e.changedTouches[0].clientY - toque.current.y
    toque.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) ir(actual + (dx < 0 ? 1 : -1))
  }

  return (
    <div>
      <div key={actual} className="animate-entra px-5 py-4" onTouchStart={alTocar} onTouchEnd={alSoltar}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-tinta-400">
          {novedad.donde}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-tinta-900">
          {novedad.titulo}
        </p>
        {novedad.figura && (
          <FiguraNovedad
            figura={novedad.figura}
            onAmpliar={(captura, pie) => setAmpliada({ captura, pie })}
          />
        )}
        <p className="mt-2.5 text-sm leading-relaxed text-tinta-600">{novedad.texto}</p>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            disabled={actual === 0}
            aria-label="Anterior"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta-100 text-tinta-600 transition enabled:hover:bg-tinta-150 disabled:opacity-35 sm:h-9 sm:w-9"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center overflow-x-auto sin-barra">
            {novedades.map((n, i) => (
              <button
                key={n.titulo}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Novedad ${i + 1} de ${total}: ${n.titulo}`}
                aria-current={i === actual || undefined}
                className="flex items-center justify-center px-1 py-2"
              >
                <span
                  className={`h-1.5 rounded-full transition-all ${
                    i === actual ? 'w-4 bg-haaco-600' : 'w-1.5 bg-tinta-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            disabled={actual === total - 1}
            aria-label="Siguiente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta-100 text-tinta-600 transition enabled:hover:bg-tinta-150 disabled:opacity-35 sm:h-9 sm:w-9"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {`Novedad ${actual + 1} de ${total}: ${novedad.titulo}`}
      </p>

      {ampliada && (
        <Lupa captura={ampliada.captura} pie={ampliada.pie} onCerrar={() => setAmpliada(null)} />
      )}
    </div>
  )
}

/**
 * La captura que le toca a cada tamaño, elegida por CSS y no por JS: el mismo
 * árbol sirve en el teléfono y en la computadora, como el resto de la hoja.
 * Si sólo hay una variante, se enseña en los dos.
 */
function FiguraNovedad({
  figura,
  onAmpliar,
}: {
  figura: Figura
  onAmpliar: (captura: Captura, pie: string) => void
}) {
  return (
    <figure className="mt-3">
      {figura.movil && (
        <CapturaConMarca
          captura={figura.movil}
          pie={figura.pie}
          telefono
          clase={figura.escritorio ? 'sm:hidden' : ''}
          onAmpliar={onAmpliar}
        />
      )}
      {figura.escritorio && (
        <CapturaConMarca
          captura={figura.escritorio}
          pie={figura.pie}
          clase={figura.movil ? 'hidden sm:block' : ''}
          onAmpliar={onAmpliar}
        />
      )}
      <figcaption className="mt-2 text-[13px] leading-snug text-tinta-500">{figura.pie}</figcaption>
    </figure>
  )
}

/**
 * El envoltorio mide lo mismo que la imagen —ancho y alto intrínsecos, sin
 * saltos al navegar— y por eso los porcentajes de la marca caen donde deben.
 */
function CapturaConMarca({
  captura,
  pie,
  telefono = false,
  clase = '',
  onAmpliar,
}: {
  captura: Captura
  pie: string
  telefono?: boolean
  clase?: string
  onAmpliar: (captura: Captura, pie: string) => void
}) {
  return (
    <div className={`relative ${telefono ? 'mx-auto max-w-[230px]' : ''} ${clase}`}>
      <button
        type="button"
        onClick={() => onAmpliar(captura, pie)}
        className="block w-full cursor-zoom-in"
        aria-label={`Ver grande: ${pie}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={captura.ruta}
          alt={pie}
          width={captura.ancho}
          height={captura.alto}
          decoding="async"
          className={`h-auto w-full border-[0.5px] border-tinta-200 shadow-tarjeta ${
            telefono ? 'rounded-[22px]' : 'rounded-xl'
          }`}
        />
      </button>
      {captura.marca && <Marcador marca={captura.marca} />}
      <span
        className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-tinta-950/55 text-white"
        aria-hidden
      >
        <Maximize2 size={13} />
      </span>
    </div>
  )
}

/**
 * El anillo que señala dónde está el cambio. El halo respira; el punto lleva
 * un ring estático para que, sin animación —reduced motion—, siga señalando.
 * Va `aria-hidden`: lo que apunta ya lo cuenta el pie de la figura.
 */
function Marcador({ marca }: { marca: Marca }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${marca.x}%`, top: `${marca.y}%` }}
    >
      <span className="absolute inset-0 rounded-full bg-haaco-500/50 animate-destello" />
      <span className="absolute inset-0 rounded-full border-2 border-white bg-haaco-600 shadow-verde ring-4 ring-haaco-500/25" />
    </span>
  )
}

/**
 * La captura en grande, a resolución casi completa y con scroll: aquí es donde
 * de verdad se ve el detalle, sobre todo una pantalla de computadora abierta
 * desde el teléfono.
 */
function Lupa({ captura, pie, onCerrar }: { captura: Captura; pie: string; onCerrar: () => void }) {
  const marcoRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const antes = document.activeElement
    cerrarRef.current?.focus()
    // El interés suele estar al centro de la pantalla, no en su orilla
    // izquierda: el scroll horizontal arranca centrado.
    const marco = marcoRef.current
    if (marco) marco.scrollLeft = (marco.scrollWidth - marco.clientWidth) / 2
    return () => {
      if (antes instanceof HTMLElement) antes.focus()
    }
  }, [])

  useEffect(() => {
    // En fase de captura y con stopPropagation: el Escape de la hoja vive en
    // burbuja sobre este mismo document, y el primer Escape debe cerrar la
    // lupa, no el aviso entero.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
      }
    }
    document.addEventListener('keydown', alTeclear, { capture: true })
    return () => document.removeEventListener('keydown', alTeclear, { capture: true })
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-tinta-950/95">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="min-w-0 truncate text-sm text-white/85">{pie}</p>
        <button
          ref={cerrarRef}
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la vista grande"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </div>
      <div
        ref={marcoRef}
        className="flex-1 overflow-auto overscroll-contain p-4 pb-seguro"
        onClick={(e) => e.target === e.currentTarget && onCerrar()}
      >
        <div
          className="relative mx-auto"
          style={{ width: `max(100%, min(${captura.ancho}px, 1400px))` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captura.ruta}
            alt={pie}
            width={captura.ancho}
            height={captura.alto}
            className="h-auto w-full rounded-lg"
          />
          {captura.marca && <Marcador marca={captura.marca} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Una entrega de antes: doblada, con su fecha y cuántas cosas trajo.
 *
 * Lo de hoy es lo que hay que leer; lo de la vez pasada ya se leyó y no tiene
 * por qué estorbar arriba. Pero tampoco se borra: el que entró de vacaciones o
 * quiere volver a ver cómo era algo, lo abre y ahí está.
 */
function EntregaPlegada({ fecha, novedades }: { fecha: string; novedades: Novedad[] }) {
  const [abierta, setAbierta] = useState(false)

  return (
    <div className="border-t-[0.5px] border-tinta-150">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex min-h-[52px] w-full items-center gap-2 bg-tinta-50 px-5 py-3 text-left transition hover:bg-tinta-100"
      >
        <span className="flex-1 text-sm text-tinta-600">
          Cambios del {fecha}
          <span className="ml-1.5 text-tinta-400">
            · {novedades.length} {novedades.length === 1 ? 'novedad' : 'novedades'}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-tinta-400 transition-transform ${abierta ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {abierta && <ListaNovedades novedades={novedades} />}
    </div>
  )
}
