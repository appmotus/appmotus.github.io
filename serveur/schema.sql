-- ════════════════════════════════════════════════════════════════════
-- Motus — serveur (Supabase)
-- Comptes, numéros C-0001 / T-0001, compteurs d'usage, fonctions admin.
-- AUCUNE note, émotion ou synthèse n'est stockée ici : elles restent
-- chiffrées sur le téléphone de chaque utilisateur.
--
-- À coller tel quel dans Supabase › SQL Editor › New query › Run.
-- ════════════════════════════════════════════════════════════════════

-- ─── Tables ──────────────────────────────────────────────────────────
create table public.profils (
  id                 uuid primary key references auth.users(id) on delete cascade,
  identifiant        text not null unique,
  numero             text not null unique,            -- code utilisateur : U-0001 (utilisateur, C-0001 avant novembre 2026) ou T-0001 (thérapeute)
  role               text not null default 'client' check (role in ('client', 'therapeute')),
  est_admin          boolean not null default false,
  actif              boolean not null default true,
  nom                text not null default '',
  prenom             text not null default '',
  therapie           text not null default '',        -- thérapeute : type de thérapie
  telephone          text not null default '',        -- thérapeute : coordonnées
  email_contact      text not null default '',
  adresse            text not null default '',
  cree_le            timestamptz not null default now(),
  derniere_connexion timestamptz,
  nb_connexions      integer not null default 0
);

-- Compteurs par utilisateur et par jour (nombres uniquement)
create table public.usage_jour (
  profil     uuid not null references public.profils(id) on delete cascade,
  jour       date not null default current_date,
  connexions integer not null default 0,
  notes      integer not null default 0,
  envois     integer not null default 0,
  primary key (profil, jour)
);

-- Aucun accès direct aux tables : tout passe par les fonctions ci-dessous.
alter table public.profils enable row level security;
alter table public.usage_jour enable row level security;

-- ─── Numérotation ────────────────────────────────────────────────────
create sequence public.seq_client;
create sequence public.seq_therapeute;

create function public.nouveau_numero(r text) returns text
language sql security definer set search_path = public as $$
  select case when r = 'therapeute'
    then 'T-' || lpad(nextval('public.seq_therapeute')::text, 4, '0')
    else 'U-' || lpad(nextval('public.seq_client')::text, 4, '0') end
$$;

-- ─── Création du profil à l'inscription ──────────────────────────────
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'client');
begin
  if r not in ('client', 'therapeute') then r := 'client'; end if;   -- jamais admin à l'inscription
  insert into public.profils (id, identifiant, numero, role, nom, prenom)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'identifiant', split_part(new.email, '@', 1))),
          public.nouveau_numero(r), r,
          left(coalesce(new.raw_user_meta_data->>'nom', ''), 80),
          left(coalesce(new.raw_user_meta_data->>'prenom', ''), 80));
  return new;
end $$;

create trigger apres_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- ─── Fonctions utilisateur ───────────────────────────────────────────
create function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select est_admin and actif from public.profils where id = auth.uid()), false)
$$;

-- Appelée à chaque connexion : date et nombre de connexions
create function public.ouvrir_session() returns json
language plpgsql security definer set search_path = public as $$
declare p public.profils;
begin
  update public.profils set derniere_connexion = now(), nb_connexions = nb_connexions + 1
   where id = auth.uid() and actif returning * into p;
  if not found then return json_build_object('actif', false); end if;
  insert into public.usage_jour (profil, connexions) values (p.id, 1)
    on conflict (profil, jour) do update set connexions = usage_jour.connexions + 1;
  return row_to_json(p);
end $$;

-- Nom, prénom et (thérapeute) coordonnées, pour la liste admin
create function public.maj_profil(p jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profils set
    nom           = left(coalesce(p->>'nom', nom), 80),
    prenom        = left(coalesce(p->>'prenom', prenom), 80),
    therapie      = left(coalesce(p->>'therapie', therapie), 80),
    telephone     = left(coalesce(p->>'telephone', telephone), 40),
    email_contact = left(coalesce(p->>'email_contact', email_contact), 120),
    adresse       = left(coalesce(p->>'adresse', adresse), 200)
  where id = auth.uid() and actif
$$;

-- Compteurs envoyés par l'app (nombre de notes saisies, d'envois au thérapeute)
create function public.compter(p_notes integer default 0, p_envois integer default 0) returns void
language sql security definer set search_path = public as $$
  insert into public.usage_jour (profil, notes, envois)
  select auth.uid(), least(greatest(p_notes, 0), 500), least(greatest(p_envois, 0), 50)
   where exists (select 1 from public.profils where id = auth.uid() and actif)
  on conflict (profil, jour) do update
    set notes = usage_jour.notes + excluded.notes, envois = usage_jour.envois + excluded.envois
$$;

-- ─── Fonctions administrateur ────────────────────────────────────────
create function public.admin_utilisateurs() returns setof public.profils
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return query select * from public.profils order by cree_le;
end $$;

create function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return json_build_object(
    'comptes',      (select count(*) from profils),
    'clients',      (select count(*) from profils where role = 'client'),
    'therapeutes',  (select count(*) from profils where role = 'therapeute'),
    'desactives',   (select count(*) from profils where not actif),
    'inscrits_1j',  (select count(*) from profils where cree_le >= current_date),
    'inscrits_7j',  (select count(*) from profils where cree_le > now() - interval '7 days'),
    'inscrits_30j', (select count(*) from profils where cree_le > now() - interval '30 days'),
    'actifs_1j',    (select count(*) from profils where derniere_connexion >= current_date),
    'actifs_7j',    (select count(*) from profils where derniere_connexion > now() - interval '7 days'),
    'actifs_30j',   (select count(*) from profils where derniere_connexion > now() - interval '30 days'),
    'activite', (select json_build_object(
        'connexions', json_build_object('j1', coalesce(sum(connexions) filter (where jour = current_date), 0),
                                        'j7', coalesce(sum(connexions) filter (where jour > current_date - 7), 0),
                                        'j30', coalesce(sum(connexions) filter (where jour > current_date - 30), 0),
                                        'total', coalesce(sum(connexions), 0)),
        'notes',      json_build_object('j1', coalesce(sum(notes) filter (where jour = current_date), 0),
                                        'j7', coalesce(sum(notes) filter (where jour > current_date - 7), 0),
                                        'j30', coalesce(sum(notes) filter (where jour > current_date - 30), 0),
                                        'total', coalesce(sum(notes), 0)),
        'envois',     json_build_object('j1', coalesce(sum(envois) filter (where jour = current_date), 0),
                                        'j7', coalesce(sum(envois) filter (where jour > current_date - 7), 0),
                                        'j30', coalesce(sum(envois) filter (where jour > current_date - 30), 0),
                                        'total', coalesce(sum(envois), 0)))
      from usage_jour),
    'semaines', (select coalesce(json_agg(s order by s.semaine), '[]'::json) from (
        select date_trunc('week', jour)::date as semaine, sum(connexions) as connexions, sum(notes) as notes, sum(envois) as envois
          from usage_jour where jour > current_date - 56 group by 1) s)
  );
end $$;

create function public.admin_activer(p_id uuid, p_actif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_id = auth.uid() then raise exception 'Impossible sur votre propre compte'; end if;
  -- Pas de « banned_until » : Supabase le vérifie avant le mot de passe et révélerait l'état du compte.
  -- Le mot de passe est donc contrôlé d'abord, puis ouvrir_session refuse le compte désactivé,
  -- et toutes les fonctions ci-dessus exigent « actif ».
  update public.profils set actif = p_actif where id = p_id;
end $$;

create function public.admin_type(p_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_role not in ('client', 'therapeute') then raise exception 'Type inconnu'; end if;
  update public.profils set role = p_role, numero = public.nouveau_numero(p_role)
   where id = p_id and role <> p_role;
end $$;

create function public.admin_supprimer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_id = auth.uid() then raise exception 'Impossible sur votre propre compte'; end if;
  delete from auth.users where id = p_id;   -- le profil et les compteurs suivent (cascade)
end $$;

-- ─── Droits : seuls les utilisateurs connectés appellent les fonctions ─
revoke all on function public.nouveau_numero(text) from public, anon, authenticated;
revoke all on function public.creer_profil() from public, anon, authenticated;
revoke all on function public.est_admin(), public.ouvrir_session(), public.maj_profil(jsonb),
  public.compter(integer, integer), public.admin_utilisateurs(), public.admin_stats(),
  public.admin_activer(uuid, boolean), public.admin_type(uuid, text), public.admin_supprimer(uuid)
  from public, anon;
grant execute on function public.est_admin(), public.ouvrir_session(), public.maj_profil(jsonb),
  public.compter(integer, integer), public.admin_utilisateurs(), public.admin_stats(),
  public.admin_activer(uuid, boolean), public.admin_type(uuid, text), public.admin_supprimer(uuid)
  to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- APRÈS avoir créé VOTRE compte dans l'app, faites-en l'administrateur
-- (remplacez « votre-identifiant ») :
--
--   update public.profils set est_admin = true where identifiant = 'votre-identifiant';
-- ════════════════════════════════════════════════════════════════════
