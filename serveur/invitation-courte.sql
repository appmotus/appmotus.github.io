-- ════════════════════════════════════════════════════════════════════
-- Motus — lien d'invitation court du thérapeute
-- À exécuter une fois (SQL Editor › New query › Run).
--
-- Le serveur garde la clé publique du thérapeute et un code de 30 caractères.
-- Une clé publique ne permet pas de lire les envois : seule la clé privée,
-- restée sur l'appareil du thérapeute, les ouvre.
-- Le client compare toujours le code de sécurité de vive voix.
-- Sans ce fichier, l'app continue d'utiliser le lien long.
-- ════════════════════════════════════════════════════════════════════

alter table public.profils
  add column if not exists cle_publique text,
  add column if not exists code_invitation text unique;

-- Le thérapeute connecté enregistre sa clé publique et reçoit son code, toujours le même
create or replace function public.mon_lien_invitation(p_pk text) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if p_pk is null or length(p_pk) > 200 then raise exception 'Clé invalide'; end if;
  update public.profils
     set cle_publique = p_pk,
         code_invitation = coalesce(code_invitation, left(replace(gen_random_uuid()::text, '-', ''), 30))
   where id = auth.uid() and actif and role = 'therapeute'
   returning code_invitation into c;
  return c;
end $$;

-- Un utilisateur connecté lit l'invitation correspondant à un code : nom et type de thérapie seulement.
-- Les coordonnées n'arrivent qu'aux clients acceptés, par le canal (voir canal.sql).
create or replace function public.lire_invitation(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('v', 1, 'pk', cle_publique, 'nom', nom, 'prenom', prenom, 'type', therapie)
    from public.profils
   where code_invitation = lower(p_code) and role = 'therapeute' and actif and cle_publique is not null
$$;

revoke all on function public.mon_lien_invitation(text), public.lire_invitation(text) from public, anon;
grant execute on function public.mon_lien_invitation(text), public.lire_invitation(text) to authenticated;
