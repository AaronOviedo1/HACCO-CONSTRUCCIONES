import 'server-only'
import { cookies } from 'next/headers'
import { mesActual } from '@/lib/finanzas'
import { COOKIE_MESES } from '@/lib/preferencias'

/**
 * Qué meses tiene plegados el usuario en cada lista.
 *
 * Va en una cookie y no en el almacenamiento del navegador para que el
 * servidor pinte la lista ya plegada desde el primer byte: si se leyera en el
 * cliente, la página aparecería completa y se encogería un instante después.
 *
 * Como todas las páginas del panel ya son dinámicas, leer la cookie no cuesta
 * nada extra.
 */
type Guardado = Record<string, string[]>

/**
 * Los meses plegados de una lista. Sin nada guardado, el criterio es el de
 * siempre: el mes en curso abierto y los anteriores cerrados, que es como se
 * lee una hoja del Excel.
 */
export async function mesesPlegados(lista: string, meses: string[]): Promise<string[]> {
  const cruda = (await cookies()).get(COOKIE_MESES)?.value
  if (cruda) {
    try {
      const guardado = JSON.parse(decodeURIComponent(cruda)) as Guardado
      const suyos = guardado[lista]
      if (Array.isArray(suyos)) return suyos
    } catch {
      // Cookie manoseada o de una versión vieja: se usa el criterio de siempre.
    }
  }
  const actual = mesActual()
  return meses.filter((m) => m !== '' && m !== actual)
}
