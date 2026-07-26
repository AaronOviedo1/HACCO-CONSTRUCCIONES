import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { cargarObra } from '../datos'
import { EncabezadoObra } from '@/components/obras/encabezado'
import { PanelResumen } from '@/components/obras/resumen'
import { PanelContratos } from '@/components/obras/contratos'
import { PanelAvances } from '@/components/obras/avances'
import { PanelMateriales } from '@/components/obras/materiales'
import { PanelConceptos } from '@/components/obras/conceptos'
import { PanelCronograma } from '@/components/obras/cronograma'
import { PanelDocumentos } from '@/components/obras/documentos'
import { PanelCierre } from '@/components/obras/cierre'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'resumen', titulo: 'Resumen' },
  { clave: 'contratos', titulo: 'Contratos' },
  { clave: 'avances', titulo: 'Avances' },
  { clave: 'materiales', titulo: 'Materiales' },
  { clave: 'conceptos', titulo: 'Conceptos' },
  { clave: 'cronograma', titulo: 'Cronograma' },
  { clave: 'documentos', titulo: 'Documentos' },
  { clave: 'cierre', titulo: 'Cierre' },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

export default async function PaginaObra({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const { t } = await searchParams
  const activa = (PESTANAS.find((p) => p.clave === t)?.clave ?? 'resumen') as Pestana

  const datos = await cargarObra(id)

  const pendientes = {
    contratos: datos.contratos.length,
    avances: datos.avances.length,
    materiales: datos.materiales.length,
    conceptos: datos.conceptos.length,
    cronograma: datos.tareas.filter((x) => x.estatus !== 'terminada').length,
    documentos: datos.recibos.length + datos.pagares.length + (datos.poliza ? 1 : 0),
    cierre: datos.detalles.filter((d) => !d.atendido).length,
    resumen: 0,
  } as const

  return (
    <>
      <EncabezadoObra concentrado={datos.concentrado} obra={datos.obra} cobranza={datos.cobranza} />

      <nav className="mb-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1.5 border-b border-tinta-200 pb-px">
          {PESTANAS.map((p) => {
            const es = activa === p.clave
            const n = pendientes[p.clave]
            return (
              <Link
                key={p.clave}
                href={`/admin/obras/${id}?t=${p.clave}`}
                className={`relative rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  es
                    ? 'border-b-2 border-haaco-600 text-haaco-800'
                    : 'border-b-2 border-transparent text-tinta-500 hover:text-tinta-800'
                }`}
              >
                {p.titulo}
                {n > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      p.clave === 'cierre'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-tinta-100 text-tinta-500'
                    }`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {activa === 'resumen' && <PanelResumen datos={datos} />}
      {activa === 'contratos' && <PanelContratos datos={datos} />}
      {activa === 'avances' && <PanelAvances datos={datos} />}
      {activa === 'materiales' && <PanelMateriales datos={datos} />}
      {activa === 'conceptos' && <PanelConceptos datos={datos} />}
      {activa === 'cronograma' && <PanelCronograma datos={datos} />}
      {activa === 'documentos' && <PanelDocumentos datos={datos} />}
      {activa === 'cierre' && <PanelCierre datos={datos} />}
    </>
  )
}
