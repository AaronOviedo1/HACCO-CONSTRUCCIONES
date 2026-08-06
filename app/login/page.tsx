import { FileText, HardHat, Wallet } from 'lucide-react'
import { Logo, Membrete } from '@/components/marca'
import { EMPRESA } from '@/lib/empresa'
import { FormularioLogin } from './formulario'

const AVISOS: Record<string, string> = {
  inactivo: 'Tu usuario está dado de baja o sin perfil. Comunícate con Dirección.',
}

/* Lo que el equipo entra a hacer aquí, en el orden del menú de la app. */
const PROMESAS = [
  { icono: FileText, texto: 'Cotizaciones y órdenes de trabajo' },
  { icono: HardHat, texto: 'Obra, avance y cuadrilla' },
  { icono: Wallet, texto: 'Cobranza, gastos y nómina' },
]

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams

  /*
   * Dos paneles en escritorio; en el teléfono, una sola columna. El
   * `grid-cols-1` es explícito para que la columna nunca crezca al max-content
   * del formulario en pantallas angostas.
   */
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/*
        Panel de marca. Sólo en escritorio: en el teléfono la pantalla es la
        tarjeta de siempre. Los tonos son los de la barra lateral para que el
        login y el chrome de la app se lean como la misma pieza.
      */}
      <section className="relative hidden overflow-hidden bg-haaco-900 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* El imagotipo del manual, gigante y casi apagado, como filigrana. */}
        <Logo
          tamano={640}
          className="pointer-events-none absolute -bottom-32 -right-28 text-white/[0.045]"
        />

        <div className="relative">
          <Membrete tono="claro" />
        </div>

        <div className="relative max-w-md">
          <h2 className="tipo-display text-[32px] font-extrabold uppercase leading-[1.12] tracking-tight text-white xl:text-[38px]">
            Toda la operación
            <br />
            en un solo lugar
          </h2>
          <ul className="mt-8 space-y-3.5">
            {PROMESAS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-[15px] text-haaco-100/80">
                <Icono size={18} className="shrink-0 text-haaco-300" />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] tracking-wide text-haaco-300/70">
          © {new Date().getFullYear()} {EMPRESA.nombre} · {EMPRESA.ciudad}
        </p>
      </section>

      <div className="flex flex-col items-center bg-tinta-50 px-6 pb-10 pt-[max(3.25rem,env(safe-area-inset-top))] lg:justify-center lg:bg-white lg:px-12 lg:pt-10 xl:px-20">
        <div className="w-full max-w-sm lg:max-w-[380px]">
          {/* Membrete en dos piezas: el imagotipo y el nombre, como en la app. */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-haaco-700 text-white shadow-verde">
              <Logo tamano={34} />
            </span>
            <div className="leading-tight">
              <p className="text-2xl font-semibold -tracking-[0.5px] text-tinta-900">
                Haaco<span className="text-haaco-600">Pro</span>
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-tinta-500">
                Recubrimientos y herrería
              </p>
            </div>
          </div>

          <div className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <h1 className="text-[19px] font-semibold -tracking-[0.3px] text-tinta-900 lg:tipo-display lg:text-[28px] lg:font-extrabold lg:uppercase lg:tracking-tight lg:text-haaco-900">
              Entrar
            </h1>
            <p className="mb-5 mt-1 text-sm text-tinta-500 lg:mb-8 lg:mt-2">
              Acceso para el equipo de {EMPRESA.nombre}.
            </p>

            <FormularioLogin aviso={motivo ? AVISOS[motivo] : undefined} />
          </div>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-tinta-400 lg:mt-10 lg:border-t lg:border-tinta-150 lg:pt-6 lg:text-left lg:text-xs">
            ¿No tienes acceso? Las cuentas las crea Dirección desde Usuarios.
          </p>
        </div>
      </div>
    </main>
  )
}
