-- ════════════════════════════════════════════════════════════════════
-- Motus — compte désactivé = lecture seule, et connexions comptées par l'app
-- À exécuter une fois (SQL Editor › New query › Run), AVANT de mettre en
-- ligne la version 47.
--
-- 1. ouvrir_session : un compte désactivé reçoit désormais son profil
--    (actif = false) au lieu d'être refusé. L'app le laisse se connecter, lire
--    et exporter ses notes, mais plus en saisir. Elle ne compte plus les
--    connexions ici.
-- 2. compter : l'app envoie aussi le nombre d'ouvertures de l'app, comptées
--    sur le téléphone même sans internet. Un compte désactivé ne compte plus.
--
-- Tant que ce fichier n'est pas exécuté, l'app de la version 47 refuse un
-- compte désactivé comme avant, et les connexions restent comptées à l'ancienne.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.ouvrir_session() returns json
language plpgsql security definer set search_path = public as $$
declare p public.profils;
begin
  update public.profils set derniere_connexion = now() where id = auth.uid() returning * into p;
  if not found then return json_build_object('actif', false); end if;
  return row_to_json(p);
end $$;

drop function if exists public.compter(integer, integer);
create or replace function public.compter(p_notes integer default 0, p_envois integer default 0, p_connexions integer default 0) returns void
language plpgsql security definer set search_path = public as $$
declare
  n integer := least(greatest(p_notes, 0), 500);
  e integer := least(greatest(p_envois, 0), 50);
  c integer := least(greatest(p_connexions, 0), 200);
begin
  if not exists (select 1 from public.profils where id = auth.uid() and actif) then return; end if;
  insert into public.usage_jour (profil, notes, envois, connexions) values (auth.uid(), n, e, c)
    on conflict (profil, jour) do update
      set notes = usage_jour.notes + excluded.notes, envois = usage_jour.envois + excluded.envois, connexions = usage_jour.connexions + excluded.connexions;
  update public.profils set nb_connexions = nb_connexions + c where id = auth.uid();
end $$;

revoke all on function public.ouvrir_session(), public.compter(integer, integer, integer) from public, anon;
grant execute on function public.ouvrir_session(), public.compter(integer, integer, integer) to authenticated;
