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

// ---------------------------------------------------------------------------
// Navegación del teléfono
// ---------------------------------------------------------------------------

/** Trazos de los iconos de la barra de pestañas, en un lienzo de 24×24. */
export const ICONO = {
  inicio: 'M3 10.6 12 3.2l9 7.4M5.6 9.4V20.4h12.8V9.4',
  obras: 'M4 17.5h16M6.5 17.5v-3.2a5.5 5.5 0 0 1 11 0v3.2M10 8.6V4.6h4v4',
  cotizacion: 'M6.5 3.2h7l4.5 4.5v13.1h-11.5zM13.5 3.2v4.5h4.5M9.5 13h5M9.5 16.6h5',
  rayo: 'M13.4 2.6 5.6 14.2h5l-1 7.2 7.8-11.6h-5z',
  dinero:
    'M3.2 7.8h15.6a1.8 1.8 0 0 1 1.8 1.8v7.6a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8zM3.2 7.8V6.2a1.8 1.8 0 0 1 1.8-1.8h11M16.4 13.8h1.6',
  cobranza: 'M3.2 7.4h17.6v9.2H3.2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  camara:
    'M4.4 8.4h3l1.4-2h6.4l1.4 2h3v10.8H4.4zM12 16.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8',
  perfil: 'M12 11.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.6 20.8c0-3.5 3.3-5.8 7.4-5.8s7.4 2.3 7.4 5.8',
  mas: 'M6 12h.1M12 12h.1M18 12h.1',
  reporte: 'M4.6 20.4V10.2M12 20.4V3.6M19.4 20.4v-6.8',
} as const

export type Pestana = {
  href: string
  etiqueta: string
  icono: string
  /** Rutas que también encienden la pestaña (el detalle cuelga de ella). */
  prefijos?: string[]
}

const DINERO = [
  '/admin/dinero', '/admin/cobranza', '/admin/gastos', '/admin/cuentas-por-pagar',
  '/admin/nomina', '/admin/pagos-fijos', '/admin/caja-chica',
]
const CATALOGOS = [
  '/admin/mas', '/admin/catalogo', '/admin/clientes', '/admin/herramientas',
  '/admin/reportes', '/admin/usuarios',
]

/**
 * Las cinco cosas que se hacen desde el teléfono, por rol.
 * Dirección vigila el dinero completo; Administración cobra; la cuadrilla sube
 * avance. Todo lo demás vive en «Más».
 */
const PESTANAS: Record<RolUsuario, Pestana[]> = {
  admin: [
    { href: '/admin',              etiqueta: 'Inicio',  icono: ICONO.inicio },
    { href: '/admin/obras',        etiqueta: 'Obras',   icono: ICONO.obras,      prefijos: ['/admin/obras'] },
    { href: '/admin/cotizaciones', etiqueta: 'Cotizar', icono: ICONO.cotizacion, prefijos: ['/admin/cotizaciones', '/admin/cotizar-rapido'] },
    { href: '/admin/dinero',       etiqueta: 'Dinero',  icono: ICONO.dinero,     prefijos: DINERO },
    { href: '/admin/mas',          etiqueta: 'Más',     icono: ICONO.mas,        prefijos: CATALOGOS },
  ],
  administracion: [
    { href: '/admin',                etiqueta: 'Inicio',   icono: ICONO.inicio },
    { href: '/admin/obras',          etiqueta: 'Obras',    icono: ICONO.obras,    prefijos: ['/admin/obras'] },
    { href: '/admin/cotizar-rapido', etiqueta: 'Cotizar',  icono: ICONO.rayo,     prefijos: ['/admin/cotizaciones', '/admin/cotizar-rapido'] },
    { href: '/admin/cobranza',       etiqueta: 'Cobranza', icono: ICONO.cobranza, prefijos: ['/admin/cobranza'] },
    { href: '/admin/mas',            etiqueta: 'Más',      icono: ICONO.mas,      prefijos: [...CATALOGOS, ...DINERO] },
  ],
  contador: [
    { href: '/admin/reportes', etiqueta: 'Reportes', icono: ICONO.reporte, prefijos: ['/admin/reportes'] },
    { href: '/admin/mas',      etiqueta: 'Más',      icono: ICONO.mas },
  ],
  cuadrilla: [
    { href: '/obra',     etiqueta: 'Mis obras', icono: ICONO.obras, prefijos: ['/obra'] },
    { href: '/obra/mas', etiqueta: 'Perfil',    icono: ICONO.perfil },
  ],
}

export function pestanasDe(rol: RolUsuario): Pestana[] {
  return PESTANAS[rol]
}
