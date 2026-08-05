import { crearClienteServidor } from '@/lib/supabase/server'
import { NOMBRE_ROL, requerirRol } from '@/lib/auth'
import { fecha } from '@/lib/format'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Tabla, Tarjeta, Td, Th, type TonoEtiqueta,
} from '@/components/ui'
import { ChipsFiltro, FilaLista } from '@/components/movil/piezas'
import { BuscadorTabla } from '@/components/buscador'
import {
  BotonEditarTrabajador, FilaTrabajadorMovil,
} from '@/components/usuarios/formulario-trabajador'
import type { RolUsuario } from '@/types/database'

export const dynamic = 'force-dynamic'

const TONO_ROL: Record<RolUsuario, TonoEtiqueta> = {
  admin: 'verde',
  administracion: 'azul',
  cuadrilla: 'gris',
  contador: 'ambar',
}

const FILTROS = [
  { clave: 'activos', titulo: 'Activos' },
  { clave: 'baja', titulo: 'De baja' },
  { clave: 'todos', titulo: 'Todos' },
] as const

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  await requerirRol(['admin'])
  const { q, estado } = await searchParams
  const filtro = FILTROS.find((f) => f.clave === estado)?.clave ?? 'activos'
  const busqueda = (q ?? '').trim().toLowerCase()

  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('profiles').select('*').order('rol').order('nombre')
  const todos = data ?? []

  const filas = todos
    .filter((u) => (filtro === 'todos' ? true : filtro === 'activos' ? u.activo : !u.activo))
    .filter((u) =>
      busqueda
        ? [u.nombre, u.correo ?? '', u.telefono ?? '', u.oficio ?? '']
            .join(' ')
            .toLowerCase()
            .includes(busqueda)
        : true,
    )

  const enlace = (clave: string) =>
    `/admin/usuarios?estado=${clave}${busqueda ? `&q=${encodeURIComponent(q ?? '')}` : ''}`

  const conteos = {
    activos: todos.filter((u) => u.activo).length,
    baja: todos.filter((u) => !u.activo).length,
    todos: todos.length,
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="No hay registro público: las cuentas las crea Dirección. Cada rol ve exactamente lo que le toca."
      />

      <div className="mb-3.5 flex items-center gap-2 lg:mb-4">
        <BuscadorTabla
          marcador="Nombre, correo u oficio…"
          className="min-w-0 flex-1 lg:flex-none"
        />
        <ChipsFiltro
          className="shrink-0"
          opciones={FILTROS.map((f) => ({
            titulo: `${f.titulo}${conteos[f.clave] > 0 ? ` ${conteos[f.clave]}` : ''}`,
            href: enlace(f.clave),
            activo: filtro === f.clave,
          }))}
        />
      </div>

      {/* Teléfono: quién es y con qué rol entra --------------------------- */}
      {filas.length > 0 && (
        <Tarjeta
          className="lg:hidden"
          pie={`${filas.length} de ${todos.length} usuarios · toca uno para editarlo`}
        >
          {filas.map((u) => (
            <FilaTrabajadorMovil key={u.id} trabajador={u}>
              <FilaLista
                principal={u.nombre}
                secundario={[u.correo, u.oficio, u.es_externo ? 'Externo' : 'Interno']
                  .filter(Boolean)
                  .join(' · ')}
                derecha={
                  <>
                    <Etiqueta tono={TONO_ROL[u.rol]}>{NOMBRE_ROL[u.rol]}</Etiqueta>
                    {!u.activo && <Etiqueta tono="rojo">Baja</Etiqueta>}
                  </>
                }
              />
            </FilaTrabajadorMovil>
          ))}
        </Tarjeta>
      )}

      <Tarjeta
        className={filas.length > 0 ? 'hidden lg:block' : ''}
        pie={`${filas.length} de ${todos.length} usuarios · las cuentas nuevas se crean con npm run usuarios:reales`}
      >
        {filas.length === 0 ? (
          <EstadoVacio
            titulo={todos.length === 0 ? 'Sin usuarios' : 'Nadie coincide con el filtro'}
            descripcion={
              todos.length === 0
                ? 'Crea las cuentas de prueba con npm run usuarios:demo.'
                : 'Prueba con otra búsqueda o cambia el filtro de estado.'
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Oficio</Th>
                <Th>Relación</Th>
                <Th>Alta</Th>
                <Th>Estado</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((u) => (
                <tr key={u.id} className="hover:bg-tinta-50/60">
                  <Td className="font-medium text-tinta-900">{u.nombre}</Td>
                  <Td className="text-tinta-500">{u.correo ?? '—'}</Td>
                  <Td>
                    <Etiqueta tono={TONO_ROL[u.rol]}>{NOMBRE_ROL[u.rol]}</Etiqueta>
                  </Td>
                  <Td className="capitalize text-tinta-500">{u.oficio ?? '—'}</Td>
                  <Td className="text-tinta-500">{u.es_externo ? 'Externo' : 'Interno'}</Td>
                  <Td className="text-tinta-500">{fecha(u.created_at)}</Td>
                  <Td>
                    <Etiqueta tono={u.activo ? 'verde' : 'rojo'}>
                      {u.activo ? 'Activo' : 'Baja'}
                    </Etiqueta>
                  </Td>
                  <Td className="w-10">
                    <BotonEditarTrabajador trabajador={u} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>

      <p className="mt-4 text-sm text-tinta-500">
        Los trabajadores marcados como <strong>externos</strong> no llevan la retención Costo Haaco
        del 5% en sus contratos de mano de obra: el sistema la pone en 0% automáticamente. Dar de
        baja a alguien no borra nada: sus contratos, recibos y pagos se quedan como están, sólo
        deja de aparecer en los contratos nuevos y en la nómina.
      </p>
    </>
  )
}
