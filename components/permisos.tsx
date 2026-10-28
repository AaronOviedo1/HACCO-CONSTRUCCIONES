'use client'

import { createContext, useContext } from 'react'

/**
 * Si quien usa el panel es de oficina (Dirección o Administración) o es el
 * residente. Al residente no le salen la cobranza ni los botones de borrar,
 * cerrar una obra o meterle dinero a la caja: la base ya se los niega, y un
 * botón que siempre contesta «no tienes permiso» sólo estorba.
 *
 * Va en contexto, puesto una vez en el layout del panel, porque esos botones
 * están regados por toda la app y pasar la bandera de mano en mano por cada
 * componente ensuciaba las firmas.
 */
const Oficina = createContext(true)

export function ProveedorOficina({
  oficina,
  children,
}: {
  oficina: boolean
  children: React.ReactNode
}) {
  return <Oficina.Provider value={oficina}>{children}</Oficina.Provider>
}

export function useEsOficina() {
  return useContext(Oficina)
}
