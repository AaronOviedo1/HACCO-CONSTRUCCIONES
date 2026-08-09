'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { iniciarSesion, type EstadoLogin } from './acciones'

/**
 * Sólo se recuerda el correo —nunca la contraseña—: es una comodidad para la
 * computadora de la oficina, no un guardado de credenciales.
 */
const CLAVE_CORREO = 'haacopro:correo'

/*
 * Los campos usan `campo-login` y no `Entrada`.
 *
 * Sin caja alrededor, los campos son lo único que dibuja la columna del
 * formulario y necesitan algo más de presencia que los de un formulario denso:
 * filete de medio píxel y una sombra de un pelo. Eso no se consigue apilando
 * clases sobre `Entrada`, porque en Tailwind gana la utilidad que la hoja
 * emita después, no la que se escriba después en el atributo.
 *
 * El relleno sí queda en clases: es lo que deja que `pr-11` abra el hueco del
 * ojo de la contraseña. Y en la tableta los campos conservan tamaño de dedo
 * aunque el ancho ya sea de escritorio.
 */
const CLASE_ENTRADA =
  'campo-login px-3.5 py-3 tableta:min-h-[52px] tableta:px-4 tableta:text-base escritorio:py-2.5 escritorio:text-[15px] [@media(pointer:coarse)]:min-h-[48px]'

const CLASE_ETIQUETA = 'mb-1.5 block text-[13px] font-medium text-tinta-700'

/*
 * Un `<button>` propio y no `Boton`: el primario de la app se oscurece a
 * haaco-900 al pasar el ratón, y cuando el botón es la única masa de color de
 * la pantalla eso lo apaga en vez de responder. No se puede corregir desde
 * `className` por el mismo problema de orden de la hoja.
 */
function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="boton-entrar inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-4 text-[17px] font-semibold disabled:cursor-not-allowed tableta:min-h-[54px] escritorio:min-h-[46px] escritorio:text-[15px]"
    >
      {pending && <Loader2 size={17} className="animate-spin" />}
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
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
    // Sin `preventScroll`, en una ventana baja el foco arrastra la página justo
    // mientras el formulario se está asomando, y el movimiento salta.
    destino?.focus({ preventScroll: true })
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
        <p className="rounded-[14px] bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200 escritorio:text-[13px]">
          {aviso}
        </p>
      )}

      <div>
        <label htmlFor="correo" className={CLASE_ETIQUETA}>
          Correo
        </label>
        <input
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
        <label htmlFor="contrasena" className={CLASE_ETIQUETA}>
          Contraseña
        </label>
        <div className="relative">
          <input
            ref={claveRef}
            id="contrasena"
            name="contrasena"
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-invalid={estado.error ? true : undefined}
            className={`${CLASE_ENTRADA} pr-11`}
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
          className="flex items-start gap-2 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200 escritorio:text-[13px]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
