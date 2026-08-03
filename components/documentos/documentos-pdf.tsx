import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MarcaAguaPdf, MembretePdf } from '@/components/documentos/marca-pdf'
import { EMPRESA } from '@/lib/empresa'
import { MARCA } from '@/lib/marca'
import { fecha, fechaLarga, montoEnLetra, pesos } from '@/lib/format'
import { GRUPOS_TRABAJOS, textoPagare, type ReparacionContrato } from '@/lib/obras'

const VERDE = MARCA.verde
const VERDE_CLARO = MARCA.verdeClaro
const TINTA = MARCA.tinta
const GRIS = MARCA.gris
const LINEA = MARCA.linea

const e = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 52,
    paddingHorizontal: 46,
    fontSize: 9.5,
    color: TINTA,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
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
  folio: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: TINTA },
  encabezadoDoc: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10,
  },

  seccion: {
    backgroundColor: VERDE, color: MARCA.blanco, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    letterSpacing: 0.9, paddingVertical: 4, paddingHorizontal: 7, marginTop: 9, marginBottom: 5,
  },
  fila: { flexDirection: 'row', marginBottom: 3 },
  etiqueta: { width: 108, color: GRIS, fontSize: 8.5 },
  valor: { flex: 1, fontSize: 9.5 },
  valorFuerte: { flex: 1, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },

  caja: {
    borderWidth: 0.8, borderColor: LINEA, borderRadius: 3, padding: 9, marginTop: 6,
  },
  cajaVerde: { backgroundColor: VERDE_CLARO, padding: 9, marginTop: 8 },

  parrafo: { marginBottom: 8, textAlign: 'justify' },
  letra: { fontSize: 8.5, color: GRIS, fontStyle: 'italic', marginTop: 2 },

  th: {
    flexDirection: 'row', backgroundColor: VERDE, color: MARCA.blanco,
    fontFamily: 'Helvetica-Bold', fontSize: 8, paddingVertical: 4, paddingHorizontal: 6,
  },
  tr: {
    flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: LINEA,
    paddingVertical: 3.2, paddingHorizontal: 6,
  },

  firmas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  firma: { width: '44%', alignItems: 'center' },
  lineaFirma: { borderTopWidth: 0.8, borderTopColor: TINTA, width: '100%', marginBottom: 4 },
  nombreFirma: { fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center' },
  cargoFirma: { fontSize: 7.5, color: GRIS, textAlign: 'center' },

  pie: {
    position: 'absolute', bottom: 24, left: 46, right: 46,
    borderTopWidth: 0.7, borderTopColor: LINEA, paddingTop: 5,
    flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GRIS,
  },
})

function Membrete() {
  return (
    <View style={e.membrete} fixed>
      <MembretePdf tamano={28} />
      <View>
        <Text style={e.contacto}>{EMPRESA.ciudad}</Text>
        {EMPRESA.telefono ? <Text style={e.contacto}>{EMPRESA.telefono}</Text> : null}
        {EMPRESA.correo ? <Text style={e.contacto}>{EMPRESA.correo}</Text> : null}
      </View>
    </View>
  )
}

function Pie({ documento }: { documento: string }) {
  return (
    <View style={e.pie} fixed>
      <Text>
        {EMPRESA.nombre} · {documento}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function Dato({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={e.fila}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <Text style={fuerte ? e.valorFuerte : e.valor}>{valor}</Text>
    </View>
  )
}

// ===========================================================================
// RECIBO-CONTRATO DE ANTICIPO
// ===========================================================================
export type DatosRecibo = {
  folio: string
  fecha: string
  cliente: string
  tituloCortesia: string | null
  domicilio: string | null
  telefono: string | null
  correo: string | null
  metodoPago: string
  cotizacionFolio: string
  concepto: string
  monto: number
  totalCotizacion: number
  saldoPendiente: number
  esquemaPagos: string | null
  fechaInicio: string | null
  fechaEstimadaEntrega: string | null
  datosBancarios: string | null
  obra: string | null
}

export function DocumentoRecibo({ datos }: { datos: DatosRecibo }) {
  return (
    <Document title={`Recibo ${datos.folio}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <Membrete />

        <View style={e.encabezadoDoc}>
          <Text style={e.titulo}>RECIBO HAACO PRO</Text>
          <View>
            <Text style={e.folio}>{datos.folio}</Text>
            <Text style={{ fontSize: 8, color: GRIS, textAlign: 'right' }}>
              {EMPRESA.ciudad} a {fechaLarga(datos.fecha)}
            </Text>
          </View>
        </View>

        <Text style={e.seccion}>CLIENTE</Text>
        <Dato
          etiqueta="Nombre"
          valor={`${datos.tituloCortesia ? `${datos.tituloCortesia} ` : ''}${datos.cliente}`}
          fuerte
        />
        <Dato etiqueta="Domicilio" valor={datos.domicilio ?? '—'} />
        <Dato etiqueta="Teléfono" valor={datos.telefono ?? '—'} />
        <Dato etiqueta="Correo" valor={datos.correo ?? '—'} />

        <Text style={e.seccion}>MÉTODO DE PAGO</Text>
        <Dato etiqueta="Forma de pago" valor={datos.metodoPago} />
        <Dato etiqueta="Fecha del pago" valor={fecha(datos.fecha)} />

        <Text style={e.seccion}>DESCRIPCIÓN</Text>
        <Dato etiqueta="No. de cotización" valor={datos.cotizacionFolio} fuerte />
        {datos.obra ? <Dato etiqueta="Obra" valor={datos.obra} /> : null}
        <Dato etiqueta="Concepto" valor={datos.concepto} />

        <View style={e.cajaVerde}>
          <View style={e.fila}>
            <Text style={[e.etiqueta, { color: TINTA }]}>Anticipo recibido</Text>
            <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 13, color: VERDE }}>
              {pesos(datos.monto)}
            </Text>
          </View>
          <Text style={e.letra}>({montoEnLetra(datos.monto)})</Text>
        </View>

        <View style={e.caja}>
          <Dato etiqueta="Total de la obra" valor={pesos(datos.totalCotizacion)} />
          <Dato etiqueta="Saldo pendiente" valor={pesos(datos.saldoPendiente)} fuerte />
          {datos.esquemaPagos ? <Dato etiqueta="Esquema de pagos" valor={datos.esquemaPagos} /> : null}
          <Dato
            etiqueta="Fecha de inicio"
            valor={datos.fechaInicio ? fecha(datos.fechaInicio) : 'Por definir'}
          />
          <Dato
            etiqueta="Entrega estimada"
            valor={datos.fechaEstimadaEntrega ? fecha(datos.fechaEstimadaEntrega) : 'Por definir'}
          />
        </View>

        <Text style={[e.parrafo, { marginTop: 9 }]}>
          Ambas partes manifiestan su conformidad con el monto recibido, el saldo pendiente y las
          fechas señaladas. El presente recibo forma parte integrante de la cotización{' '}
          {datos.cotizacionFolio} y hace las veces de contrato entre las partes.
        </Text>

        {datos.datosBancarios ? (
          <>
            <Text style={e.seccion}>DATOS BANCARIOS</Text>
            <Text style={{ fontSize: 9 }}>{datos.datosBancarios}</Text>
          </>
        ) : null}

        <View style={e.firmas} wrap={false}>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{datos.cliente}</Text>
            <Text style={e.cargoFirma}>Cliente</Text>
          </View>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Por {EMPRESA.nombre}</Text>
          </View>
        </View>

        <Pie documento={`Recibo ${datos.folio}`} />
      </Page>
    </Document>
  )
}

// ===========================================================================
// CONTRATO POR OBRA DETERMINADA
// ===========================================================================
export type DatosContrato = {
  oficio: string
  oficial: string
  obra: string
  domicilio: string | null
  cliente: string
  inicia: string | null
  finaliza: string | null
  cotizacionFolio: string
  trabajos: Record<string, string[]>
  reparaciones: ReparacionContrato[]
  m2: number
  tarifa: number
  otros: number
  reparacionesImporte: number
  subtotal: number
  costoHaacoPct: number
  retencion: number
  total: number
  esExterno: boolean
}

export function DocumentoContrato({ datos }: { datos: DatosContrato }) {
  return (
    <Document title={`Contrato ${datos.oficial}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <Membrete />

        <View style={e.encabezadoDoc}>
          <Text style={e.titulo}>CONTRATO POR OBRA DETERMINADA</Text>
          <Text style={{ fontSize: 8, color: GRIS }}>{EMPRESA.ciudad}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 18 }}>
          <View style={{ flex: 1 }}>
            <Dato etiqueta={datos.oficio} valor={datos.oficial} fuerte />
            <Dato etiqueta="Obra" valor={datos.obra} />
            <Dato etiqueta="Domicilio" valor={datos.domicilio ?? '—'} />
          </View>
          <View style={{ flex: 1 }}>
            <Dato etiqueta="Cliente" valor={datos.cliente} />
            <Dato etiqueta="Inicia" valor={datos.inicia ? fecha(datos.inicia) : '—'} />
            <Dato etiqueta="Finaliza" valor={datos.finaliza ? fecha(datos.finaliza) : '—'} />
            <Dato etiqueta="No. de cotización" valor={datos.cotizacionFolio} />
          </View>
        </View>

        <Text style={e.seccion}>TRABAJOS A REALIZAR</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {GRUPOS_TRABAJOS.map((grupo) => (
            <View key={grupo.clave} style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 3 }}>
                {grupo.titulo.toUpperCase()}
              </Text>
              {grupo.opciones.map((o) => {
                const marcada = (datos.trabajos[grupo.clave] ?? []).includes(o.clave)
                return (
                  <View key={o.clave} style={{ flexDirection: 'row', marginBottom: 0.5 }}>
                    <Text
                      style={{
                        width: 17,
                        fontFamily: 'Helvetica-Bold',
                        fontSize: 8.5,
                        color: marcada ? VERDE : GRIS,
                      }}
                    >
                      {marcada ? '[X]' : '[  ]'}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 8.5, color: marcada ? TINTA : GRIS }}>
                      {o.texto}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))}

          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 3 }}>
              REPARACIONES
            </Text>
            {[0, 1, 2, 3].map((i) => {
              const r = datos.reparaciones[i]
              return (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 0.5 }}>
                  <Text style={{ width: 12, fontSize: 8.5, color: GRIS }}>{i + 1}.</Text>
                  <Text style={{ flex: 1, fontSize: 8.5 }}>
                    {r?.descripcion || '—'}
                    {r && r.importe > 0 ? ` · ${pesos(r.importe)}` : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        <Text style={e.seccion}>IMPORTE</Text>
        <View style={e.th}>
          <Text style={{ flex: 1 }}>CONCEPTO</Text>
          <Text style={{ width: 60, textAlign: 'right' }}>CANTIDAD</Text>
          <Text style={{ width: 70, textAlign: 'right' }}>TARIFA</Text>
          <Text style={{ width: 80, textAlign: 'right' }}>IMPORTE</Text>
        </View>
        <View style={e.tr}>
          <Text style={{ flex: 1 }}>Mano de obra por metro cuadrado</Text>
          <Text style={{ width: 60, textAlign: 'right' }}>{datos.m2} m²</Text>
          <Text style={{ width: 70, textAlign: 'right' }}>{pesos(datos.tarifa)}</Text>
          <Text style={{ width: 80, textAlign: 'right' }}>{pesos(datos.m2 * datos.tarifa)}</Text>
        </View>
        <View style={e.tr}>
          <Text style={{ flex: 1 }}>Otros</Text>
          <Text style={{ width: 60 }} />
          <Text style={{ width: 70 }} />
          <Text style={{ width: 80, textAlign: 'right' }}>{pesos(datos.otros)}</Text>
        </View>
        <View style={e.tr}>
          <Text style={{ flex: 1 }}>Reparaciones</Text>
          <Text style={{ width: 60 }} />
          <Text style={{ width: 70 }} />
          <Text style={{ width: 80, textAlign: 'right' }}>{pesos(datos.reparacionesImporte)}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ width: 150, textAlign: 'right', paddingRight: 12, color: GRIS }}>
              Subtotal
            </Text>
            <Text style={{ width: 84, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
              {pesos(datos.subtotal)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            <Text style={{ width: 150, textAlign: 'right', paddingRight: 12, color: GRIS }}>
              Costo Haaco {datos.costoHaacoPct}%
              {datos.esExterno && datos.costoHaacoPct === 0 ? ' (externo)' : ''}
            </Text>
            <Text style={{ width: 84, textAlign: 'right' }}>- {pesos(datos.retencion)}</Text>
          </View>
          <View
            style={{
              flexDirection: 'row', backgroundColor: VERDE_CLARO,
              paddingVertical: 5, marginTop: 4,
            }}
          >
            <Text
              style={{
                width: 150, textAlign: 'right', paddingRight: 12,
                fontFamily: 'Helvetica-Bold', color: VERDE,
              }}
            >
              TOTAL A PAGAR
            </Text>
            <Text
              style={{
                width: 84, textAlign: 'right', fontFamily: 'Helvetica-Bold',
                fontSize: 11, color: VERDE, paddingRight: 6,
              }}
            >
              {pesos(datos.total)}
            </Text>
          </View>
        </View>

        <Text style={[e.letra, { textAlign: 'right', marginTop: 2 }]}>
          ({montoEnLetra(datos.total)})
        </Text>

        <Text style={[e.parrafo, { marginTop: 10 }]}>
          El presente contrato se celebra por obra determinada. La retención «Costo Haaco»
          corresponde al uso de herramienta y consumibles proporcionados por la empresa. El pago se
          realiza por avance de obra, conforme a lo verificado en sitio.
        </Text>

        <View style={[e.firmas, { marginTop: 18 }]} wrap={false}>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{datos.oficial}</Text>
            <Text style={e.cargoFirma}>{datos.oficio}</Text>
          </View>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Director General</Text>
          </View>
        </View>

        <View style={[e.caja, { marginTop: 14 }]} wrap={false}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 10 }}>
            CIERRE DE OBRA
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '48%' }}>
              <View style={[e.lineaFirma, { marginTop: 14 }]} />
              <Text style={e.cargoFirma}>Firma de cierre de obra</Text>
            </View>
            <View style={{ width: '40%' }}>
              <View style={[e.lineaFirma, { marginTop: 14 }]} />
              <Text style={e.cargoFirma}>Fecha de cierre</Text>
            </View>
          </View>
        </View>

        <Pie documento={`Contrato · ${datos.oficial}`} />
      </Page>
    </Document>
  )
}

// ===========================================================================
// PAGARÉ DE HERRAMIENTAS
// ===========================================================================
export type DatosPagare = {
  suscriptor: string
  obra: string
  domicilio: string | null
  fecha: string
  valorTotal: number
  interesOrdinario: number
  interesMoratorio: number
  herramientas: { codigo: string; nombre: string; marca: string | null; valor: number }[]
}

export function DocumentoPagare({ datos }: { datos: DatosPagare }) {
  const parrafos = textoPagare({
    suscriptor: datos.suscriptor,
    obra: datos.obra,
    domicilio: datos.domicilio ?? '',
    valor: pesos(datos.valorTotal),
    valorLetra: montoEnLetra(datos.valorTotal),
    fecha: fechaLarga(datos.fecha),
    beneficiario: EMPRESA.director.replace(/^Lic\.\s*/, ''),
    interesOrdinario: datos.interesOrdinario,
    interesMoratorio: datos.interesMoratorio,
  })

  return (
    <Document title={`Pagaré ${datos.suscriptor}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <Membrete />

        <View style={e.encabezadoDoc}>
          <Text style={e.titulo}>PAGARÉ</Text>
          <View>
            <Text style={[e.folio, { textAlign: 'right' }]}>{pesos(datos.valorTotal)}</Text>
            <Text style={{ fontSize: 8, color: GRIS, textAlign: 'right' }}>
              {EMPRESA.ciudad} a {fechaLarga(datos.fecha)}
            </Text>
          </View>
        </View>

        <Dato etiqueta="Suscriptor" valor={datos.suscriptor} fuerte />
        <Dato etiqueta="Obra" valor={datos.obra} />
        <Dato etiqueta="Domicilio de la obra" valor={datos.domicilio ?? '—'} />

        <View style={{ marginTop: 12 }}>
          {parrafos.map((p, i) => (
            <Text key={i} style={e.parrafo}>
              {p}
            </Text>
          ))}
        </View>

        <Text style={e.seccion}>HERRAMIENTAS RECIBIDAS EN PRÉSTAMO</Text>
        <View style={e.th}>
          <Text style={{ width: 26 }}>#</Text>
          <Text style={{ width: 66 }}>CÓDIGO</Text>
          <Text style={{ flex: 1 }}>HERRAMIENTA</Text>
          <Text style={{ width: 72 }}>MARCA</Text>
          <Text style={{ width: 74, textAlign: 'right' }}>VALOR</Text>
        </View>
        {datos.herramientas.map((h, i) => (
          <View key={h.codigo} style={e.tr} wrap={false}>
            <Text style={{ width: 26, color: GRIS }}>{i + 1}</Text>
            <Text style={{ width: 66, fontFamily: 'Helvetica-Bold' }}>{h.codigo}</Text>
            <Text style={{ flex: 1 }}>{h.nombre}</Text>
            <Text style={{ width: 72, color: GRIS }}>{h.marca ?? '—'}</Text>
            <Text style={{ width: 74, textAlign: 'right' }}>{pesos(h.valor)}</Text>
          </View>
        ))}

        <View
          style={{
            flexDirection: 'row', backgroundColor: VERDE_CLARO,
            paddingVertical: 5, paddingHorizontal: 6, marginTop: 3,
          }}
        >
          <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', color: VERDE }}>
            VALOR TOTAL DE LAS HERRAMIENTAS
          </Text>
          <Text
            style={{
              width: 74, textAlign: 'right', fontFamily: 'Helvetica-Bold',
              fontSize: 11, color: VERDE,
            }}
          >
            {pesos(datos.valorTotal)}
          </Text>
        </View>
        <Text style={[e.letra, { textAlign: 'right' }]}>({montoEnLetra(datos.valorTotal)})</Text>

        <View style={e.firmas} wrap={false}>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{datos.suscriptor}</Text>
            <Text style={e.cargoFirma}>Suscriptor</Text>
          </View>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Beneficiario</Text>
          </View>
        </View>

        <Pie documento={`Pagaré · ${datos.suscriptor}`} />
      </Page>
    </Document>
  )
}

// ===========================================================================
// PÓLIZA DE GARANTÍA
// ===========================================================================
export type DatosPoliza = {
  folio: string
  fechaEmision: string
  fechaConclusion: string | null
  vigenciaDias: number
  vence: string | null
  cliente: string
  domicilio: string | null
  obra: string
  otNumero: string
  condiciones: string | null
  deslindes: string | null
  areas: { area: string; pintura: string; color: string; codigo: string }[]
}

export function DocumentoPoliza({ datos }: { datos: DatosPoliza }) {
  return (
    <Document title={`Póliza ${datos.folio}`} author={EMPRESA.nombre}>
      <Page size="LETTER" style={e.pagina}>
        <MarcaAguaPdf />
        <Membrete />

        <View style={e.encabezadoDoc}>
          <Text style={e.titulo}>PÓLIZA DE GARANTÍA</Text>
          <View>
            <Text style={[e.folio, { textAlign: 'right' }]}>{datos.folio}</Text>
            <Text style={{ fontSize: 8, color: GRIS, textAlign: 'right' }}>
              {EMPRESA.ciudad} a {fechaLarga(datos.fechaEmision)}
            </Text>
          </View>
        </View>

        <Dato etiqueta="Cliente" valor={datos.cliente} fuerte />
        <Dato etiqueta="Domicilio" valor={datos.domicilio ?? '—'} />
        <Dato etiqueta="Obra" valor={`${datos.obra} · OT ${datos.otNumero}`} />

        <View style={e.cajaVerde}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: VERDE }}>
            Garantía por {datos.vigenciaDias} días naturales
          </Text>
          <Text style={{ fontSize: 9, marginTop: 2 }}>
            Contados a partir de la conclusión de los trabajos el{' '}
            {datos.fechaConclusion ? fecha(datos.fechaConclusion) : '—'}
            {datos.vence ? `, con vencimiento el ${fecha(datos.vence)}` : ''}.
          </Text>
        </View>

        <Text style={e.seccion}>ALCANCE DE LA GARANTÍA</Text>
        <Text style={e.parrafo}>{datos.condiciones ?? '—'}</Text>

        <Text style={e.seccion}>LO QUE NO AMPARA</Text>
        <Text style={e.parrafo}>{datos.deslindes ?? '—'}</Text>

        {datos.areas.length > 0 && (
          <>
            <Text style={e.seccion}>PINTURAS Y COLORES APLICADOS</Text>
            <Text style={{ fontSize: 8.5, color: GRIS, marginBottom: 5 }}>
              Conserve esta relación: es la referencia exacta para cualquier retoque futuro.
            </Text>
            <View style={e.th}>
              <Text style={{ flex: 1 }}>ÁREA</Text>
              <Text style={{ flex: 1.2 }}>PRODUCTO</Text>
              <Text style={{ flex: 1 }}>COLOR</Text>
              <Text style={{ width: 80 }}>CÓDIGO</Text>
            </View>
            {datos.areas.map((a, i) => (
              <View key={i} style={e.tr} wrap={false}>
                <Text style={{ flex: 1 }}>{a.area || '—'}</Text>
                <Text style={{ flex: 1.2 }}>{a.pintura || '—'}</Text>
                <Text style={{ flex: 1 }}>{a.color || '—'}</Text>
                <Text style={{ width: 80, fontFamily: 'Helvetica-Bold' }}>{a.codigo || '—'}</Text>
              </View>
            ))}
          </>
        )}

        <View style={[e.firmas, { marginTop: 26 }]} wrap={false}>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{datos.cliente}</Text>
            <Text style={e.cargoFirma}>Recibí de conformidad</Text>
          </View>
          <View style={e.firma}>
            <View style={e.lineaFirma} />
            <Text style={e.nombreFirma}>{EMPRESA.director}</Text>
            <Text style={e.cargoFirma}>Director General</Text>
          </View>
        </View>

        <Pie documento={`Póliza ${datos.folio}`} />
      </Page>
    </Document>
  )
}
