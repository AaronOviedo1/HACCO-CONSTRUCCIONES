-- ===========================================================================
-- EL PERMISO QUE LE FALTÓ A LA 048
--
--   «Could not find the function public.quitar_pago_fijo(p_alcance, p_id)
--    in the schema cache»
--
-- La 048 aplicó bien y las funciones existen. Lo que no les puso fue el
-- `grant execute`, y PostgREST no sirve —ni siquiera enseña— las funciones que
-- el rol de quien pregunta no puede ejecutar: las deja fuera de su caché de
-- esquema, y desde la pantalla eso se lee como «no existe».
--
-- Es el único error que la prueba local no podía encontrar. Ahí las
-- migraciones corren como superusuario contra un Postgres pelón, sin las
-- políticas ni los roles de Supabase, así que todo se puede ejecutar siempre y
-- la falta de permiso no se nota. Se nota en producción, que es donde importa.
--
-- La 046 sí los pone, uno por uno, para las funciones de la raya. Aquí se
-- completa lo que le faltó a la 048, y de paso `generar_quincena`, que viene
-- arrastrando lo mismo desde la 045: hoy funciona porque `create function` deja
-- el permiso a PUBLIC por omisión, pero eso es un accidente afortunado y no una
-- decisión, y el día que alguien lo revoque se cae sin explicación.
-- ===========================================================================

grant execute on function public.quitar_pago_fijo(uuid, text)    to authenticated;
grant execute on function public.restaurar_pago_fijo(uuid, date) to authenticated;
grant execute on function public.quincena_de(date)               to authenticated;
grant execute on function public.generar_quincena(date)          to authenticated;

notify pgrst, 'reload schema';
