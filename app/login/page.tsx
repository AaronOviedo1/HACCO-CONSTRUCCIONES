import type { Viewport } from 'next'
import { FileText, HardHat, Wallet } from 'lucide-react'
import { Logo, Membrete } from '@/components/marca'
import { EMPRESA } from '@/lib/empresa'
import { FormularioLogin } from './formulario'

/*
 * La barra de estado se pinta del blanco del lienzo, para que en la app
 * instalada no haya escalón entre el sistema y la pantalla.
 *
 * Sólo se declara `themeColor`: Next fusiona el viewport clave a clave, así que
 * el `viewportFit: 'cover'`, el ancho y la escala del layout raíz siguen en pie.
 * `appleWebApp.statusBarStyle` se queda donde está a propósito —en modo
 * standalone iOS lo lee una sola vez al lanzar la app, y cambiarlo por página
 * no serviría de nada.
 */
export const viewport: Viewport = {
  themeColor: '#ffffff',
  interactiveWidget: 'resizes-content',
}

const AVISOS: Record<string, string> = {
  inactivo: 'Tu usuario está dado de baja o sin perfil. Comunícate con Dirección.',
}

const PROMESAS = [
  { icono: FileText, texto: 'Cotizaciones y órdenes de trabajo' },
  { icono: HardHat, texto: 'Obra, avance y cuadrilla' },
  { icono: Wallet, texto: 'Cobranza, gastos y nómina' },
]

/* En renglón mientras hay ancho de sobra; en columna cuando la marca ya tiene
   su propio lado de la pantalla. */
function Promesas() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-7 gap-y-2.5 escritorio:block escritorio:space-y-3.5">
      {PROMESAS.map(({ icono: Icono, texto }) => (
        <li key={texto} className="flex items-center gap-3 text-[15px] text-tinta-600">
          <Icono size={18} className="shrink-0 text-haaco-600" />
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

  return (
    /*
     * `min-h-dvh`, nunca `h-dvh`: en iOS el teclado se superpone sin encoger la
     * página, y con la altura clavada el botón de entrar se va debajo del
     * teclado sin forma de alcanzarlo. Con un mínimo, la página crece y el
     * desplazamiento lo rescata.
     */
    <main
      data-lienzo="claro"
      className="lienzo-claro relative z-0 flex min-h-dvh flex-col overflow-hidden px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))] tableta:px-10 escritorio:px-14 xl:px-24"
    >
      {/* El imagotipo del manual a tamaño de mural, en verde: es lo único que
          impide que la pantalla sea una hoja en blanco. El verde medio a un
          11 % se lee como verde; el del manual, tan oscuro, a esta dilución
          sólo daba gris. */}
      <Logo
        tamano={420}
        className="pointer-events-none absolute -right-20 top-[6%] text-haaco-600/[0.11] tableta:-right-16 tableta:top-[18%] tableta:scale-125 escritorio:right-auto escritorio:left-[52%] escritorio:top-[8%] escritorio:scale-[1.7]"
      />

      <div aria-hidden className="grano pointer-events-none absolute inset-0" />

      {/* `m-auto` y no `flex-1`: absorbe el espacio libre cuando sobra —queda
          centrado— y vale cero cuando no, dejando crecer la página. `flex-1`
          se desbordaría en cuanto el teclado come media pantalla. */}
      <div className="relative z-10 m-auto grid w-full max-w-[22rem] gap-9 tableta:max-w-2xl tableta:gap-12 escritorio:max-w-[66rem] escritorio:grid-cols-[minmax(0,1fr)_22rem] escritorio:items-center escritorio:gap-20 xl:gap-28">
        {/*
          * La entrada se escalona pieza por pieza: marca, formulario y letra
          * chica, con 70 ms entre cada una.
          */}
        <div className="animate-surge text-center escritorio:text-left">
          <div className="flex justify-center escritorio:justify-start">
            <Membrete />
          </div>

          {/* En el teléfono el reclamo no cabe sin quitarle sitio al
              formulario, que es a lo que se viene. */}
          <h2 className="mt-7 hidden tipo-display text-[26px] font-extrabold uppercase leading-[1.14] tracking-tight text-haaco-900 md:block escritorio:mt-9 escritorio:text-[34px] xl:text-[40px]">
            Toda la operación
            <br /> en un solo lugar
          </h2>

          <div className="mt-6 hidden md:block escritorio:mt-9">
            <Promesas />
          </div>

          <p className="mt-12 hidden text-[11px] tracking-wide text-tinta-400 escritorio:block">
            {creditos}
          </p>
        </div>

        {/*
          * Sin caja: el formulario se apoya en el papel y lo agrupa el aire.
          *
          * Mientras la marca va centrada —teléfono y tableta—, el encabezado
          * del formulario va centrado con ella; sólo cuando la marca se muda a
          * su propia columna, en escritorio, el formulario se alinea por la
          * izquierda. Y en la tableta se estrecha: dos campos a lo ancho de un
          * iPad no son un formulario, son una tabla.
          */}
        <div className="tableta:mx-auto tableta:w-full tableta:max-w-md">
          <div className="animate-surge [--retraso:70ms]">
            {/* El rótulo se quitó de la vista, pero la página necesita un
                encabezado: sin él, un lector de pantalla llega al formulario
                sin saber a qué pantalla entró, y el reclamo de la izquierda
                —un h2— quedaría colgando de ningún h1. */}
            <h1 className="sr-only">Entrar</h1>
            <p className="mb-7 text-center text-sm text-tinta-500 escritorio:text-left">
              Acceso para el equipo de {EMPRESA.nombre}.
            </p>

            <FormularioLogin aviso={motivo ? AVISOS[motivo] : undefined} />
          </div>

          <div className="animate-surge [--retraso:140ms]">
            <p className="mt-7 text-center text-[11.5px] leading-relaxed text-tinta-400 escritorio:text-left">
              ¿No tienes acceso? Las cuentas las crea Dirección desde Usuarios.
            </p>

            {/* En escritorio los créditos van al pie de la columna de marca. */}
            <p className="mt-3 text-center text-[11px] text-tinta-400 escritorio:hidden">
              {creditos}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
