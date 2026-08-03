import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fecha, pesos } from '@/lib/format'
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/finanzas'
import type { ReporteMensual } from '@/lib/reportes'

const VERDE = MARCA.verde
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

// OJO: nada de lineHeight en la página — rompe el pie fijo de react-pdf.
// Cada texto que lo necesite lo declara por su cuenta.
const e = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 52,
    paddingHorizontal: 46,
    fontSize: 9,
    color: TINTA,
    fontFamily: 'Helvetica',
  },
  membrete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: VERDE,
    paddingBottom: 8,
    marginBottom: 12,
  },
  contacto: { fontSize: 7.5, color: GRIS, textAlign: 'right', lineHeight: 1.5 },

  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: VERDE, letterSpacing: 0.8 },
  encabezadoDoc: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10,
  },

  seccion: {
    backgroundColor: VERDE, color: MARCA.blanco, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    letterSpacing: 0.9, paddingVertical: 4, paddingHorizontal: 7, marginTop: 10, marginBottom: 5,
  },

  cajaVerde: { backgroundColor: VERDE_CLARO, padding: 9, marginTop: 6, flexDirection: 'row' },
  indicador: { flex: 1 },
  indicadorEtiqueta: { fontSize: 7, color: GRIS, marginBottom: 2 },
  indicadorValor: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  fila: { flexDirection: 'row', marginBottom: 3 },
  etiqueta: { width: 150, color: GRIS, fontSize: 8.5 },
  valor: { flex: 1, fontSize: 9, textAlign: 'right', maxWidth: 90 },
  valorFuerte: {
    flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right', maxWidth: 90,
  },

  th: {
    flexDirection: 'row', backgroundColor: VERDE, color: MARCA.blanco,
    fontFamily: 'Helvetica-Bold', fontSize: 7.5, paddingVertical: 4, paddingHorizontal: 6,
  },
  tr: {
    flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: LINEA,
    paddingVertical: 3, paddingHorizontal: 6,
  },
  trTotal: {
    flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6,
    backgroundColor: VERDE_CLARO, fontFamily: 'Helvetica-Bold',
  },

  pie: {
    position: 'absolute', bottom: 24, left: 46, right: 46,
    borderTopWidth: 0.7, borderTopColor: LINEA, paddingTop: 5,
    flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GRIS,
  },
})

function Dato({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={e.fila}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <Text style={fuerte ? e.valorFuerte : e.valor}>{valor}</Text>
    </View>
  )
}

export function DocumentoReporteContador({ reporte }: { reporte: ReporteMensual }) {
  const f = reporte.finanzas

  return (
    <Document title={`Concentrado ${reporte.etiqueta}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <View style={e.membrete} fixed>
          <MembretePdf tamano={28} />
          <View>
            <Text style={e.contacto}>{EMPRESA.ciudad}</Text>
            {EMPRESA.telefono ? <Text style={e.contacto}>{EMPRESA.telefono}</Text> : null}
            {EMPRESA.correo ? <Text style={e.contacto}>{EMPRESA.correo}</Text> : null}
          </View>
        </View>

        <View style={e.encabezadoDoc}>
          <Text style={e.titulo}>CONCENTRADO PARA EL CONTADOR</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{reporte.etiqueta}</Text>
        </View>

        {/* Resumen del mes ------------------------------------------------ */}
        <View style={e.cajaVerde}>
          <View style={e.indicador}>
            <Text style={e.indicadorEtiqueta}>FACTURADO (LIQUIDADO)</Text>
            <Text style={e.indicadorValor}>{pesos(f.facturado)}</Text>
          </View>
          <View style={e.indicador}>
            <Text style={e.indicadorEtiqueta}>COBRADO (FLUJO)</Text>
            <Text style={e.indicadorValor}>{pesos(f.cobrado)}</Text>
          </View>
          <View style={e.indicador}>
            <Text style={e.indicadorEtiqueta}>COSTO DE OBRA</Text>
            <Text style={e.indicadorValor}>{pesos(f.costoObra.total)}</Text>
          </View>
          <View style={e.indicador}>
            <Text style={e.indicadorEtiqueta}>UTILIDAD A CORTE</Text>
            <Text style={e.indicadorValor}>{pesos(f.utilidadCorte)}</Text>
          </View>
        </View>

        <Text style={e.seccion}>RESULTADO DEL MES</Text>
        <Dato etiqueta="Facturado (obras liquidadas en el mes)" valor={pesos(f.facturado)} />
        <Dato etiqueta="Material de obra" valor={pesos(f.costoObra.material)} />
        <Dato etiqueta="Mano de obra" valor={pesos(f.costoObra.manoObra)} />
        <Dato etiqueta="Viáticos" valor={pesos(f.costoObra.viaticos)} />
        <Dato etiqueta="Gastos adicionales de obra" valor={pesos(f.costoObra.adicionales)} />
        <Dato etiqueta="Utilidad bruta" valor={`${pesos(f.utilidadBruta)} (${f.margenPct}%)`} fuerte />
        <Dato etiqueta="Gastos generales" valor={pesos(f.totalGastosGenerales)} />
        <Dato etiqueta="Pagos fijos" valor={pesos(f.totalPagosFijos)} />
        <Dato etiqueta="Utilidad a fecha de corte" valor={pesos(f.utilidadCorte)} fuerte />
        {f.puntoEquilibrio != null && (
          <Dato etiqueta="Punto de equilibrio" valor={pesos(f.puntoEquilibrio)} />
        )}

        {/* Gastos generales por categoría --------------------------------- */}
        {f.categorias.length > 0 && (
          <>
            <Text style={e.seccion}>GASTOS GENERALES POR CATEGORÍA</Text>
            {f.categorias.map((c) => (
              <Dato
                key={c.categoria}
                etiqueta={CATEGORIA_GASTO[c.categoria] ?? c.categoria}
                valor={pesos(c.monto)}
              />
            ))}
            <Dato etiqueta="Total" valor={pesos(f.totalGastosGenerales)} fuerte />
          </>
        )}

        {/* Concentrado de cobranza ---------------------------------------- */}
        <Text style={e.seccion} break>
          CONCENTRADO DE COBRANZA
        </Text>
        <View style={e.th}>
          <Text style={{ flex: 3 }}>CLIENTE</Text>
          <Text style={{ flex: 1.2 }}>COTIZACIÓN</Text>
          <Text style={{ flex: 0.9, textAlign: 'center' }}>FACTURA</Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>COTIZADO</Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>COBRADO</Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>SALDO</Text>
        </View>
        {reporte.cobranza.map((c) => (
          <View key={c.cotizacion_id} style={e.tr} wrap={false}>
            <Text style={{ flex: 3 }}>{c.cliente}</Text>
            <Text style={{ flex: 1.2 }}>{c.folio ?? '—'}</Text>
            <Text style={{ flex: 0.9, textAlign: 'center' }}>{c.requiere_factura ? 'Sí' : 'No'}</Text>
            <Text style={{ flex: 1.4, textAlign: 'right' }}>{pesos(c.cotizado)}</Text>
            <Text style={{ flex: 1.4, textAlign: 'right' }}>{pesos(c.cobrado)}</Text>
            <Text style={{ flex: 1.4, textAlign: 'right' }}>{pesos(c.saldo)}</Text>
          </View>
        ))}
        <View style={e.trTotal}>
          <Text style={{ flex: 3 }}>TOTAL GENERAL</Text>
          <Text style={{ flex: 2.1 }} />
          <Text style={{ flex: 1.4, textAlign: 'right' }}>
            {pesos(reporte.cobranza.reduce((s, c) => s + Number(c.cotizado), 0))}
          </Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>
            {pesos(reporte.cobranza.reduce((s, c) => s + Number(c.cobrado), 0))}
          </Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>
            {pesos(reporte.cobranza.reduce((s, c) => s + Number(c.saldo), 0))}
          </Text>
        </View>

        {/* Movimientos del mes -------------------------------------------- */}
        <Text style={e.seccion} break>
          MOVIMIENTOS DEL MES (GASTOS, PAGOS FIJOS Y NÓMINA)
        </Text>
        <View style={e.th}>
          <Text style={{ flex: 1 }}>FECHA</Text>
          <Text style={{ flex: 3 }}>CONCEPTO</Text>
          <Text style={{ flex: 2.4 }}>REFERENCIA</Text>
          <Text style={{ flex: 1.3 }}>MÉTODO</Text>
          <Text style={{ flex: 1.3, textAlign: 'right' }}>MONTO</Text>
        </View>
        {reporte.movimientos.map((m, i) => (
          <View key={i} style={e.tr} wrap={false}>
            <Text style={{ flex: 1 }}>{fecha(m.fecha)}</Text>
            <Text style={{ flex: 3 }}>{m.concepto}</Text>
            <Text style={{ flex: 2.4, color: GRIS }}>{m.referencia}</Text>
            <Text style={{ flex: 1.3 }}>{METODO_PAGO[m.metodo] ?? m.metodo}</Text>
            <Text style={{ flex: 1.3, textAlign: 'right' }}>{pesos(m.monto)}</Text>
          </View>
        ))}
        <View style={e.trTotal}>
          <Text style={{ flex: 7.7 }}>TOTAL DE SALIDAS</Text>
          <Text style={{ flex: 1.3, textAlign: 'right' }}>
            {pesos(reporte.movimientos.reduce((s, m) => s + m.monto, 0))}
          </Text>
        </View>

        <View style={e.pie} fixed>
          <Text>
            {EMPRESA.nombre} · Concentrado {reporte.etiqueta}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
