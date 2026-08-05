-- ===========================================================================
-- VALORES NUEVOS DE ENUMERACIÓN
--
-- Van solos en su propio archivo a propósito. «alter type ... add value» sí
-- corre dentro de una transacción, pero el valor recién agregado no se puede
-- usar en esa misma transacción, y aplicar-migraciones.mjs envuelve cada .sql
-- en la suya. Si esto viviera junto a la función que lo usa, reventaría.
--
--  · reapertura → una OT cerrada por error se puede volver a abrir.
--  · imper      → impermeabilización, que se cotiza por m² igual que la pintura.
--  · otros      → todo lo que se cobra por cantidad y no encaja en los demás.
-- ===========================================================================
alter type public.evento_obra     add value if not exists 'reapertura';
alter type public.tipo_cotizacion add value if not exists 'imper' after 'pintura';
alter type public.tipo_cotizacion add value if not exists 'otros';
