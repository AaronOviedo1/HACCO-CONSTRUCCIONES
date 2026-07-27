import { Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { MARCA } from '@/lib/marca'

/**
 * Imagotipo de HAACO PRO para los PDFs.
 * Mismos trazos que components/marca.tsx, dibujados con los primitivos SVG de
 * react-pdf porque aquí no hay Tailwind ni CSS.
 */

const PROPORCION = 96 / 116

export function LogoPdf({
  tamano = 28,
  color = MARCA.verde,
}: {
  tamano?: number
  color?: string
}) {
  return (
    <Svg
      width={tamano * PROPORCION}
      height={tamano}
      viewBox="0 0 96 116"
      style={{ marginRight: 8 }}
    >
      <Path d="M13 12V110" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M19.5 6V109.5" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M26 4V108.5" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M32.5 8V107" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path
        d="M13 66C28 61 46 57 62 55"
        stroke={color}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M13 77C28 72 46 68 62 66"
        stroke={color}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M62 4V98" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M68.5 30V95" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M75 36V92.5" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M81.5 44V89.5" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      <Path
        d="M13 110C36 108 68 100 92 84"
        stroke={color}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}

const m = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  nombre: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: MARCA.verde,
    letterSpacing: 0.8,
    marginRight: 3,
  },
  cajaPro: {
    backgroundColor: MARCA.verde,
    paddingHorizontal: 3,
    paddingTop: 2.5,
    paddingBottom: 1.5,
  },
  pro: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: MARCA.blanco,
    letterSpacing: 0.6,
  },
  giro: {
    fontSize: 6.2,
    color: MARCA.gris,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginTop: 2.5,
  },
})

/** Wordmark HAACO PRO · RECUBRIMIENTOS. */
export function MarcaPdf() {
  return (
    <View>
      <View style={m.fila}>
        <Text style={m.nombre}>HAACO</Text>
        <View style={m.cajaPro}>
          <Text style={m.pro}>PRO</Text>
        </View>
      </View>
      <Text style={m.giro}>Recubrimientos</Text>
    </View>
  )
}

/** Bloque completo: imagotipo + wordmark. */
export function MembretePdf({ tamano = 28 }: { tamano?: number }) {
  return (
    <View style={m.fila}>
      <LogoPdf tamano={tamano} />
      <MarcaPdf />
    </View>
  )
}
