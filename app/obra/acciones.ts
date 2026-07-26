'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type { TipoAvance } from '@/types/database'

export type Resultado = { ok: true } | { ok: false; error: string }

/**
 * La cuadrilla sube la foto directo a Storage desde el navegador (la política
 * de RLS ya sólo le permite su carpeta) y aquí sólo se guarda el registro.
 */
export async function registrarAvance(
  obraId: string,
  datos: { tipo: TipoAvance; storage_path: string | null; comentario: string; porcentaje: number | null },
): Promise<Resultado> {
  const perfil = await requerirRol(['cuadrilla'])
  const supabase = await crearClienteServidor()

  if (!datos.storage_path && !datos.comentario.trim()) {
    return { ok: false, error: 'Sube una foto o escribe una nota.' }
  }

  const { error } = await supabase.from('avances').insert({
    obra_id: obraId,
    autor_id: perfil.id,
    tipo: datos.tipo,
    storage_path: datos.storage_path,
    comentario: datos.comentario.trim() || null,
    porcentaje_avance: datos.porcentaje,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/obra')
  revalidatePath(`/obra/${obraId}`)
  return { ok: true }
}

/** Lista de material que captura el herrero para que administración la cotice. */
export async function pedirMaterial(
  obraId: string,
  items: { material: string; cantidad: string; unidad: string; notas: string }[],
): Promise<Resultado> {
  const perfil = await requerirRol(['cuadrilla'])
  const supabase = await crearClienteServidor()

  const limpios = items
    .filter((i) => i.material.trim())
    .map((i) => ({
      material: i.material.trim(),
      cantidad: Number(i.cantidad) || 1,
      unidad: i.unidad.trim() || 'pza',
      notas: i.notas.trim() || null,
    }))

  if (limpios.length === 0) return { ok: false, error: 'Agrega al menos un material.' }

  const { error } = await supabase.from('solicitudes_material').insert({
    obra_id: obraId,
    autor_id: perfil.id,
    items: limpios,
    estatus: 'pendiente',
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/obra/${obraId}`)
  revalidatePath('/admin/obras')
  return { ok: true }
}
