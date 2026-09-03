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
export type TipoCotizacion = 'pintura' | 'imper' | 'herreria' | 'otros' | 'mixta'
export type EstatusCotizacion =
  | 'borrador' | 'enviada' | 'seguimiento' | 'aprobada' | 'rechazada' | 'terminada'

/** Las tres tarifas con las que se cobra un metro de pintura. */
export type NivelPrecio = 'publico' | 'especial' | 'super'
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
export type MetodoPago = 'efectivo' | 'caja_chica' | 'tarjeta_empresa' | 'transferencia' | 'cheque' | 'deposito'
export type CondicionCompra = 'contado' | 'credito'
export type TipoPagoCobranza = 'anticipo' | 'abono' | 'liquidacion'
export type TipoDeduccion = 'prestamo' | 'adelanto' | 'reembolso'
export type EstadoPagoFijo = 'pagado' | 'pendiente' | 'vencido' | 'programado'
export type TipoMovimientoCaja = 'entrada' | 'salida'
export type EstatusTarea = 'pendiente' | 'en_proceso' | 'terminada'
export type EstadoCxp = 'pagada' | 'vencida' | 'urgente' | 'proxima' | 'al_corriente' | 'cancelada'
export type RubroMaterial = 'herreria' | 'pintura' | 'otro'
/** De dónde salió un precio observado. Nunca «actual»: siempre su procedencia. */
export type OrigenPrecio = 'factura' | 'llamada' | 'captura' | 'lista'
/** Qué clase de visita es. El preventivo no lo pide nadie: se ofrece. */
export type TipoServicio = 'reparacion' | 'preventivo'
/** El flujo de una reparación. «Cobrado» no está: eso lo dicen los pagos. */
export type EstatusServicio =
  | 'agendado' | 'diagnostico' | 'presupuestado'
  | 'aprobado' | 'rechazado' | 'reparado' | 'cancelado'
export type EstatusPropuesta = 'pendiente' | 'aceptada' | 'rechazada'
export type EstatusRonda = 'pendiente' | 'confirmado' | 'pospuesto'
export type EventoObra =
  | 'apertura' | 'estatus' | 'cronograma' | 'avance' | 'contrato'
  | 'pagare' | 'material' | 'entrega' | 'cierre' | 'reapertura' | 'nota'

// ---------------------------------------------------------------------------
// FILAS
// ---------------------------------------------------------------------------
/** Un número que Dirección cambia sin tocar el código. Una fila por clave. */
export type Ajuste = {
  clave: string
  valor: unknown
  updated_at: string
}

export type Profile = {
  id: string
  nombre: string
  telefono: string | null
  correo: string | null
  rol: RolUsuario
  oficio: OficioTrabajador | null
  /** Sin retención Costo Haaco del 5%. No confundir con `con_acceso`. */
  es_externo: boolean
  /** Falso = sólo existe para contratos y nómina; nunca entra a la app. */
  con_acceso: boolean
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
  /** Normalmente pide factura: es el IVA con el que nace su cotización. */
  requiere_factura: boolean
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
  /** Lo que cuesta comprarla, sin IVA. */
  costo: number
  iva: number
  /** Lo que se paga por ella: costo + IVA. */
  precio_neto: number
  /** Agrupa las pinturas en el cotizador. */
  marca: string | null
  /**
   * Lo que se le cobra al cliente por m² aplicado con esta pintura, en sus tres
   * tarifas. Nada que ver con el costo. Nulos = no se ofrece al cotizar.
   */
  precio_publico: number | null
  precio_especial: number | null
  precio_super: number | null
  proveedor_id: string | null
  tipo: TipoProducto
  /** El texto del nombre normalizado; lo calcula la base. */
  clave_busqueda: string | null
  /** Si entra en la ronda de precios de la mañana. */
  seguir_precio: boolean
  /** Cuánto aguanta su precio antes de estar viejo. Nulo = el de su tipo. */
  dias_vigencia_precio: number | null
  precio_actualizado_en: string | null
  /** La última vez que alguien lo miró y lo dio por bueno. */
  precio_revisado_en: string | null
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
  /** Descuento comercial sobre el subtotal, antes de IVA. */
  descuento_pct: number
  iva_pct: number
  total: number
  /** Viáticos presupuestados: no salen en el PDF, se comparan en la OT. */
  viaticos: number
  linea_calidad: string | null
  /** Términos y condiciones al pie del PDF, tal como se le mandaron a este cliente. */
  terminos: string | null
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
  /** Cantidad de la partida. Se llama m2 por historia; nulo se toma como 1. */
  m2: number | null
  /** Unidad de la cantidad. Nulo o 'm2' = metros cuadrados; 'pza', 'ml'… */
  unidad: string | null
  precio_unitario: number
  importe: number
  producto_id: string | null
  /** Con qué tarifa de la pintura se armó; nulo = precio tecleado a mano. */
  nivel_precio: NivelPrecio | null
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
  materiales_otro: number
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
  /** Tarea de la que cuelga; null si es tarea de primer nivel. */
  padre_id: string | null
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  estatus: EstatusTarea
  responsable_id: string | null
  orden: number
  /** Qué tanto pesa la tarea en el avance global de la obra. */
  peso: number
  /** Avance de la tarea (0-100). En tareas con subtareas es derivado. */
  avance_pct: number
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
  producto_id: string | null
  metodo: MetodoPago
  condicion: CondicionCompra
  foto_ticket_path: string | null
  fecha: string
  ocr_raw: unknown
  /** A qué cuenta por pagar pertenece: los renglones de una factura comparten una. */
  cxp_id: string | null
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
  updated_at: string
  editado_por: string | null
}

export type InsumoKardex = {
  id: string
  producto_id: string
  tipo: TipoMovimiento
  cantidad: number
  fecha: string
  obra_id: string | null
  notas: string | null
  /** Gasto que dio la entrada al inventario, si aplica. */
  gasto_id: string | null
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
  updated_at: string
  editado_por: string | null
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
  /** Qué gasto la abrió. Dato de origen: la liga viva es gastos.cxp_id. */
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
  /** true = la cuadra el sistema con los gastos de la factura; false = capturada a mano. */
  automatica: boolean
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
  updated_at: string
  /** Quién lo corrigió. Nulo mientras nadie lo haya tocado. */
  editado_por: string | null
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
  updated_at: string
  editado_por: string | null
}

/** Un aviso a mandar: el recordatorio pendiente ya cruzado con su teléfono. */
export type AvisoRecordatorio = {
  recordatorio_id: string
  titulo: string
  nota: string | null
  fecha: string
  /** La hora de la cita, si la tiene: va al frente del aviso. */
  hora: string | null
  vencido: boolean
  cotizacion_id: string | null
  obra_id: string | null
  servicio_id: string | null
  suscripcion_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Un teléfono dado de alta para recibir avisos. Uno por aparato, no por persona. */
export type PushSuscripcion = {
  id: string
  profile_id: string
  endpoint: string
  p256dh: string
  auth: string
  agente: string | null
  ultimo_envio: string | null
  created_at: string
}

/** Un pendiente con fecha. Cuelga de una cotización, una obra, un servicio, o de nada. */
export type Recordatorio = {
  id: string
  cotizacion_id: string | null
  obra_id: string | null
  /** La cita del técnico: el primer recordatorio que de verdad usa la hora. */
  servicio_id: string | null
  titulo: string
  nota: string | null
  fecha: string
  /** Sin hora es un pendiente del día; con hora es una cita. */
  hora: string | null
  para: string | null
  atendido_en: string | null
  atendido_por: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
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
  updated_at: string
  editado_por: string | null
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
  /** De cuántos gastos capturados sale su importe. 0 = capturada a mano. */
  gastos: number
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
  /** El día que el cliente resolvió. Nulo mientras no conteste. */
  fecha_resolucion: string | null
  /**
   * El día que cuenta como la venta: el de la aprobación, o el de elaboración
   * en las cotizaciones viejas que no traen resolución.
   */
  fecha_venta: string
  tipo: TipoCotizacion
  estatus: EstatusCotizacion
  requiere_factura: boolean
  nombre_obra: string | null
  subtotal: number
  descuento_pct: number
  descuento: number
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

// ---------------------------------------------------------------------------
// Servicios y reparaciones
// ---------------------------------------------------------------------------

/** Una reparación de portón: la cita, el diagnóstico, el presupuesto y el cobro. */
export type Servicio = {
  id: string
  /** 'S-###'. Serie propia, no se revuelve con las F-### de cotizaciones. */
  folio: string | null
  tipo: TipoServicio
  /** De qué servicio nació. El preventivo cuelga de la reparación anterior. */
  origen_id: string | null
  cliente_id: string
  descripcion: string
  /** Dónde está el portón: puede no ser el domicilio del cliente. */
  domicilio: string | null
  estatus: EstatusServicio
  /** El usuario que va a la visita. */
  tecnico_id: string | null
  fecha_visita: string
  hora_visita: string | null
  diagnostico: string | null
  requiere_factura: boolean
  iva_pct: number
  /** Lo que cuesta ir a ver el portón. Se debe aunque el cliente diga que no. */
  cuota_visita: number
  /** Lo mantiene el trigger de partidas. */
  subtotal: number
  /**
   * Columna generada: lo que se debe hoy, que depende de en qué va. Antes de
   * la visita no se debe nada; después, la cuota; sólo al aprobar, la
   * reparación completa. No se escribe.
   */
  total: number
  vigencia_dias: number
  garantia_dias: number
  fecha_presupuesto: string | null
  /** El sí o el no del cliente. De aquí sale la fecha de venta. */
  fecha_resolucion: string | null
  fecha_reparacion: string | null
  notas: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
}

export type ServicioItem = {
  id: string
  servicio_id: string
  descripcion: string
  cantidad: number
  /** Nulo se lee «pza». */
  unidad: string | null
  precio_unitario: number
  /** Lo pone el trigger: cantidad x precio. */
  importe: number
  orden: number
  created_at: string
}

/** Un cobro de reparación. Sin tipo: no hay anticipo, se cobra al terminar. */
export type ServicioPago = {
  id: string
  servicio_id: string
  monto: number
  metodo: MetodoPago
  fecha: string
  comprobante_path: string | null
  notas: string | null
  registrado_por: string | null
  editado_por: string | null
  created_at: string
  updated_at: string
}

/**
 * El servicio con su dinero ya sumado. Habla el mismo vocabulario que
 * `VCobranza` —cotizado, cobrado, saldo, pct_pendiente— para que los totales
 * del panel se saquen con la misma función y no con una cuenta parecida.
 */
export type VServicio = {
  servicio_id: string
  folio: string | null
  tipo: TipoServicio
  origen_id: string | null
  descripcion: string
  domicilio: string | null
  estatus: EstatusServicio
  fecha_visita: string
  hora_visita: string | null
  diagnostico: string | null
  tecnico_id: string | null
  tecnico: string | null
  cliente_id: string
  cliente: string
  cliente_telefono: string | null
  requiere_factura: boolean
  subtotal: number
  iva_pct: number
  cuota_visita: number
  /** Lo que se le pasó al cliente, se haya aprobado o no. */
  presupuesto: number
  /** Lo que se debe hoy: la visita, y la reparación sólo si la aprobaron. */
  cotizado: number
  cobrado: number
  saldo: number
  ultimo_pago: string | null
  pct_pendiente: number
  /** El mes en que el cliente dijo que sí; antes de eso, el de la visita. */
  fecha_venta: string
  fecha_presupuesto: string | null
  fecha_reparacion: string | null
  vigencia_dias: number
  garantia_dias: number
  notas: string | null
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
  descuento_pct: number
  descuento: number
  cotizado: number
  anticipo_pct: number | null
  anticipo_esperado: number
  anticipo: number
  abonos: number
  liquidacion: number
  cobrado: number
  saldo: number
  /** Fecha del último pago recibido. Nulo si todavía no cobra nada. */
  ultimo_pago: string | null
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
  mano_obra_cotizada: number
  mano_obra: number
  contratos: number
  material_cotizado: number
  material_real: number
  viaticos_cotizados: number
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
  updated_at: string
  editado_por: string | null
  /** Con fecha, el recibo ya no vale: sus abonos se borraron. */
  cancelado_en: string | null
  cancelado_por: string | null
  motivo_cancelacion: string | null
}

// ---------------------------------------------------------------------------
// PRECIOS VIVOS
// ---------------------------------------------------------------------------

/** Lo que se pagó por un material, cuándo y a quién. Nunca se pisa: se acumula. */
export type PrecioMaterial = {
  id: string
  producto_id: string
  proveedor_id: string | null
  fecha: string
  costo: number | null
  iva: number | null
  precio_neto: number
  /** La unidad EN QUE se observó, que no siempre es la del catálogo. */
  unidad: string | null
  origen: OrigenPrecio
  gasto_id: string | null
  folio_factura: string | null
  nota: string | null
  registrado_por: string | null
  created_at: string
}

/** Cómo escribe cada proveedor un producto del catálogo. */
export type ProductoAlias = {
  id: string
  producto_id: string
  texto_norm: string
  veces: number
  origen: string | null
  created_at: string
}

/** Un renglón de factura que no se pudo ligar. Nunca se adivina. */
export type RenglonSinLigar = {
  id: string
  gasto_id: string | null
  texto: string
  texto_norm: string
  precio_neto: number | null
  unidad: string | null
  proveedor_id: string | null
  folio_factura: string | null
  fecha: string
  resuelto: boolean
  producto_id: string | null
  created_at: string
}

/** Un precio que el sistema dedujo y espera visto bueno. */
export type PrecioPropuesto = {
  id: string
  producto_id: string
  proveedor_id: string | null
  observacion_id: string | null
  costo_actual: number | null
  neto_actual: number | null
  costo_nuevo: number | null
  iva_nuevo: number | null
  neto_nuevo: number
  variacion_pct: number | null
  estado: EstatusPropuesta
  motivo: string | null
  resuelta_por: string | null
  resuelta_en: string | null
  created_at: string
}

/** Qué precios conviene preguntar hoy. La arma el cron cada mañana. */
export type RondaPrecio = {
  fecha: string
  producto_id: string
  motivo: string | null
  orden: number
  estado: EstatusRonda
  created_at: string
}

/** Último precio pagado por producto, con su origen y qué tan viejo está. */
export type VPrecioVigente = {
  producto_id: string
  observacion_id: string
  producto: string
  tipo: TipoProducto
  unidad_catalogo: string | null
  costo_catalogo: number | null
  neto_catalogo: number | null
  seguir_precio: boolean
  unidad_observada: string | null
  proveedor_id: string | null
  proveedor: string | null
  proveedor_telefono: string | null
  costo: number | null
  iva: number | null
  precio_neto: number
  fecha: string
  origen: OrigenPrecio
  folio_factura: string | null
  gasto_id: string | null
  nota: string | null
  dias: number
  vigencia: number
  semaforo: 'verde' | 'ambar' | 'rojo'
  unidad_distinta: boolean
}

/** Qué tan viejo está el precio de cada producto y cuánto se cotiza. */
export type VPrecioFrescura = {
  producto_id: string
  nombre: string
  tipo: TipoProducto
  unidad: string
  seguir_precio: boolean
  neto_catalogo: number | null
  ultima_observacion: string | null
  visto_en: string | null
  vigencia: number
  dias: number | null
  usos: number
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
  descuento_pct?: number
  vigencia_dias?: number
  viaticos?: number
  linea_calidad?: string | null
  terminos?: string | null
  notas?: string | null
  fecha?: string
  procesos: { texto_proceso_id?: string | null; contenido: string; orden: number }[]
  items: {
    descripcion: string
    m2?: number | null
    unidad?: string | null
    precio_unitario: number
    producto_id?: string | null
    nivel_precio?: NivelPrecio | null
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
  /** Qué material del catálogo se compró: de ahí sale su precio vigente. */
  producto_id?: string | null
  metodo: MetodoPago
  condicion: CondicionCompra
  foto_ticket_path?: string | null
  fecha: string
  /** Si es material de una obra, crea también el renglón REAL. */
  crear_material?: boolean
  /** Compra para el stock: da entrada al kardex del taller en el mismo movimiento. */
  al_inventario?: boolean
  /** A qué insumo del catálogo entra. Sin él se da de alta con el nombre. */
  inventario_producto_id?: string | null
  /** Cuánto entra. Sin él entran las piezas del gasto. */
  inventario_cantidad?: number | null
  /** Nombre del insumo nuevo. Sin él se usa la descripción del gasto. */
  inventario_nombre?: string | null
  inventario_unidad?: string | null
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

/** Una factura del lote que se va a pagar de un jalón. */
export type PagoCxpLote = { id: string; monto: number }

/** Resumen del pago en lote, para confirmárselo a quien lo hizo. */
export type ResultadoPagoLote = {
  proveedor: string
  facturas: number
  pagado: number
  liquidadas: number
  /** Lo que se le sigue debiendo a ese proveedor después del pago. */
  saldo_restante: number
}

/** Lo que deshizo `reabrir_obra`, para poder confirmárselo a quien la reabrió. */
export type ResultadoReapertura = {
  reabierta: true
  contratos_reactivados: number
  cotizacion_reabierta: boolean
  /** Los pagarés que canceló el cierre y que NO se reactivan. */
  pagares_cancelados: number
}

/** El corte que hizo `reasignar_contrato` al pasarle la obra a otro oficial. */
export type ResultadoReasignacion = {
  contrato_anterior: string
  contrato_nuevo: string
  sale: string
  entra: string
  m2_corte: number
  m2_nuevo: number
  total_anterior: number
  /** Lo que queda valiendo el contrato del que se va, ya cortado. */
  total_cerrado: number
  total_nuevo: number
  pagado: number
  pagares_cancelados: number
}

/** Lo que se llevó `eliminar_obra`, para poder contárselo a quien la borró. */
export type ResultadoBorradoObra = {
  ot_numero: string | null
  nombre: string
  conceptos: number
  tareas: number
  materiales: number
  avances: number
  contratos: number
  polizas: number
  solicitudes: number
  herramientas_devueltas: number
  cotizacion_id: string
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
      ajustes: Tabla<Ajuste>
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
      recordatorios: Tabla<Recordatorio>
      servicios: Tabla<Servicio>
      servicio_items: Tabla<ServicioItem>
      servicio_pagos: Tabla<ServicioPago>
      push_suscripciones: Tabla<PushSuscripcion>
      consecutivos: Tabla<Consecutivo>
      recibos: Tabla<Recibo>
      recibos_nomina: Tabla<ReciboNomina>
      obra_detalles: Tabla<ObraDetalle>
      bitacora_obra: Tabla<BitacoraObra>
      precios_material: Tabla<PrecioMaterial>
      producto_alias: Tabla<ProductoAlias>
      renglones_sin_ligar: Tabla<RenglonSinLigar>
      precios_propuestos: Tabla<PrecioPropuesto>
      ronda_precios: Tabla<RondaPrecio>
    }
    Views: {
      v_precios_vigentes: Vista<VPrecioVigente>
      v_precios_frescura: Vista<VPrecioFrescura>
      v_cotizaciones: Vista<VCotizacion>
      v_gastos: Vista<VGasto>
      v_insumos_existencia: Vista<VInsumoExistencia>
      v_cuentas_por_pagar: Vista<VCuentaPorPagar>
      v_cxp_por_proveedor: Vista<VCxpPorProveedor>
      v_cobranza: Vista<VCobranza>
      v_servicios: Vista<VServicio>
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
      editar_pagare: {
        Args: { p_pagare: string; p_herramientas: string[] }
        Returns: number
      }
      cancelar_pagare: { Args: { p_pagare: string }; Returns: number }
      entregar_obra: { Args: { p_obra: string; p_fecha: string }; Returns: undefined }
      cerrar_obra: {
        Args: { p_obra: string; p_fecha: string; p_forzar: boolean }
        Returns: ResultadoCierre
      }
      reabrir_obra: {
        Args: { p_obra: string; p_motivo: string }
        Returns: ResultadoReapertura
      }
      reasignar_contrato: {
        Args: {
          p_contrato: string
          p_nuevo_trabajador: string
          p_fecha: string
          p_m2_ejecutados: number | null
          p_motivo: string | null
        }
        Returns: ResultadoReasignacion
      }
      eliminar_obra: { Args: { p_obra: string }; Returns: ResultadoBorradoObra }
      registrar_gasto: { Args: { p_datos: GastoSql }; Returns: string }
      editar_gasto: { Args: { p_gasto: string; p_datos: GastoSql }; Returns: string }
      eliminar_gasto: { Args: { p_gasto: string }; Returns: undefined }
      eliminar_material_obra: { Args: { p_material: string }; Returns: undefined }
      entrada_inventario_desde_gasto: {
        Args: {
          p_gasto: string
          p_cantidad: number
          p_producto?: string | null
          p_nombre?: string | null
          p_unidad?: string | null
        }
        Returns: string
      }
      recalcular_avance_obra: { Args: { p_obra: string }; Returns: undefined }
      abonar_cxp: {
        Args: { p_id: string; p_monto: number; p_fecha: string }
        Returns: { pagado: number; saldo: number; liquidada: boolean }
      }
      abonar_cxp_lote: {
        Args: { p_pagos: PagoCxpLote[]; p_fecha: string }
        Returns: ResultadoPagoLote
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
      editar_recibo_nomina: {
        Args: {
          p_recibo: string
          p_fecha: string
          p_metodo: MetodoPago
          p_pagos: { contrato_id: string; monto: number; porcentaje: number | null }[]
          p_notas: string | null
        }
        Returns: undefined
      }
      cancelar_recibo_nomina: {
        Args: { p_recibo: string; p_motivo: string | null }
        Returns: undefined
      }
      generar_quincena: { Args: { p_quincena: string }; Returns: number }
      registrar_precio: {
        Args: {
          p_producto: string
          p_proveedor: string | null
          p_neto: number
          p_origen: OrigenPrecio
          p_unidad: string | null
          p_nota: string | null
          p_aprobar: boolean
        }
        Returns: string
      }
      agregar_a_ronda: { Args: { p_producto: string }; Returns: undefined }
      ligar_renglon: {
        Args: { p_renglon: string; p_producto: string | null }
        Returns: string | null
      }
      aceptar_propuesta_precio: { Args: { p_id: string }; Returns: string }
      rechazar_propuesta_precio: {
        Args: { p_id: string; p_motivo: string | null }
        Returns: string
      }
      ronda_precios_del_dia: { Args: { p_fecha: string | null }; Returns: number }
      observar_precios_de_gasto: { Args: { p_gasto: string }; Returns: string | null }
      /* Sólo para el cron: `service_role` no lee las tablas de este esquema. */
      avisos_de_recordatorios: { Args: Record<string, never>; Returns: AvisoRecordatorio[] }
      olvidar_suscripciones: { Args: { p_ids: string[] }; Returns: number }
      marcar_envio_push: { Args: { p_ids: string[] }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
