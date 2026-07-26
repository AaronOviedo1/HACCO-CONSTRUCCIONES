'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AreaTexto, BotonGuardar, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError,
  Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import {
  eliminarHerramienta, eliminarProducto, eliminarProveedor, eliminarTexto,
  guardarHerramienta, guardarProducto, guardarProveedor, guardarTexto, moverKardex,
  type EstadoAccion,
} from '@/app/admin/acciones'
import { hoyISO } from '@/lib/cotizaciones'
import type { Herramienta, Producto, Proveedor, TextoProceso } from '@/types/database'

// ---------------------------------------------------------------------------
// Disparadores
// ---------------------------------------------------------------------------
export function BotonNuevo({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: (abierto: boolean, cerrar: () => void) => ReactNode
}) {
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
      {children(abierto, () => setAbierto(false))}
    </>
  )
}

export function BotonEditar({
  titulo,
  children,
}: {
  titulo: string
  children: (abierto: boolean, cerrar: () => void) => ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label={titulo}
      >
        <Pencil size={15} />
      </button>
      {children(abierto, () => setAbierto(false))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Envoltura común: form + pie con eliminar/cancelar/guardar
// ---------------------------------------------------------------------------
function Formulario({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  accionGuardar,
  accionEliminar,
  confirmacionBorrado,
  ancho,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  accionGuardar: (prev: EstadoAccion, d: FormData) => Promise<EstadoAccion>
  accionEliminar?: (prev: EstadoAccion, d: FormData) => Promise<EstadoAccion>
  confirmacionBorrado?: string
  ancho?: 'md' | 'lg' | 'xl'
  children: ReactNode
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(accionGuardar, {})
  const [estadoBorrar, accionBorrar] = useActionState<EstadoAccion, FormData>(
    accionEliminar ?? accionGuardar,
    {},
  )

  useEffect(() => {
    if (estado.ok || estadoBorrar.ok) onCerrar()
  }, [estado.ok, estadoBorrar.ok, onCerrar])

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={titulo} descripcion={descripcion} ancho={ancho}>
      <form action={accion} className="flex min-h-0 flex-1 flex-col">
        <CuerpoDialogo>
          {children}
          <MensajeError mensaje={estado.error ?? estadoBorrar.error} />
        </CuerpoDialogo>
        <PieDialogo>
          {accionEliminar && (
            <button
              type="submit"
              formAction={accionBorrar}
              onClick={(e) => {
                if (!confirm(confirmacionBorrado ?? '¿Eliminar este registro?')) e.preventDefault()
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

// ---------------------------------------------------------------------------
// PROVEEDOR
// ---------------------------------------------------------------------------
export function FormularioProveedor({
  proveedor,
  abierto,
  onCerrar,
}: {
  proveedor?: Proveedor
  abierto: boolean
  onCerrar: () => void
}) {
  return (
    <Formulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      descripcion="Los días de crédito se copian solos a la cuenta por pagar."
      accionGuardar={guardarProveedor}
      accionEliminar={proveedor ? eliminarProveedor : undefined}
      confirmacionBorrado={`¿Eliminar a ${proveedor?.nombre}?`}
    >
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}
      <Campo etiqueta="Nombre" hijo={<Entrada name="nombre" defaultValue={proveedor?.nombre ?? ''} required />} />
      <Campo
        etiqueta="Días de crédito"
        ancho="medio"
        hijo={<Numero name="dias_credito_default" defaultValue={proveedor?.dias_credito_default ?? 0} />}
        ayuda="0 = contado"
      />
      <Campo
        etiqueta="Teléfono"
        ancho="medio"
        hijo={<Entrada name="telefono" type="tel" defaultValue={proveedor?.telefono ?? ''} />}
      />
      <Campo etiqueta="Contacto" hijo={<Entrada name="contacto" defaultValue={proveedor?.contacto ?? ''} />} />
      <Campo etiqueta="Notas" hijo={<AreaTexto name="notas" defaultValue={proveedor?.notas ?? ''} rows={2} />} />
      {proveedor && <Casilla name="activo" etiqueta="Proveedor activo" defaultChecked={proveedor.activo} />}
    </Formulario>
  )
}

// ---------------------------------------------------------------------------
// PRODUCTO / INSUMO
// ---------------------------------------------------------------------------
export function FormularioProducto({
  producto,
  proveedores,
  esInsumo = false,
  abierto,
  onCerrar,
}: {
  producto?: Producto
  proveedores: Pick<Proveedor, 'id' | 'nombre'>[]
  esInsumo?: boolean
  abierto: boolean
  onCerrar: () => void
}) {
  const titulo = esInsumo
    ? producto ? 'Editar insumo' : 'Nuevo insumo de taller'
    : producto ? 'Editar producto' : 'Nuevo producto'

  return (
    <Formulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={
        esInsumo
          ? 'La existencia se mueve desde el kardex, no desde aquí.'
          : 'Las pinturas y materiales que se citan en las cotizaciones.'
      }
      accionGuardar={guardarProducto}
      accionEliminar={producto ? eliminarProducto : undefined}
      confirmacionBorrado={`¿Eliminar ${producto?.nombre}?`}
    >
      {producto && <input type="hidden" name="id" value={producto.id} />}
      {esInsumo && <input type="hidden" name="tipo" value="insumo_taller" />}

      <Campo etiqueta="Nombre" hijo={<Entrada name="nombre" defaultValue={producto?.nombre ?? ''} required />} />
      <Campo
        etiqueta="Código"
        ancho="medio"
        hijo={<Entrada name="codigo" defaultValue={producto?.codigo ?? ''} placeholder="E-8325" />}
      />
      <Campo
        etiqueta="Unidad"
        ancho="medio"
        hijo={
          <Seleccion name="unidad" defaultValue={producto?.unidad ?? 'pza'}>
            {['pza', 'cubeta', 'litro', 'galón', 'rollo', 'par', 'kg', 'm', 'm²', 'servicio'].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Seleccion>
        }
      />
      {!esInsumo && (
        <Campo
          etiqueta="Tipo"
          ancho="medio"
          hijo={
            <Seleccion name="tipo" defaultValue={producto?.tipo ?? 'pintura'}>
              <option value="pintura">Pintura</option>
              <option value="herreria">Herrería</option>
              <option value="otro">Otro</option>
            </Seleccion>
          }
        />
      )}
      <Campo
        etiqueta="Proveedor"
        ancho="medio"
        hijo={
          <Seleccion name="proveedor_id" defaultValue={producto?.proveedor_id ?? ''}>
            <option value="">Sin asignar</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Seleccion>
        }
      />
      <Campo
        etiqueta="Costo unitario"
        ancho="medio"
        hijo={<Numero name="costo" defaultValue={producto?.costo ?? ''} placeholder="0.00" />}
      />
      <Campo
        etiqueta="IVA"
        ancho="medio"
        hijo={<Numero name="iva" defaultValue={producto?.iva ?? ''} placeholder="se calcula al 16%" />}
        ayuda="Déjalo vacío y se calcula solo."
      />
      <Campo etiqueta="Notas" hijo={<AreaTexto name="notas" defaultValue={producto?.notas ?? ''} rows={2} />} />
      {producto && <Casilla name="activo" etiqueta="Activo" defaultChecked={producto.activo} />}
    </Formulario>
  )
}

// ---------------------------------------------------------------------------
// MOVIMIENTO DE KARDEX
// ---------------------------------------------------------------------------
export function BotonMovimiento({
  producto,
  tipo,
}: {
  producto: { producto_id: string; nombre: string; unidad: string }
  tipo: 'entrada' | 'salida'
}) {
  const [abierto, setAbierto] = useState(false)
  const esEntrada = tipo === 'entrada'

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`rounded-lg p-1.5 transition ${
          esEntrada
            ? 'text-haaco-600 hover:bg-haaco-50'
            : 'text-amber-600 hover:bg-amber-50'
        }`}
        aria-label={`${esEntrada ? 'Entrada' : 'Salida'} de ${producto.nombre}`}
        title={esEntrada ? 'Registrar entrada' : 'Registrar salida'}
      >
        {esEntrada ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
      </button>

      <Formulario
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={esEntrada ? 'Entrada al taller' : 'Salida del taller'}
        descripcion={producto.nombre}
        accionGuardar={moverKardex}
      >
        <input type="hidden" name="producto_id" value={producto.producto_id} />
        <input type="hidden" name="tipo" value={tipo} />
        <Campo
          etiqueta={`Cantidad (${producto.unidad})`}
          ancho="medio"
          hijo={<Numero name="cantidad" required autoFocus placeholder="0" />}
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<Entrada type="date" name="fecha" defaultValue={hoyISO()} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={
            <AreaTexto
              name="notas"
              rows={2}
              placeholder={esEntrada ? 'Compra a Ferrecasa' : 'Salida a obra La Jolla'}
            />
          }
        />
      </Formulario>
    </>
  )
}

// ---------------------------------------------------------------------------
// TEXTO DE PROCESO
// ---------------------------------------------------------------------------
export function FormularioTexto({
  texto,
  abierto,
  onCerrar,
}: {
  texto?: TextoProceso
  abierto: boolean
  onCerrar: () => void
}) {
  return (
    <Formulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={texto ? 'Editar texto de proceso' : 'Nuevo texto de proceso'}
      descripcion="Se imprime como bullet en «Descripción del trabajo». {PRODUCTO} se sustituye al cotizar."
      accionGuardar={guardarTexto}
      accionEliminar={texto ? eliminarTexto : undefined}
      confirmacionBorrado={`¿Eliminar «${texto?.titulo}»?`}
      ancho="lg"
    >
      {texto && <input type="hidden" name="id" value={texto.id} />}
      <Campo etiqueta="Título" hijo={<Entrada name="titulo" defaultValue={texto?.titulo ?? ''} required />} />
      <Campo
        etiqueta="Contenido"
        hijo={<AreaTexto name="contenido" defaultValue={texto?.contenido ?? ''} rows={4} required />}
      />
      <Campo etiqueta="Orden" ancho="medio" hijo={<Numero name="orden" defaultValue={texto?.orden ?? 0} />} />
      {texto && <Casilla name="activo" etiqueta="Activo" defaultChecked={texto.activo} />}
    </Formulario>
  )
}

// ---------------------------------------------------------------------------
// HERRAMIENTA
// ---------------------------------------------------------------------------
export function FormularioHerramienta({
  herramienta,
  abierto,
  onCerrar,
}: {
  herramienta?: Herramienta
  abierto: boolean
  onCerrar: () => void
}) {
  return (
    <Formulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={herramienta ? 'Editar herramienta' : 'Nueva herramienta'}
      descripcion="El valor es el que se asienta en el pagaré cuando se presta."
      accionGuardar={guardarHerramienta}
      accionEliminar={herramienta ? eliminarHerramienta : undefined}
      confirmacionBorrado={`¿Eliminar ${herramienta?.codigo}?`}
    >
      {herramienta && <input type="hidden" name="id" value={herramienta.id} />}
      <Campo
        etiqueta="Código"
        ancho="medio"
        hijo={<Entrada name="codigo" defaultValue={herramienta?.codigo ?? ''} required placeholder="LR-5" />}
      />
      <Campo
        etiqueta="Marca"
        ancho="medio"
        hijo={<Entrada name="marca" defaultValue={herramienta?.marca ?? ''} />}
      />
      <Campo etiqueta="Herramienta" hijo={<Entrada name="nombre" defaultValue={herramienta?.nombre ?? ''} required />} />
      <Campo
        etiqueta="Valor"
        ancho="medio"
        hijo={<Numero name="valor" defaultValue={herramienta?.valor ?? ''} placeholder="0.00" />}
      />
      <Campo
        etiqueta="Estado"
        ancho="medio"
        hijo={
          <Seleccion name="estado" defaultValue={herramienta?.estado ?? 'disponible'}>
            <option value="disponible">Disponible</option>
            <option value="en_obra">En obra</option>
            <option value="fuera_servicio">Fuera de servicio</option>
          </Seleccion>
        }
      />
      <Campo
        etiqueta="Ubicación"
        hijo={<Entrada name="ubicacion" defaultValue={herramienta?.ubicacion ?? 'Taller'} />}
        ayuda="«Taller» o el nombre del oficial que la trae."
      />
      <Campo etiqueta="Notas" hijo={<AreaTexto name="notas" defaultValue={herramienta?.notas ?? ''} rows={2} />} />
    </Formulario>
  )
}
