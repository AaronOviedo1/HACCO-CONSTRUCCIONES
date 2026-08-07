'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Entrada } from '@/components/formulario'
import { Boton } from '@/components/ui'
import { iniciarSesion, type EstadoLogin } from './acciones'

/**
 * Sólo se recuerda el correo —nunca la contraseña—: es una comodidad para la
 * computadora de la oficina, no un guardado de credenciales.
 */
const CLAVE_CORREO = 'haacopro:correo'

/*
 * Los campos del login son más altos que los de un formulario denso, y en la
 * tableta conservan el tamaño de dedo aunque el ancho ya sea de escritorio.
 */
const CLASE_ENTRADA =
  'tableta:min-h-[52px] tableta:rounded-[14px] tableta:px-4 tableta:text-base escritorio:py-2.5 escritorio:text-[15px] [@media(pointer:coarse)]:min-h-[48px]'

function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <Boton
      type="submit"
      disabled={pending}
      className="min-h-[50px] w-full text-[17px] tableta:min-h-[54px] tableta:rounded-xl tableta:text-[17px] tableta:font-semibold escritorio:min-h-[44px] escritorio:text-[15px] escritorio:font-semibold"
    >
      {pending && <Loader2 size={17} className="animate-spin" />}
      {pending ? 'Entrando…' : 'Entrar'}
    </Boton>
  )
}

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {})
  const [verClave, setVerClave] = useState(false)
  const [recordar, setRecordar] = useState(false)
  const correoRef = useRef<HTMLInputElement>(null)
  const claveRef = useRef<HTMLInputElement>(null)

  /*
   * El correo guardado se lee ya montado el componente: en el servidor no hay
   * localStorage y la hidratación tiene que coincidir con el HTML.
   */
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_CORREO)
    if (guardado && correoRef.current) {
      correoRef.current.value = guardado
      setRecordar(true)
    }

    // Sólo con ratón o trackpad: en una pantalla táctil el foco automático
    // abre el teclado y se come media pantalla nada más entrar.
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return
    const destino = guardado ? claveRef.current : correoRef.current
    destino?.focus()
  }, [])

  // Corre antes de la server action; sin preventDefault, el envío sigue su curso.
  function guardarCorreo() {
    const correo = correoRef.current?.value.trim() ?? ''
    if (recordar && correo) localStorage.setItem(CLAVE_CORREO, correo)
    else localStorage.removeItem(CLAVE_CORREO)
  }

  return (
    <form action={accion} onSubmit={guardarCorreo} className="space-y-4">
      {aviso && (
        <p className="rounded-[14px] bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200 escritorio:rounded-lg escritorio:text-[13px]">
          {aviso}
        </p>
      )}

      <div>
        <label htmlFor="correo" className="mb-1.5 block text-[13px] font-medium text-tinta-700">
          Correo
        </label>
        <Entrada
          ref={correoRef}
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          aria-invalid={estado.error ? true : undefined}
          className={CLASE_ENTRADA}
          placeholder="nombre@haacopro.com"
        />
      </div>

      <div>
        <label htmlFor="contrasena" className="mb-1.5 block text-[13px] font-medium text-tinta-700">
          Contraseña
        </label>
        <div className="relative">
          <Entrada
            ref={claveRef}
            id="contrasena"
            name="contrasena"
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-invalid={estado.error ? true : undefined}
            className={`pr-11 ${CLASE_ENTRADA}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={verClave}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-tinta-400 transition hover:text-haaco-700"
          >
            {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2.5 py-1 text-[13px] text-tinta-600 tableta:text-sm">
        <input
          type="checkbox"
          checked={recordar}
          onChange={(e) => setRecordar(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-haaco-700 tableta:h-[18px] tableta:w-[18px]"
        />
        Recordar mi correo
      </label>

      {estado.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200 escritorio:rounded-lg escritorio:text-[13px]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
