/**
 * Piezas compartidas por las acciones de formulario (las que usan
 * `useActionState`): leer los campos del FormData con el tipo correcto y
 * traducir los errores de Postgres a algo que se pueda leer en pantalla.
 *
 * Viven aquí y no dentro de un `acciones.ts` porque un módulo marcado con
 * 'use server' sólo puede exportar funciones asíncronas: cualquier helper
 * síncrono que se quiera compartir tiene que salirse.
 *
 * `EstadoAccion` se importa siempre desde aquí, nunca reexportado desde un
 * `acciones.ts`: al compilar un módulo 'use server', un `export type { X }`
 * no se borra —se registra como server reference— y el bundle acaba llamando
 * a `registerServerReference(EstadoAccion, …)` sobre un nombre que ya no
 * existe. El módulo revienta al cargarse con «EstadoAccion is not defined» y
 * se lleva por delante cualquier pantalla que use uno de sus formularios.
 */

export type EstadoAccion = { error?: string; ok?: boolean; id?: string }

export const texto = (d: FormData, campo: string) => String(d.get(campo) ?? '').trim()

export const opcional = (d: FormData, campo: string) => texto(d, campo) || null

export const numero = (d: FormData, campo: string) => {
  const bruto = texto(d, campo).replace(/[^\d.-]/g, '')
  const n = Number(bruto)
  return bruto === '' || !Number.isFinite(n) ? null : n
}

export const casilla = (d: FormData, campo: string) =>
  d.get(campo) === 'on' || d.get(campo) === 'true'

/** Traduce los errores de Postgres a algo que Pati pueda entender. */
export function explicar(error: { message: string; code?: string }): string {
  if (error.code === '23505') return 'Ya existe un registro con ese código o nombre.'
  if (error.code === '23503') return 'No se puede borrar: hay movimientos que dependen de este registro.'
  if (error.code === '42501') return 'Tu usuario no tiene permiso para esta operación.'
  return error.message
}
