'use client'

import { useActionState, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AreaTexto, BotonGuardar, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError,
  PieDialogo, Seleccion,
} from '@/components/formulario'
import { eliminarCliente, guardarCliente, type EstadoAccion } from '@/app/admin/acciones'
import type { Cliente } from '@/types/database'

const TITULOS = ['Sr.', 'Sra.', 'Srita.', 'Lic.', 'Arq.', 'Ing.', 'Dr.', 'Empresa']

export function BotonNuevoCliente({ etiqueta = 'Nuevo cliente' }: { etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Plus size={16} />
        {etiqueta}
      </button>
      <FormularioCliente abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  )
}

export function BotonEditarCliente({ cliente }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label={`Editar ${cliente.nombre}`}
      >
        <Pencil size={15} />
      </button>
      <FormularioCliente cliente={cliente} abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  )
}

export function FormularioCliente({
  cliente,
  abierto,
  onCerrar,
  onGuardado,
}: {
  cliente?: Cliente
  abierto: boolean
  onCerrar: () => void
  onGuardado?: (id: string) => void
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(guardarCliente, {})
  const [estadoBorrar, accionBorrar] = useActionState<EstadoAccion, FormData>(eliminarCliente, {})

  useEffect(() => {
    if (estado.ok) {
      if (estado.id) onGuardado?.(estado.id)
      onCerrar()
    }
  }, [estado, onCerrar, onGuardado])

  useEffect(() => {
    if (estadoBorrar.ok) onCerrar()
  }, [estadoBorrar, onCerrar])

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion="Los datos aparecen tal cual en la cotización y en el recibo."
    >
      <form action={accion} className="flex min-h-0 flex-1 flex-col">
        <CuerpoDialogo>
          {cliente && <input type="hidden" name="id" value={cliente.id} />}

          <Campo
            etiqueta="Nombre"
            hijo={
              <Entrada name="nombre" defaultValue={cliente?.nombre ?? ''} required autoFocus />
            }
          />
          <Campo
            etiqueta="Título de cortesía"
            ancho="medio"
            hijo={
              <Seleccion name="titulo_cortesia" defaultValue={cliente?.titulo_cortesia ?? 'Sr.'}>
                <option value="">Sin título</option>
                {TITULOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Seleccion>
            }
            ayuda="Se imprime en el «Atn.» de la cotización."
          />
          <Campo
            etiqueta="Teléfono"
            ancho="medio"
            hijo={<Entrada name="telefono" type="tel" defaultValue={cliente?.telefono ?? ''} />}
          />
          <Campo
            etiqueta="Correo"
            hijo={<Entrada name="correo" type="email" defaultValue={cliente?.correo ?? ''} />}
          />
          <Campo
            etiqueta="Domicilio"
            hijo={<AreaTexto name="domicilio" defaultValue={cliente?.domicilio ?? ''} rows={2} />}
          />
          <Campo
            etiqueta="Notas"
            hijo={<AreaTexto name="notas" defaultValue={cliente?.notas ?? ''} rows={2} />}
          />
          {cliente && (
            <Casilla name="activo" etiqueta="Cliente activo" defaultChecked={cliente.activo} />
          )}

          <MensajeError mensaje={estado.error ?? estadoBorrar.error} />
        </CuerpoDialogo>

        <PieDialogo>
          {cliente && (
            <button
              type="submit"
              formAction={accionBorrar}
              onClick={(e) => {
                if (!confirm(`¿Eliminar a ${cliente.nombre}? No se puede deshacer.`)) {
                  e.preventDefault()
                }
              }}
              className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={15} />
              Eliminar
            </button>
          )}
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
