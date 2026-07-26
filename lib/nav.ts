import type { RolUsuario } from '@/types/database'

export type Seccion = {
  href: string
  titulo: string
  icono: string
  roles: RolUsuario[]
  grupo: 'Operación' | 'Dinero' | 'Catálogos' | 'Sistema'
  /** true mientras el módulo tenga base de datos pero todavía no interfaz. */
  pendiente?: boolean
}

/**
 * Menú del panel administrativo.
 * La navegación completa existe desde el día uno para que Luis y Pati vean el
 * mapa entero; los módulos marcados como pendientes ya tienen su esquema y su
 * RLS, sólo les falta la pantalla.
 */
export const SECCIONES: Seccion[] = [
  { href: '/admin',                    titulo: 'Dashboard',         icono: 'panel',       grupo: 'Operación', roles: ['admin', 'administracion'] },
  { href: '/admin/cotizaciones',       titulo: 'Cotizaciones',      icono: 'cotizacion',  grupo: 'Operación', roles: ['admin', 'administracion'] },
  { href: '/admin/cotizar-rapido',     titulo: 'Cotización rápida', icono: 'rapido',      grupo: 'Operación', roles: ['admin', 'administracion'] },
  { href: '/admin/obras',              titulo: 'Obras (OTs)',       icono: 'obra',        grupo: 'Operación', roles: ['admin', 'administracion'] },
  { href: '/admin/clientes',           titulo: 'Clientes',          icono: 'cliente',     grupo: 'Operación', roles: ['admin', 'administracion'] },

  { href: '/admin/cobranza',           titulo: 'Cobranza',          icono: 'cobranza',    grupo: 'Dinero',    roles: ['admin', 'administracion'] },
  { href: '/admin/gastos',             titulo: 'Gastos',            icono: 'gasto',       grupo: 'Dinero',    roles: ['admin', 'administracion'] },
  { href: '/admin/cuentas-por-pagar',  titulo: 'Cuentas por pagar', icono: 'cxp',         grupo: 'Dinero',    roles: ['admin', 'administracion'] },
  { href: '/admin/nomina',             titulo: 'Nómina',            icono: 'nomina',      grupo: 'Dinero',    roles: ['admin', 'administracion'] },
  { href: '/admin/pagos-fijos',        titulo: 'Pagos fijos',       icono: 'pagosfijos',  grupo: 'Dinero',    roles: ['admin', 'administracion'] },
  { href: '/admin/caja-chica',         titulo: 'Caja chica',        icono: 'caja',        grupo: 'Dinero',    roles: ['admin', 'administracion'] },

  { href: '/admin/catalogo',           titulo: 'Catálogo',          icono: 'catalogo',    grupo: 'Catálogos', roles: ['admin', 'administracion'] },
  { href: '/admin/herramientas',       titulo: 'Herramientas',      icono: 'herramienta', grupo: 'Catálogos', roles: ['admin', 'administracion'] },

  { href: '/admin/reportes',           titulo: 'Reportes',          icono: 'reporte',     grupo: 'Sistema',   roles: ['admin', 'administracion', 'contador'] },
  { href: '/admin/usuarios',           titulo: 'Usuarios',          icono: 'usuario',     grupo: 'Sistema',   roles: ['admin'] },
]

export const GRUPOS: Seccion['grupo'][] = ['Operación', 'Dinero', 'Catálogos', 'Sistema']

export function seccionesDe(rol: RolUsuario): Seccion[] {
  return SECCIONES.filter((s) => s.roles.includes(rol))
}
