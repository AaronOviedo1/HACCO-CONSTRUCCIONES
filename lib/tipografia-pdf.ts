import 'server-only'
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

/**
 * La tipografía de los documentos.
 *
 * El manual pide Circular Std Medium para el texto, que es comercial y no está
 * en el repo; la app la sustituye desde hace tiempo por Figtree, geométrica y
 * de la misma familia de formas. Aquí registramos esa misma Figtree para que el
 * papel y la pantalla dejen de ir por caminos distintos: hasta ahora los PDFs
 * salían enteros en Helvetica.
 *
 * De paso arregla los acentos. Las fuentes que trae el PDF por dentro sólo
 * cubren WinAnsi, y los documentos usan «», ·, ² y el signo menos de verdad.
 *
 * Los archivos son WOFF y no TTF porque es lo que entrega Google Fonts para
 * Figtree —arriba sólo existe la variable, que react-pdf no sabe instanciar—.
 * fontkit los lee igual. Viajan al servidor por `outputFileTracingIncludes`,
 * en next.config.ts; si se mueven de sitio, hay que moverlo también allá.
 */
const tipografia = (archivo: string) =>
  path.join(process.cwd(), 'assets/tipografias', archivo)

// Las cuatro variantes hacen falta: con Helvetica la cursiva salía sola porque
// es una de las catorce fuentes que todo lector de PDF trae dentro, pero una
// familia registrada a mano sólo tiene lo que se le declara. Sin la cursiva,
// react-pdf no maquilla nada: revienta el documento entero.
Font.register({
  family: 'Figtree',
  fonts: [
    { src: tipografia('Figtree-Regular.woff'), fontWeight: 400 },
    { src: tipografia('Figtree-Bold.woff'), fontWeight: 700 },
    { src: tipografia('Figtree-Italic.woff'), fontWeight: 400, fontStyle: 'italic' },
    { src: tipografia('Figtree-BoldItalic.woff'), fontWeight: 700, fontStyle: 'italic' },
  ],
})

// Sin esto react-pdf parte las palabras largas con guion a mitad de renglón, y
// en un contrato eso se lee como un error de redacción.
Font.registerHyphenationCallback((palabra) => [palabra])
