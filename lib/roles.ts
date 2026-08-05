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
  contador: '/admin/reportes',
  cuadrilla: '/obra',
}

export const NOMBRE_ROL: Record<RolUsuario, string> = {
  admin: 'Dirección',
  administracion: 'Administración',
  cuadrilla: 'Cuadrilla',
  contador: 'Contador',
}

export const esStaff = (rol: RolUsuario) => rol === 'admin' || rol === 'administracion'
