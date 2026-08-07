/**
 * El correo de quien no va a entrar a la app.
 *
 * El perfil de una persona cuelga de un usuario de Auth, y un usuario de Auth
 * necesita un correo aunque nadie lo vaya a usar nunca. Se arma con su nombre
 * y cuatro dígitos, para que dos tocayos no choquen y para que al mirar la
 * tabla de usuarios se entienda de un vistazo que ese correo no es de nadie.
 */
export const DOMINIO_INTERNO = 'haacopro.local'

export function correoInterno(nombre: string): string {
  const base =
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 40) || 'personal'

  const sufijo = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `${base}.${sufijo}@${DOMINIO_INTERNO}`
}

/** Un correo que la app se inventó: no sirve para escribirle a nadie. */
export const esCorreoInterno = (correo: string | null) =>
  Boolean(correo?.endsWith(`@${DOMINIO_INTERNO}`))
