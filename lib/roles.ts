import type { RolUsuario } from '@/types/database'

/**
 * Los roles y cómo se llaman en pantalla.
 *
 * Viven aparte de `lib/auth.ts` porque ese módulo arrastra el cliente de
 * Supabase con cookies, que sólo existe en el servidor: los formularios que
 * corren en el navegador necesitan estas etiquetas sin cargarse todo eso.
 */

/** A dónde manda la app a cada rol al entrar. */
export const RUTA_POR_ROL: Record<RolUsuario, string> = {
  admin: '/admin',
  administracion: '/admin',
  residente: '/admin/obras',
  contador: '/admin/reportes',
  cuadrilla: '/obra',
}

export const NOMBRE_ROL: Record<RolUsuario, string> = {
  admin: 'Dirección',
  administracion: 'Administración',
  residente: 'Residente',
  cuadrilla: 'Cuadrilla',
  contador: 'Contador',
}

/**
 * Lo que abre el residente: la obra y lo que la rodea en campo —cotizar,
 * gastar, pagar la raya—. Fuera quedan el tablero, la cobranza, las cuentas
 * por pagar, los pagos fijos, el catálogo de precios, los reportes y lo de
 * Dirección. El proxy lo usa para no dejarlo aterrizar en otra cosa; la
 * seguridad de verdad sigue en las políticas de la base.
 */
export const RUTAS_RESIDENTE = [
  '/admin/obras',
  '/admin/cotizaciones',
  '/admin/cotizar-rapido',
  '/admin/clientes',
  '/admin/gastos',
  '/admin/nomina',
  '/admin/caja-chica',
  '/admin/herramientas',
  '/admin/mas',
  '/api/cotizaciones',
  '/api/contratos',
  '/api/pagares',
  '/api/polizas',
  '/api/recibos-nomina',
  '/api/ticket',
  '/api/lugares',
]
