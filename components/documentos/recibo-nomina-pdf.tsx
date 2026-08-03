import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MarcaAguaPdf, MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fechaLarga, montoEnLetra, pesos } from '@/lib/format'

const VERDE = MARCA.verde
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

const e = StyleSheet.create({
  pagina: {
    paddingTop: 30, paddingBottom: 46, paddingHorizontal: 48,
    fontSize: 10, color: TINTA, fontFamily: 'Helvetica', lineHeight: 1.45,
  },
  membrete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 2, borderBottomColor: VERDE, paddingBottom: 8, marginBottom: 14,
  },
  contacto: { fontSize: 7.5, color: GRIS, textAlign: 'right' },

  encabezado: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14,
  },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: VERDE, letterSpacing: 0.6 },
  folio: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  fila: { flexDirection: 'row', marginBottom: 3 },
  etiqueta: { width: 92, color: GRIS, fontSize: 9 },
  valor: { flex: 1, fontFamily: 'Helvetica-Bold' },

  th: {
    flexDirection: 'row', backgroundColor: VERDE, color: MARCA.blanco,
    fontFamily: 'Helvetica-Bold', fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 7,
    marginTop: 14,
  },
  tr: {
    flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: LINEA,
    paddingVertical: 5.5, paddingHorizontal: 7,
  },
  cObra: { flex: 1 },
  cImporte: { width: 92, textAlign: 'right' },
  cPct: { width: 58, textAlign: 'right' },

  totales: { alignItems: 'flex-end', marginTop: 10 },
  filaTotal: { flexDirection: 'row', paddingVertical: 2.5 },
  etiquetaTotal: { width: 132, textAlign: 'right', paddingRight: 12, color: GRIS },
  valorTotal: { width: 92, textAlign: 'right' },
  granTotal: {
    flexDirection: 'row', backgroundColor: VERDE_CLARO, paddingVertical: 6, marginTop: 4,
  },
  letra: {
    marginTop: 8, fontSize: 9, color: TINTA, textAlign: 'right', fontStyle: 'italic',
  },

  leyendas: {
    marginTop: 20, borderTopWidth: 0.7, borderTopColor: LINEA, paddingTop: 8,
  },
  leyenda: { fontSize: 8, color: GRIS, marginBottom: 2 },

  firmas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  firma: { width: '44%', alignItems: 'center' },
  lineaFirma: { borderTopWidth: 0.8, borderTopColor: TINTA, width: '100%', marginBottom: 4 },
  nombreFirma: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, textAlign: 'center' },
  cargoFirma: { fontSize: 7.5, color: GRIS, textAlign: 'center' },
})

export type DatosReciboNomina = {
  folio: string
  fecha: string
  trabajador: string
  oficio: string
  metodo: string
  renglones: { obra: string; otNumero: string | null; importe: number; porcentaje: number | null }[]
  deducciones: { tipo: string; monto: number; notas: string | null }[]
  subtotal: number
  totalDeducciones: number
  total: number
  notas: string | null
}

/** RECIBO DE ABONO A MANO DE OBRA · réplica del formato que imprimen hoy. */
export function DocumentoReciboNomina({ datos }: { datos: DatosReciboNomina }) {
  return (
    <Document title={`Recibo de abono ${datos.folio}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <View style={e.membrete}>
          <MembretePdf tamano={28} />
          <View>
            <Text style={e.contacto}>{EMPRESA.ciudad}</Text>
            {EMPRESA.telefono ? <Text style={e.contacto}>{EMPRESA.telefono}</Text> : null}
          </View>
        </View>

        <View style={e.encabezado}>
          <Text style={e.titulo}>RECIBO DE ABONO A MANO DE OBRA</Text>
          <View>
            <Text style={e.folio}>{datos.folio}</Text>
            <Text style={{ fontSize: 8, color: GRIS, textAlign: 'right' }}>
              {EMPRESA.ciudad} a {fechaLarga(datos.fecha)}
            </Text>
          </View>
        </View>

        <View style={e.fila}>
          <Text style={e.etiqueta}>Trabajador</Text>
          <Text style={e.valor}>{datos.trabajador}</Text>
        </View>
        <View style={e.fila}>
          <Text style={e.etiqueta}>Oficio</Text>
          <Text style={{ flex: 1 }}>{datos.oficio}</Text>
        </View>
        <View style={e.fila}>
          <Text style={e.etiqueta}>Forma de pago</Text>
          <Text style={{ flex: 1 }}>{datos.metodo}</Text>
        </View>

        {/* Tabla obra / $ / % ------------------------------------------- */}
        <View style={e.th}>
          <Text style={e.cObra}>OBRA</Text>
          <Text style={e.cImporte}>IMPORTE</Text>
          <Text style={e.cPct}>%</Text>
        </View>

        {datos.renglones.map((r, i) => (
          <View key={i} style={e.tr} wrap={false}>
            <Text style={e.cObra}>
              {r.obra}
              {r.otNumero ? `  ·  OT ${r.otNumero}` : ''}
            </Text>
            <Text style={e.cImporte}>{pesos(r.importe)}</Text>
            <Text style={e.cPct}>{r.porcentaje == null ? '—' : `${r.porcentaje.toFixed(0)}%`}</Text>
          </View>
        ))}

        <View style={e.totales}>
          <View style={e.filaTotal}>
            <Text style={e.etiquetaTotal}>Subtotal</Text>
            <Text style={[e.valorTotal, { fontFamily: 'Helvetica-Bold' }]}>
              {pesos(datos.subtotal)}
            </Text>
          </View>

          {datos.deducciones.map((d, i) => (
            <View key={i} style={e.filaTotal}>
              <Text style={e.etiquetaTotal}>
                {d.tipo}
                {d.notas ? ` (${d.notas})` : ''}
              </Text>
              <Text style={e.valorTotal}>- {pesos(d.monto)}</Text>
            </View>
          ))}

          {datos.deducciones.length === 0 && (
            <View style={e.filaTotal}>
              <Text style={e.etiquetaTotal}>Deducciones</Text>
              <Text style={e.valorTotal}>{pesos(0)}</Text>
            </View>
          )}

          <View style={e.granTotal}>
            <Text
              style={[e.etiquetaTotal, { fontFamily: 'Helvetica-Bold', color: VERDE }]}
            >
              TOTAL A PAGAR
            </Text>
            <Text
              style={[
                e.valorTotal,
                { fontFamily: 'Helvetica-Bold', fontSize: 12, color: VERDE, paddingRight: 7 },
              ]}
            >
              {pesos(datos.total)}
            </Text>
          </View>
        </View>

        <Text style={e.letra}>({montoEnLetra(datos.total)})</Text>

        {datos.notas ? (
          <Text style={{ marginTop: 10, fontSize: 9, color: GRIS }}>{datos.notas}</Text>
        ) : null}

        <View style={e.leyendas}>
          <Text style={e.leyenda}>
            * El % de avance en el recibo representa sólo lo del pago actual.
          </Text>
          <Text style={e.leyenda}>* Abonos según requiera avance de obra.</Text>
        </View>

        <View style={e.firmas} wrap={false}>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{datos.trabajador}</Text>
            <Text style={e.cargoFirma}>Recibí de conformidad</Text>
          </View>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Director General</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
