'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import { FECHA_NOVEDADES, VERSION_NOVEDADES, entregasDe } from '@/lib/novedades'
import type { Novedad } from '@/lib/novedades'
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-950/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lo nuevo"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl animate-sube sm:animate-none sm:rounded-2xl"
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

        <div className="flex-1 overflow-y-auto border-t-[0.5px] border-tinta-150">
          <ListaNovedades novedades={reciente?.novedades ?? []} />
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
