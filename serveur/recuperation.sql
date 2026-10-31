-- ════════════════════════════════════════════════════════════════════
-- Motus — récupération de compte par e-mail
-- À exécuter une fois, APRÈS schema.sql (SQL Editor › New query › Run).
--
-- L'adresse e-mail n'est jamais stockée : seule son empreinte l'est.
-- Elle n'est utilisable qu'après confirmation par un code reçu par e-mail.
-- La clé de secours, seule, n'ouvre rien : les notes restent sur le téléphone.
-- ════════════════════════════════════════════════════════════════════

create table public.recuperation (
  profil                uuid primary key references public.profils(id) on delete cascade,
  email_empreinte       text,          -- adresse confirmée
  attente_empreinte     text,          -- adresse en attente de confirmation
  confirm_empreinte     text,
  confirm_expire        timestamptz,
  confirm_essais        integer not null default 0,
  derniere_confirmation timestamptz,
  cle_secours           text not null,
  code_empreinte        text,
  code_expire           timestamptz,
  essais                integer not null default 0,
  derniere_demande      timestamptz,
  demandes_nb           integer not null default 0,
  demandes_depuis       timestamptz
);

-- Aucun accès direct : seules la fonction d'envoi (côté serveur) et les fonctions ci-dessous y accèdent.
alter table public.recuperation enable row level security;
revoke all on table public.recuperation from anon, authenticated;

create function public.ma_cle_secours() returns text
language sql stable security definer set search_path = public as $$
  select r.cle_secours from public.recuperation r
    join public.profils p on p.id = r.profil
   where r.profil = auth.uid() and p.actif
$$;

create function public.ma_recuperation_etat() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'confirmee', coalesce(bool_or(email_empreinte is not null), false),
    'attente',   coalesce(bool_or(attente_empreinte is not null), false))
  from public.recuperation where profil = auth.uid()
$$;

create function public.retirer_recuperation() returns void
language sql security definer set search_path = public as $$
  delete from public.recuperation where profil = auth.uid()
$$;

revoke all on function public.ma_cle_secours(), public.ma_recuperation_etat(), public.retirer_recuperation() from public, anon;
grant execute on function public.ma_cle_secours(), public.ma_recuperation_etat(), public.retirer_recuperation() to authenticated;
