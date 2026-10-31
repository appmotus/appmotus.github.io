-- ════════════════════════════════════════════════════════════════════
-- Motus — confirmation de l'adresse par un code à 6 chiffres (et non plus un lien).
-- À exécuter une fois (SQL Editor › New query › Run).
-- Pour une nouvelle installation, recuperation.sql contient déjà ce changement.
-- ════════════════════════════════════════════════════════════════════

alter table public.recuperation
  add column confirm_essais integer not null default 0;
