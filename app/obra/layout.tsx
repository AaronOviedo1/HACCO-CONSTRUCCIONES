import { BarraTabs } from '@/components/movil/tabs'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { ICONO, pestanasDe, type Pestana } from '@/lib/nav'

/**
 * Vista de cuadrilla: mobile-first y sin ruido. Compite contra WhatsApp, así
 * que todo tiene que estar a uno o dos toques. La barra de pestañas deja
 * «Subir» siempre a la mano cuando hay una obra abierta.
 */
export default async function LayoutObra({ children }: { children: React.ReactNode }) {
  await requerirRol(['cuadrilla'])
  const supabase = await crearClienteServidor()

  // RLS ya limita esto a las obras donde el oficial tiene contrato.
  const { data: activa } = await supabase
    .from('obras')
    .select('id')
    .neq('estatus', 'cerrada')
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pestanas: Pestana[] = [...pestanasDe('cuadrilla')]
  if (activa) {
    pestanas.splice(1, 0, {
      href: `/obra/${activa.id}#subir`,
      etiqueta: 'Subir',
      icono: ICONO.camara,
    })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 px-4 pb-[calc(var(--alto-tabs)+1rem)] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>

      <BarraTabs pestanas={pestanas} />
    </div>
  )
}
