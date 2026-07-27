import { cerrarSesion } from '@/app/login/acciones'
import { NOMBRE_ROL, requerirPerfil } from '@/lib/auth'
import { GRUPOS, seccionesDe } from '@/lib/nav'
import { EncabezadoPagina } from '@/components/ui'
import { BotonSalir, GrupoMenu, OpcionMenu, TarjetaPerfil } from '@/components/movil/menu'

export const dynamic = 'force-dynamic'

/**
 * El resto de la app para quien la trae en el bolsillo: lo que no cabe en las
 * cinco pestañas vive aquí, con los mismos grupos que la barra lateral.
 */
export default async function PaginaMas() {
  const perfil = await requerirPerfil()
  const secciones = seccionesDe(perfil.rol)

  return (
    <>
      <EncabezadoPagina titulo="Perfil" />

      <TarjetaPerfil
        nombre={perfil.nombre}
        rol={NOMBRE_ROL[perfil.rol]}
        detalle={perfil.correo ?? perfil.telefono}
      />

      {GRUPOS.map((grupo) => {
        const items = secciones.filter((s) => s.grupo === grupo)
        if (items.length === 0) return null

        return (
          <GrupoMenu key={grupo} titulo={grupo}>
            {items.map((s) => (
              <OpcionMenu key={s.href} href={s.href}>
                {s.titulo}
              </OpcionMenu>
            ))}
          </GrupoMenu>
        )
      })}

      <BotonSalir cerrarSesion={cerrarSesion} />
    </>
  )
}
