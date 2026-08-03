import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { pesos } from '@/lib/format'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
  type TonoEtiqueta,
} from '@/components/ui'
import { BuscadorTabla } from '@/components/buscador'
import { FilaLista } from '@/components/movil/piezas'
import { BotonEditarHerramienta, BotonNuevaHerramienta } from '@/components/catalogos/formularios-catalogo'
import type { EstadoHerramienta } from '@/types/database'

export const dynamic = 'force-dynamic'

const ESTADO: Record<EstadoHerramienta, { texto: string; tono: TonoEtiqueta }> = {
  disponible: { texto: 'Disponible', tono: 'verde' },
  en_obra: { texto: 'En obra', tono: 'azul' },
  fuera_servicio: { texto: 'Fuera de servicio', tono: 'rojo' },
}

const FILTROS = [
  { clave: '', titulo: 'Todas' },
  { clave: 'disponible', titulo: 'Disponibles' },
  { clave: 'en_obra', titulo: 'En obra' },
  { clave: 'fuera_servicio', titulo: 'Fuera de servicio' },
] as const

export default async function PaginaHerramientas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { q, estado } = await searchParams
  const supabase = await crearClienteServidor()

  const { data: todas, error } = await supabase.from('herramientas').select('*').order('codigo')
  const inventario = todas ?? []

  const filas = inventario.filter((h) => {
    if (estado && h.estado !== estado) return false
    if (q?.trim()) {
      const texto = `${h.codigo} ${h.nombre} ${h.marca ?? ''} ${h.ubicacion}`.toLowerCase()
      if (!texto.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  const valorTotal = inventario.reduce((s, h) => s + Number(h.valor ?? 0), 0)
  const enObra = inventario.filter((h) => h.estado === 'en_obra')
  const valorEnObra = enObra.reduce((s, h) => s + Number(h.valor ?? 0), 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Herramientas"
        descripcion="Inventario que alimenta los pagarés. Al prestar una herramienta pasa a «En obra» con el oficial; al devolverla regresa al taller."
        acciones={<BotonNuevaHerramienta />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Piezas" valor={String(inventario.length)} />
        <Indicador etiqueta="Valor del inventario" valor={pesos(valorTotal)} />
        <Indicador etiqueta="En obra" valor={String(enObra.length)} nota={pesos(valorEnObra)} tono="verde" />
        <Indicador
          etiqueta="Fuera de servicio"
          valor={String(inventario.filter((h) => h.estado === 'fuera_servicio').length)}
          tono="rojo"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BuscadorTabla marcador="Buscar por código, nombre o quién la trae…" />
        <nav className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const activo = (estado ?? '') === f.clave
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (f.clave) params.set('estado', f.clave)
            return (
              <Link
                key={f.titulo}
                href={`/admin/herramientas${params.toString() ? `?${params}` : ''}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activo
                    ? 'bg-haaco-700 text-white'
                    : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
                }`}
              >
                {f.titulo}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Teléfono: qué pieza es, dónde anda y cómo está ------------------- */}
      {filas.length > 0 && (
        <Tarjeta className="lg:hidden" pie={`${filas.length} de ${inventario.length} herramientas`}>
          {filas.map((h) => (
            <FilaLista
              key={h.id}
              principal={h.nombre}
              secundario={[h.codigo, h.marca, h.ubicacion].filter(Boolean).join(' · ')}
              derecha={
                <>
                  <Etiqueta tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Etiqueta>
                  {h.valor != null && (
                    <span className="text-[11.5px] tabular-nums text-tinta-400">{pesos(h.valor)}</span>
                  )}
                </>
              }
              accion={<BotonEditarHerramienta herramienta={h} />}
            />
          ))}
        </Tarjeta>
      )}

      <Tarjeta
        className={filas.length > 0 ? 'hidden lg:block' : ''}
        pie={`${filas.length} de ${inventario.length} herramientas · valor total ${pesos(valorTotal)}`}
      >
        {error ? (
          <EstadoVacio
            titulo="No se pudo leer el inventario"
            descripcion="Revisa que las migraciones estén aplicadas y que tu usuario tenga rol de Dirección o Administración."
          />
        ) : filas.length === 0 ? (
          <EstadoVacio
            titulo={inventario.length === 0 ? 'Todavía no hay herramientas' : 'Ninguna coincide con el filtro'}
            descripcion={
              inventario.length === 0
                ? 'Carga el catálogo inicial con npm run bd:seed para traer las 57 piezas del control actual.'
                : 'Prueba con otro texto o quita el filtro de estado.'
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Herramienta</Th>
                <Th>Marca</Th>
                <Th numerico>Valor</Th>
                <Th>Estado</Th>
                <Th>Ubicación</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((h) => (
                <tr key={h.id} className="hover:bg-tinta-50/60">
                  <Td className="font-mono text-xs font-medium text-tinta-900">{h.codigo}</Td>
                  <Td>{h.nombre}</Td>
                  <Td className="text-tinta-500">{h.marca ?? '—'}</Td>
                  <Td numerico>{h.valor == null ? '—' : pesos(h.valor)}</Td>
                  <Td>
                    <Etiqueta tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Etiqueta>
                  </Td>
                  <Td className="text-tinta-500">{h.ubicacion}</Td>
                  <Td className="w-10">
                    <BotonEditarHerramienta herramienta={h} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
