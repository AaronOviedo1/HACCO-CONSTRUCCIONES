import { Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { LOGO_CAJA, LOGO_TRAZO, MARCA } from '@/lib/marca'

/**
 * Imagotipo de HAACO PRO para los PDFs: el vector original del manual,
 * dibujado con los primitivos SVG de react-pdf porque aquí no hay CSS.
 */

const PROPORCION = LOGO_CAJA.ancho / LOGO_CAJA.alto

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
      viewBox={`0 0 ${LOGO_CAJA.ancho} ${LOGO_CAJA.alto}`}
      style={{ marginRight: 8 }}
    >
      <Path d={LOGO_TRAZO} fill={color} />
    </Svg>
  )
}

/**
 * Marca de agua para los documentos: el imagotipo grande, muy tenue y fijo
 * al centro de cada página, debajo del contenido. Va como primer hijo del
 * <Page> para que todo lo demás se pinte encima.
 */
export function MarcaAguaPdf({ tamano = 340 }: { tamano?: number }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={tamano * PROPORCION}
        height={tamano}
        viewBox={`0 0 ${LOGO_CAJA.ancho} ${LOGO_CAJA.alto}`}
      >
        <Path d={LOGO_TRAZO} fill={MARCA.verde} fillOpacity={0.05} />
      </Svg>
    </View>
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
