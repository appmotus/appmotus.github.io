-- ════════════════════════════════════════════════════════════════════
-- Motus — un compte thérapeute ne se crée qu'avec un lien de l'administrateur
-- À exécuter une fois (SQL Editor › New query › Run), AVANT de mettre en
-- ligne la version 46.
--
-- L'administrateur crée un lien dans sa page Admin et l'envoie au thérapeute
-- qui le lui demande. Chaque lien sert une seule fois et reste valable 30 jours.
-- Le serveur n'en garde qu'une empreinte (SHA-256) et ses dates : jamais le
-- code lui-même, ni la personne à qui il a été envoyé. Le lien est effacé dès
-- qu'il a servi, ou à son expiration.
-- Toute inscription « thérapeute » sans lien valable est refusée par le
-- serveur, même envoyée hors de l'app ; le formulaire ordinaire crée un compte
-- utilisateur. L'administrateur peut toujours changer le type d'un compte.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.liens_therapeute (
  id        bigint generated always as identity primary key,
  empreinte text not null unique,                                   -- SHA-256 du code, jamais le code
  cree_le   timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '30 days'
);
alter table public.liens_therapeute enable row level security;     -- aucun accès direct : seulement les fonctions ci-dessous

create or replace function public.empreinte_lien(p_code text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(lower(coalesce(p_code, '')), 'UTF8')), 'hex')
$$;

-- Administrateur : crée un lien et rend son code, une seule fois (122 bits tirés au hasard)
create or replace function public.admin_creer_lien_therapeute() returns json
language plpgsql security definer set search_path = public as $$
declare c text := replace(gen_random_uuid()::text, '-', '');
        l public.liens_therapeute;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  delete from public.liens_therapeute where expire_le <= now();
  insert into public.liens_therapeute (empreinte) values (public.empreinte_lien(c)) returning * into l;
  return json_build_object('code', c, 'id', l.id, 'cree_le', l.cree_le, 'expire_le', l.expire_le);
end $$;

-- Administrateur : les liens qui n'ont pas encore servi
create or replace function public.admin_liens_therapeute() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  delete from public.liens_therapeute where expire_le <= now();
  return coalesce((select json_agg(json_build_object('id', id, 'cree_le', cree_le, 'expire_le', expire_le) order by cree_le desc)
                     from public.liens_therapeute), '[]'::json);
end $$;

-- Administrateur : annule un lien envoyé par erreur ou perdu
create or replace function public.admin_annuler_lien_therapeute(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  delete from public.liens_therapeute where id = p_id;
end $$;

-- Avant d'afficher le formulaire thérapeute, sans compte : le lien est-il encore valable ? (null sinon)
create or replace function public.lien_therapeute_valable(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('expire_le', expire_le)
    from public.liens_therapeute
   where empreinte = public.empreinte_lien(p_code) and expire_le > now()
$$;

-- Création du profil à l'inscription (remplace celle de schema.sql) : un compte thérapeute
-- consomme un lien valable, sinon l'inscription est refusée
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'client');
begin
  if r not in ('client', 'therapeute') then r := 'client'; end if;   -- jamais admin à l'inscription
  if r = 'therapeute' then
    delete from public.liens_therapeute
     where empreinte = public.empreinte_lien(new.raw_user_meta_data->>'lien') and expire_le > now();
    if not found then raise exception 'lien_therapeute'; end if;
  end if;
  insert into public.profils (id, identifiant, numero, role, nom, prenom)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'identifiant', split_part(new.email, '@', 1))),
          public.nouveau_numero(r), r,
          left(coalesce(new.raw_user_meta_data->>'nom', ''), 80),
          left(coalesce(new.raw_user_meta_data->>'prenom', ''), 80));
  return new;
end $$;

-- ─── Droits ──────────────────────────────────────────────────────────
revoke all on function public.empreinte_lien(text), public.creer_profil() from public, anon, authenticated;
revoke all on function public.admin_creer_lien_therapeute(), public.admin_liens_therapeute(),
  public.admin_annuler_lien_therapeute(bigint), public.lien_therapeute_valable(text) from public, anon;
grant execute on function public.admin_creer_lien_therapeute(), public.admin_liens_therapeute(),
  public.admin_annuler_lien_therapeute(bigint) to authenticated;
grant execute on function public.lien_therapeute_valable(text) to anon, authenticated;
