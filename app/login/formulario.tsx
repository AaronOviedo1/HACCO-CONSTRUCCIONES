'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { iniciarSesion, type EstadoLogin } from './acciones'

function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-haaco-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {})

  return (
    <form action={accion} className="space-y-4">
      {aviso && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          {aviso}
        </p>
      )}

      <div>
        <label htmlFor="correo" className="mb-1.5 block text-sm font-medium text-tinta-700">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          className="w-full rounded-lg border border-tinta-300 bg-white px-3 py-2.5 text-tinta-900 outline-none transition focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100"
          placeholder="nombre@haacopro.com"
        />
      </div>

      <div>
        <label htmlFor="contrasena" className="mb-1.5 block text-sm font-medium text-tinta-700">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-tinta-300 bg-white px-3 py-2.5 text-tinta-900 outline-none transition focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100"
          placeholder="••••••••"
        />
      </div>

      {estado.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
