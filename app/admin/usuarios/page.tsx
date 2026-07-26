import { crearClienteServidor } from '@/lib/supabase/server'
import { NOMBRE_ROL, requerirRol } from '@/lib/auth'
import { fecha } from '@/lib/format'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Tabla, Tarjeta, Td, Th, type TonoEtiqueta,
} from '@/components/ui'
import type { RolUsuario } from '@/types/database'

export const dynamic = 'force-dynamic'

const TONO_ROL: Record<RolUsuario, TonoEtiqueta> = {
  admin: 'verde',
  administracion: 'azul',
  cuadrilla: 'gris',
  contador: 'ambar',
}

export default async function PaginaUsuarios() {
  await requerirRol(['admin'])
  const supabase = await crearClienteServidor()

  const { data } = await supabase.from('profiles').select('*').order('rol').order('nombre')
  const filas = data ?? []

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="No hay registro público: las cuentas las crea Dirección. Cada rol ve exactamente lo que le toca."
      />

      <Tarjeta pie={`${filas.length} usuarios · ${filas.filter((u) => u.activo).length} activos`}>
        {filas.length === 0 ? (
          <EstadoVacio
            titulo="Sin usuarios"
            descripcion="Crea las cuentas de prueba con npm run usuarios:demo."
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
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>

      <p className="mt-4 text-sm text-tinta-500">
        Los trabajadores marcados como <strong>externos</strong> no llevan la retención Costo Haaco
        del 5% en sus contratos de mano de obra: el sistema la pone en 0% automáticamente.
      </p>
    </>
  )
}
