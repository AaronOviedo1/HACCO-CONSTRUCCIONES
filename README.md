# HaacoPro

Sistema de gestión de **HAACO PRO RECUBRIMIENTOS** — pintura y herrería, Hermosillo, Sonora.
Sustituye los ~13 archivos de Excel y el grupo de WhatsApp con los que opera hoy la empresa.

**Concepto central:** la cotización (folio `F-###`) es la raíz de todo. De ella cuelgan una o
varias órdenes de trabajo, la cobranza, los contratos de mano de obra, los materiales y los
documentos legales.

```
Cotización F-452
├── OT 26000001 · La Jolla Exterior ──┬── Contrato del oficial ── Pagaré de herramientas
│                                     ├── Avances (fotos, %)
│                                     ├── Materiales cotizado / real
│                                     └── Póliza de garantía H405-26
├── OT 26000002 · La Jolla Interior
└── Cobranza: anticipo 50% + abonos + liquidación
```

## Stack

| Pieza | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) + TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos | Supabase — Postgres con RLS, Auth y Storage privado |
| PDF | `@react-pdf/renderer`, generado en el servidor |
| Excel | `exceljs`, un archivo por reporte o el libro completo |
| Lectura de tickets | Claude (`@anthropic-ai/sdk`), sólo desde el servidor en `/api/ticket` |
| Avisos al teléfono | `web-push` + el service worker de `public/sw.js` |
| Mensualidad de la app | Stripe: suscripción, portal y webhook |
| Deploy | Vercel, con un cron diario (`vercel.json`) |

> **Next.js 16 no es el de siempre.** Cambian APIs y convenciones —por ejemplo, el
> antiguo `middleware.ts` aquí se llama [proxy.ts](proxy.ts)—. Antes de escribir código de
> framework, lee la guía que toque en `node_modules/next/dist/docs/`.

---

## 1 · Puesta en marcha local

### Requisitos

Node 20 o superior y una cuenta de Supabase. Nada más.

### Paso 1 · Crear el proyecto de Supabase

En [supabase.com](https://supabase.com) → **New project**.
Región recomendada `us-west-1`, que es la más cercana a Hermosillo.

### Paso 2 · Llenar `.env.local`

```bash
cp .env.example .env.local
```

| Variable | Dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role — **nunca** se expone al navegador |
| `SUPABASE_DB_URL` | Settings → Database → Connection string → URI |
| `CRON_SECRET` | La inventas tú. Sin ella las tareas de la mañana no corren |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | `node -e "console.log(require('web-push').generateVAPIDKeys())"`. Sin ellas no hay avisos en el teléfono; los recordatorios se siguen viendo en el tablero |

Las demás son opcionales y cada una apaga sólo su función si falta: `GOOGLE_PLACES_API_KEY`
(sugerencias de domicilio), `ANTHROPIC_API_KEY` (lectura de tickets), `CORREO_AVISOS`, las
cuatro `STRIPE_*` (mensualidad de la app) y `DEV_AUTOLOGIN*` (entrar a localhost sin teclear
credenciales). [.env.example](.env.example) explica cada una, de dónde sale y qué pasa sin ella:
es la referencia completa.

Los datos del membrete (`NEXT_PUBLIC_EMPRESA_*`) se usan en cotizaciones, recibos, contratos,
pagarés y pólizas. Llena al menos teléfono y correo antes de mandar documentos a un cliente.

### Paso 3 · Aplicar el esquema

```bash
npm install
npx supabase link --project-ref <tu-ref>
npm run bd:push      # aplica supabase/migrations en orden
npm run bd:seed      # catálogo real: proveedores, pinturas, insumos y 57 herramientas
```

El seed es idempotente: se puede correr las veces que haga falta sin duplicar nada.

### Paso 4 · Crear el primer usuario administrador

```bash
npm run usuarios:demo
```

Genera una cuenta por rol con la contraseña `HaacoPro2026!`:

| Correo | Rol | Entra a |
|---|---|---|
| `luis@haacopro.mx` | Dirección (admin) | `/admin` |
| `pati@haacopro.mx` | Dirección (admin) | `/admin` |
| `jorge@haacopro.mx` | Cuadrilla · pintor | `/obra` |
| `alejandro@haacopro.mx` | Cuadrilla · herrero | `/obra` |
| `contador@haacopro.mx` | Contador | `/admin/reportes` |

> **Cambia las contraseñas antes de usar la app con datos reales.** No hay registro público: en
> adelante las cuentas las crea Dirección desde Supabase → Authentication → Add user, poniendo
> en *User Metadata* el JSON `{"nombre": "...", "rol": "cuadrilla", "oficio": "pintor"}`.
> Un trigger crea el perfil automáticamente con ese rol.

Si prefieres crear el primer admin a mano en vez de correr el script:

1. Supabase → Authentication → **Add user** → correo y contraseña, marca *Auto Confirm*.
2. En **User Metadata** pega `{"nombre": "Luis Enrique Inda Franco", "rol": "admin"}`.
3. Listo: el trigger `nuevo_usuario` crea su fila en `profiles` con rol admin.

### Paso 5 · Levantar la app

```bash
npm run dev          # http://localhost:3002
```

Si `.env.local` apunta a una Supabase local, `npm run dev` la enciende sola antes de arrancar
(`scripts/levantar-supabase.mjs`); con un proyecto remoto ese paso se hace a un lado.

Mientras falten las llaves de Supabase, la app redirige a `/instalacion` con la lista de pasos
pendientes en lugar de tronar.

---

## 2 · Deploy en Vercel

```bash
npm i -g vercel@latest
vercel link
```

Carga las variables de entorno (una por una o con `vercel env pull` / `vercel env add`):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_EMPRESA_TELEFONO production
vercel env add NEXT_PUBLIC_EMPRESA_CORREO production
```

`SUPABASE_DB_URL` sólo hace falta en local para correr el seed; no la subas a Vercel.

```bash
vercel --prod
```

Después del primer deploy, en Supabase → Authentication → **URL Configuration** agrega el
dominio de Vercel a *Site URL* y a *Redirect URLs*.

**Los PDF y el Excel se generan en el servidor**, así que las rutas de `/api` corren en Node
(no en Edge). Ya está configurado en `next.config.ts` con `serverExternalPackages`.

---

## 3 · Roles

| Rol | Entra a | Qué ve |
|---|---|---|
| **admin** (Luis, Pati) | `/admin` | Todo, incluida la gestión de usuarios |
| **administracion** | `/admin` | Todo lo operativo y administrativo, sin usuarios |
| **cuadrilla** (pintor/herrero) | `/obra` | Sólo sus obras: avances, materiales, su contrato, su pagaré y su cronograma. Nunca dinero ajeno |
| **contador** | `/admin/reportes` | Sólo lectura de reportes y exportación a Excel |

El encaminamiento vive en [proxy.ts](proxy.ts), pero **la seguridad real está en las políticas
RLS de Postgres**: aunque alguien llame a la API directamente, la base de datos sólo le devuelve
lo que le toca. Las operaciones que mutan datos empiezan con una guarda `exigir_staff()`.

---

## 4 · Qué hace cada módulo

| Módulo | Qué resuelve |
|---|---|
| **Catálogo** | Clientes, proveedores con días de crédito, pinturas, insumos de taller con kardex, textos de proceso, herramientas |
| **Precios del material** | Sin pantalla propia: cada factura deja el precio de lo que se compró, el cotizador enseña el último pagado con su folio y antigüedad, y el historial se consulta en la ficha del producto, dentro de Catálogo |
| **Cotizaciones** | Folio `F-###`, editor con totales en vivo, bullets de proceso, duplicar variantes, PDF con el formato real y compartir por WhatsApp |
| **Recordatorios** | Una fecha pegada a la cotización: sale en el tablero, se pasa al Google Calendar y llega como aviso al teléfono a las 7 de la mañana |
| **Cotizador de herrería** | Materiales + mano de obra + 5% indirectos → precio de venta con el % de utilidad |
| **Cotización rápida** | Cuatro pasos con botones grandes para levantar en sitio desde el iPad |
| **Obras (OTs)** | Concentrado cotizado/real/%, contratos, avances, materiales, conceptos, cronograma, documentos y cierre |
| **Documentos** | Recibo-contrato de anticipo, contrato por obra determinada, pagaré de herramientas, póliza de garantía y recibo de abono a mano de obra |
| **Cuadrilla** | Subir avance con foto en dos taps; el herrero solicita material |
| **Gastos** | Foto del ticket; a crédito abre la cuenta por pagar y como material alimenta la OT |
| **Cobranza** | Anticipo, abonos y liquidación con comprobante, más el concentrado del contador |
| **Nómina por avance** | Devengado por % de obra, préstamos, prenómina y recibo de abono |
| **Cuentas por pagar** | Abonos parciales, estados automáticos y dashboard por proveedor |
| **Pagos fijos y caja chica** | Quincenas con recurrencia y saldo de efectivo |
| **Servicios** | Reparaciones y mantenimientos preventivos: visita, anticipo, cobro y la siguiente revisión a los seis meses |
| **Raya semanal** | Sueldo fijo semanal de los pintores, repartido entre las obras que se indiquen |
| **Reportes** | Cierre mensual completo, exportable a Excel y PDF |
| **Novedades** | El aviso de «lo nuevo» que ve cada rol al entrar tras una entrega; se escribe en `lib/novedades.ts` |
| **Suscripción** | La mensualidad de la app, cobrada con Stripe. Si se vence, [proxy.ts](proxy.ts) manda a Dirección a `/admin/suscripcion` y al resto a `/bloqueada` |

---

## 5 · Reglas de negocio codificadas en la base

Estas no dependen de la interfaz: las hace cumplir Postgres.

| Regla | Cómo |
|---|---|
| Folio `F-###` consecutivo | Trigger sobre `cotizaciones` con tabla `consecutivos` |
| OT `AA######` (2026 → `26000001`) | Trigger sobre `obras` con corte anual |
| Póliza `H###-AA`, recibos `R-###` y `N-###` | Triggers con su propia serie |
| Anticipo 50% pintura / 60% herrería | Trigger según el tipo, editable después |
| Subtotal y total con IVA de la cotización | Se recalculan al tocar las partidas |
| Precio de venta de herrería | Columna generada: (materiales + MO) × indirectos × utilidad |
| Retención Costo Haaco 5% | Columna generada; 0% automático si el trabajador es externo |
| Valor del pagaré | Suma automática de las herramientas prestadas |
| Herramienta prestada / devuelta | Cambia de estado y ubicación sola al armar o cerrar el pagaré |
| Gasto a crédito → cuenta por pagar | Trigger que copia los días de crédito del proveedor |
| Gasto de material de obra → material REAL | Misma transacción, sin doble conteo en el concentrado |
| Vencimiento, saldo y estado de las CxP | Columnas generadas + vista `v_cuentas_por_pagar` |
| % de avance de la OT | Lo actualiza el último avance que sube la cuadrilla |
| Devengado de nómina | Total del contrato × avance reportado, menos lo ya abonado |
| Bitácora de obra | Triggers: cambios de estatus, movimientos de fecha, avances, pagarés |
| Cierre de obra | Cancela pagarés, devuelve herramienta, cierra contratos y marca la cotización terminada |
| Quincena recurrente | Copia los pagos marcados como recurrentes sin duplicar |

Detalle completo del esquema y de las funciones en [supabase/README.md](supabase/README.md).

---

## 6 · Mapa del código

```
proxy.ts               Encamina cada petición según sesión y rol (el «middleware» de Next 16)
app/
  login/  instalacion/  bloqueada/     Entrada, pasos pendientes de configuración y suscripción vencida
  admin/               Panel de Dirección y Administración: una carpeta por pantalla
    */acciones.ts      Server actions de ese módulo (las de dinero viven juntas en finanzas-acciones.ts)
  obra/                La app de la cuadrilla, pensada para el teléfono
  api/                 Lo que no es pantalla: PDFs, Excel, lectura de tickets, cron, Stripe
components/
  ui.tsx               Piezas de servidor: encabezados, tarjetas, tablas, etiquetas, botones
  formulario.tsx       Piezas de formulario: diálogo, campos, pie con guardar/cancelar
  movil/               Piezas y navegación de la vista de teléfono
  <módulo>/            Los componentes de cada módulo (cotizaciones, obras, finanzas, servicios…)
lib/
  format.ts            Pesos, fechas y monto con letra
  acciones.ts          Leer un FormData con tipos y traducir los errores de Postgres
  auth.ts  roles.ts    Sesión, perfil y guardas por rol
  supabase/            Los tres clientes: navegador, servidor (con cookies) y servicio (sin RLS)
  cotizaciones.ts  obras.ts  finanzas.ts  cobranza.ts  servicios.ts  reportes.ts  precios.ts
                       Las cuentas y etiquetas de cada módulo, sin React ni base de datos
  pdf.ts  excel.ts     Envolturas para responder un PDF o armar un libro de Excel
  stripe/              Cliente, estados y sincronización de la suscripción
  novedades.ts         Lo nuevo de cada entrega (se actualiza antes de desplegar)
types/database.ts      Los tipos de tablas, vistas y enumeraciones, escritos a mano
supabase/migrations/   El esquema, en orden. La seguridad real (RLS) y las reglas de negocio viven aquí
scripts/               Herramientas de terminal: migraciones, respaldos, datos de ejemplo, iconos, pruebas
```

Tres convenciones que se repiten en todo el código:

- **Las cuentas viven en `lib/`, no en las pantallas.** Una página pide los datos y pinta; si
  hay que sumar, redondear o decidir un estado, la función está en el `lib/` de su módulo y por
  eso se puede probar sin navegador.
- **Toda acción de formulario devuelve un `EstadoAccion`** (`{ ok }` o `{ error }`, ver
  `lib/acciones.ts`) y empieza por una guarda de rol. El componente la consume con
  `useActionState`.
- **Los comentarios explican el porqué**, casi siempre el tropiezo que motivó el código. Si
  cambias algo que tiene un comentario así, léelo antes: suele describir el error que vuelve si
  se quita.

---

## 7 · Comandos

**Día a día**

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3002 |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Comprobación de tipos |
| `npm run probar:cuadre` · `probar:cobranza` · `probar:servicios` | Pruebas de las cuentas de `lib/`. No tocan la base |

Antes de dar por bueno un cambio: tipos, lint, las tres pruebas y `npm run build`.

**Base de datos**

| Comando | Qué hace |
|---|---|
| `npm run bd:push` | Aplica las migraciones pendientes a la base de `.env.local` |
| `npm run bd:push:prod` | Lo mismo contra **producción**. Respalda antes con `bd:respaldar` |
| `npm run bd:seed` | Carga el catálogo inicial (idempotente) |
| `npm run bd:demo` | Carga una operación completa de ejemplo (`-- --reiniciar` la rehace) |
| `npm run bd:respaldar` | Copia los datos de producción a `respaldos/` (sólo lectura) |
| `npm run bd:clonar` | Reemplaza los datos de la Supabase **local** con ese respaldo |
| `npm run bd:clonar:todo` | Respalda y clona de una vez |
| `npm run usuarios:demo` | Crea una cuenta por rol |

`bd:reales`, `usuarios:reales` y `precios:sembrar` son de la migración inicial desde los Excel
de la empresa: ya se corrieron y se conservan como registro de cómo llegaron los datos. Lo mismo
`scripts/importar-excel-2026.mjs`, que no tiene comando. `bd:revisar-contratos` sólo lee: lista
los contratos importados que conviene corregir a mano.

**Marca y avisos**

| Comando | Qué hace |
|---|---|
| `npm run imagotipo` | Vuelve a sacar los trazos del logo del manual de marca (`lib/imagotipo.ts`) |
| `npm run iconos` | Regenera el favicon y los iconos de la PWA desde el imagotipo |
| `npm run splash` | Regenera las láminas de arranque de iOS (`lib/splash-ios.ts`) |
| `npm run novedades:imagenes` | Convierte las capturas de una entrega en las imágenes del aviso de novedades |

---

## 8 · Pendientes conocidos

- **Los bullets del proceso son texto provisional.** Están escritos con la estructura correcta y
  se editan desde Catálogo → Textos de proceso, pero la redacción exacta de la nota de tablaroca y
  la línea de calidad hay que copiarla del PDF real de sus cotizaciones.
- **La app no timbra CFDI.** Guarda el folio de factura y la bandera de facturación; el timbrado
  sigue con el contador.
- **No hay pruebas de interfaz.** Las cuentas de `lib/` tienen sus `probar:*`; las pantallas se
  verifican a mano.
