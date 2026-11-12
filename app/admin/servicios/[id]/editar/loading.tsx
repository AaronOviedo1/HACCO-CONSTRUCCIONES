import { Esqueleto, EsqueletoEncabezado, EsqueletoFormulario } from '@/components/esqueletos'

/**
 * Esqueleto del formulario para corregir una cita.
 *
 * La ficha de la cita vive en el grupo `(ficha)` para que su esqueleto no se
 * asome aquí antes que éste: sin el grupo, el `loading.tsx` de `[id]`
 * envolvía también a `editar`.
 */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando cita">
      <EsqueletoEncabezado />
      <EsqueletoFormulario />
      <div className="mt-4 h-[46px] rounded-xl bg-tinta-150 lg:h-9 lg:w-40 lg:rounded-lg" />
    </Esqueleto>
  )
}
