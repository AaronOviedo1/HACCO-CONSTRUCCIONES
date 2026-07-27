import { Membrete } from '@/components/marca'
import { SUPABASE_CONFIGURADO } from '@/lib/config'
import { redirect } from 'next/navigation'

const PASOS = [
  {
    titulo: 'Crear el proyecto en Supabase',
    detalle: 'supabase.com → New project. Región recomendada: us-west-1 (la más cercana a Hermosillo).',
  },
  {
    titulo: 'Copiar las llaves a .env.local',
    detalle: 'Project Settings → API. Se necesitan NEXT_PUBLIC_SUPABASE_URL, la llave pública (anon o publishable) y SUPABASE_SERVICE_ROLE_KEY.',
  },
  {
    titulo: 'Aplicar las migraciones',
    detalle: 'npx supabase link --project-ref <ref> && npx supabase db push',
  },
  {
    titulo: 'Cargar el catálogo inicial',
    detalle: 'npm run bd:seed — carga proveedores, pinturas, insumos de taller y las 57 herramientas con sus códigos reales.',
  },
  {
    titulo: 'Crear los usuarios del equipo',
    detalle: 'npm run usuarios:demo — genera una cuenta por rol para probar. Después Dirección los administra desde la app.',
  },
  {
    titulo: 'Opcional: cargar una operación de ejemplo',
    detalle: 'npm run bd:demo — cotizaciones, obras con avance, cobranza, gastos y nómina para recorrer la app antes de capturar lo real.',
  },
]

export default function PaginaInstalacion() {
  if (SUPABASE_CONFIGURADO) redirect('/')

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-12">
      <Membrete />

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-tinta-900">
        Falta conectar la base de datos
      </h1>
      <p className="mt-2 text-sm text-tinta-500">
        La aplicación está lista; sólo necesita las llaves del proyecto de Supabase.
      </p>

      <ol className="mt-8 space-y-4">
        {PASOS.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-4 rounded-xl border border-tinta-200 bg-white p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-haaco-700 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-tinta-900">{paso.titulo}</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-tinta-500">{paso.detalle}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        Después de llenar <code className="font-mono">.env.local</code> hay que reiniciar
        <code className="ml-1 font-mono">npm run dev</code> para que Next lea las variables.
      </p>
    </main>
  )
}
