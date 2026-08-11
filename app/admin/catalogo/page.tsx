import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos } from '@/lib/format'
import { NIVELES_PRECIO, precioPorNivel, tieneTarifas } from '@/lib/cotizaciones'
import { EncabezadoPagina, EstadoVacio, Etiqueta, Tabla, Tarjeta, Td, Th } from '@/components/ui'
import { BuscadorTabla } from '@/components/buscador'
import { FilaLista } from '@/components/movil/piezas'
import {
  BotonEditarProducto, BotonEditarProveedor, BotonEditarTexto, BotonMovimiento,
  BotonNuevoProducto, BotonNuevoProveedor, BotonNuevoTexto,
} from '@/components/catalogos/formularios-catalogo'
import type { Proveedor } from '@/types/database'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'productos', titulo: 'Pinturas y materiales' },
  { clave: 'insumos', titulo: 'Insumos de taller' },
  { clave: 'proveedores', titulo: 'Proveedores' },
  { clave: 'textos', titulo: 'Textos de proceso' },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; q?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { t, q } = await searchParams
  const activa = (PESTANAS.find((p) => p.clave === t)?.clave ?? 'productos') as Pestana
  const busqueda = (q ?? '').trim().toLowerCase()

  const supabase = await crearClienteServidor()
  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre')

  const listaProveedores = proveedores ?? []

  return (
    <>
      <EncabezadoPagina
        titulo="Catálogo"
        descripcion="La materia prima de las cotizaciones: qué se aplica, con qué producto, a qué costo y a quién se le compra."
        acciones={<AccionDePestana pestana={activa} proveedores={listaProveedores} />}
      />

      <nav className="mb-5 flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/admin/catalogo?t=${p.clave}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activa === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {activa !== 'textos' && (
        <div className="mb-4">
          <BuscadorTabla
            marcador={
              activa === 'proveedores'
                ? 'Buscar proveedor…'
                : 'Buscar por nombre, código o proveedor…'
            }
          />
        </div>
      )}

      {activa === 'productos' && (
        <TablaProductos proveedores={listaProveedores} busqueda={busqueda} />
      )}
      {activa === 'insumos' && <TablaInsumos proveedores={listaProveedores} busqueda={busqueda} />}
      {activa === 'proveedores' && (
        <TablaProveedores
          proveedores={listaProveedores.filter(
            (p) =>
              !busqueda ||
              `${p.nombre} ${p.contacto ?? ''} ${p.telefono ?? ''}`.toLowerCase().includes(busqueda),
          )}
        />
      )}
      {activa === 'textos' && <TablaTextos />}
    </>
  )
}

function AccionDePestana({ pestana, proveedores }: { pestana: Pestana; proveedores: Proveedor[] }) {
  if (pestana === 'proveedores') return <BotonNuevoProveedor />
  if (pestana === 'textos') return <BotonNuevoTexto />
  return <BotonNuevoProducto proveedores={proveedores} esInsumo={pestana === 'insumos'} />
}

// ---------------------------------------------------------------------------
async function TablaProductos({
  proveedores, busqueda,
}: {
  proveedores: Proveedor[]
  busqueda: string
}) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('productos')
    .select('*')
    .neq('tipo', 'insumo_taller')
    .order('tipo')
    .order('nombre')

  const nombreProveedor = new Map(proveedores.map((p) => [p.id, p.nombre]))
  const filas = (data ?? []).filter(
    (p) =>
      !busqueda ||
      `${p.nombre} ${p.codigo ?? ''} ${(p.proveedor_id && nombreProveedor.get(p.proveedor_id)) ?? ''}`
        .toLowerCase()
        .includes(busqueda),
  )
  const tipoProducto = (t: string) =>
    t === 'pintura' ? 'Pintura' : t === 'herreria' ? 'Herrería' : 'Otro'

  return (
    <>
      {/* Teléfono: el producto y su costo; el resto, al abrirlo ---------- */}
      {filas.length > 0 && (
        <Tarjeta className="lg:hidden" pie={`${filas.length} productos`}>
          {filas.map((p) => (
            <FilaLista
              key={p.id}
              principal={
                <>
                  {p.nombre}
                  {!p.activo && <span className="text-tinta-400"> · inactivo</span>}
                </>
              }
              secundario={[p.codigo, tipoProducto(p.tipo), p.unidad, p.proveedor_id && nombreProveedor.get(p.proveedor_id)]
                .filter(Boolean)
                .join(' · ')}
              derecha={
                <span className="text-sm font-semibold tabular-nums">
                  {p.costo > 0 ? pesos(p.costo) : '—'}
                </span>
              }
              accion={<BotonEditarProducto producto={p} proveedores={proveedores} />}
            />
          ))}
        </Tarjeta>
      )}

    <Tarjeta className={filas.length > 0 ? 'hidden lg:block' : ''} pie={`${filas.length} productos`}>
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin productos" descripcion="Carga el catálogo con npm run bd:seed o da de alta el primero." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Producto</Th>
              <Th>Tipo</Th>
              <Th>Unidad</Th>
              <Th numerico>Costo</Th>
              <Th numerico>Venta $/m²</Th>
              <Th>Proveedor</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id} className="hover:bg-tinta-50/60">
                <Td className="font-mono text-xs font-medium text-tinta-900">{p.codigo ?? '—'}</Td>
                <Td>
                  <span className="flex items-center gap-2">
                    {p.nombre}
                    {!p.activo && <Etiqueta tono="gris">Inactivo</Etiqueta>}
                  </span>
                </Td>
                <Td>
                  <Etiqueta tono={p.tipo === 'pintura' ? 'verde' : p.tipo === 'herreria' ? 'azul' : 'gris'}>
                    {p.tipo === 'pintura' ? 'Pintura' : p.tipo === 'herreria' ? 'Herrería' : 'Otro'}
                  </Etiqueta>
                </Td>
                <Td className="text-tinta-500">{p.unidad}</Td>
                <Td numerico>{p.costo > 0 ? pesos(p.costo) : '—'}</Td>
                {/* Las tres tarifas de venta, que no tienen que ver con lo que
                    cuesta comprarla: público · especial · súper. */}
                <Td numerico className="whitespace-nowrap text-tinta-500">
                  {tieneTarifas(p)
                    ? NIVELES_PRECIO.map((n) => {
                        const monto = precioPorNivel(p, n.valor)
                        return monto == null ? '—' : pesos(monto)
                      }).join(' · ')
                    : '—'}
                </Td>
                <Td className="text-tinta-500">
                  {(p.proveedor_id && nombreProveedor.get(p.proveedor_id)) || '—'}
                </Td>
                <Td className="w-10">
                  <BotonEditarProducto producto={p} proveedores={proveedores} />
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

// ---------------------------------------------------------------------------
async function TablaInsumos({
  proveedores, busqueda,
}: {
  proveedores: Proveedor[]
  busqueda: string
}) {
  const supabase = await crearClienteServidor()
  const [{ data }, { data: productos }] = await Promise.all([
    supabase.from('v_insumos_existencia').select('*').order('nombre'),
    // Sin filtrar por tipo: la existencia ahora es la del kardex, así que en el
    // taller puede haber material que el catálogo tenga como pintura u otro, y
    // esos renglones también necesitan su botón de editar.
    supabase.from('productos').select('*'),
  ])

  const filas = (data ?? []).filter(
    (i) => !busqueda || `${i.nombre} ${i.codigo ?? ''}`.toLowerCase().includes(busqueda),
  )
  const porId = new Map((productos ?? []).map((p) => [p.id, p]))

  return (
    <>
      {/* Teléfono: lo que se pregunta en el taller es cuánto queda ------- */}
      {filas.length > 0 && (
        <Tarjeta className="lg:hidden" pie="La existencia sale del kardex: cada salida a obra la descuenta.">
          {filas.map((i) => {
            const bajo = Number(i.existencia) <= 2
            return (
              <FilaLista
                key={i.producto_id}
                principal={i.nombre}
                secundario={`${i.codigo ?? '—'} · ${pesos(i.precio_neto)} neto · ${fecha(i.ultimo_movimiento)}`}
                derecha={
                  <span
                    className={`text-sm font-semibold tabular-nums ${bajo ? 'text-red-600' : ''}`}
                  >
                    {Number(i.existencia)} {i.unidad}
                  </span>
                }
                accion={
                  <span className="flex items-center">
                    <BotonMovimiento
                      producto={{ producto_id: i.producto_id, nombre: i.nombre, unidad: i.unidad }}
                      tipo="entrada"
                    />
                    <BotonMovimiento
                      producto={{ producto_id: i.producto_id, nombre: i.nombre, unidad: i.unidad }}
                      tipo="salida"
                    />
                  </span>
                }
              />
            )
          })}
        </Tarjeta>
      )}

    <Tarjeta
      className={filas.length > 0 ? 'hidden lg:block' : ''}
      pie="La existencia sale del kardex: cada salida a obra la descuenta y se marca con folio «TALLER»."
    >
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin insumos" descripcion="Carga el kardex con npm run bd:seed o da de alta el primero." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Insumo</Th>
              <Th numerico>Existencia</Th>
              <Th numerico>Costo</Th>
              <Th numerico>IVA</Th>
              <Th numerico>Precio neto</Th>
              <Th>Último mov.</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((i) => {
              const bajo = Number(i.existencia) <= 2
              const producto = porId.get(i.producto_id)
              return (
                <tr key={i.producto_id} className="hover:bg-tinta-50/60">
                  <Td className="font-mono text-xs font-medium text-tinta-900">{i.codigo ?? '—'}</Td>
                  <Td>{i.nombre}</Td>
                  <Td numerico className={bajo ? 'font-semibold text-red-600' : ''}>
                    {Number(i.existencia)} {i.unidad}
                  </Td>
                  <Td numerico>{pesos(i.costo)}</Td>
                  <Td numerico className="text-tinta-500">{pesos(i.iva)}</Td>
                  <Td numerico className="font-medium">{pesos(i.precio_neto)}</Td>
                  <Td className="text-tinta-500">{fecha(i.ultimo_movimiento)}</Td>
                  <Td className="w-24">
                    <div className="flex items-center justify-end gap-0.5">
                      <BotonMovimiento
                        producto={{ producto_id: i.producto_id, nombre: i.nombre, unidad: i.unidad }}
                        tipo="entrada"
                      />
                      <BotonMovimiento
                        producto={{ producto_id: i.producto_id, nombre: i.nombre, unidad: i.unidad }}
                        tipo="salida"
                      />
                      {producto && (
                        // esInsumo fuerza el tipo a «insumo de taller» al guardar:
                        // sólo va cuando ya lo es, o editar desde aquí una pintura
                        // con existencia la sacaría del cotizador sin avisar.
                        <BotonEditarProducto
                          producto={producto}
                          proveedores={proveedores}
                          esInsumo={producto.tipo === 'insumo_taller'}
                        />
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
    </>
  )
}

// ---------------------------------------------------------------------------
function TablaProveedores({ proveedores }: { proveedores: Proveedor[] }) {
  return (
    <>
      {/* Teléfono: a quién se le compra y en qué términos ---------------- */}
      {proveedores.length > 0 && (
        <Tarjeta className="lg:hidden">
          {proveedores.map((p) => (
            <FilaLista
              key={p.id}
              principal={
                <>
                  {p.nombre}
                  {!p.activo && <span className="text-tinta-400"> · inactivo</span>}
                </>
              }
              secundario={p.contacto ?? p.telefono ?? p.notas ?? '—'}
              derecha={
                <span className="text-[11.5px] text-tinta-500">
                  {p.dias_credito_default > 0 ? `${p.dias_credito_default} días` : 'Contado'}
                </span>
              }
              accion={<BotonEditarProveedor proveedor={p} />}
            />
          ))}
        </Tarjeta>
      )}

    <Tarjeta
      className={proveedores.length > 0 ? 'hidden lg:block' : ''}
      pie="Los días de crédito se copian automáticamente a la cuenta por pagar cuando un gasto se registra a crédito."
    >
      {proveedores.length === 0 ? (
        <EstadoVacio titulo="Sin proveedores" descripcion="Da de alta el primero para poder registrar compras." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Proveedor</Th>
              <Th numerico>Días de crédito</Th>
              <Th>Contacto</Th>
              <Th>Notas</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id} className="hover:bg-tinta-50/60">
                <Td className="font-medium text-tinta-900">
                  <span className="flex items-center gap-2">
                    {p.nombre}
                    {!p.activo && <Etiqueta tono="gris">Inactivo</Etiqueta>}
                  </span>
                </Td>
                <Td numerico>
                  {p.dias_credito_default > 0 ? `${p.dias_credito_default} días` : 'Contado'}
                </Td>
                <Td className="text-tinta-500">{p.contacto ?? p.telefono ?? '—'}</Td>
                <Td className="text-tinta-500">{p.notas ?? '—'}</Td>
                <Td className="w-10">
                  <BotonEditarProveedor proveedor={p} />
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

// ---------------------------------------------------------------------------
async function TablaTextos() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('textos_proceso').select('*').order('orden')
  const filas = data ?? []

  return (
    <Tarjeta pie="Estos bullets se seleccionan por cotización y se imprimen en «Descripción del trabajo». {PRODUCTO} se sustituye por la pintura elegida.">
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin textos" descripcion="Carga la biblioteca con npm run bd:seed o escribe el primero." />
      ) : (
        <ul className="divide-y divide-tinta-100">
          {filas.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-tinta-900">{t.titulo}</span>
                  {!t.activo && <Etiqueta>Inactivo</Etiqueta>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-tinta-600">{t.contenido}</p>
              </div>
              <BotonEditarTexto texto={t} />
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}
