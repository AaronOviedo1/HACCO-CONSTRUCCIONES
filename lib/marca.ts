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
