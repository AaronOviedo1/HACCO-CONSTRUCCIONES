-- ===========================================================================
-- PERSONAL SIN ACCESO A LA APP
--
-- Hay gente a la que se le paga mano de obra por contrato y que nunca va a
-- entrar al sistema: el pintor que hace una obra suelta en Oaxaca, el herrero
-- de un trabajo puntual. Necesitan existir para firmar contrato y cobrar
-- nómina, no para tener una contraseña.
--
-- No se les saca de `profiles`: media base cuelga de ahí —contratos, recibos,
-- deducciones, avances— y las políticas RLS de cuadrilla comparan
-- `contratos_oficial.trabajador_id` contra `auth.uid()`. Separarlo sería
-- rehacer la seguridad entera para no ganar nada. Siguen siendo un usuario de
-- Auth, con correo interno y una contraseña aleatoria que nadie ve ni recibe;
-- lo que cambia es que aquí queda dicho, y la app deja de pedirles correo.
--
-- Ojo con `es_externo`: eso ya significa otra cosa (sin retención Costo Haaco
-- del 5%) y lo lee el trigger tg_contrato_retencion_externo. Son dos hechos
-- distintos y llevan dos columnas distintas.
-- ===========================================================================

alter table public.profiles
  add column if not exists con_acceso boolean not null default true;

comment on column public.profiles.con_acceso is
  'Falso = personal que sólo existe para contratos y nómina; nunca entra a la app. Su cuenta de Auth existe porque el perfil cuelga de ella, pero la contraseña es aleatoria y no se comparte con nadie.';

-- Los siete de la cuadrilla se dieron de alta por script con correo interno y
-- ninguno ha entrado nunca: quedan marcados como lo que son.
update public.profiles
   set con_acceso = false
 where correo like '%@haacopro.local';

-- El perfil nace con el dato puesto: el alta manda `con_acceso` en el metadata
-- del usuario de Auth y el trigger lo recoge junto con el resto.
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, nombre, correo, telefono, rol, oficio, es_externo, con_acceso)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'telefono',
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'cuadrilla'),
    (new.raw_user_meta_data->>'oficio')::oficio_trabajador,
    coalesce((new.raw_user_meta_data->>'es_externo')::boolean, false),
    coalesce((new.raw_user_meta_data->>'con_acceso')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end $$;
