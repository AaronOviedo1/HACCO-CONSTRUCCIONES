/**
 * Mandar un recordatorio al Google Calendar de quien lo captura.
 *
 * Es una URL de plantilla, no una integración: no hay que conectar cuentas ni
 * pedir permisos, y el aviso lo acaba dando el teléfono con la alarma que la
 * persona ya tiene configurada en su calendario. Si más adelante hace falta
 * crear eventos sin abrir el navegador, ahí sí toca OAuth.
 *
 * Google espera las fechas en UTC con el formato compacto. Sonora no cambia de
 * horario nunca (UTC-7 todo el año), así que la conversión es una resta fija y
 * no hay que arrastrar una librería de zonas horarias por esto.
 */

/** Hermosillo va siete horas atrás de UTC, sin horario de verano. */
const HORAS_UTC = 7

const compacto = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')

export function enlaceGoogleCalendar({
  titulo,
  detalle,
  fecha,
  hora,
  duracionMinutos = 30,
}: {
  titulo: string
  detalle?: string | null
  /** aaaa-mm-dd, como la guarda Postgres. */
  fecha: string
  /** hh:mm. Sin hora, el evento es de día completo. */
  hora?: string | null
  duracionMinutos?: number
}): string {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: titulo })
  if (detalle?.trim()) params.set('details', detalle.trim())

  if (hora) {
    const [h, m] = hora.split(':').map(Number)
    const inicio = new Date(`${fecha}T00:00:00Z`)
    inicio.setUTCHours(h + HORAS_UTC, m ?? 0, 0, 0)
    const fin = new Date(inicio.getTime() + duracionMinutos * 60_000)
    params.set('dates', `${compacto(inicio)}/${compacto(fin)}`)
  } else {
    // Día completo: Google pide aaaammdd y el final es el día siguiente.
    const dia = fecha.replace(/-/g, '')
    const siguiente = new Date(`${fecha}T00:00:00Z`)
    siguiente.setUTCDate(siguiente.getUTCDate() + 1)
    params.set('dates', `${dia}/${siguiente.toISOString().slice(0, 10).replace(/-/g, '')}`)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
