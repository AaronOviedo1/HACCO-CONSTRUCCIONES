'use client'

import { useActionState, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  BotonGuardar, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, PieDialogo,
  Seleccion,
} from '@/components/formulario'
import { NOMBRE_ROL } from '@/lib/roles'
import { guardarTrabajador, type EstadoAccion } from '@/app/admin/usuarios/acciones'
import type { OficioTrabajador, Profile, RolUsuario } from '@/types/database'

const ROLES: RolUsuario[] = ['admin', 'administracion', 'contador', 'cuadrilla']

const OFICIOS: { valor: OficioTrabajador | ''; texto: string }[] = [
  { valor: '', texto: 'Sin oficio' },
  { valor: 'pintor', texto: 'Pintor' },
  { valor: 'herrero', texto: 'Herrero' },
  { valor: 'ayudante', texto: 'Ayudante' },
  { valor: 'otro', texto: 'Otro' },
]

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
      <FormularioTrabajador
        trabajador={trabajador}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
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
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="block w-full text-left"
      >
        {children}
      </button>
      <FormularioTrabajador
        trabajador={trabajador}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </>
  )
}

/**
 * La ficha de un trabajador. No hay alta: las cuentas se crean con la llave de
 * servicio desde `npm run usuarios:reales`, porque un perfil no existe sin su
 * usuario de Auth detrás. Aquí se corrigen los datos y se da de baja a quien
 * ya no labora — la baja es lógica, nunca un borrado: sus contratos y sus
 * recibos tienen que seguir en pie.
 */
export function FormularioTrabajador({
  trabajador,
  abierto,
  onCerrar,
}: {
  trabajador: Profile
  abierto: boolean
  onCerrar: () => void
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(guardarTrabajador, {})

  useEffect(() => {
    if (estado.ok) onCerrar()
  }, [estado, onCerrar])

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={trabajador.nombre}
      descripcion="El rol decide qué pantallas ve. Los externos no llevan retención Costo Haaco."
    >
      <form action={accion} className="flex min-h-0 flex-1 flex-col">
        <CuerpoDialogo>
          <input type="hidden" name="id" value={trabajador.id} />

          <Campo
            etiqueta="Nombre"
            hijo={<Entrada name="nombre" defaultValue={trabajador.nombre} required autoFocus />}
          />
          <Campo
            etiqueta="Teléfono"
            ancho="medio"
            hijo={<Entrada name="telefono" type="tel" defaultValue={trabajador.telefono ?? ''} />}
          />
          <Campo
            etiqueta="Correo"
            ancho="medio"
            hijo={<Entrada name="correo" type="email" defaultValue={trabajador.correo ?? ''} />}
            ayuda="Es con el que entra a la app; cambiarlo aquí no cambia su acceso."
          />
          <Campo
            etiqueta="Rol"
            ancho="medio"
            hijo={
              <Seleccion name="rol" defaultValue={trabajador.rol}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_ROL[r]}
                  </option>
                ))}
              </Seleccion>
            }
          />
          <Campo
            etiqueta="Oficio"
            ancho="medio"
            hijo={
              <Seleccion name="oficio" defaultValue={trabajador.oficio ?? ''}>
                {OFICIOS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.texto}
                  </option>
                ))}
              </Seleccion>
            }
          />

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Casilla
              name="es_externo"
              etiqueta="Es externo (sin retención Costo Haaco)"
              defaultChecked={trabajador.es_externo}
            />
            <Casilla
              name="activo"
              etiqueta="Sigue laborando"
              defaultChecked={trabajador.activo}
            />
            <p className="text-xs text-tinta-500">
              Al quitar la palomita deja de aparecer en contratos nuevos y en la nómina. Si trae
              contratos abiertos hay que reasignarlos primero, o su saldo se quedaría sin quien lo
              cobre.
            </p>
          </div>

          <MensajeError mensaje={estado.error} />
        </CuerpoDialogo>

        <PieDialogo>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <BotonGuardar />
        </PieDialogo>
      </form>
    </Dialogo>
  )
}
