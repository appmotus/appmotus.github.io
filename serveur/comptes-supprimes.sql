-- ════════════════════════════════════════════════════════════════════
-- Motus — trace conservée 5 ans après la suppression d'un compte
-- À exécuter une fois (SQL Editor › New query › Run).
--
-- Quand un compte est supprimé (par la personne ou par l'administrateur),
-- une trace minimale est gardée à part, en « archivage intermédiaire » :
-- elle sert à prouver l'accord donné à la politique de confidentialité et
-- à défendre nos droits en cas de litige (prescription civile de 5 ans,
-- article 2224 du Code civil). Elle est effacée au bout de 5 ans.
--
-- La table n'est lisible par aucun utilisateur de l'app (pas de droits pour
-- « anon » ni « authenticated ») : seulement depuis le tableau de bord Supabase.
-- Aucune donnée du journal n'y figure : les notes restent sur les téléphones.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.comptes_supprimes (
  numero       text primary key,          -- code utilisateur (U-0001, T-0001) : jamais réutilisé
  identifiant  text not null,
  role         text not null,
  prenom       text,
  nom          text,                      -- initiale pour un utilisateur, comme sur le serveur ; nom complet pour un thérapeute
  cree_le      timestamptz,
  supprime_le  timestamptz not null default now(),
  rgpd         jsonb,                     -- version et date d'acceptation de la politique
  efface_le    timestamptz not null default now() + interval '5 years'
);
alter table public.comptes_supprimes enable row level security;
revoke all on table public.comptes_supprimes from public, anon, authenticated;

-- Avant chaque suppression d'un compte : copie de la trace, puis effacement des traces de plus de 5 ans
create or replace function public.archiver_compte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.comptes_supprimes (numero, identifiant, role, prenom, nom, cree_le, rgpd)
  select p.numero, p.identifiant, p.role, p.prenom, p.nom, p.cree_le, old.raw_user_meta_data->'rgpd'
    from public.profils p where p.id = old.id
  on conflict (numero) do nothing;
  delete from public.comptes_supprimes where efface_le < now();
  return old;
end $$;
revoke all on function public.archiver_compte() from public, anon, authenticated;

drop trigger if exists avant_suppression on auth.users;
create trigger avant_suppression before delete on auth.users
  for each row execute function public.archiver_compte();
