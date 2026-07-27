'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Dialogo, PieDialogo } from '@/components/formulario'
import { CLASES_TILE, CuerpoTile, type TonoTile } from '@/components/movil/piezas'

/**
 * Los cuatro números del dashboard.
 *
 * En el escritorio hay pantalla de sobra: tocarlos abre el detalle encima sin
 * perder el tablero. En el teléfono no cabe un cuadro de diálogo con tabla, así
 * que ahí el mismo tile lleva a su pantalla completa, como cualquier enlace.
 */
export function TileResumen({
  etiqueta,
  valor,
  nota,
  tono = 'neutro',
  href,
  titulo,
  descripcion,
  irA = 'Abrir la pantalla completa',
  children,
}: {
  etiqueta: string
  valor: string
  nota?: ReactNode
  tono?: TonoTile
  /** A dónde va en el teléfono, y a dónde lleva el pie del diálogo. */
  href: string
  titulo: string
  descripcion?: string
  irA?: string
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <Link
        href={href}
        onClick={(e) => {
          // Debajo de lg no hay diálogo que valga: se navega.
          if (!window.matchMedia('(min-width: 1024px)').matches) return
          e.preventDefault()
          setAbierto(true)
        }}
        className={`${CLASES_TILE} transition active:bg-tinta-50 lg:hover:border-haaco-300 lg:hover:bg-haaco-50/40`}
      >
        <CuerpoTile etiqueta={etiqueta} valor={valor} nota={nota} tono={tono} />
      </Link>

      <Dialogo
        abierto={abierto}
        titulo={titulo}
        descripcion={descripcion}
        onCerrar={() => setAbierto(false)}
        ancho="xl"
      >
        <div className="max-h-[65dvh] overflow-y-auto">{children}</div>
        <PieDialogo>
          <Link
            href={href}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-4 text-base font-semibold text-white transition hover:bg-haaco-800 sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
          >
            {irA}
            <ArrowRight size={16} />
          </Link>
        </PieDialogo>
      </Dialogo>
    </>
  )
}
