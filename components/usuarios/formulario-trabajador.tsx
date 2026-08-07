'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, PieFormulario, Seleccion,
} from '@/components/formulario'
import { NOMBRE_ROL } from '@/lib/roles'
import {
  crearTrabajador, eliminarTrabajador, guardarTrabajador,
} from '@/app/admin/usuarios/acciones'
import type { EstadoAccion } from '@/lib/acciones'
import type { OficioTrabajador, Profile, RolUsuario } from '@/types/database'

const ROLES: RolUsuario[] = ['admin', 'administracion', 'contador', 'cuadrilla']

const OFICIOS: { valor: OficioTrabajador | ''; texto: string }[] = [
  { valor: '', texto: 'Sin oficio' },
  { valor: 'pintor', texto: 'Pintor' },
  { valor: 'herrero', texto: 'Herrero' },
  { valor: 'ayudante', texto: 'Ayudante' },
  { valor: 'otro', texto: 'Otro' },
]

export function BotonNuevoTrabajador() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Plus size={16} />
        Dar de alta
      </button>
      {abierto && <FormularioTrabajador onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export function BotonEditarTrabajador({ trabajador }: { trabajador: Profile }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="relative rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label={`Editar ${trabajador.nombre}`}
      >
        <Pencil size={15} />
      </button>
      {abierto && (
        <FormularioTrabajador trabajador={trabajador} onCerrar={() => setAbierto(false)} />
      )}
    </>
  )
}

/** En el teléfono el renglón entero abre la ficha: no cabe una columna aparte. */
export function FilaTrabajadorMovil({
  trabajador,
  children,
}: {
  trabajador: Profile
  children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="block w-full text-left">
        {children}
      </button>
      {abierto && (
        <FormularioTrabajador trabajador={trabajador} onCerrar={() => setAbierto(false)} />
      )}
    </>
  )
}

/**
 * La ficha de una persona: alta, corrección y baja.
 *
 * La baja normal es lógica —quitar «Sigue laborando»—: sus contratos y sus
 * recibos tienen que seguir en pie aunque ya no trabaje. El borrado de verdad
 * queda para el alta que salió mal, y la acción lo rechaza en cuanto la persona
 * tiene algo a su nombre.
 */
export function FormularioTrabajador({
  trabajador,
  onCerrar,
}: {
  trabajador?: Profile
  onCerrar: () => void
}) {
  const nuevo = !trabajador
  const [estado, accion] = useActionState<EstadoAccion, FormData>(
    nuevo ? crearTrabajador : guardarTrabajador,
    {},
  )
  const [estadoBorrar, accionBorrar] = useActionState<EstadoAccion, FormData>(
    eliminarTrabajador,
    {},
  )
  const [conAcceso, setConAcceso] = useState(trabajador?.con_acceso ?? false)

  // `onCerrar` cambia de identidad en cada pintado del padre; la marca de agua
  // es el objeto que devuelve useActionState, distinto por cada envío.
  const atendido = useRef<EstadoAccion | null>(null)

  useEffect(() => {
    const hecho = estado.ok ? estado : estadoBorrar.ok ? estadoBorrar : null
    if (!hecho || atendido.current === hecho) return
    atendido.current = hecho
    onCerrar()
  }, [estado, estadoBorrar, onCerrar])

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={trabajador ? trabajador.nombre : 'Dar de alta'}
      descripcion="El rol decide qué pantallas ve. Los externos no llevan retención Costo Haaco."
    >
      <form action={accion} className="flex min-h-0 flex-1 flex-col">
        <CuerpoDialogo>
          {trabajador && <input type="hidden" name="id" value={trabajador.id} />}

          <Campo
            etiqueta="Nombre"
            hijo={<Entrada name="nombre" defaultValue={trabajador?.nombre ?? ''} required />}
          />
          <Campo
            etiqueta="Teléfono"
            ancho="medio"
            hijo={<Entrada name="telefono" type="tel" defaultValue={trabajador?.telefono ?? ''} />}
          />
          <Campo
            etiqueta="Oficio"
            ancho="medio"
            hijo={
              <Seleccion name="oficio" defaultValue={trabajador?.oficio ?? ''}>
                {OFICIOS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </Seleccion>
            }
          />
          <Campo
            etiqueta="Rol"
            ancho="medio"
            hijo={
              <Seleccion name="rol" defaultValue={trabajador?.rol ?? 'cuadrilla'}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_ROL[r]}
                  </option>
                ))}
              </Seleccion>
            }
            ayuda={nuevo ? 'Cuadrilla es el rol que puede firmar contratos de obra.' : undefined}
          />

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Casilla
              name="con_acceso"
              etiqueta="Va a entrar a la app"
              checked={conAcceso}
              onChange={(e) => setConAcceso(e.target.checked)}
            />
            <p className="text-xs text-tinta-500">
              Sin palomita se registra sólo para contratos y nómina —el pintor de una obra suelta,
              el herrero de un trabajo puntual— y no se le da ninguna contraseña.
            </p>
          </div>

          {conAcceso && (
            <>
              <Campo
                etiqueta="Correo"
                ancho={nuevo ? 'medio' : 'completo'}
                hijo={
                  <Entrada
                    name="correo"
                    type="email"
                    defaultValue={trabajador?.correo ?? ''}
                    required={nuevo}
                  />
                }
                ayuda={
                  nuevo
                    ? 'Con el que va a entrar.'
                    : 'Cambiarlo aquí no cambia el correo con el que entra.'
                }
              />
              {nuevo && (
                <Campo
                  etiqueta="Contraseña de arranque"
                  ancho="medio"
                  hijo={<Entrada name="contrasena" type="text" minLength={8} required />}
                  ayuda="Se la pasas tú; que la cambie al entrar."
                />
              )}
            </>
          )}

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Casilla
              name="es_externo"
              etiqueta="Es externo (sin retención Costo Haaco)"
              defaultChecked={trabajador?.es_externo ?? false}
            />
            {trabajador && (
              <>
                <Casilla name="activo" etiqueta="Sigue laborando" defaultChecked={trabajador.activo} />
                <p className="text-xs text-tinta-500">
                  Al quitar la palomita deja de aparecer en contratos nuevos y en la nómina. Si trae
                  contratos abiertos hay que reasignarlos primero, o su saldo se quedaría sin quien
                  lo cobre.
                </p>
              </>
            )}
          </div>

          <MensajeError mensaje={estado.error ?? estadoBorrar.error} />
        </CuerpoDialogo>

        <PieFormulario
          onCerrar={onCerrar}
          guardar={nuevo ? 'Dar de alta' : 'Guardar'}
          borrado={
            trabajador
              ? {
                  pregunta: `¿Borrar a ${trabajador.nombre} por completo?`,
                  formAction: accionBorrar,
                }
              : undefined
          }
        />
      </form>
    </Dialogo>
  )
}
