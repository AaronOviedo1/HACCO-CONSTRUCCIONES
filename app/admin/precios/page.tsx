import Link from 'next/link'
import { requerirRol } from '@/lib/auth'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { antiguedad, COLOR_SEMAFORO, procedencia } from '@/lib/precios'
import {
  EncabezadoPagina, EstadoVacio, Tabla, Tarjeta, TarjetaPlegable, Td, Th,
} from '@/components/ui'
import { RondaHoy } from '@/components/precios/ronda-hoy'
import { SinLigar } from '@/components/precios/sin-ligar'
import { BandejaPropuestas } from '@/components/precios/bandeja-propuestas'
import { PegarLista } from '@/components/precios/pegar-lista'
import { BotonCorrerRonda } from '@/components/precios/boton-correr-ronda'
import { cargarPrecios } from './datos'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'hoy', titulo: 'Preguntar hoy' },
  { clave: 'propuestas', titulo: 'Por revisar' },
  { clave: 'todos', titulo: 'Todos los precios' },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

export default async function PaginaPrecios({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const perfil = await requerirRol(['admin', 'administracion'])
  const { t } = await searchParams
  const activa = (PESTANAS.find((p) => p.clave === t)?.clave ?? 'hoy') as Pestana

  const { ronda, sinLigar, propuestas, productos, proveedores, vigentes } = await cargarPrecios()

  const porPreguntar = ronda.filter((f) => f.estado === 'pendiente').length
  const cuenta: Record<Pestana, number> = {
    hoy: porPreguntar,
    propuestas: propuestas.length,
    todos: vigentes.length,
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Precios"
        descripcion="Lo que se pagó por cada material, con su factura y su fecha. El sistema no dice a cómo está hoy: dice a cómo se pagó la última vez y hace cuánto."
        acciones={perfil.rol === 'admin' ? <BotonCorrerRonda /> : undefined}
      />

      <nav className="mb-5 flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/admin/precios?t=${p.clave}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activa === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
            {cuenta[p.clave] > 0 && (
              <span className={activa === p.clave ? 'ml-1.5 opacity-70' : 'ml-1.5 text-tinta-400'}>
                {cuenta[p.clave]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {activa === 'hoy' && (
        <div className="space-y-5">
          <Tarjeta
            titulo="Preguntar hoy"
            pie="La lista se arma sola cada mañana con lo que más se cotiza y lleva más tiempo sin precio. Al teclear lo que te dicten, el catálogo se actualiza y ese material deja de aparecer."
          >
            <div className="px-5 py-5">
              <RondaHoy filas={ronda} proveedores={proveedores} />
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Pegar la lista del proveedor"
            pie="Si el vendedor manda su lista por WhatsApp, pégala aquí o sube la foto: se lee sola y tú confirmas qué material es cada renglón."
          >
            <div className="px-5 py-5">
              <PegarLista productos={productos} />
            </div>
          </Tarjeta>

          {sinLigar.length > 0 && (
            <TarjetaPlegable
              titulo="Sin reconocer"
              resumen={`${sinLigar.length} ${sinLigar.length === 1 ? 'renglón' : 'renglones'} de factura sin material`}
              pie="Al decir una sola vez qué material es, ese texto queda aprendido y no vuelve a preguntar. La lista encoge cada semana."
            >
              <div className="px-5 py-5">
                <SinLigar renglones={sinLigar} productos={productos} />
              </div>
            </TarjetaPlegable>
          )}

        </div>
      )}

      {activa === 'propuestas' && (
        <Tarjeta
          titulo="Por revisar"
          pie="Precios que salieron de una factura y no cuadran con el catálogo. Nada se actualiza solo: aquí decides."
        >
          <div className="px-5 py-5">
            <BandejaPropuestas propuestas={propuestas} />
          </div>
        </Tarjeta>
      )}

      {activa === 'todos' && (
        <Tarjeta>
          {vigentes.length === 0 ? (
            <EstadoVacio
              titulo="Todavía no hay precios registrados"
              descripcion="Se van llenando solos conforme se capturan las facturas de compra: cada una deja el precio de lo que trae."
            />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Material</Th>
                  <Th numerico>Último precio</Th>
                  <Th>De dónde</Th>
                  <Th>Hace</Th>
                </tr>
              </thead>
              <tbody>
                {vigentes.map((p) => (
                  <tr key={p.producto_id} className="border-t border-tinta-100">
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_SEMAFORO[p.semaforo]}`} />
                        {p.producto}
                      </span>
                    </Td>
                    <Td numerico>
                      {pesos(p.precio_neto)}
                      <span className="ml-1 text-xs text-tinta-400">
                        por {p.unidad_observada ?? p.unidad_catalogo}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-tinta-500">{procedencia(p)}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-tinta-500" title={formatoFecha(p.fecha)}>
                        {antiguedad(p.dias)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      )}
    </>
  )
}
