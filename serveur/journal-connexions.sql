-- ════════════════════════════════════════════════════════════════════
-- Motus — journal de connexion de Supabase gardé 6 mois
-- À exécuter une fois (SQL Editor › New query › Run).
--
-- Supabase peut noter dans la base chaque connexion, reconnexion et
-- déconnexion (table auth.audit_log_entries) : qui, quoi, quand. Ce
-- journal sert à repérer un accès frauduleux à un compte. La CNIL
-- recommande de garder ce type de journal de 6 mois à 1 an.
-- Motus ne le lit pas : la page Admin utilise seulement les compteurs.
--
-- AVANT : Authentication › Configuration › Audit Logs › activer
-- « Write audit logs to the database ». Sans cela, la table reste vide.
--
-- Ce fichier efface chaque nuit les lignes de plus de 6 mois.
-- Le relancer ne crée pas de doublon : la tâche du même nom est remplacée.
-- ════════════════════════════════════════════════════════════════════

-- Planificateur de tâches de Supabase (inclus dans l'offre gratuite)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Premier effacement tout de suite : un manque de droits se voit ici, pas en silence la nuit
delete from auth.audit_log_entries where created_at < now() - interval '6 months';

-- Puis chaque nuit à 3 h (heure UTC)
select cron.schedule('motus-journal-6-mois', '0 3 * * *',
  $$delete from auth.audit_log_entries where created_at < now() - interval '6 months'$$);

-- Vérifier plus tard que la tâche tourne :
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
