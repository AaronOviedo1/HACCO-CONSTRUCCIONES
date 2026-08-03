/**
 * Colores del manual de marca de HAACO PRO RECUBRIMIENTOS.
 *
 * Fuente única de verdad para lo que no puede leer Tailwind: los PDFs de
 * react-pdf y el `themeColor` del navegador. Los mismos valores viven como
 * tokens `haaco-*` / `tinta-*` en app/globals.css; si cambia uno, cambia el otro.
 */
export const MARCA = {
  /** Verde oficial del manual (= haaco-900). También es el color del icono. */
  verde: '#12341c',
  /** Verde de acento, para reglas finas y viñetas (= haaco-700). */
  verdeMedio: '#145836',
  /** Fondo suave de bloques destacados (= haaco-50). */
  verdeClaro: '#eef7f1',
  /** Negro oficial del manual (= tinta-950). */
  negro: '#070c14',
  /** Texto corrido (= tinta-900). */
  tinta: '#1a1f1c',
  /** Texto secundario (= tinta-500). */
  gris: '#6b776e',
  /** Filetes y bordes de tabla (= tinta-200). */
  linea: '#dfe3df',
  /** Fondo de fila alterna (= tinta-50). */
  papel: '#f6f7f6',
  blanco: '#ffffff',
} as const

/**
 * El imagotipo ORIGINAL del manual («MANUAL DE APLICACIÓN DE LOGOTIPO.pdf»,
 * pág. 3), extraído del vector del PDF: un solo path relleno con las tres
 * astas de cada lado, los travesaños curvos y la base en perspectiva.
 * Lo comparten components/marca.tsx, los PDFs y el generador de iconos.
 */
export const LOGO_CAJA = { ancho: 165.01, alto: 201.48 } as const

export const LOGO_TRAZO =
  'M 98.53 77.63 C 66.48 78.33 44.19 86.86 37.24 89.89 L 37.24 80.13 C 56.5 70.52 78.61 67.79 98.53 66.38 Z ' +
  'M 98.53 94.54 C 66.2 95.27 43.84 103.98 37.24 106.91 L 37.24 95.47 L 37.3 95.61 C 37.55 95.49 61.63 83.7 98.53 82.87 Z ' +
  'M 98.53 155.68 C 94.76 156.63 90.96 157.64 87.24 158.71 C 87.16 158.73 87.07 158.76 87.03 158.78 C 70.39 163.53 53.66 169.6 37.24 176.83 L 37.24 112.66 C 37.48 112.53 61.76 100.66 98.53 99.76 Z ' +
  'M 135.82 148.57 L 135.82 29.89 L 130.6 28.74 L 130.6 149.29 C 127.01 149.82 123.4 150.41 119.78 151.08 L 119.78 26.36 L 114.55 25.2 L 114.55 152.08 C 110.96 152.79 107.36 153.57 103.75 154.42 L 103.75 22.82 L 98.53 21.68 L 98.53 61.14 C 78.78 62.54 56.85 65.15 37.24 74.32 L 37.24 8.2 L 32 7.05 L 32 179.17 C 31.6 179.38 31.2 179.56 30.79 179.74 C 27.64 181.19 24.45 182.71 21.26 184.28 L 21.26 4.67 L 16.04 3.52 L 16.04 186.91 C 12.47 188.73 8.84 190.63 5.23 192.61 L 5.23 1.14 L 0 0 L 0 201.48 L 3.82 199.34 C 9.12 196.38 14.5 193.52 19.75 190.88 C 24.17 188.65 28.61 186.49 32.98 184.48 C 33.61 184.2 34.23 183.91 34.84 183.63 L 35.69 183.25 C 53.08 175.38 70.85 168.83 88.51 163.78 C 88.52 163.78 88.52 163.78 88.54 163.77 C 88.55 163.77 88.59 163.77 88.61 163.75 C 92.95 162.52 97.37 161.34 101.75 160.25 C 107.24 158.93 112.79 157.71 118.26 156.66 C 124.18 155.54 130.12 154.57 135.92 153.82 C 152.41 151.7 162.13 151.98 162.23 151.98 L 164.84 152.06 L 165.01 146.84 L 162.4 146.76 C 162 146.74 152.43 146.46 135.82 148.57 Z'
