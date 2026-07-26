import { BarraLateral } from '@/components/admin/barra-lateral'
import { cerrarSesion } from '@/app/login/acciones'
import { NOMBRE_ROL, requerirRol } from '@/lib/auth'
import { seccionesDe } from '@/lib/nav'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const perfil = await requerirRol(['admin', 'administracion', 'contador'])
  const secciones = seccionesDe(perfil.rol)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BarraLateral
        secciones={secciones}
        nombre={perfil.nombre}
        rol={NOMBRE_ROL[perfil.rol]}
        cerrarSesion={cerrarSesion}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
