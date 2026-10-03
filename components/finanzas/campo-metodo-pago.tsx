import { Campo, Seleccion } from '@/components/formulario'
import { METODO_PAGO_SIN_CAJA } from '@/lib/finanzas'
import type { MetodoPago } from '@/types/database'

/**
 * Con qué se pagó, en los diálogos que registran una salida de dinero (nómina,
 * raya, pagos fijos y programados). Sin caja chica: lo que sale de la caja se
 * captura como gasto, que es lo que descuenta su saldo.
 */
export function CampoMetodoPago({
  valor,
  onCambio,
}: {
  valor: MetodoPago
  onCambio: (metodo: MetodoPago) => void
}) {
  return (
    <Campo
      etiqueta="Método"
      ancho="medio"
      hijo={
        <Seleccion value={valor} onChange={(e) => onCambio(e.target.value as MetodoPago)}>
          {Object.entries(METODO_PAGO_SIN_CAJA).map(([clave, texto]) => (
            <option key={clave} value={clave}>
              {texto}
            </option>
          ))}
        </Seleccion>
      }
    />
  )
}
