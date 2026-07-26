'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Banknote, Boxes, ClipboardList, FileSpreadsheet, FileText, HardHat, LayoutDashboard,
  LogOut, Menu, Receipt, ShoppingCart, Users, Wallet, Wrench, X, Zap,
} from 'lucide-react'
import { Membrete } from '@/components/marca'
import { GRUPOS, type Seccion } from '@/lib/nav'
import type { LucideIcon } from 'lucide-react'

const ICONOS: Record<string, LucideIcon> = {
  panel: LayoutDashboard,
  cotizacion: FileText,
  rapido: Zap,
  obra: HardHat,
  cliente: Users,
  cobranza: Banknote,
  gasto: ShoppingCart,
  cxp: Receipt,
  nomina: Wallet,
  pagosfijos: ClipboardList,
  caja: Wallet,
  catalogo: Boxes,
  herramienta: Wrench,
  reporte: FileSpreadsheet,
  usuario: Users,
}

function estaActiva(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

export function BarraLateral({
  secciones,
  nombre,
  rol,
  cerrarSesion,
}: {
  secciones: Seccion[]
  nombre: string
  rol: string
  cerrarSesion: () => Promise<void>
}) {
  const pathname = usePathname()
  const [abierta, setAbierta] = useState(false)

  const contenido = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-tinta-100 px-4 py-4">
        <Membrete compacto />
        <button
          type="button"
          onClick={() => setAbierta(false)}
          className="rounded-lg p-1.5 text-tinta-500 hover:bg-tinta-100 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GRUPOS.map((grupo) => {
          const items = secciones.filter((s) => s.grupo === grupo)
          if (items.length === 0) return null

          return (
            <div key={grupo} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-tinta-400">
                {grupo}
              </p>
              <ul className="space-y-0.5">
                {items.map((seccion) => {
                  const Icono = ICONOS[seccion.icono] ?? LayoutDashboard
                  const activa = estaActiva(pathname, seccion.href)

                  return (
                    <li key={seccion.href}>
                      <Link
                        href={seccion.href}
                        onClick={() => setAbierta(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                          activa
                            ? 'bg-haaco-50 font-medium text-haaco-800'
                            : 'text-tinta-600 hover:bg-tinta-100 hover:text-tinta-900'
                        }`}
                      >
                        <Icono size={17} className={activa ? 'text-haaco-600' : 'text-tinta-400'} />
                        <span className="flex-1">{seccion.titulo}</span>
                        {seccion.pendiente && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title="Módulo por construir"
                          />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-tinta-100 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-tinta-800">{nombre}</p>
          <p className="text-xs text-tinta-500">{rol}</p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-tinta-600 transition hover:bg-tinta-100 hover:text-tinta-900"
          >
            <LogOut size={17} className="text-tinta-400" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Barra superior · sólo móvil y iPad en vertical */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-tinta-200 bg-white px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="rounded-lg p-1.5 text-tinta-600 hover:bg-tinta-100"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
        <Membrete compacto />
      </div>

      {abierta && (
        <div
          className="fixed inset-0 z-40 bg-tinta-900/40 lg:hidden"
          onClick={() => setAbierta(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-tinta-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {contenido}
      </aside>
    </>
  )
}
