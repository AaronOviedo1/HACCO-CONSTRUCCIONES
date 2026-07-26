import { Membrete } from '@/components/marca'
import { EMPRESA } from '@/lib/empresa'
import { FormularioLogin } from './formulario'

const AVISOS: Record<string, string> = {
  inactivo: 'Tu usuario está dado de baja o sin perfil. Comunícate con Dirección.',
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-tinta-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Membrete />
        </div>

        <div className="rounded-2xl border border-tinta-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold text-tinta-900">Entrar</h1>
          <p className="mt-1 mb-6 text-sm text-tinta-500">
            Acceso para el equipo de {EMPRESA.nombre}.
          </p>

          <FormularioLogin aviso={motivo ? AVISOS[motivo] : undefined} />
        </div>

        <p className="mt-6 text-center text-xs text-tinta-400">
          ¿No tienes acceso? Las cuentas las crea Dirección desde Usuarios.
        </p>
      </div>
    </main>
  )
}
