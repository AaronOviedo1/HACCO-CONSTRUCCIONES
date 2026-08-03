'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AreaTexto, BotonGuardar, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError,
  PieDialogo, Seleccion,
} from '@/components/formulario'
import { CampoDomicilio } from '@/components/campo-domicilio'
import { Etiqueta, Td } from '@/components/ui'
import { pesos } from '@/lib/format'
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

/**
 * El mismo cliente, en el teléfono.
 *
 * La tabla no cabe en 393 px —quedaban tres columnas y el resto se iba de
 * lado—, así que cada cliente es un renglón con lo que de verdad se busca:
 * cómo se llama, cómo localizarlo y cuánto lleva contratado.
 */
export function FilaClienteMovil({
  cliente,
  cotizaciones,
  contratado,
}: {
  cliente: Cliente
  cotizaciones: number
  contratado: number
}) {
  const [abierto, setAbierto] = useState(false)
  const contacto = [cliente.telefono, cliente.correo, cliente.domicilio]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-between gap-2.5 border-b-[0.5px] border-tinta-100 px-4 py-3 text-left transition last:border-b-0 active:bg-tinta-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-medium text-tinta-900">
              {cliente.titulo_cortesia ? `${cliente.titulo_cortesia} ` : ''}
              {cliente.nombre}
            </span>
            {!cliente.activo && <Etiqueta tono="gris">Inactivo</Etiqueta>}
          </span>
          {contacto && (
            <span className="mt-0.5 block truncate text-[11.5px] text-tinta-400">{contacto}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-[3px]">
          <span className="text-sm font-semibold tabular-nums text-tinta-900">
            {contratado > 0 ? pesos(contratado) : '—'}
          </span>
          <span className="text-[10.5px] text-tinta-400">
            {cotizaciones} {cotizaciones === 1 ? 'cotización' : 'cotizaciones'}
          </span>
        </span>
      </button>
      <FormularioCliente cliente={cliente} abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  )
}

/**
 * Un renglón de la tabla de clientes.
 *
 * El cliente no tiene pantalla propia: su ficha es este formulario, así que
 * tocar cualquier parte del renglón lo abre. El nombre es un botón de verdad
 * —se llega con el tabulador— y su área invisible cubre toda la fila; el lápiz
 * se queda para que se vea que el renglón hace algo.
 */
export function FilaCliente({ cliente, children }: { cliente: Cliente; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <tr className="relative cursor-pointer hover:bg-tinta-50/60">
      <Td className="font-medium text-tinta-900">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex items-center gap-2 text-left after:absolute after:inset-0"
        >
          {cliente.titulo_cortesia ? `${cliente.titulo_cortesia} ` : ''}
          {cliente.nombre}
          {!cliente.activo && <Etiqueta tono="gris">Inactivo</Etiqueta>}
        </button>
      </Td>

      {children}

      <Td className="w-10">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="relative rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
          aria-label={`Editar ${cliente.nombre}`}
        >
          <Pencil size={15} />
        </button>
        <FormularioCliente cliente={cliente} abierto={abierto} onCerrar={() => setAbierto(false)} />
      </Td>
    </tr>
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
  // El domicilio se controla aparte porque lo llena Google; viaja al servidor
  // en un campo oculto para no cambiar la acción.
  const [domicilio, setDomicilio] = useState(cliente?.domicilio ?? '')

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
            hijo={
              <>
                <CampoDomicilio valor={domicilio} onCambio={setDomicilio} />
                <input type="hidden" name="domicilio" value={domicilio} />
              </>
            }
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
