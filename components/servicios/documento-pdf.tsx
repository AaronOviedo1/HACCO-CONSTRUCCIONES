import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MarcaAguaPdf, MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fecha as fechaCorta, fechaLarga, horaCorta, pesos } from '@/lib/format'
import { abreviaUnidad } from '@/lib/cotizaciones'

const VERDE = MARCA.verde
const VERDE_MEDIO = MARCA.verdeMedio
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

const e = StyleSheet.create({
  pagina: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 46,
    fontSize: 9.5,
    color: TINTA,
    fontFamily: 'Figtree',
  },
  // El interlineado va texto por texto y nunca en la página: con `lineHeight`
  // en el `<Page>`, react-pdf deja de pintar lo anclado con `bottom` y el pie
  // desaparece sin avisar. Le pasó a la cotización y el diagnóstico costó caro.

  banda: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: VERDE },

  membrete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 0.8,
    borderBottomColor: LINEA,
    paddingBottom: 9,
    marginBottom: 12,
  },
  tituloDoc: { fontSize: 7, color: GRIS, letterSpacing: 2.2, textAlign: 'right', marginBottom: 2 },
  folio: {
    fontSize: 16,
    fontFamily: 'Figtree', fontWeight: 700,
    color: VERDE,
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  fechaDoc: { fontSize: 7.5, color: GRIS, textAlign: 'right', marginTop: 2 },

  tarjetaCliente: {
    flexDirection: 'row',
    backgroundColor: VERDE_CLARO,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 11,
    gap: 18,
  },
  celdaCliente: { flex: 1.4 },
  celdaLugar: { flex: 2 },
  celdaVisita: { width: 92 },
  etiquetaDato: { fontSize: 6.4, color: VERDE_MEDIO, letterSpacing: 1.6, marginBottom: 2.5 },
  datoFuerte: { fontFamily: 'Figtree', fontWeight: 700, fontSize: 10, lineHeight: 1.2 },
  datoSuave: { fontSize: 8.5, color: GRIS, marginTop: 1, lineHeight: 1.2 },

  parrafo: { marginBottom: 9, textAlign: 'justify', lineHeight: 1.28 },

  encabezadoSeccion: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 5 },
  marcaSeccion: {
    width: 3.5,
    height: 10,
    borderRadius: 2,
    backgroundColor: VERDE_MEDIO,
    marginRight: 6,
  },
  subtitulo: { fontFamily: 'Figtree', fontWeight: 700, fontSize: 10.5 },
  diagnostico: {
    backgroundColor: MARCA.papel,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 11,
    textAlign: 'justify',
    lineHeight: 1.3,
  },

  tabla: { marginTop: 2 },
  encabezadoTabla: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VERDE,
    color: MARCA.blanco,
    fontFamily: 'Figtree', fontWeight: 700,
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
    paddingVertical: 3.6,
    paddingHorizontal: 8,
  },
  filaAlterna: { backgroundColor: MARCA.papel },
  cNum: { width: 20, color: GRIS },
  cNumEncabezado: { width: 20 },
  cDesc: { flex: 1, paddingRight: 8, lineHeight: 1.1 },
  cDescEncabezado: { flex: 1, paddingRight: 8 },
  cCant: { width: 64, textAlign: 'right' },
  cPU: { width: 66, textAlign: 'right' },
  cImp: { width: 78, textAlign: 'right' },
  importeFila: { fontFamily: 'Figtree', fontWeight: 700 },

  totales: { alignItems: 'flex-end', marginTop: 8 },
  filaTotal: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 2 },
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
    fontFamily: 'Figtree', fontWeight: 700,
    fontSize: 8,
    letterSpacing: 1.4,
    color: MARCA.blanco,
  },
  granTotalValor: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Figtree', fontWeight: 700,
    fontSize: 12.5,
    color: MARCA.blanco,
  },
  chipCobro: {
    backgroundColor: VERDE_CLARO,
    borderRadius: 6,
    paddingVertical: 4.5,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  chipCobroTexto: { fontSize: 8.5, color: VERDE_MEDIO, fontFamily: 'Figtree', fontWeight: 700 },

  cierre: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 12 },
  condiciones: {
    flex: 1,
    backgroundColor: MARCA.papel,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  columnaFirma: { width: 200, paddingTop: 2 },
  tituloCondiciones: { fontSize: 6.4, color: GRIS, letterSpacing: 1.6, marginBottom: 4 },
  filaNota: { flexDirection: 'row', marginBottom: 2 },
  puntoNota: { width: 10, color: VERDE_MEDIO, fontFamily: 'Figtree', fontWeight: 700, fontSize: 8.5 },
  nota: { flex: 1, fontSize: 8.5, lineHeight: 1.25 },

  despedida: { marginBottom: 30, lineHeight: 1.28 },
  firma: { alignItems: 'center', width: '100%' },
  lineaFirma: { borderTopWidth: 1, borderTopColor: VERDE, width: '100%', marginBottom: 5 },
  nombreFirma: { fontFamily: 'Figtree', fontWeight: 700, fontSize: 9.5, textAlign: 'center' },
  cargoFirma: { fontSize: 8, color: GRIS, textAlign: 'center' },

  pie: {
    position: 'absolute',
    bottom: 22,
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

export type DatosPdfServicio = {
  folio: string
  /** La fecha del documento: el día en que se armó el presupuesto. */
  fecha: string
  cliente: string
  tituloCortesia: string | null
  descripcion: string
  domicilio: string | null
  fechaVisita: string
  horaVisita: string | null
  tecnico: string | null
  diagnostico: string | null
  partidas: {
    descripcion: string
    cantidad: number
    unidad: string | null
    precio_unitario: number
    importe: number
  }[]
  /** Lo que cuesta ir a ver el portón. Cero cuando no se le cobra. */
  cuotaVisita: number
  /** Las partidas y la visita juntas, antes de IVA. */
  subtotal: number
  ivaPct: number
  total: number
  vigenciaDias: number
  garantiaDias: number
  /** Preventivo o reparación: el papel no dice lo mismo en los dos casos. */
  preventivo: boolean
}

/** Las condiciones del presupuesto de una reparación. */
function condicionesServicio(datos: DatosPdfServicio): string[] {
  const notas = [
    `Este presupuesto tiene una vigencia de ${datos.vigenciaDias} días naturales.`,
  ]

  // La visita se cobra por ir, no por el resultado. Decirlo en el papel evita
  // la conversación incómoda del día en que el cliente no acepta.
  if (datos.cuotaVisita > 0) {
    notas.push(
      `La visita de diagnóstico se cobra por separado y ya viene incluida arriba; ` +
        `se cubre aun cuando el presupuesto no sea aceptado.`,
    )
  }

  notas.push(
    'En trabajos mayores se solicita un anticipo para surtir el material; el resto se cubre al terminar.',
    `El trabajo queda garantizado por ${datos.garantiaDias} días naturales sobre lo aquí descrito.`,
    'La garantía no cubre daños por mal uso, descargas eléctricas ni golpes al portón.',
  )
  notas.push(
    datos.ivaPct > 0
      ? 'Los precios ya incluyen el IVA.'
      : 'Los precios no incluyen IVA. De requerir factura, se agrega el 16%.',
  )
  return notas
}

export function DocumentoServicio({ datos }: { datos: DatosPdfServicio }) {
  const tratamiento = datos.tituloCortesia ? `${datos.tituloCortesia} ` : ''
  const contacto = [EMPRESA.telefono, EMPRESA.correo].filter(Boolean).join(' · ')
  // El IVA se saca del total real y no se recalcula: así el papel no puede
  // desviarse ni un centavo de lo que dice la base.
  const iva = Math.round((datos.total - datos.subtotal) * 100) / 100

  return (
    <Document
      title={`Presupuesto ${datos.folio}`}
      author={EMPRESA.nombre}
      subject={`Presupuesto ${datos.folio} · ${datos.cliente}`}
    >
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <View style={e.banda} fixed />

        <View style={e.membrete} fixed>
          <MembretePdf tamano={30} />
          <View>
            <Text style={e.tituloDoc}>
              {datos.preventivo ? 'MANTENIMIENTO PREVENTIVO' : 'PRESUPUESTO DE SERVICIO'}
            </Text>
            <Text style={e.folio}>{datos.folio}</Text>
            <Text style={e.fechaDoc}>
              {EMPRESA.ciudad} · {fechaLarga(datos.fecha)}
            </Text>
          </View>
        </View>

        {/* Cliente, dónde está el portón y cuándo se fue a ver ------------- */}
        <View style={e.tarjetaCliente}>
          <View style={e.celdaCliente}>
            <Text style={e.etiquetaDato}>PREPARADO PARA</Text>
            <Text style={e.datoFuerte}>
              {tratamiento}
              {datos.cliente}
            </Text>
          </View>
          <View style={e.celdaLugar}>
            <Text style={e.etiquetaDato}>SERVICIO</Text>
            <Text style={e.datoFuerte}>{datos.descripcion}</Text>
            {datos.domicilio ? <Text style={e.datoSuave}>{datos.domicilio}</Text> : null}
          </View>
          <View style={e.celdaVisita}>
            <Text style={e.etiquetaDato}>REVISADO EL</Text>
            {/* Corta y no larga: «13 de agosto de 2026» no cabe de un
                renglón en esta columna y se partía en dos. */}
            <Text style={e.datoFuerte}>{fechaCorta(datos.fechaVisita)}</Text>
            {datos.horaVisita ? (
              <Text style={e.datoSuave}>{horaCorta(datos.horaVisita)}</Text>
            ) : null}
            {datos.tecnico ? <Text style={e.datoSuave}>{datos.tecnico}</Text> : null}
          </View>
        </View>

        <Text style={e.parrafo}>
          Reciba un cordial saludo. Después de revisar el equipo en sitio, nos permitimos
          presentarle el presupuesto{' '}
          {datos.preventivo ? 'del mantenimiento.' : 'de la reparación.'}
        </Text>

        {/* Diagnóstico: lo que justifica el precio ------------------------ */}
        {datos.diagnostico ? (
          <>
            <View style={e.encabezadoSeccion}>
              <View style={e.marcaSeccion} />
              <Text style={e.subtitulo}>Diagnóstico</Text>
            </View>
            <Text style={e.diagnostico}>{datos.diagnostico}</Text>
          </>
        ) : null}

        {/* Tabla ---------------------------------------------------------- */}
        <View style={e.encabezadoSeccion}>
          <View style={e.marcaSeccion} />
          <Text style={e.subtitulo}>Lo que se va a hacer</Text>
        </View>

        <View style={e.tabla}>
          <View style={e.encabezadoTabla}>
            <Text style={e.cNumEncabezado}>#</Text>
            <Text style={e.cDescEncabezado}>DESCRIPCIÓN</Text>
            <Text style={e.cCant}>CANT.</Text>
            <Text style={e.cPU}>P.U.</Text>
            <Text style={e.cImp}>IMPORTE</Text>
          </View>

          {datos.partidas.map((p, i) => (
            <View key={i} style={i % 2 === 1 ? [e.fila, e.filaAlterna] : e.fila} wrap={false}>
              <Text style={e.cNum}>{i + 1}</Text>
              <Text style={e.cDesc}>{p.descripcion}</Text>
              <Text style={e.cCant}>
                {p.cantidad.toLocaleString('es-MX')} {abreviaUnidad(p.unidad ?? 'pza')}
              </Text>
              <Text style={e.cPU}>{pesos(p.precio_unitario)}</Text>
              <Text style={[e.cImp, e.importeFila]}>{pesos(p.importe)}</Text>
            </View>
          ))}

          {/* La visita va como un renglón más y no escondida en el total: el
              cliente tiene que ver qué está pagando y por qué. */}
          {datos.cuotaVisita > 0 && (
            <View
              style={datos.partidas.length % 2 === 1 ? [e.fila, e.filaAlterna] : e.fila}
              wrap={false}
            >
              <Text style={e.cNum}>{datos.partidas.length + 1}</Text>
              <Text style={e.cDesc}>Visita de diagnóstico</Text>
              <Text style={e.cCant}>1 serv</Text>
              <Text style={e.cPU}>{pesos(datos.cuotaVisita)}</Text>
              <Text style={[e.cImp, e.importeFila]}>{pesos(datos.cuotaVisita)}</Text>
            </View>
          )}
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
              <Text style={e.valorTotal}>{pesos(iva)}</Text>
            </View>
          )}
          <View style={e.granTotal}>
            <Text style={e.granTotalEtiqueta}>TOTAL</Text>
            <Text style={e.granTotalValor}>{pesos(datos.total)}</Text>
          </View>
          <View style={e.chipCobro}>
            {/* Sin «se cobra al terminar»: en los trabajos grandes se pide
                anticipo, y el matiz ya está dicho en las condiciones. */}
            <Text style={e.chipCobroTexto}>
              Garantía de {datos.garantiaDias} días sobre lo aquí descrito
            </Text>
          </View>
        </View>

        {/* Condiciones y firma, hombro con hombro -------------------------- */}
        <View style={e.cierre} wrap={false}>
          <View style={e.condiciones}>
            <Text style={e.tituloCondiciones}>CONDICIONES</Text>
            {condicionesServicio(datos).map((n) => (
              <View key={n} style={e.filaNota}>
                <Text style={e.puntoNota}>•</Text>
                <Text style={e.nota}>{n}</Text>
              </View>
            ))}
          </View>

          <View style={e.columnaFirma}>
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
        </View>

        <View style={e.pie} fixed>
          <Text>
            {EMPRESA.nombre}
            {contacto ? ` · ${contacto}` : ''}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Presupuesto ${datos.folio} · Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
