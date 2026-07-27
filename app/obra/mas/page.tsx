import { cerrarSesion } from '@/app/login/acciones'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { EncabezadoPagina } from '@/components/ui'
import { BotonSalir, GrupoMenu, OpcionMenu, TarjetaPerfil } from '@/components/movil/menu'

export const dynamic = 'force-dynamic'

const OFICIO: Record<string, string> = {
  pintor: 'Cuadrilla · pintor',
  herrero: 'Cuadrilla · herrero',
  ayudante: 'Cuadrilla · ayudante',
  oficial: 'Cuadrilla · oficial',
}

/** Quién soy, en qué ando y salir. Nada más: la cuadrilla no administra. */
export default async function PerfilCuadrilla() {
  const perfil = await requerirRol(['cuadrilla'])
  const supabase = await crearClienteServidor()

  const { data: obras } = await supabase
    .from('obras')
    .select('id, nombre, ot_numero, estatus')
    .neq('estatus', 'cerrada')
    .order('fecha_apertura', { ascending: false })

  const activas = obras ?? []

  return (
    <>
      <EncabezadoPagina titulo="Perfil" />

      <TarjetaPerfil
        nombre={perfil.nombre}
        rol={perfil.oficio ? (OFICIO[perfil.oficio] ?? 'Cuadrilla') : 'Cuadrilla'}
        detalle={perfil.correo ?? perfil.telefono}
      />

      {activas.length > 0 && (
        <GrupoMenu titulo="Mis obras abiertas">
          {activas.map((o) => (
            <OpcionMenu key={o.id} href={`/obra/${o.id}`}>
              {o.nombre}
            </OpcionMenu>
          ))}
        </GrupoMenu>
      )}

      <p className="mb-4 px-1.5 text-[11.5px] leading-relaxed text-tinta-400">
        Las cuentas y los contratos los abre Dirección. Si algo no aparece aquí, avísale.
      </p>

      <BotonSalir cerrarSesion={cerrarSesion} />
    </>
  )
}
