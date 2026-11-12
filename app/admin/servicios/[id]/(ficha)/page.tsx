import Link from 'next/link'
import { CalendarClock, Pencil } from 'lucide-react'
import { requerirRol } from '@/lib/auth'
import { cargarServicio } from '@/app/admin/servicios/datos'
import { fecha, horaCorta, pesos } from '@/lib/format'
import { METODO_PAGO } from '@/lib/finanzas'
import { TIPO_SERVICIO, etapaServicio } from '@/lib/servicios'
import { enlaceGoogleCalendar } from '@/lib/calendario'
import { abreviaUnidad } from '@/lib/cotizaciones'
import { EncabezadoPagina, Etiqueta, Tabla, Tarjeta, Td, Th } from '@/components/ui'
import { CabeceraDetalle } from '@/components/movil/piezas'
import { AvanceServicio, DatoFicha } from '@/components/servicios/ficha-servicio'
import {
  AccionesResolucion, AccionesSecundarias, BotonPreventivo, DialogoDiagnostico, DialogoReparado,
} from '@/components/servicios/dialogos'
import { BotonEliminarPresupuesto } from '@/components/servicios/boton-eliminar-presupuesto'
import { EditorPresupuesto } from '@/components/servicios/editor-presupuesto'
import { DialogoCobro } from '@/components/servicios/dialogo-cobro'
import { AccionesPdf } from '@/components/servicios/acciones-pdf'

export const dynamic = 'force-dynamic'

export default async function PaginaServicio({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const { servicio, items, pagos, cita, preventivo } = await cargarServicio(id)

  const etapa = etapaServicio(servicio)
  const cotizado = Number(servicio.cotizado)
  const saldo = Number(servicio.saldo)
  const conPresupuesto = items.length > 0
  // Lo que dice el papel: la reparación y la visita juntas. `cotizado` es otra
  // cosa —lo que se debe hoy—, y de un rechazado son sólo los $400.
  const visita = Number(servicio.cuota_visita)
  const subtotalPapel = Number(servicio.subtotal) + visita
  const ivaPapel = Number(servicio.presupuesto) - subtotalPapel

  /**
   * El total que se enseña arriba: el del papel mientras el trabajo sigue en
   * pie, y lo que de verdad se cobra cuando el cliente dijo que no.
   *
   * Leerlo de `cotizado` a secas engañaba: un presupuesto ya enviado todavía
   * no se debe —se debe al aprobarlo—, así que un servicio con la visita en
   * cero decía «Sin presupuesto» aunque el papel trajera $2,400. Lo que se
   * debe hoy se lee en el renglón de al lado, que para eso está.
   */
  const cerrado = servicio.estatus === 'rechazado' || servicio.estatus === 'cancelado'
  const totalFicha = cerrado ? cotizado : Math.max(cotizado, Number(servicio.presupuesto))

  return (
    <>
      <CabeceraDetalle titulo={servicio.folio ?? 'Servicio'} volverA="/admin/servicios" />

      <EncabezadoPagina
        titulo={servicio.cliente}
        descripcion={`${servicio.folio ?? ''} · ${
          servicio.tipo === 'preventivo' ? 'Mantenimiento preventivo' : servicio.descripcion
        }`}
        acciones={
          <Link
            href={`/admin/servicios/${id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            <Pencil size={15} />
            Corregir la cita
          </Link>
        }
      />

      <Tarjeta className="mb-4">
        <div className="px-5 py-4">
          <AvanceServicio
            estatus={servicio.estatus}
            cerrado={servicio.estatus === 'reparado' && cotizado > 0 && saldo <= 0}
          />
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t-[0.5px] border-tinta-150 px-5 py-4 lg:grid-cols-5">
          <DatoFicha etiqueta="Estatus">
            <span className="flex flex-wrap items-center gap-1.5">
              <Etiqueta tono={etapa.tono}>{etapa.texto}</Etiqueta>
              {servicio.tipo === 'preventivo' && (
                <Etiqueta tono={TIPO_SERVICIO.preventivo.tono}>
                  {TIPO_SERVICIO.preventivo.texto}
                </Etiqueta>
              )}
            </span>
          </DatoFicha>
          <DatoFicha etiqueta="Visita">
            {fecha(servicio.fecha_visita)}
            {servicio.hora_visita ? ` · ${horaCorta(servicio.hora_visita)}` : ''}
          </DatoFicha>
          <DatoFicha etiqueta="Técnico">{servicio.tecnico ?? 'Sin asignar'}</DatoFicha>
          <DatoFicha etiqueta="Total" tono={totalFicha > 0 ? 'verde' : undefined}>
            {totalFicha > 0 ? pesos(totalFicha) : 'Sin presupuesto'}
          </DatoFicha>
          <DatoFicha etiqueta="Saldo" tono={saldo > 0 ? 'ambar' : 'verde'}>
            {cotizado > 0 ? (saldo > 0 ? pesos(saldo) : 'Saldado') : '—'}
          </DatoFicha>
        </dl>

        {(servicio.domicilio || servicio.notas || Number(servicio.cuota_visita) > 0) && (
          <dl className="grid gap-4 border-t-[0.5px] border-tinta-150 px-5 py-4 lg:grid-cols-3">
            {servicio.domicilio && (
              <DatoFicha etiqueta="Dónde está el portón">{servicio.domicilio}</DatoFicha>
            )}
            {Number(servicio.cuota_visita) > 0 && (
              <DatoFicha etiqueta="Costo de la visita">
                {pesos(servicio.cuota_visita)}
                <span className="ml-1 text-xs text-tinta-400">
                  {servicio.estatus === 'aprobado' || servicio.estatus === 'reparado'
                    ? 'incluido en el total'
                    : 'se cobra aunque no acepte'}
                </span>
              </DatoFicha>
            )}
            {servicio.notas && <DatoFicha etiqueta="Notas">{servicio.notas}</DatoFicha>}
          </dl>
        )}
      </Tarjeta>

      {/* Lo que toca hacer ahora, en grande ------------------------------- */}
      <Tarjeta className="mb-4" titulo="Qué sigue">
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {servicio.estatus === 'agendado' && <DialogoDiagnostico servicio={servicio} />}

            {(servicio.estatus === 'diagnostico' || servicio.estatus === 'presupuestado') && (
              <>
                <EditorPresupuesto servicio={servicio} items={items} />
                <DialogoDiagnostico servicio={servicio} />
              </>
            )}

            {servicio.estatus === 'presupuestado' && conPresupuesto && (
              <AccionesResolucion servicio={servicio} />
            )}

            {servicio.estatus === 'aprobado' && (
              <>
                <DialogoReparado servicio={servicio} />
                {/* El anticipo: cuando el trabajo es grande se pide algo antes
                    de empezar, no siempre. Por eso se puede cobrar desde que
                    el cliente aprueba y no hasta que queda la reparación. */}
                {saldo > 0 && (
                  <DialogoCobro
                    servicio={servicio}
                    pagos={pagos}
                    etiqueta={pagos.length > 0 ? 'Otro cobro' : 'Cobrar anticipo'}
                  />
                )}
              </>
            )}

            {servicio.estatus === 'reparado' && saldo > 0 && (
              <DialogoCobro servicio={servicio} pagos={pagos} etiqueta="Cobrar la reparación" />
            )}

            {/* El cliente dijo que no, pero el técnico ya fue: la visita se
                cobra igual. Sin esto, esos pesos se perdían de vista. */}
            {servicio.estatus === 'rechazado' && saldo > 0 && (
              <DialogoCobro servicio={servicio} pagos={pagos} etiqueta="Cobrar la visita" />
            )}

            {servicio.estatus === 'reparado' && saldo <= 0 && cotizado > 0 && (
              <p className="rounded-[14px] bg-haaco-50 px-4 py-3 text-sm text-haaco-800">
                Listo: la reparación quedó y está pagada.
              </p>
            )}

            {/* El preventivo se ofrece al cerrar, que es cuando alguien se
                acuerda de que este portón hay que volver a verlo. */}
            {servicio.estatus === 'reparado' && (
              <BotonPreventivo
                servicio={servicio}
                yaAgendado={preventivo ? (preventivo.folio ?? 'ya agendado') : null}
              />
            )}

            {/* La cita se pasa al calendario del teléfono de quien la agendó. */}
            {servicio.estatus === 'agendado' && (
              <a
                href={enlaceGoogleCalendar({
                  titulo: `Visita ${servicio.folio ?? ''} · ${servicio.cliente}`,
                  detalle: [servicio.descripcion, servicio.domicilio, servicio.tecnico]
                    .filter(Boolean)
                    .join(' · '),
                  fecha: servicio.fecha_visita,
                  hora: servicio.hora_visita,
                  duracionMinutos: 60,
                })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 lg:min-h-0 lg:rounded-lg lg:py-2"
              >
                <CalendarClock size={16} />
                Ponerlo en mi calendario
              </a>
            )}
          </div>

          {cita && !cita.atendido_en && (
            <p className="text-xs text-tinta-500">
              El aviso de la visita sale en el tablero y llega al teléfono a las 7 de la mañana.
            </p>
          )}

          <AccionesSecundarias servicio={servicio} />
        </div>
      </Tarjeta>

      {servicio.diagnostico && (
        <Tarjeta className="mb-4" titulo="Diagnóstico">
          <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-tinta-700">
            {servicio.diagnostico}
          </p>
        </Tarjeta>
      )}

      {conPresupuesto && servicio.estatus === 'rechazado' && (
        <p className="mb-4 rounded-xl bg-tinta-50 px-4 py-3 text-sm text-tinta-600">
          Se le presupuestaron <strong>{pesos(servicio.presupuesto)}</strong> y no aceptó.
          {Number(servicio.cuota_visita) > 0 && (
            <> De este servicio sólo se cobra la visita: {pesos(cotizado)}.</>
          )}
        </p>
      )}

      {conPresupuesto && (
        <Tarjeta
          className="mb-4"
          // Con el «no» del cliente, el total de esta tarjeta y el de la ficha
          // dicen números distintos a propósito: uno es lo que se ofreció y el
          // otro lo que se debe. El título lo separa.
          titulo={
            servicio.estatus === 'rechazado' ? 'Presupuesto que no aceptó' : 'Presupuesto'
          }
          pie={`Vigencia de ${servicio.vigencia_dias} días · garantía de ${servicio.garantia_dias} días`}
        >
          {/* Teléfono: la tabla no cabe y el total —que es lo que se busca—
              quedaba fuera de la pantalla, había que arrastrar de lado para
              verlo. Aquí cada partida es un renglón y el total va al pie. */}
          <ul className="divide-y divide-tinta-100 lg:hidden">
            {items.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block text-sm text-tinta-800">{i.descripcion}</span>
                  <span className="block text-xs text-tinta-400">
                    {Number(i.cantidad)} {abreviaUnidad(i.unidad)} × {pesos(i.precio_unitario)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{pesos(i.importe)}</span>
              </li>
            ))}
            {visita > 0 && (
              <li className="flex items-baseline justify-between gap-3 px-5 py-3">
                <span className="text-sm text-tinta-800">Visita de diagnóstico</span>
                <span className="text-sm font-medium tabular-nums">{pesos(visita)}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-3 px-5 py-3">
              <span className="text-sm text-tinta-600">Subtotal</span>
              <span className="text-sm tabular-nums">{pesos(subtotalPapel)}</span>
            </li>
            {Number(servicio.iva_pct) > 0 && (
              <li className="flex items-baseline justify-between gap-3 px-5 py-3">
                <span className="text-sm text-tinta-600">IVA {Number(servicio.iva_pct)}%</span>
                <span className="text-sm tabular-nums">{pesos(ivaPapel)}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-3 bg-haaco-50/60 px-5 py-3">
              <span className="text-sm font-semibold text-tinta-900">TOTAL</span>
              <span className="text-lg font-bold tabular-nums text-haaco-700">
                {pesos(servicio.presupuesto)}
              </span>
            </li>
          </ul>

          <div className="hidden lg:block">
          <Tabla>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th numerico>Cant.</Th>
                <Th numerico>Precio</Th>
                <Th numerico>Importe</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-tinta-50/60">
                  <Td>{i.descripcion}</Td>
                  <Td numerico className="text-tinta-500">
                    {Number(i.cantidad)} {abreviaUnidad(i.unidad)}
                  </Td>
                  <Td numerico className="text-tinta-500">{pesos(i.precio_unitario)}</Td>
                  <Td numerico>{pesos(i.importe)}</Td>
                </tr>
              ))}
              {visita > 0 && (
                <tr className="hover:bg-tinta-50/60">
                  <Td>Visita de diagnóstico</Td>
                  <Td numerico className="text-tinta-500">1 serv</Td>
                  <Td numerico className="text-tinta-500">{pesos(visita)}</Td>
                  <Td numerico>{pesos(visita)}</Td>
                </tr>
              )}
              <tr className="border-t-[0.5px] border-tinta-200">
                <Td className="text-tinta-600">Subtotal</Td>
                <Td> </Td>
                <Td> </Td>
                <Td numerico>{pesos(subtotalPapel)}</Td>
              </tr>
              {Number(servicio.iva_pct) > 0 && (
                <tr>
                  <Td className="text-tinta-600">IVA {Number(servicio.iva_pct)}%</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td numerico>{pesos(ivaPapel)}</Td>
                </tr>
              )}
              <tr className="bg-haaco-50/60">
                <Td className="font-semibold text-tinta-900">TOTAL</Td>
                <Td> </Td>
                <Td> </Td>
                <Td numerico className="text-base font-semibold text-haaco-700">
                  {pesos(servicio.presupuesto)}
                </Td>
              </tr>
            </tbody>
          </Tabla>
          </div>

          <div className="border-t-[0.5px] border-tinta-150 px-5 py-4">
            <AccionesPdf servicio={servicio} />
          </div>

          {/* Borrar el presupuesto va aparte y abajo del todo: al lado de
              «mandar por WhatsApp» invita a errores, y en su propia franja se
              lee como lo que es, la salida de emergencia. Sólo mientras el
              cliente no haya contestado; después, primero se deshace el paso. */}
          {(servicio.estatus === 'diagnostico' || servicio.estatus === 'presupuestado') && (
            <div className="flex flex-wrap items-center gap-2 border-t-[0.5px] border-tinta-150 bg-tinta-50/60 px-5 py-3">
              <BotonEliminarPresupuesto servicio={servicio} />
            </div>
          )}
        </Tarjeta>
      )}

      {(pagos.length > 0 || (cotizado > 0 && servicio.estatus === 'reparado')) && (
        <Tarjeta
          titulo="Cobros"
          pie={
            saldo > 0
              ? `Faltan ${pesos(saldo)} de ${pesos(cotizado)}`
              : `Cobrado por completo: ${pesos(servicio.cobrado)}`
          }
        >
          {pagos.length === 0 ? (
            <p className="px-5 py-4 text-sm text-tinta-500">Todavía no se cobra nada.</p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    <span className="block font-medium tabular-nums text-tinta-900">
                      {pesos(p.monto)}
                    </span>
                    <span className="block text-xs text-tinta-400">
                      {fecha(p.fecha)} · {METODO_PAGO[p.metodo]}
                      {p.notas ? ` · ${p.notas}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t-[0.5px] border-tinta-150 px-5 py-4">
            <DialogoCobro servicio={servicio} pagos={pagos} />
          </div>
        </Tarjeta>
      )}
    </>
  )
}
