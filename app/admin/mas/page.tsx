import { cerrarSesion } from '@/app/login/acciones'
import { NOMBRE_ROL, requerirPerfil } from '@/lib/auth'
import { GRUPOS, seccionesDe } from '@/lib/nav'
import { EncabezadoPagina } from '@/components/ui'
import { BotonSalir, GrupoMenu, OpcionMenu, TarjetaPerfil } from '@/components/movil/menu'
import { ActivarAvisos } from '@/components/recordatorios/activar-avisos'
import { BotonNovedades } from '@/components/novedades'

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

      {/* Los avisos se encienden por aparato y sólo desde el aparato: aquí,
          que es la pantalla que se abre en el teléfono. */}
      <div className="mt-3.5">
        <ActivarAvisos llavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
      </div>

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
            {/* El aviso de lo nuevo sale solo una vez; quien lo cerró de prisa
                lo vuelve a abrir desde aquí. */}
            {grupo === 'Sistema' && <BotonNovedades rol={perfil.rol} />}
          </GrupoMenu>
        )
      })}

      <BotonSalir cerrarSesion={cerrarSesion} />
    </>
  )
}
