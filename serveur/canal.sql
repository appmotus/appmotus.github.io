-- ════════════════════════════════════════════════════════════════════
-- Motus — lien entre un client et son thérapeute
-- À exécuter une fois, APRÈS invitation-courte.sql (SQL Editor › New query › Run).
--
-- Aucune donnée du journal ne passe par ici : seulement les coordonnées de
-- chacun et l'état du lien, chiffrés sur les téléphones avec un secret que
-- seuls le client et son thérapeute connaissent.
-- Le serveur ne sait pas quel client est lié à quel thérapeute : un canal
-- n'est rattaché à aucun compte, et le client y accède sans se connecter.
-- ════════════════════════════════════════════════════════════════════

-- Arrivée d'un client : dépôt chiffré pour le thérapeute, lu puis effacé par son app
create table public.arrivees (
  id          bigint generated always as identity primary key,
  therapeute  uuid not null references public.profils(id) on delete cascade,
  contenu     text not null check (length(contenu) < 8000),
  cree_le     timestamptz not null default now()
);

-- Canal d'un lien : fiches chiffrées des deux côtés et état du lien
create table public.canaux (
  id          text primary key check (length(id) = 64),
  jeton       text not null,                     -- empreinte du jeton d'écriture
  client      text check (length(client) < 6000),
  therapeute  text check (length(therapeute) < 6000),
  statut      text not null default 'actif' check (statut in ('actif', 'rompu')),
  rompu_par   text check (rompu_par in ('client', 'therapeute')),
  maj         timestamptz not null default now()
);

alter table public.arrivees enable row level security;
alter table public.canaux enable row level security;
revoke all on table public.arrivees, public.canaux from anon, authenticated;

create function public.empreinte_jeton(p text) returns text
language sql immutable as $$ select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

-- Le client dépose son arrivée sans se connecter : le serveur ne sait pas qui il est
create function public.deposer_arrivee(p_pk text, p_contenu text) returns boolean
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select id into t from public.profils where cle_publique = p_pk and role = 'therapeute' and actif;
  if t is null or (select count(*) from public.arrivees where therapeute = t) >= 1000 then return false; end if;
  insert into public.arrivees (therapeute, contenu) values (t, p_contenu);
  return true;
end $$;

create function public.lire_arrivees() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'contenu', contenu) order by id), '[]'::json)
    from public.arrivees where therapeute = auth.uid()
$$;

create function public.supprimer_arrivees(p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  delete from public.arrivees where therapeute = auth.uid() and id = any(p_ids)
$$;

-- Chaque côté écrit sa fiche chiffrée ; il faut le jeton du canal, connu des deux seuls
create function public.canal_ecrire(p_id text, p_jeton text, p_cote text, p_fiche text) returns boolean
language plpgsql security definer set search_path = public as $$
declare h text := public.empreinte_jeton(p_jeton);
begin
  if p_cote not in ('client', 'therapeute') then raise exception 'Requête invalide'; end if;
  insert into public.canaux (id, jeton) values (p_id, h) on conflict (id) do nothing;
  update public.canaux
     set client = case when p_cote = 'client' then p_fiche else client end,
         therapeute = case when p_cote = 'therapeute' then p_fiche else therapeute end,
         maj = now()
   where id = p_id and jeton = h and statut = 'actif';
  return found;
end $$;

create function public.canal_lire(p_id text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('client', client, 'therapeute', therapeute, 'statut', statut, 'rompu_par', rompu_par)
    from public.canaux where id = p_id
$$;

create function public.canal_rompre(p_id text, p_jeton text, p_par text) returns boolean
language plpgsql security definer set search_path = public as $$
declare h text := public.empreinte_jeton(p_jeton);
begin
  if p_par not in ('client', 'therapeute') then raise exception 'Requête invalide'; end if;
  insert into public.canaux (id, jeton) values (p_id, h) on conflict (id) do nothing;
  update public.canaux set statut = 'rompu', rompu_par = p_par, client = null, therapeute = null, maj = now()
   where id = p_id and jeton = h;
  return found;
end $$;

-- L'autre côté efface le canal une fois la rupture lue
create function public.canal_supprimer(p_id text, p_jeton text) returns void
language sql security definer set search_path = public as $$
  delete from public.canaux where id = p_id and jeton = public.empreinte_jeton(p_jeton) and statut = 'rompu'
$$;

revoke all on function public.empreinte_jeton(text), public.deposer_arrivee(text, text), public.lire_arrivees(),
  public.supprimer_arrivees(bigint[]), public.canal_ecrire(text, text, text, text), public.canal_lire(text),
  public.canal_rompre(text, text, text), public.canal_supprimer(text, text) from public, anon, authenticated;
grant execute on function public.deposer_arrivee(text, text), public.canal_ecrire(text, text, text, text),
  public.canal_lire(text), public.canal_rompre(text, text, text), public.canal_supprimer(text, text) to anon, authenticated;
grant execute on function public.lire_arrivees(), public.supprimer_arrivees(bigint[]) to authenticated;

-- Lire une invitation sans se connecter : la demande n'est plus rattachée au compte du client
grant execute on function public.lire_invitation(text) to anon;
