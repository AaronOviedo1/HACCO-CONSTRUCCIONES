// ============================================================================
// HaacoPro · Tipos de la base de datos
//
// Escritos a mano para que las consultas de Supabase estén tipadas desde el
// primer día. Para regenerarlos contra el proyecto real:
//   npm run tipos
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMERACIONES (espejo de los tipos de Postgres)
// ---------------------------------------------------------------------------
export type RolUsuario = 'admin' | 'administracion' | 'cuadrilla' | 'contador'
export type OficioTrabajador = 'pintor' | 'herrero' | 'ayudante' | 'otro'
export type TipoCotizacion = 'pintura' | 'herreria' | 'mixta'
export type EstatusCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'terminada'
export type EstatusObra = 'agendada' | 'en_obra' | 'pausada' | 'en_entrega' | 'terminada' | 'cerrada'
export type TipoProducto = 'pintura' | 'herreria' | 'insumo_taller' | 'otro'
export type TipoMovimiento = 'entrada' | 'salida'
export type EstadoHerramienta = 'disponible' | 'en_obra' | 'fuera_servicio'
export type OrigenMaterial = 'cotizado' | 'real'
export type EstatusContrato = 'activo' | 'cerrado'
export type EstatusPagare = 'activo' | 'cancelado'
export type TipoAvance = 'foto' | 'video' | 'nota'
export type EstatusSolicitud = 'pendiente' | 'cotizada' | 'comprada'
export type CategoriaGasto =
  | 'material' | 'herramienta' | 'gasolina' | 'servicio_auto'
  | 'garrafones' | 'marketing' | 'oficina' | 'viaticos' | 'otro'
export type MetodoPago = 'efectivo' | 'tarjeta_empresa' | 'transferencia' | 'cheque' | 'deposito'
export type CondicionCompra = 'contado' | 'credito'
export type TipoPagoCobranza = 'anticipo' | 'abono' | 'liquidacion'
export type TipoDeduccion = 'prestamo' | 'adelanto' | 'reembolso'
export type EstadoPagoFijo = 'pagado' | 'pendiente' | 'vencido' | 'programado'
export type TipoMovimientoCaja = 'entrada' | 'salida'
export type EstatusTarea = 'pendiente' | 'en_proceso' | 'terminada'
export type EstadoCxp = 'pagada' | 'vencida' | 'urgente' | 'proxima' | 'al_corriente' | 'cancelada'
export type RubroMaterial = 'herreria' | 'pintura' | 'otro'
export type EventoObra =
  | 'apertura' | 'estatus' | 'cronograma' | 'avance' | 'contrato'
  | 'pagare' | 'material' | 'entrega' | 'cierre' | 'nota'

// ---------------------------------------------------------------------------
// FILAS
// ---------------------------------------------------------------------------
export type Profile = {
  id: string
  nombre: string
  telefono: string | null
  correo: string | null
  rol: RolUsuario
  oficio: OficioTrabajador | null
  es_externo: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export type Cliente = {
  id: string
  nombre: string
  titulo_cortesia: string | null
  telefono: string | null
  correo: string | null
  domicilio: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type Proveedor = {
  id: string
  nombre: string
  dias_credito_default: number
  telefono: string | null
  contacto: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type Producto = {
  id: string
  nombre: string
  codigo: string | null
  unidad: string
  costo: number
  iva: number
  precio_neto: number
  proveedor_id: string | null
  tipo: TipoProducto
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type Herramienta = {
  id: string
  codigo: string
  nombre: string
  marca: string | null
  valor: number | null
  estado: EstadoHerramienta
  ubicacion: string
  notas: string | null
  created_at: string
  updated_at: string
}

export type TextoProceso = {
  id: string
  titulo: string
  contenido: string
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
}

export type Cotizacion = {
  id: string
  folio: string | null
  cliente_id: string
  nombre_obra: string | null
  domicilio_obra: string | null
  tipo: TipoCotizacion
  estatus: EstatusCotizacion
  requiere_factura: boolean
  anticipo_pct: number | null
  subtotal: number
  iva_pct: number
  total: number
  linea_calidad: string | null
  notas: string | null
  vigencia_dias: number
  fecha: string
  fecha_envio: string | null
  fecha_resolucion: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
}

export type CotizacionProceso = {
  id: string
  cotizacion_id: string
  texto_proceso_id: string | null
  contenido_override: string | null
  orden: number
}

export type CotizacionItem = {
  id: string
  cotizacion_id: string
  desglose_id: string | null
  descripcion: string
  m2: number | null
  precio_unitario: number
  importe: number
  producto_id: string | null
  orden: number
}

export type CotizacionMaterial = {
  id: string
  cotizacion_id: string
  desglose_id: string | null
  rubro: RubroMaterial
  material: string
  producto_id: string | null
  piezas: number
  costo: number
  total: number
  orden: number
}

export type CotizacionHerreriaDesglose = {
  id: string
  cotizacion_id: string
  concepto: string
  materiales_herreria: number
  materiales_pintura: number
  mano_obra: number
  gastos_indirectos_pct: number
  utilidad_pct: number
  costo_total: number
  precio_venta: number
  orden: number
}

export type Obra = {
  id: string
  ot_numero: string | null
  cotizacion_id: string
  nombre: string
  domicilio: string | null
  estatus: EstatusObra
  monto_cotizado: number
  avance_pct: number
  fecha_apertura: string
  fecha_estimada_entrega: string | null
  fecha_ultima_actualizacion: string
  fecha_cierre: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export type ObraConcepto = {
  id: string
  obra_id: string
  nombre: string
  presupuesto: number
  orden: number
  created_at: string
}

export type CronogramaTarea = {
  id: string
  obra_id: string
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  estatus: EstatusTarea
  responsable_id: string | null
  orden: number
  created_at: string
}

export type Gasto = {
  id: string
  obra_id: string | null
  concepto_id: string | null
  categoria: CategoriaGasto
  descripcion: string
  piezas: number | null
  costo_unitario: number | null
  monto: number
  folio_factura: string | null
  proveedor_id: string | null
  metodo: MetodoPago
  condicion: CondicionCompra
  foto_ticket_path: string | null
  fecha: string
  ocr_raw: unknown
  registrado_por: string | null
  created_at: string
  updated_at: string
}

export type ObraMaterial = {
  id: string
  obra_id: string
  concepto_id: string | null
  origen: OrigenMaterial
  material: string
  producto_id: string | null
  piezas: number
  costo: number
  total: number
  folio_factura: string | null
  es_taller: boolean
  gasto_id: string | null
  created_at: string
}

export type InsumoKardex = {
  id: string
  producto_id: string
  tipo: TipoMovimiento
  cantidad: number
  fecha: string
  obra_id: string | null
  notas: string | null
  registrado_por: string | null
  created_at: string
}

export type ContratoOficial = {
  id: string
  obra_id: string
  trabajador_id: string
  trabajos: unknown
  m2: number
  tarifa_m2: number
  otros_importe: number
  reparaciones: unknown
  reparaciones_importe: number
  costo_haaco_pct: number
  subtotal: number
  retencion_haaco: number
  total_pagar: number
  estatus: EstatusContrato
  fecha_inicia: string | null
  fecha_finaliza: string | null
  fecha_cierre: string | null
  firma_oficial_at: string | null
  firma_director_at: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export type Pagare = {
  id: string
  contrato_id: string
  valor_total: number
  interes_ordinario_pct: number
  interes_moratorio_pct: number
  texto_generado: string | null
  estatus: EstatusPagare
  fecha_emision: string
  fecha_cancelacion: string | null
  firma_oficial_at: string | null
  created_at: string
  updated_at: string
}

export type PagareItem = {
  id: string
  pagare_id: string
  herramienta_id: string
  cantidad: number
  valor_unitario: number
  devuelta: boolean
  fecha_devolucion: string | null
}

export type Avance = {
  id: string
  obra_id: string
  autor_id: string
  tipo: TipoAvance
  storage_path: string | null
  comentario: string | null
  porcentaje_avance: number | null
  created_at: string
}

export type SolicitudMaterial = {
  id: string
  obra_id: string
  autor_id: string
  items: unknown
  estatus: EstatusSolicitud
  notas: string | null
  created_at: string
  updated_at: string
}

export type CuentaPorPagar = {
  id: string
  gasto_id: string | null
  proveedor_id: string
  folio_factura: string
  monto: number
  fecha_factura: string
  dias_credito: number
  monto_pagado: number
  fecha_pago: string | null
  cancelada: boolean
  notas: string | null
  vencimiento: string
  saldo: number
  created_at: string
  updated_at: string
}

export type PagoCobranza = {
  id: string
  cotizacion_id: string
  tipo: TipoPagoCobranza
  monto: number
  metodo: MetodoPago
  fecha: string
  comprobante_path: string | null
  notas: string | null
  registrado_por: string | null
  created_at: string
}

export type NominaPago = {
  id: string
  contrato_id: string
  recibo_id: string | null
  fecha: string
  monto: number
  porcentaje_del_pago: number | null
  metodo: MetodoPago
  recibo_folio: string | null
  notas: string | null
  registrado_por: string | null
  created_at: string
}

export type Deduccion = {
  id: string
  trabajador_id: string
  recibo_id: string | null
  contrato_id: string | null
  tipo: TipoDeduccion
  monto: number
  fecha: string
  saldado: boolean
  notas: string | null
  created_at: string
}

export type PagoFijo = {
  id: string
  quincena: string
  recurrente: boolean
  categoria: string
  beneficiario: string
  monto: number
  metodo: MetodoPago
  estado: EstadoPagoFijo
  descripcion: string | null
  notas: string | null
  fecha_pago: string | null
  created_at: string
  updated_at: string
}

export type CajaChica = {
  id: string
  tipo: TipoMovimientoCaja
  concepto: string
  monto: number
  fecha: string
  obra_id: string | null
  gasto_id: string | null
  registrado_por: string | null
  created_at: string
}

export type PolizaGarantia = {
  id: string
  obra_id: string
  folio: string | null
  items: unknown
  fecha_emision: string
  fecha_conclusion: string | null
  vigencia_dias: number
  condiciones: string | null
  deslindes: string | null
  created_at: string
  updated_at: string
}

export type Consecutivo = {
  serie: string
  anio: number
  ultimo: number
}

export type Recibo = {
  id: string
  pago_id: string | null
  cotizacion_id: string
  obra_id: string | null
  folio: string | null
  concepto: string
  esquema_pagos: string | null
  fecha_inicio: string | null
  fecha_estimada_entrega: string | null
  datos_bancarios: string | null
  firma_cliente_at: string | null
  firma_empresa_at: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export type ObraDetalle = {
  id: string
  obra_id: string
  descripcion: string
  atendido: boolean
  fecha_reporte: string
  fecha_atencion: string | null
  reportado_por: string | null
  notas: string | null
  created_at: string
}

export type BitacoraObra = {
  id: string
  obra_id: string
  tipo: EventoObra
  descripcion: string
  datos: unknown
  autor_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// VISTAS DE REPORTE
// ---------------------------------------------------------------------------
export type VInsumoExistencia = {
  producto_id: string
  nombre: string
  codigo: string | null
  unidad: string
  costo: number
  iva: number
  precio_neto: number
  existencia: number
  ultimo_movimiento: string | null
}

export type VCuentaPorPagar = CuentaPorPagar & {
  proveedor: string
  dias_restantes: number
  estado: EstadoCxp
}

export type VCxpPorProveedor = {
  proveedor_id: string
  proveedor: string
  dias_credito_default: number
  saldo_total: number
  vencido: number
  por_vencer: number
}

export type VCotizacion = {
  id: string
  folio: string | null
  fecha: string
  tipo: TipoCotizacion
  estatus: EstatusCotizacion
  requiere_factura: boolean
  nombre_obra: string | null
  subtotal: number
  iva_pct: number
  total: number
  anticipo_pct: number | null
  anticipo_esperado: number
  vigencia_dias: number
  vence: string
  cliente_id: string
  cliente: string
  obras: number
  cobrado: number
  created_at: string
  updated_at: string
}

export type VCobranza = {
  cotizacion_id: string
  folio: string | null
  fecha: string
  estatus: EstatusCotizacion
  requiere_factura: boolean
  cliente_id: string
  cliente: string
  subtotal: number
  cotizado: number
  anticipo_pct: number | null
  anticipo_esperado: number
  anticipo: number
  abonos: number
  liquidacion: number
  cobrado: number
  saldo: number
  pct_pendiente: number
}

export type VObraConcentrado = {
  obra_id: string
  ot_numero: string | null
  nombre: string
  domicilio: string | null
  estatus: EstatusObra
  cotizacion_id: string
  cotizacion_folio: string | null
  cotizacion_tipo: TipoCotizacion
  cliente_id: string
  cliente: string
  fecha_apertura: string
  fecha_estimada_entrega: string | null
  fecha_ultima_actualizacion: string
  fecha_cierre: string | null
  avance_pct: number
  cotizado: number
  mano_obra: number
  contratos: number
  material_cotizado: number
  material_real: number
  viaticos: number
  gastos_adicionales: number
  utilidad: number
  avances: number
  ultimo_avance: string | null
}

export type VNominaContrato = {
  contrato_id: string
  trabajador_id: string
  trabajador: string
  es_externo: boolean
  oficio: OficioTrabajador | null
  obra_id: string
  ot_numero: string | null
  obra: string
  estatus_obra: EstatusObra
  avance_pct: number
  fecha_inicia: string | null
  mano_obra: number
  costo_haaco_pct: number
  retencion_haaco: number
  total: number
  /** Lo ganado hasta hoy: total del contrato por el avance reportado. */
  devengado: number
  pagado: number
  por_pagar: number
  /** Devengado menos lo ya abonado; nunca negativo. */
  disponible: number
  pct_pagado: number
  ultimo_pago: string | null
  estatus: EstatusContrato
}

export type VPrenomina = {
  trabajador_id: string
  trabajador: string
  es_externo: boolean
  oficio: OficioTrabajador | null
  contratos_activos: number
  total_mano_obra: number
  retencion: number
  total_contratos: number
  devengado: number
  pagado: number
  pendiente: number
  disponible: number
  pct_pagado: number
  deducciones: number
  ultimo_pago: string | null
}

export type ReciboNomina = {
  id: string
  folio: string | null
  trabajador_id: string
  fecha: string
  metodo: MetodoPago
  subtotal: number
  deducciones: number
  total: number
  notas: string | null
  registrado_por: string | null
  created_at: string
}

export type VGasto = Gasto & {
  proveedor: string | null
  obra: string | null
  ot_numero: string | null
  concepto: string | null
}

// ---------------------------------------------------------------------------
// Argumentos de las funciones RPC (las operaciones que deben ser atómicas)
// ---------------------------------------------------------------------------
export type MaterialSql = {
  rubro: RubroMaterial
  material: string
  producto_id?: string | null
  piezas: number
  costo: number
  orden?: number
}

export type DocumentoCotizacionSql = {
  cliente_id: string
  nombre_obra?: string | null
  domicilio_obra?: string | null
  tipo: TipoCotizacion
  requiere_factura?: boolean
  anticipo_pct?: number | null
  iva_pct?: number
  vigencia_dias?: number
  linea_calidad?: string | null
  notas?: string | null
  fecha?: string
  procesos: { texto_proceso_id?: string | null; contenido: string; orden: number }[]
  items: {
    descripcion: string
    m2?: number | null
    precio_unitario: number
    producto_id?: string | null
  }[]
  desglose: {
    concepto: string
    mano_obra: number
    gastos_indirectos_pct: number
    utilidad_pct: number
    materiales: MaterialSql[]
  }[]
  materiales: MaterialSql[]
}

export type GastoSql = {
  obra_id?: string | null
  concepto_id?: string | null
  categoria: CategoriaGasto
  descripcion: string
  piezas?: number | null
  costo_unitario?: number | null
  monto: number
  folio_factura?: string | null
  proveedor_id?: string | null
  metodo: MetodoPago
  condicion: CondicionCompra
  foto_ticket_path?: string | null
  fecha: string
  /** Si es material de una obra, crea también el renglón REAL. */
  crear_material?: boolean
}

export type ObraNuevaSql = {
  nombre: string
  domicilio?: string | null
  monto?: number
  fecha_estimada_entrega?: string | null
}

export type ResultadoAprobacion = {
  folio: string
  anticipo_esperado: number
  obras: { id: string; ot_numero: string; nombre: string }[]
}

/**
 * `cerrar_obra` no cierra si quedan detalles, saldo del cliente o nómina
 * pendiente: en ese caso regresa el diagnóstico en vez de fallar.
 */
export type ResultadoCierre =
  | {
      cerrada: false
      detalles_pendientes: number
      saldo_cliente: number
      mano_obra_pendiente: number
    }
  | {
      cerrada: true
      contratos_cerrados: number
      pagares_cancelados: number
      herramientas_devueltas: number
      cotizacion_terminada: boolean
      forzado: boolean
    }

// ---------------------------------------------------------------------------
// Mapa que consume supabase-js
// ---------------------------------------------------------------------------
type Tabla<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}
type Vista<Row> = { Row: Row; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: Tabla<Profile>
      clientes: Tabla<Cliente>
      proveedores: Tabla<Proveedor>
      productos: Tabla<Producto>
      herramientas: Tabla<Herramienta>
      textos_proceso: Tabla<TextoProceso>
      cotizaciones: Tabla<Cotizacion>
      cotizacion_procesos: Tabla<CotizacionProceso>
      cotizacion_items: Tabla<CotizacionItem>
      cotizacion_materiales: Tabla<CotizacionMaterial>
      cotizacion_herreria_desglose: Tabla<CotizacionHerreriaDesglose>
      obras: Tabla<Obra>
      obra_conceptos: Tabla<ObraConcepto>
      cronograma_tareas: Tabla<CronogramaTarea>
      obra_materiales: Tabla<ObraMaterial>
      insumos_kardex: Tabla<InsumoKardex>
      gastos: Tabla<Gasto>
      contratos_oficial: Tabla<ContratoOficial>
      pagares: Tabla<Pagare>
      pagare_items: Tabla<PagareItem>
      avances: Tabla<Avance>
      solicitudes_material: Tabla<SolicitudMaterial>
      cuentas_por_pagar: Tabla<CuentaPorPagar>
      pagos_cobranza: Tabla<PagoCobranza>
      nomina_pagos: Tabla<NominaPago>
      deducciones: Tabla<Deduccion>
      pagos_fijos: Tabla<PagoFijo>
      caja_chica: Tabla<CajaChica>
      polizas_garantia: Tabla<PolizaGarantia>
      consecutivos: Tabla<Consecutivo>
      recibos: Tabla<Recibo>
      recibos_nomina: Tabla<ReciboNomina>
      obra_detalles: Tabla<ObraDetalle>
      bitacora_obra: Tabla<BitacoraObra>
    }
    Views: {
      v_cotizaciones: Vista<VCotizacion>
      v_gastos: Vista<VGasto>
      v_insumos_existencia: Vista<VInsumoExistencia>
      v_cuentas_por_pagar: Vista<VCuentaPorPagar>
      v_cxp_por_proveedor: Vista<VCxpPorProveedor>
      v_cobranza: Vista<VCobranza>
      v_obra_concentrado: Vista<VObraConcentrado>
      v_nomina_contratos: Vista<VNominaContrato>
      v_prenomina: Vista<VPrenomina>
    }
    Functions: {
      guardar_cotizacion: {
        Args: { p_id: string | null; p_datos: DocumentoCotizacionSql }
        Returns: string
      }
      duplicar_cotizacion: {
        Args: { p_id: string }
        Returns: string
      }
      aprobar_cotizacion: {
        Args: { p_id: string; p_obras: ObraNuevaSql[]; p_anticipo_pct: number | null }
        Returns: ResultadoAprobacion
      }
      recorrer_cronograma: {
        Args: { p_obra: string; p_dias: number; p_desde: string }
        Returns: number
      }
      salida_taller_a_obra: {
        Args: {
          p_obra: string
          p_producto: string
          p_cantidad: number
          p_concepto: string | null
          p_notas: string | null
        }
        Returns: string
      }
      crear_pagare: {
        Args: { p_contrato: string; p_herramientas: string[] }
        Returns: string
      }
      cancelar_pagare: { Args: { p_pagare: string }; Returns: number }
      entregar_obra: { Args: { p_obra: string; p_fecha: string }; Returns: undefined }
      cerrar_obra: {
        Args: { p_obra: string; p_fecha: string; p_forzar: boolean }
        Returns: ResultadoCierre
      }
      registrar_gasto: { Args: { p_datos: GastoSql }; Returns: string }
      abonar_cxp: {
        Args: { p_id: string; p_monto: number; p_fecha: string }
        Returns: { pagado: number; saldo: number; liquidada: boolean }
      }
      pagar_nomina: {
        Args: {
          p_trabajador: string
          p_fecha: string
          p_metodo: MetodoPago
          p_pagos: { contrato_id: string; monto: number; porcentaje: number | null }[]
          p_deducciones: string[]
          p_notas: string | null
        }
        Returns: string
      }
      generar_quincena: { Args: { p_quincena: string }; Returns: number }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
