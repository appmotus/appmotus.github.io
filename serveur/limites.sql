-- ════════════════════════════════════════════════════════════════════
-- Motus — mesures pour la carte « Services et limites » de la page admin
-- À exécuter une fois, APRÈS schema.sql (SQL Editor › New query › Run).
-- ════════════════════════════════════════════════════════════════════

create function public.admin_ressources() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return json_build_object(
    'base_octets', pg_database_size(current_database()),
    'actifs_30j',  (select count(*) from public.profils where derniere_connexion > now() - interval '30 days')
  );
end $$;

revoke all on function public.admin_ressources() from public, anon;
grant execute on function public.admin_ressources() to authenticated;
