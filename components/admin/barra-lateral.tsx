'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote, Boxes, ClipboardList, FileSpreadsheet, FileText, HardHat, LayoutDashboard,
  LogOut, Receipt, ShoppingCart, Users, Wallet, Wrench, Zap,
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

/**
 * Menú completo de la app. Vive sólo en pantallas grandes: en el teléfono la
 * navegación es la barra de pestañas y la pantalla «Más».
 */
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

  /*
   * El `z-10` de la barra no es decorativo. Sin él se queda en el nivel de
   * apilamiento del contenido, y cualquier cosa posicionada que venga después
   * en el documento —una tabla entera, por ejemplo— le pasa por encima y le
   * roba los toques. Ya ocurrió: los renglones de las listas se llevaban por
   * delante los botones de aquí. Las barras de acción fijas no compiten,
   * porque se apartan con `lg:pl-72` en vez de subirse encima.
   */
  return (
    <aside className="sticky top-0 z-10 hidden h-dvh w-72 shrink-0 bg-haaco-900 lg:block">
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-haaco-950 px-4 py-4">
          <Membrete compacto tono="claro" />
        </div>

        <nav className="sin-barra flex-1 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => {
            const items = secciones.filter((s) => s.grupo === grupo)
            if (items.length === 0) return null

            return (
              <div key={grupo} className="mb-5">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-haaco-300">
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
                          className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                            activa
                              ? 'bg-white/12 font-medium text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-haaco-300'
                              : 'text-haaco-100/80 hover:bg-white/8 hover:text-white'
                          }`}
                        >
                          <Icono size={17} className={activa ? 'text-haaco-300' : 'text-haaco-200/70'} />
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

        <div className="border-t border-haaco-950 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-white">{nombre}</p>
            <p className="text-xs text-haaco-300">{rol}</p>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-haaco-100/80 transition hover:bg-white/8 hover:text-white"
            >
              <LogOut size={17} className="text-haaco-200/70" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
