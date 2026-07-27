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
      className="min-h-[50px] w-full rounded-[14px] bg-haaco-700 px-4 text-[17px] font-semibold text-white transition hover:bg-haaco-800 active:bg-haaco-800 disabled:bg-haaco-300 lg:min-h-0 lg:rounded-lg lg:py-3 lg:text-sm"
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
        <p className="rounded-[14px] bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          {aviso}
        </p>
      )}

      <div>
        <label htmlFor="correo" className="mb-1.5 block text-[13px] font-medium text-tinta-700">
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
          className="w-full rounded-[12px] border border-tinta-300 bg-white px-3.5 py-3 text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
          placeholder="nombre@haacopro.com"
        />
      </div>

      <div>
        <label htmlFor="contrasena" className="mb-1.5 block text-[13px] font-medium text-tinta-700">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-[12px] border border-tinta-300 bg-white px-3.5 py-3 text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
          placeholder="••••••••"
        />
      </div>

      {estado.error && (
        <p role="alert" className="rounded-[14px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
