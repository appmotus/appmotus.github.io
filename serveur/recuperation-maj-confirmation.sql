-- ════════════════════════════════════════════════════════════════════
-- Motus — mise à jour de la récupération : adresse à confirmer par un lien,
-- limite de demandes de code. À exécuter une fois (SQL Editor › New query › Run).
--
-- Les adresses déjà enregistrées restent considérées comme confirmées.
-- Pour une nouvelle installation, recuperation.sql contient déjà ces changements.
-- ════════════════════════════════════════════════════════════════════

alter table public.recuperation
  alter column email_empreinte drop not null,
  add column attente_empreinte     text,
  add column confirm_empreinte     text,
  add column confirm_expire        timestamptz,
  add column derniere_confirmation timestamptz,
  add column demandes_nb           integer not null default 0,
  add column demandes_depuis       timestamptz;

create function public.ma_recuperation_etat() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'confirmee', coalesce(bool_or(email_empreinte is not null), false),
    'attente',   coalesce(bool_or(attente_empreinte is not null), false))
  from public.recuperation where profil = auth.uid()
$$;

revoke all on function public.ma_recuperation_etat() from public, anon;
grant execute on function public.ma_recuperation_etat() to authenticated;
