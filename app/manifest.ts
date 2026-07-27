import type { MetadataRoute } from 'next'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'

/**
 * Ficha de instalación: es lo que lee el teléfono cuando alguien agrega
 * HaacoPro a la pantalla de inicio.
 *
 * Los iconos se generan con `npm run iconos` a partir del imagotipo del manual.
 * El `maskable` va aparte porque Android lo recorta en círculo o en gota y
 * necesita el logo más chico para no comerse las astas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `HaacoPro · ${EMPRESA.nombre}`,
    short_name: 'HaacoPro',
    description:
      'Cotizaciones, obras, cobranza y nómina de HAACO PRO RECUBRIMIENTOS, desde la obra.',
    lang: 'es-MX',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Sin fijar orientación: en el teléfono se usa vertical, pero el iPad
    // acostado muestra la barra lateral completa.
    background_color: '#f6f7f6',
    theme_color: MARCA.verde,
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
