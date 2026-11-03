-- ════════════════════════════════════════════════════════════════════
-- Motus — compteurs du jour dans la page admin
-- À exécuter une fois (SQL Editor › New query › Run).
--
-- Ajoute « aujourd'hui » (j1) aux compteurs d'activité, d'inscriptions et de comptes actifs.
-- Le jour est celui du serveur (heure UTC) : il change à 1 h du matin en hiver, 2 h en été.
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
