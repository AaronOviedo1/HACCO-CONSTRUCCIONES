/**
 * Datos de HAACO PRO que aparecen en cotizaciones, recibos, contratos,
 * pagarés y pólizas. Se pueden sobreescribir por entorno.
 */
export const EMPRESA = {
  nombre: process.env.NEXT_PUBLIC_EMPRESA_NOMBRE ?? 'HAACO PRO RECUBRIMIENTOS',
  marca: 'HaacoPro',
  director: process.env.NEXT_PUBLIC_EMPRESA_DIRECTOR ?? 'Lic. Luis Enrique Inda Franco',
  ciudad: process.env.NEXT_PUBLIC_EMPRESA_CIUDAD ?? 'Hermosillo, Sonora',
  telefono: process.env.NEXT_PUBLIC_EMPRESA_TELEFONO ?? '',
  correo: process.env.NEXT_PUBLIC_EMPRESA_CORREO ?? '',
} as const

/** Reglas de negocio con valor por defecto, todas editables por documento. */
export const REGLAS = {
  ivaPct: 16,
  anticipoPinturaPct: 50,
  anticipoHerreriaPct: 60,
  costoHaacoPct: 5,
  gastosIndirectosPct: 5,
  utilidadHerreriaPct: 35,
  vigenciaCotizacionDias: 30,
  garantiaDias: 365,
  interesOrdinarioPagarePct: 10,
  interesMoratorioPagarePct: 20,
} as const
