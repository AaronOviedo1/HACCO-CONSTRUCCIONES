import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { cargarEstadoDeCuenta } from '@/lib/estado-de-cuenta'
import { DocumentoEstadoCuenta } from '@/components/documentos/documentos-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** El estado de cuenta de un cliente: todas sus obras con saldo, en un PDF. */
export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params

  const datos = await cargarEstadoDeCuenta(id)
  if (!datos) return new Response('Cliente no encontrado', { status: 404 })
  if (datos.cuentas.length === 0) {
    return new Response('Este cliente no tiene obras pendientes de cobro.', { status: 404 })
  }

  return responderPdf(
    DocumentoEstadoCuenta,
    { datos },
    `Estado de cuenta ${datos.cliente} ${datos.fecha}.pdf`,
    peticion,
  )
}
