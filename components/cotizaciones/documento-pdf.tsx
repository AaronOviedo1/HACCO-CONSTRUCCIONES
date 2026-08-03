import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MarcaAguaPdf, MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fechaLarga, pesos } from '@/lib/format'
import { notasCotizacion } from '@/lib/cotizaciones'

const VERDE = MARCA.verde
const VERDE_MEDIO = MARCA.verdeMedio
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

const e = StyleSheet.create({
  pagina: {
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 46,
    fontSize: 9.5,
    color: TINTA,
    fontFamily: 'Helvetica',
  },
  // Ojo: el interlineado va texto por texto y no en la página; si la página
  // trae lineHeight, react-pdf deja de pintar los elementos fijos anclados
  // con `bottom` (el pie desaparecía).

  // Banda de marca al filo de cada página
  banda: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: VERDE,
  },

  // Membrete: marca a la izquierda, folio y fecha a la derecha
  membrete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 0.8,
    borderBottomColor: LINEA,
    paddingBottom: 12,
    marginBottom: 16,
  },
  tituloDoc: {
    fontSize: 7,
    color: GRIS,
    letterSpacing: 2.2,
    textAlign: 'right',
    marginBottom: 2,
  },
  folio: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  fechaDoc: { fontSize: 7.5, color: GRIS, textAlign: 'right', marginTop: 2 },

  // Tarjeta con los datos del cliente y la obra
  tarjetaCliente: {
    flexDirection: 'row',
    backgroundColor: VERDE_CLARO,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 18,
  },
  celdaCliente: { flex: 1.4 },
  celdaObra: { flex: 2 },
  celdaVigencia: { width: 70 },
  etiquetaDato: {
    fontSize: 6.4,
    color: VERDE_MEDIO,
    letterSpacing: 1.6,
    marginBottom: 2.5,
  },
  datoFuerte: { fontFamily: 'Helvetica-Bold', fontSize: 10, lineHeight: 1.3 },
  datoSuave: { fontSize: 8.5, color: GRIS, marginTop: 1, lineHeight: 1.3 },

  parrafo: { marginBottom: 12, textAlign: 'justify', lineHeight: 1.45 },

  // Descripción del trabajo
  encabezadoSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 7,
  },
  marcaSeccion: {
    width: 3.5,
    height: 10,
    borderRadius: 2,
    backgroundColor: VERDE_MEDIO,
    marginRight: 6,
  },
  subtitulo: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  vineta: { flexDirection: 'row', marginBottom: 3.5, paddingRight: 8 },
  punto: { width: 11, color: VERDE_MEDIO, fontFamily: 'Helvetica-Bold' },
  vinetaTexto: { flex: 1, textAlign: 'justify', lineHeight: 1.45 },
  calidad: { marginTop: 8, marginBottom: 14, fontStyle: 'italic', color: GRIS, lineHeight: 1.45 },

  // Tabla de partidas
  tabla: { marginTop: 2 },
  encabezadoTabla: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VERDE,
    color: MARCA.blanco,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.6,
    letterSpacing: 0.8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: 0.7,
    borderBottomColor: LINEA,
    paddingVertical: 5.5,
    paddingHorizontal: 8,
  },
  filaAlterna: { backgroundColor: MARCA.papel },
  cNum: { width: 20, color: GRIS },
  cNumEncabezado: { width: 20 },
  cDesc: { flex: 1, paddingRight: 8, lineHeight: 1.35 },
  cDescEncabezado: { flex: 1, paddingRight: 8 },
  cM2: { width: 52, textAlign: 'right' },
  cPU: { width: 66, textAlign: 'right' },
  cImp: { width: 78, textAlign: 'right' },
  importeFila: { fontFamily: 'Helvetica-Bold' },

  // Totales
  totales: { alignItems: 'flex-end', marginTop: 12 },
  filaTotal: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 2.5 },
  etiquetaTotal: { width: 110, textAlign: 'right', paddingRight: 12, color: GRIS },
  valorTotal: { width: 90, textAlign: 'right' },
  granTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: VERDE,
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  granTotalEtiqueta: {
    textAlign: 'right',
    paddingRight: 14,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.4,
    color: MARCA.blanco,
  },
  granTotalValor: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12.5,
    color: MARCA.blanco,
  },
  chipAnticipo: {
    backgroundColor: VERDE_CLARO,
    borderRadius: 6,
    paddingVertical: 4.5,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  chipAnticipoTexto: { fontSize: 8.5, color: VERDE_MEDIO, fontFamily: 'Helvetica-Bold' },

  // Condiciones
  condiciones: {
    marginTop: 16,
    backgroundColor: MARCA.papel,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tituloCondiciones: {
    fontSize: 6.4,
    color: GRIS,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  filaNota: { flexDirection: 'row', marginBottom: 2 },
  puntoNota: { width: 10, color: VERDE_MEDIO, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  nota: { flex: 1, fontSize: 8.5, lineHeight: 1.4 },

  // Despedida y firma
  despedida: { marginTop: 20, marginBottom: 34, lineHeight: 1.45 },
  firma: { alignItems: 'center', width: 230, alignSelf: 'flex-start' },
  lineaFirma: { borderTopWidth: 1, borderTopColor: VERDE, width: '100%', marginBottom: 5 },
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
  const anticipo = Math.round(datos.total * (datos.anticipoPct / 100) * 100) / 100
  const contacto = [EMPRESA.telefono, EMPRESA.correo].filter(Boolean).join(' · ')

  return (
    <Document
      title={`Cotización ${datos.folio}`}
      author={EMPRESA.nombre}
      subject={`Cotización ${datos.folio} · ${datos.cliente}`}
    >
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <View style={e.banda} fixed />

        {/* Membrete: marca + folio ---------------------------------------- */}
        <View style={e.membrete} fixed>
          <MembretePdf tamano={30} />
          <View>
            <Text style={e.tituloDoc}>COTIZACIÓN</Text>
            <Text style={e.folio}>{datos.folio}</Text>
            <Text style={e.fechaDoc}>
              {EMPRESA.ciudad} · {fechaLarga(datos.fecha)}
            </Text>
          </View>
        </View>

        {/* Cliente y obra -------------------------------------------------- */}
        <View style={e.tarjetaCliente}>
          <View style={e.celdaCliente}>
            <Text style={e.etiquetaDato}>PREPARADO PARA</Text>
            <Text style={e.datoFuerte}>
              {tratamiento}
              {datos.cliente}
            </Text>
          </View>
          {(datos.nombreObra || datos.domicilioObra) && (
            <View style={e.celdaObra}>
              <Text style={e.etiquetaDato}>OBRA</Text>
              {datos.nombreObra ? <Text style={e.datoFuerte}>{datos.nombreObra}</Text> : null}
              {datos.domicilioObra ? <Text style={e.datoSuave}>{datos.domicilioObra}</Text> : null}
            </View>
          )}
          <View style={e.celdaVigencia}>
            <Text style={e.etiquetaDato}>VIGENCIA</Text>
            <Text style={e.datoFuerte}>{datos.vigenciaDias} días</Text>
          </View>
        </View>

        <Text style={e.parrafo}>
          Reciba un cordial saludo. Por medio de la presente nos permitimos cotizarle, lo siguiente.
        </Text>

        {/* Descripción del trabajo ---------------------------------------- */}
        {datos.procesos.length > 0 && (
          <>
            <View style={e.encabezadoSeccion}>
              <View style={e.marcaSeccion} />
              <Text style={e.subtitulo}>Descripción del trabajo</Text>
            </View>
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
        <View style={e.tabla}>
          <View style={e.encabezadoTabla}>
            <Text style={e.cNumEncabezado}>#</Text>
            <Text style={e.cDescEncabezado}>DESCRIPCIÓN</Text>
            <Text style={e.cM2}>M²</Text>
            <Text style={e.cPU}>P.U.</Text>
            <Text style={e.cImp}>IMPORTE</Text>
          </View>

          {datos.partidas.map((p, i) => (
            <View key={i} style={i % 2 === 1 ? [e.fila, e.filaAlterna] : e.fila} wrap={false}>
              <Text style={e.cNum}>{i + 1}</Text>
              <Text style={e.cDesc}>{p.descripcion}</Text>
              <Text style={e.cM2}>{p.m2 == null ? '—' : p.m2.toLocaleString('es-MX')}</Text>
              <Text style={e.cPU}>{pesos(p.precio_unitario)}</Text>
              <Text style={[e.cImp, e.importeFila]}>{pesos(p.importe)}</Text>
            </View>
          ))}
        </View>

        {/* Totales -------------------------------------------------------- */}
        <View style={e.totales} wrap={false}>
          <View style={e.filaTotal}>
            <Text style={e.etiquetaTotal}>Subtotal</Text>
            <Text style={e.valorTotal}>{pesos(datos.subtotal)}</Text>
          </View>
          {datos.ivaPct > 0 && (
            <View style={e.filaTotal}>
              <Text style={e.etiquetaTotal}>IVA {datos.ivaPct}%</Text>
              <Text style={e.valorTotal}>{pesos(datos.total - datos.subtotal)}</Text>
            </View>
          )}
          <View style={e.granTotal}>
            <Text style={e.granTotalEtiqueta}>TOTAL</Text>
            <Text style={e.granTotalValor}>{pesos(datos.total)}</Text>
          </View>
          {anticipo > 0 && (
            <View style={e.chipAnticipo}>
              <Text style={e.chipAnticipoTexto}>
                Anticipo {Math.round(datos.anticipoPct)}% para iniciar · {pesos(anticipo)}
              </Text>
            </View>
          )}
        </View>

        {/* Condiciones ---------------------------------------------------- */}
        <View style={e.condiciones} wrap={false}>
          <Text style={e.tituloCondiciones}>CONDICIONES</Text>
          {notasCotizacion(datos.anticipoPct, datos.vigenciaDias, datos.ivaPct > 0).map((n) => (
            <View key={n} style={e.filaNota}>
              <Text style={e.puntoNota}>•</Text>
              <Text style={e.nota}>{n.replace(/^\*/, '')}</Text>
            </View>
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
            {EMPRESA.nombre}
            {contacto ? ` · ${contacto}` : ''}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Cotización ${datos.folio} · Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
