import { Esqueleto, EsqueletoEncabezado, EsqueletoMenu } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando perfil">
      <EsqueletoEncabezado descripcion={false} />
      <EsqueletoMenu grupos={[4, 4, 3]} />
    </Esqueleto>
  )
}
