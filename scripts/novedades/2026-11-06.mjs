/** Guion de capturas de la entrega del 6 de noviembre. Ver scripts/capturar-novedades.mjs. */

// Un cliente con teléfono, para que salgan los dos botones.
const escenas = [
  {
    tema: 'estado-de-cuenta',
    variantes: ['escritorio'],
    ruta: '/admin/cobranza?t=clientes',
    selector: 'tr:has(button:has-text("Enviar al cliente")) td:last-child',
  },
  {
    tema: 'estado-de-cuenta',
    variantes: ['movil'],
    ruta: '/admin/cobranza?t=clientes',
    selector: 'article:has(button:has-text("Enviar al cliente"))',
  },
]

export default escenas
