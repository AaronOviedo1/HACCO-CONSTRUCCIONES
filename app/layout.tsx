import type { Metadata, Viewport } from 'next'
import { Archivo, Figtree } from 'next/font/google'
import { MARCA } from '@/lib/marca'
import './globals.css'

/**
 * Tipografías del manual de marca.
 * Akira Expanded Super Bold y Circular Std son comerciales, así que usamos los
 * sustitutos libres más cercanos: Archivo en su ancho expandido para la marca
 * y Figtree —geométrica como Circular— para todo el cuerpo.
 */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--fuente-sans',
  display: 'swap',
})

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--fuente-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HaacoPro · HAACO PRO RECUBRIMIENTOS',
  description:
    'Gestión integral de cotizaciones, obras, cobranza y nómina de HAACO PRO RECUBRIMIENTOS.',
  applicationName: 'HaacoPro',
  /*
   * Agregada a inicio, iOS la abre a pantalla completa —sin barra de Safari—
   * y rotula el icono «HaacoPro». El icono lo toma de app/apple-icon.png.
   */
  appleWebApp: {
    capable: true,
    title: 'HaacoPro',
    statusBarStyle: 'default',
  },
  // Next emite el `mobile-web-app-capable` moderno; los iPhone con iOS viejo
  // siguen esperando el de Apple.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La app llega hasta el borde: las barras respetan el área segura por su cuenta.
  viewportFit: 'cover',
  themeColor: MARCA.verde,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Las extensiones del navegador (LanguageTool y compañía) le cuelgan
  // atributos al <html> antes de que React hidrate; el suppress silencia sólo
  // ese falso positivo del elemento raíz, no los errores de la app.
  return (
    <html
      lang="es-MX"
      className={`${figtree.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full overflow-x-hidden font-sans">{children}</body>
    </html>
  )
}
