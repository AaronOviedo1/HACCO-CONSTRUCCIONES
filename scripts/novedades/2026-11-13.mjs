/** Guion de capturas de la entrega del 13 de noviembre. Ver scripts/capturar-novedades.mjs. */
const escenas = [
  {
    // En el teléfono no hay botón que lleve a «Nueva cotización»: sólo la de
    // escritorio, que se enseña en los dos tamaños.
    tema: 'cos-pdf',
    variantes: ['escritorio'],
    ruta: '/admin/cotizaciones/nueva',
    selector: 'button:has-text("¿Viene de COS?")',
    foco: 'button:has-text("¿Viene de COS?") span.min-w-0',
  },
]

export default escenas
