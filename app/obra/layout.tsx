import { cerrarSesion } from '@/app/login/acciones'
import { Logo } from '@/components/marca'
import { requerirRol } from '@/lib/auth'
import { LogOut } from 'lucide-react'

/**
 * Vista de cuadrilla: mobile-first y sin ruido. Compite contra WhatsApp,
 * así que todo tiene que estar a uno o dos toques.
 */
export default async function LayoutObra({ children }: { children: React.ReactNode }) {
  const perfil = await requerirRol(['cuadrilla'])

  return (
    <div className="flex min-h-dvh flex-col bg-tinta-50">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-tinta-200 bg-white px-4 py-3">
        <Logo tamano={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-tinta-900">{perfil.nombre}</p>
          <p className="text-xs capitalize text-tinta-500">{perfil.oficio ?? 'Oficial'}</p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-lg p-2 text-tinta-400 hover:bg-tinta-100 hover:text-tinta-700"
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </form>
      </header>

      <main className="flex-1 px-4 py-5">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
