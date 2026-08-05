/**
 * Preferencias de lectura que viajan en cookie: el servidor las necesita para
 * pintar la pantalla ya como el usuario la dejó, y el cliente para escribirlas.
 * Viven en su propio módulo porque las tocan los dos lados.
 */

/** Meses plegados por lista. Ver `lib/meses-plegados.ts` y `components/meses.tsx`. */
export const COOKIE_MESES = 'haaco_meses'
