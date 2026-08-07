import { Path, Svg, View } from '@react-pdf/renderer'
import { IMAGOTIPO_CAJA, IMAGOTIPO_TRAZO, LOGO_CAJA, LOGO_TRAZO, MARCA } from '@/lib/marca'
import '@/lib/tipografia-pdf'

/**
 * La marca de HAACO PRO para los PDFs: los trazos originales del manual,
 * dibujados con los primitivos SVG de react-pdf porque aquí no hay CSS.
 *
 * El nombre también es dibujo, no texto: va en Akira Expanded Super Bold, que
 * es comercial y no está en el repo. Antes se apañaba con Helvetica-Bold y una
 * caja de fondo, y no se parecía.
 *
 * Si algún día hace falta otra pieza —el nombre suelto, por ejemplo—, los
 * trazos y sus cajas están en lib/imagotipo.ts y se dibujan igual que estas.
 */

const PROPORCION = LOGO_CAJA.ancho / LOGO_CAJA.alto
const PROPORCION_IMAGOTIPO = IMAGOTIPO_CAJA.ancho / IMAGOTIPO_CAJA.alto

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

/**
 * El membrete de los documentos: símbolo y nombre en una sola pieza, con la
 * separación que manda el manual. `tamano` es el alto del bloque.
 */
export function MembretePdf({
  tamano = 28,
  color = MARCA.verde,
}: {
  tamano?: number
  color?: string
}) {
  return (
    <Svg
      width={tamano * PROPORCION_IMAGOTIPO}
      height={tamano}
      viewBox={`0 0 ${IMAGOTIPO_CAJA.ancho} ${IMAGOTIPO_CAJA.alto}`}
    >
      <Path d={IMAGOTIPO_TRAZO} fill={color} />
    </Svg>
  )
}
