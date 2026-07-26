import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--fuente-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HaacoPro · HAACO PRO RECUBRIMIENTOS',
  description:
    'Gestión integral de cotizaciones, obras, cobranza y nómina de HAACO PRO RECUBRIMIENTOS.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#145836',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
