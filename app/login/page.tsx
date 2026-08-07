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

/* En columna para el panel de escritorio; en renglón para la banda del iPad. */
function Promesas({ enRenglon = false }: { enRenglon?: boolean }) {
  return (
    <ul className={enRenglon ? 'flex flex-wrap gap-x-7 gap-y-2.5' : 'space-y-3.5'}>
      {PROMESAS.map(({ icono: Icono, texto }) => (
        <li key={texto} className="flex items-center gap-3 text-[15px] text-haaco-100/80">
          <Icono size={18} className="shrink-0 text-haaco-300" />
          {texto}
        </li>
      ))}
    </ul>
  )
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>
}) {
  const { motivo } = await searchParams
  const anio = new Date().getFullYear()
  const creditos = `© ${anio} ${EMPRESA.nombre} · ${EMPRESA.ciudad}`

  /*
   * Dos paneles en escritorio; banda de marca arriba en el iPad vertical; una
   * sola columna en el teléfono. El `grid-cols-1` es explícito para que la
   * columna nunca crezca al max-content del formulario en pantallas angostas.
   */
  return (
    <main className="grid min-h-dvh grid-cols-1 tableta:grid-rows-[auto_1fr] escritorio:grid-cols-2 escritorio:grid-rows-none">
      {/*
        Banda de marca del iPad vertical: el mismo mensaje que el panel de
        escritorio, tumbado, ocupando la parte alta de la pantalla.
      */}
      <section className="relative hidden overflow-hidden bg-haaco-900 px-10 pb-11 pt-[max(2.75rem,env(safe-area-inset-top))] tableta:block escritorio:hidden">
        <Logo
          tamano={300}
          className="pointer-events-none absolute -right-14 -top-16 text-white/[0.05]"
        />
        <div className="relative mx-auto max-w-2xl">
          <Membrete tono="claro" />
          <h2 className="mt-7 tipo-display text-[26px] font-extrabold uppercase leading-[1.15] tracking-tight text-white">
            Toda la operación en un solo lugar
          </h2>
          <div className="mt-5">
            <Promesas enRenglon />
          </div>
        </div>
      </section>

      {/*
        Panel de marca de escritorio. Los tonos son los de la barra lateral para
        que el login y el chrome de la app se lean como la misma pieza.
      */}
      <section className="relative hidden overflow-hidden bg-haaco-900 escritorio:flex escritorio:flex-col escritorio:justify-between escritorio:p-12 xl:p-16">
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
          <div className="mt-8">
            <Promesas />
          </div>
        </div>

        <p className="relative text-[11px] tracking-wide text-haaco-300/70">{creditos}</p>
      </section>

      <div className="flex flex-col items-center bg-tinta-50 px-6 pb-10 pt-[max(3.25rem,env(safe-area-inset-top))] tableta:justify-center tableta:px-10 tableta:py-12 escritorio:justify-center escritorio:bg-white escritorio:px-12 escritorio:py-10 xl:px-20">
        <div className="w-full max-w-sm tableta:max-w-md escritorio:max-w-[380px]">
          {/* Membrete en dos piezas: el imagotipo y el nombre, como en la app. */}
          <div className="mb-8 flex items-center justify-center gap-3 tableta:hidden escritorio:hidden">
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

          <div className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta tableta:rounded-3xl tableta:p-8 escritorio:rounded-none escritorio:border-0 escritorio:bg-transparent escritorio:p-0 escritorio:shadow-none">
            <h1 className="text-[19px] font-semibold -tracking-[0.3px] text-tinta-900 md:tipo-display md:text-[26px] md:font-extrabold md:uppercase md:tracking-tight md:text-haaco-900 escritorio:text-[28px]">
              Entrar
            </h1>
            <p className="mb-5 mt-1 text-sm text-tinta-500 md:mb-7 md:mt-2 escritorio:mb-8">
              Acceso para el equipo de {EMPRESA.nombre}.
            </p>

            <FormularioLogin aviso={motivo ? AVISOS[motivo] : undefined} />
          </div>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-tinta-400 md:mt-8 md:text-xs escritorio:mt-10 escritorio:border-t escritorio:border-tinta-150 escritorio:pt-6 escritorio:text-left">
            ¿No tienes acceso? Las cuentas las crea Dirección desde Usuarios.
          </p>

          {/* En escritorio los créditos van al pie del panel verde. */}
          <p className="mt-3 hidden text-center text-[11px] text-tinta-400 tableta:block">
            {creditos}
          </p>
        </div>
      </div>
    </main>
  )
}
