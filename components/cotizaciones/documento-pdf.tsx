import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fechaLarga, pesos } from '@/lib/format'
import { notasCotizacion } from '@/lib/cotizaciones'

const VERDE = MARCA.verde
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

const e = StyleSheet.create({
  pagina: {
    paddingTop: 34,
    paddingBottom: 64,
    paddingHorizontal: 46,
    fontSize: 9.5,
    color: TINTA,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },

  // Membrete
  membrete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: VERDE,
    paddingBottom: 10,
    marginBottom: 18,
  },
  contacto: { fontSize: 7.5, color: GRIS, textAlign: 'right', lineHeight: 1.5 },

  // Encabezado de la carta
  lugarFecha: { textAlign: 'right', marginBottom: 14, color: GRIS },
  folio: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  atn: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 1 },
  obra: { color: GRIS, marginBottom: 12 },
  parrafo: { marginBottom: 10, textAlign: 'justify' },

  // Descripción del trabajo
  subtitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  vineta: { flexDirection: 'row', marginBottom: 3.5, paddingRight: 8 },
  punto: { width: 10, color: VERDE, fontFamily: 'Helvetica-Bold' },
  vinetaTexto: { flex: 1, textAlign: 'justify' },
  calidad: { marginTop: 8, marginBottom: 14, fontStyle: 'italic', color: GRIS },

  // Tabla
  encabezadoTabla: {
    flexDirection: 'row',
    backgroundColor: VERDE,
    color: MARCA.blanco,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: 0.7,
    borderBottomColor: LINEA,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
  },
  filaAlterna: { backgroundColor: MARCA.papel },
  cNum: { width: 22 },
  cDesc: { flex: 1, paddingRight: 8 },
  cM2: { width: 52, textAlign: 'right' },
  cPU: { width: 66, textAlign: 'right' },
  cImp: { width: 78, textAlign: 'right' },

  // Totales
  totales: { alignItems: 'flex-end', marginTop: 10 },
  filaTotal: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 2.5 },
  etiquetaTotal: { width: 110, textAlign: 'right', paddingRight: 12, color: GRIS },
  valorTotal: { width: 84, textAlign: 'right' },
  granTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: VERDE_CLARO,
    paddingVertical: 5,
    marginTop: 3,
  },
  granTotalEtiqueta: {
    width: 110,
    textAlign: 'right',
    paddingRight: 12,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
  },
  granTotalValor: {
    width: 84,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: VERDE,
    paddingRight: 6,
  },

  // Notas y firma
  notas: { marginTop: 18 },
  nota: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 2.5 },
  despedida: { marginTop: 22, marginBottom: 34 },
  firma: { alignItems: 'center', width: 230, alignSelf: 'flex-start' },
  lineaFirma: { borderTopWidth: 0.8, borderTopColor: TINTA, width: '100%', marginBottom: 4 },
  nombreFirma: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, textAlign: 'center' },
  cargoFirma: { fontSize: 8, color: GRIS, textAlign: 'center' },

  pie: {
    position: 'absolute',
    bottom: 26,
    left: 46,
    right: 46,
    borderTopWidth: 0.7,
    borderTopColor: LINEA,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: GRIS,
  },
})

export type DatosPdf = {
  folio: string
  fecha: string
  cliente: string
  tituloCortesia: string | null
  nombreObra: string | null
  domicilioObra: string | null
  procesos: string[]
  lineaCalidad: string | null
  partidas: { descripcion: string; m2: number | null; precio_unitario: number; importe: number }[]
  subtotal: number
  ivaPct: number
  total: number
  anticipoPct: number
  vigenciaDias: number
}

export function DocumentoCotizacion({ datos }: { datos: DatosPdf }) {
  const tratamiento = datos.tituloCortesia ? `${datos.tituloCortesia} ` : ''

  return (
    <Document
      title={`Cotización ${datos.folio}`}
      author={EMPRESA.nombre}
      subject={`Cotización ${datos.folio} · ${datos.cliente}`}
    >
      <Page size="LETTER" style={e.pagina}>
        {/* Membrete ------------------------------------------------------- */}
        <View style={e.membrete} fixed>
          <MembretePdf tamano={30} />
          <View>
            <Text style={e.contacto}>{EMPRESA.ciudad}</Text>
            {EMPRESA.telefono ? <Text style={e.contacto}>{EMPRESA.telefono}</Text> : null}
            {EMPRESA.correo ? <Text style={e.contacto}>{EMPRESA.correo}</Text> : null}
          </View>
        </View>

        {/* Lugar y fecha -------------------------------------------------- */}
        <Text style={e.lugarFecha}>
          {EMPRESA.ciudad} a {fechaLarga(datos.fecha)}
        </Text>

        <Text style={e.folio}>COTIZACIÓN {datos.folio}</Text>
        <Text style={e.atn}>
          Atn. {tratamiento}
          {datos.cliente}
        </Text>
        {(datos.nombreObra || datos.domicilioObra) && (
          <Text style={e.obra}>
            {[datos.nombreObra, datos.domicilioObra].filter(Boolean).join(' · ')}
          </Text>
        )}

        <Text style={e.parrafo}>
          Reciba un cordial saludo. Por medio de la presente nos permitimos cotizarle, lo siguiente.
        </Text>

        {/* Descripción del trabajo ---------------------------------------- */}
        {datos.procesos.length > 0 && (
          <>
            <Text style={e.subtitulo}>Descripción del trabajo:</Text>
            {datos.procesos.map((texto, i) => (
              <View key={i} style={e.vineta} wrap={false}>
                <Text style={e.punto}>•</Text>
                <Text style={e.vinetaTexto}>{texto}</Text>
              </View>
            ))}
          </>
        )}

        {datos.lineaCalidad ? <Text style={e.calidad}>{datos.lineaCalidad}</Text> : null}

        {/* Tabla ---------------------------------------------------------- */}
        <View style={e.encabezadoTabla}>
          <Text style={e.cNum}>#</Text>
          <Text style={e.cDesc}>DESCRIPCIÓN</Text>
          <Text style={e.cM2}>M2</Text>
          <Text style={e.cPU}>P.U.</Text>
          <Text style={e.cImp}>IMPORTE</Text>
        </View>

        {datos.partidas.map((p, i) => (
          <View key={i} style={i % 2 === 1 ? [e.fila, e.filaAlterna] : e.fila} wrap={false}>
            <Text style={e.cNum}>{i + 1}</Text>
            <Text style={e.cDesc}>{p.descripcion}</Text>
            <Text style={e.cM2}>{p.m2 == null ? '—' : p.m2.toLocaleString('es-MX')}</Text>
            <Text style={e.cPU}>{pesos(p.precio_unitario)}</Text>
            <Text style={e.cImp}>{pesos(p.importe)}</Text>
          </View>
        ))}

        {/* Totales -------------------------------------------------------- */}
        <View style={e.totales} wrap={false}>
          <View style={e.filaTotal}>
            <Text style={e.etiquetaTotal}>Subtotal</Text>
            <Text style={e.valorTotal}>{pesos(datos.subtotal)}</Text>
          </View>
          <View style={e.filaTotal}>
            <Text style={e.etiquetaTotal}>IVA {datos.ivaPct}%</Text>
            <Text style={e.valorTotal}>{pesos(datos.total - datos.subtotal)}</Text>
          </View>
          <View style={e.granTotal}>
            <Text style={e.granTotalEtiqueta}>TOTAL</Text>
            <Text style={e.granTotalValor}>{pesos(datos.total)}</Text>
          </View>
        </View>

        {/* Notas ---------------------------------------------------------- */}
        <View style={e.notas} wrap={false}>
          {notasCotizacion(datos.anticipoPct, datos.vigenciaDias).map((n) => (
            <Text key={n} style={e.nota}>
              {n}
            </Text>
          ))}
        </View>

        {/* Despedida y firma ---------------------------------------------- */}
        <View wrap={false}>
          <Text style={e.despedida}>
            Sin más por el momento y en espera de una respuesta favorable, quedo de usted.
          </Text>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Director General</Text>
            {EMPRESA.telefono ? <Text style={e.cargoFirma}>Cel. {EMPRESA.telefono}</Text> : null}
          </View>
        </View>

        <View style={e.pie} fixed>
          <Text>
            {EMPRESA.nombre} · Cotización {datos.folio}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
