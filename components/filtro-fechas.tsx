'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Filtros de fecha de las pantallas de consulta.
 *
 * `FiltroRango` abre un calendario y se eligen dos días —el primer toque es el
 * inicio, el segundo el fin— con atajos para lo que se pide siempre. Escribe
 * `desde` y `hasta` en la URL, así que el filtro se puede compartir y recargar.
 *
 * `FiltroMes` es el hermano para los cortes que por naturaleza son mensuales
 * (el cierre del contador, las quincenas de nómina): misma caja, pero se elige
 * mes y año en vez de días sueltos.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                      'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const CAJA =
  'inline-flex min-h-11 items-center gap-2 rounded-[12px] border-[0.5px] border-tinta-300 bg-white px-3.5 text-[15px] text-tinta-700 transition hover:border-haaco-400 lg:min-h-0 lg:rounded-lg lg:py-2 lg:text-sm'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const leer = (valor: string | null) => {
  if (!valor) return null
  const [a, m, d] = valor.split('-').map(Number)
  return Number.isFinite(a) && Number.isFinite(m) && Number.isFinite(d) ? new Date(a, m - 1, d) : null
}

const mismoDia = (a: Date, b: Date) => iso(a) === iso(b)
const primeroDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const ultimoDe = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

/** Los días que se pintan en la rejilla, empezando en lunes. */
function diasDelMes(ancla: Date) {
  const primero = primeroDe(ancla)
  const hueco = (primero.getDay() + 6) % 7 // lunes = 0
  const total = ultimoDe(ancla).getDate()

  return [
    ...Array.from({ length: hueco }, () => null),
    ...Array.from({ length: total }, (_, i) => new Date(ancla.getFullYear(), ancla.getMonth(), i + 1)),
  ]
}

function etiquetaRango(desde: Date | null, hasta: Date | null) {
  if (!desde && !hasta) return 'Cualquier fecha'
  if (desde && hasta) {
    // Un mes completo se dice por su nombre, que es como lo pide la gente.
    if (mismoDia(desde, primeroDe(desde)) && mismoDia(hasta, ultimoDe(desde))) {
      return `${MESES[desde.getMonth()]} de ${desde.getFullYear()}`
    }
    const mismoAnio = desde.getFullYear() === hasta.getFullYear()
    return `${desde.getDate()} ${MESES_CORTOS[desde.getMonth()]}${mismoAnio ? '' : ` ${desde.getFullYear()}`} – ${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]} ${hasta.getFullYear()}`
  }
  const d = (desde ?? hasta)!
  return `${desde ? 'Desde' : 'Hasta'} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`
}

// ---------------------------------------------------------------------------
// Caja desplegable compartida
// ---------------------------------------------------------------------------
function Desplegable({
  etiqueta,
  activo,
  children,
  abierto,
  onAbrir,
  onCerrar,
  titulo,
}: {
  etiqueta: string
  activo: boolean
  children: React.ReactNode
  abierto: boolean
  onAbrir: () => void
  onCerrar: () => void
  titulo: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // El panel vive en un portal sobre <body>: dentro de las tarjetas (que traen
  // overflow-hidden) el calendario se recortaba. En escritorio se posiciona
  // junto al botón; en el teléfono sigue siendo la hoja pegada abajo.
  const [pos, setPos] = useState<React.CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!abierto) return

    const colocar = () => {
      if (!window.matchMedia('(min-width: 640px)').matches) {
        setPos(null)
        return
      }
      const boton = caja.current?.getBoundingClientRect()
      if (!boton) return
      const alto = panel.current?.offsetHeight ?? 0
      const ancho = panel.current?.offsetWidth ?? 0
      const abajo = window.innerHeight - boton.bottom - 16
      const arriba = boton.top - 16
      const izquierda = Math.max(8, Math.min(boton.left, window.innerWidth - ancho - 8))
      // Cuelga del botón; si no cabe abajo se voltea, y si no cabe entero de
      // ningún lado se pega al borde de la pantalla aunque tape el botón:
      // cortado no sirve de nada. Los `auto` explícitos anulan los anclajes
      // de la hoja móvil (bottom-0, inset-x-0), que si no se cuelan y estiran
      // el panel de arriba a abajo.
      if (alto <= abajo) {
        setPos({ top: boton.bottom + 8, bottom: 'auto', left: izquierda, right: 'auto' })
      } else if (alto <= arriba) {
        setPos({
          top: 'auto',
          bottom: window.innerHeight - boton.top + 8,
          left: izquierda,
          right: 'auto',
        })
      } else {
        setPos({
          top: Math.max(8, window.innerHeight - alto - 8),
          bottom: 'auto',
          left: izquierda,
          right: 'auto',
          maxHeight: window.innerHeight - 16,
        })
      }
    }

    colocar()
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (caja.current?.contains(t) || panel.current?.contains(t)) return
      onCerrar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    window.addEventListener('resize', colocar)
    window.addEventListener('scroll', colocar, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('resize', colocar)
      window.removeEventListener('scroll', colocar, true)
    }
  }, [abierto, onCerrar])

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={abierto ? onCerrar : onAbrir}
        aria-expanded={abierto}
        className={`${CAJA} ${activo ? 'border-haaco-600 text-haaco-800' : ''}`}
      >
        <CalendarDays size={16} className={activo ? 'text-haaco-700' : 'text-tinta-400'} />
        {etiqueta}
      </button>

      {abierto &&
        createPortal(
          <>
            {/* En el teléfono el calendario sube como hoja; en escritorio cuelga del botón. */}
            <div className="fixed inset-0 z-[56] bg-tinta-950/40 sm:hidden" aria-hidden />
            <div
              ref={panel}
              style={pos ?? undefined}
              className={`fixed inset-x-0 bottom-0 z-[56] max-h-[92dvh] overflow-y-auto rounded-t-3xl border-tinta-200 bg-white p-4 pb-seguro shadow-xl animate-sube sm:inset-auto sm:w-max sm:animate-none sm:rounded-2xl sm:border-[0.5px] sm:p-3.5 ${
                pos ? '' : 'sm:invisible'
              }`}
            >
              <div className="mb-3 flex items-center justify-between sm:hidden">
                <span className="text-base font-semibold">{titulo}</span>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-tinta-150 text-tinta-600"
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>
              {children}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

function BotonAtajo({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 shrink-0 whitespace-nowrap rounded-full border-[0.5px] border-tinta-200 bg-white px-3 text-[13px] font-medium text-tinta-600 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Rango de fechas
// ---------------------------------------------------------------------------
export function FiltroRango({
  paramDesde = 'desde',
  paramHasta = 'hasta',
  titulo = 'Periodo',
}: {
  paramDesde?: string
  paramHasta?: string
  titulo?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [, iniciar] = useTransition()
  const [abierto, setAbierto] = useState(false)

  const desdeUrl = leer(params.get(paramDesde))
  const hastaUrl = leer(params.get(paramHasta))

  // Selección en curso: se confirma al elegir el segundo día.
  const [desde, setDesde] = useState<Date | null>(desdeUrl)
  const [hasta, setHasta] = useState<Date | null>(hastaUrl)
  const [ancla, setAncla] = useState<Date>(primeroDe(desdeUrl ?? new Date()))

  const aplicar = (d: Date | null, h: Date | null) => {
    const nuevos = new URLSearchParams(params.toString())
    if (d) nuevos.set(paramDesde, iso(d))
    else nuevos.delete(paramDesde)
    if (h) nuevos.set(paramHasta, iso(h))
    else nuevos.delete(paramHasta)
    setAbierto(false)
    iniciar(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
  }

  const tocarDia = (dia: Date) => {
    // Primer toque abre el rango; el segundo lo cierra y aplica.
    if (!desde || (desde && hasta)) {
      setDesde(dia)
      setHasta(null)
      return
    }
    if (dia < desde) {
      setDesde(dia)
      return
    }
    setHasta(dia)
    aplicar(desde, dia)
  }

  const atajo = (d: Date, h: Date) => {
    setDesde(d)
    setHasta(h)
    setAncla(primeroDe(d))
    aplicar(d, h)
  }

  const hoy = new Date()
  const atajos: [string, () => void][] = [
    ['Este mes', () => atajo(primeroDe(hoy), ultimoDe(hoy))],
    ['Mes pasado', () => {
      const m = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      atajo(m, ultimoDe(m))
    }],
    ['Últimos 30 días', () => {
      const d = new Date(hoy)
      d.setDate(d.getDate() - 29)
      atajo(d, hoy)
    }],
    ['Este año', () => atajo(new Date(hoy.getFullYear(), 0, 1), new Date(hoy.getFullYear(), 11, 31))],
  ]

  return (
    <Desplegable
      titulo={titulo}
      etiqueta={etiquetaRango(desdeUrl, hastaUrl)}
      activo={Boolean(desdeUrl || hastaUrl)}
      abierto={abierto}
      onAbrir={() => {
        setDesde(desdeUrl)
        setHasta(hastaUrl)
        setAncla(primeroDe(desdeUrl ?? new Date()))
        setAbierto(true)
      }}
      onCerrar={() => setAbierto(false)}
    >
      <div className="sin-barra mb-3 flex gap-1.5 overflow-x-auto">
        {atajos.map(([texto, accion]) => (
          <BotonAtajo key={texto} onClick={accion}>
            {texto}
          </BotonAtajo>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold capitalize">
          {MESES[ancla.getMonth()]} {ancla.getFullYear()}
          <span className="hidden sm:inline">
            {' · '}
            {MESES[(ancla.getMonth() + 1) % 12]}{' '}
            {ancla.getMonth() === 11 ? ancla.getFullYear() + 1 : ancla.getFullYear()}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex gap-5">
        <Mes ancla={ancla} desde={desde} hasta={hasta} onTocar={tocarDia} />
        <div className="hidden sm:block">
          <Mes
            ancla={new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1)}
            desde={desde}
            hasta={hasta}
            onTocar={tocarDia}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t-[0.5px] border-tinta-150 pt-3">
        <span className="text-xs text-tinta-500">
          {!desde && !hasta
            ? 'Elige el primer día'
            : desde && !hasta
              ? 'Ahora el día final'
              : etiquetaRango(desde, hasta)}
        </span>
        <button
          type="button"
          onClick={() => {
            setDesde(null)
            setHasta(null)
            aplicar(null, null)
          }}
          className="min-h-9 rounded-lg px-3 text-[13px] font-medium text-tinta-500 transition hover:bg-tinta-100"
        >
          Quitar fechas
        </button>
      </div>
    </Desplegable>
  )
}

function Mes({
  ancla,
  desde,
  hasta,
  onTocar,
}: {
  ancla: Date
  desde: Date | null
  hasta: Date | null
  onTocar: (d: Date) => void
}) {
  const hoy = new Date()

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DIAS.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-semibold uppercase text-tinta-400">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {diasDelMes(ancla).map((dia, i) => {
          if (!dia) return <span key={`hueco-${i}`} />

          const esInicio = desde && mismoDia(dia, desde)
          const esFin = hasta && mismoDia(dia, hasta)
          const dentro = desde && hasta && dia > desde && dia < hasta
          const extremo = esInicio || esFin

          return (
            <button
              key={iso(dia)}
              type="button"
              onClick={() => onTocar(dia)}
              className={`h-9 w-9 rounded-lg text-[13px] tabular-nums transition ${
                extremo
                  ? 'bg-haaco-700 font-semibold text-white'
                  : dentro
                    ? 'bg-haaco-50 text-haaco-800'
                    : 'text-tinta-700 hover:bg-tinta-100'
              } ${mismoDia(dia, hoy) && !extremo ? 'font-semibold text-haaco-700 ring-1 ring-inset ring-haaco-200' : ''}`}
            >
              {dia.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Un día suelto, para los formularios
// ---------------------------------------------------------------------------

/**
 * Reemplaza al `<input type="date">` del navegador en los formularios de
 * captura: mismo calendario que el filtro, en español y con el mismo aspecto
 * en cualquier navegador.
 */
export function SelectorFecha({
  valor,
  onCambio,
  disabled,
  titulo = 'Fecha',
  id,
}: {
  /** Fecha en formato aaaa-mm-dd, como la guarda Postgres. */
  valor: string
  onCambio: (valor: string) => void
  disabled?: boolean
  titulo?: string
  id?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const elegida = leer(valor)
  const [ancla, setAncla] = useState<Date>(primeroDe(elegida ?? new Date()))

  const hoy = new Date()
  const etiqueta = elegida
    ? `${elegida.getDate()} de ${MESES[elegida.getMonth()]} de ${elegida.getFullYear()}`
    : 'Elegir fecha'

  if (disabled) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-tinta-300 bg-tinta-50 px-3.5 text-[15px] text-tinta-400 lg:min-h-0 lg:rounded-lg lg:py-2 lg:text-sm">
        <CalendarDays size={16} />
        {etiqueta}
      </span>
    )
  }

  return (
    <span id={id} className="inline-block">
      <Desplegable
        titulo={titulo}
        etiqueta={etiqueta}
        activo={Boolean(elegida)}
        abierto={abierto}
        onAbrir={() => {
          setAncla(primeroDe(leer(valor) ?? new Date()))
          setAbierto(true)
        }}
        onCerrar={() => setAbierto(false)}
      >
        <div className="mb-3 flex gap-1.5">
          <BotonAtajo
            onClick={() => {
              onCambio(iso(hoy))
              setAbierto(false)
            }}
          >
            Hoy
          </BotonAtajo>
          <BotonAtajo
            onClick={() => {
              const ayer = new Date(hoy)
              ayer.setDate(ayer.getDate() - 1)
              onCambio(iso(ayer))
              setAbierto(false)
            }}
          >
            Ayer
          </BotonAtajo>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold capitalize">
            {MESES[ancla.getMonth()]} {ancla.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => setAncla(new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <Mes
          ancla={ancla}
          desde={elegida}
          hasta={elegida}
          onTocar={(d) => {
            onCambio(iso(d))
            setAbierto(false)
          }}
        />
      </Desplegable>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Mes suelto (cortes mensuales)
// ---------------------------------------------------------------------------
export function FiltroMes({
  mes,
  param = 'mes',
  titulo = 'Mes del corte',
}: {
  mes: string
  param?: string
  titulo?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [, iniciar] = useTransition()
  const [abierto, setAbierto] = useState(false)

  const [anio, mesNum] = mes.split('-').map(Number)
  const [anioVisible, setAnioVisible] = useState(anio)

  const elegir = (i: number) => {
    const nuevos = new URLSearchParams(params.toString())
    nuevos.set(param, `${anioVisible}-${String(i + 1).padStart(2, '0')}`)
    setAbierto(false)
    iniciar(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
  }

  return (
    <Desplegable
      titulo={titulo}
      etiqueta={`${MESES[mesNum - 1]} de ${anio}`}
      activo
      abierto={abierto}
      onAbrir={() => {
        setAnioVisible(anio)
        setAbierto(true)
      }}
      onCerrar={() => setAbierto(false)}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAnioVisible(anioVisible - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
          aria-label="Año anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold tabular-nums">{anioVisible}</span>
        <button
          type="button"
          onClick={() => setAnioVisible(anioVisible + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100"
          aria-label="Año siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid w-full grid-cols-3 gap-1.5 sm:w-64">
        {MESES_CORTOS.map((m, i) => {
          const elegido = anioVisible === anio && i === mesNum - 1
          return (
            <button
              key={m}
              type="button"
              onClick={() => elegir(i)}
              className={`min-h-11 rounded-[12px] text-[13.5px] font-medium capitalize transition ${
                elegido
                  ? 'bg-haaco-700 text-white'
                  : 'border-[0.5px] border-tinta-200 bg-white text-tinta-700 hover:border-haaco-300 hover:bg-haaco-50'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </Desplegable>
  )
}
