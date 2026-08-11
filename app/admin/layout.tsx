import { BarraLateral } from '@/components/admin/barra-lateral'
import { BotonMas } from '@/components/movil/boton-mas'
import { Novedades } from '@/components/novedades'
import { BarraTabs } from '@/components/movil/tabs'
import { cerrarSesion } from '@/app/login/acciones'
import { NOMBRE_ROL, requerirRol } from '@/lib/auth'
import { pestanasDe, seccionesDe } from '@/lib/nav'

/**
 * Dos formas de moverse por la misma app: barra lateral completa en escritorio
 * e iPad horizontal, barra de pestañas en el teléfono. Nunca las dos a la vez.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const perfil = await requerirRol(['admin', 'administracion', 'contador'])

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BarraLateral
        secciones={seccionesDe(perfil.rol)}
        nombre={perfil.nombre}
        rol={NOMBRE_ROL[perfil.rol]}
        rolClave={perfil.rol}
        cerrarSesion={cerrarSesion}
      />

      <main className="min-w-0 flex-1 px-4 pb-[calc(var(--alto-tabs)+1rem)] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <BarraTabs pestanas={pestanasDe(perfil.rol)} />
      {/* El contador sólo consulta: a él no le sale el botón de crear. */}
      {perfil.rol !== 'contador' && <BotonMas />}

      {/* Qué cambió, una sola vez por versión y por aparato. */}
      <Novedades rol={perfil.rol} />
    </div>
  )
}
