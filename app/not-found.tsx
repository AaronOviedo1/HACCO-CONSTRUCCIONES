import Link from 'next/link'
import { Membrete } from '@/components/marca'

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Membrete />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-tinta-900">
        Esta pantalla no existe
      </h1>
      <p className="mt-2 max-w-sm text-sm text-tinta-500">
        Puede que el enlace esté viejo, que el registro se haya eliminado o que no tengas acceso a
        él.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-haaco-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        Ir al inicio
      </Link>
    </main>
  )
}
