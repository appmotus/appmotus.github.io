-- ════════════════════════════════════════════════════════════════════
-- Motus — activité de chaque compte, dans la liste de la page Admin
-- À exécuter une fois (SQL Editor › New query › Run), avec la version 47.
--
-- Rend, par compte, la somme de ses compteurs : connexions (ouvertures de
-- l'app), notes saisies (émotions et notes personnelles) et envois au thérapeute. Seulement
-- des nombres : jamais le contenu des journaux.
-- Sans ce fichier, la page Admin fonctionne : elle n'affiche simplement pas
-- ces deux lignes dans le détail d'un compte.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_activite() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return coalesce((select json_agg(json_build_object('id', profil, 'connexions', c, 'notes', n, 'envois', e))
                     from (select profil, sum(connexions) as c, sum(notes) as n, sum(envois) as e
                             from public.usage_jour group by profil) t), '[]'::json);
end $$;

revoke all on function public.admin_activite() from public, anon;
grant execute on function public.admin_activite() to authenticated;
