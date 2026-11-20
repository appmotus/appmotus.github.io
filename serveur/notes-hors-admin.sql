-- ════════════════════════════════════════════════════════════════════
-- Motus — notes saisies « hors admin » (version 49)
-- À exécuter une fois (SQL Editor › New query › Run), après compteur-du-jour.sql
-- et activite-utilisateurs.sql.
--
-- 1. Page Admin › Activité : la ligne « Notes saisies (hors admin) » compte les notes
--    de tous les comptes sauf celles du compte administrateur (est_admin).
--    Les autres compteurs (connexions, envois) ne changent pas.
-- 2. Le nombre de notes de chaque compte n'est plus transmis à l'administrateur :
--    admin_activite() ne rend plus que les connexions et les envois.
--
-- Rien d'autre ne change : seuls des nombres sont rendus, jamais le contenu des journaux.
-- Sans ce fichier, l'app fonctionne : elle affiche « Notes saisies (admin compris) ».
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_stats() returns json
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
        'notes_hors_admin', json_build_object(
                                        'j1', coalesce(sum(notes) filter (where jour = current_date and not est_admin), 0),
                                        'j7', coalesce(sum(notes) filter (where jour > current_date - 7 and not est_admin), 0),
                                        'j30', coalesce(sum(notes) filter (where jour > current_date - 30 and not est_admin), 0),
                                        'total', coalesce(sum(notes) filter (where not est_admin), 0)),
        'envois',     json_build_object('j1', coalesce(sum(envois) filter (where jour = current_date), 0),
                                        'j7', coalesce(sum(envois) filter (where jour > current_date - 7), 0),
                                        'j30', coalesce(sum(envois) filter (where jour > current_date - 30), 0),
                                        'total', coalesce(sum(envois), 0)))
      from (select u.jour, u.connexions, u.notes, u.envois, coalesce(p.est_admin, false) as est_admin
              from usage_jour u left join profils p on p.id = u.profil) t),
    'semaines', (select coalesce(json_agg(s order by s.semaine), '[]'::json) from (
        select date_trunc('week', jour)::date as semaine, sum(connexions) as connexions, sum(notes) as notes, sum(envois) as envois
          from usage_jour where jour > current_date - 56 group by 1) s)
  );
end $$;

create or replace function public.admin_activite() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return coalesce((select json_agg(json_build_object('id', profil, 'connexions', c, 'envois', e))
                     from (select profil, sum(connexions) as c, sum(envois) as e
                             from public.usage_jour group by profil) t), '[]'::json);
end $$;
