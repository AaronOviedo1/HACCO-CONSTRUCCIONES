import { Logo } from '@/components/marca'
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
    <main className="flex min-h-dvh flex-col items-center bg-tinta-50 px-6 pb-10 pt-[max(3.25rem,env(safe-area-inset-top))] lg:justify-center lg:bg-haaco-900 lg:pt-10">
      <div className="w-full max-w-sm">
        {/* Membrete en dos piezas: el imagotipo y el nombre, como en la app. */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-haaco-700 text-white shadow-verde lg:bg-white lg:text-haaco-900 lg:shadow-none">
            <Logo tamano={34} />
          </span>
          <div className="leading-tight">
            <p className="text-2xl font-semibold -tracking-[0.5px] text-tinta-900 lg:text-white">
              Haaco<span className="text-haaco-600 lg:text-haaco-300">Pro</span>
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-tinta-500 lg:text-haaco-300">
              Recubrimientos y herrería
            </p>
          </div>
        </div>

        <div className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta lg:rounded-2xl lg:border-0 lg:p-8 lg:shadow-xl lg:shadow-haaco-950/30">
          <h1 className="text-[19px] font-semibold -tracking-[0.3px] text-tinta-900 lg:tipo-display lg:text-lg lg:font-extrabold lg:uppercase lg:tracking-tight lg:text-haaco-900">
            Entrar
          </h1>
          <p className="mb-5 mt-1 text-sm text-tinta-500">Acceso para el equipo de {EMPRESA.nombre}.</p>

          <FormularioLogin aviso={motivo ? AVISOS[motivo] : undefined} />
        </div>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-tinta-400 lg:text-haaco-300">
          ¿No tienes acceso? Las cuentas las crea Dirección desde Usuarios.
        </p>
      </div>
    </main>
  )
}
