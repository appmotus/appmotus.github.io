-- ════════════════════════════════════════════════════════════════════
-- Motus — les comptes qui ne sont pas thérapeutes s'appellent « utilisateurs »
-- À exécuter une fois (SQL Editor › New query › Run).
--
-- Leur code utilisateur passe de C-0001 à U-0001 : les chiffres ne changent pas.
-- Les nouveaux comptes reçoivent directement un code en U-.
-- Les thérapeutes gardent leur code en T-.
-- L'app reconnaît les deux formes : une fiche client notée C-0012 retrouve U-0012.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.nouveau_numero(r text) returns text
language sql security definer set search_path = public as $$
  select case when r = 'therapeute'
    then 'T-' || lpad(nextval('public.seq_therapeute')::text, 4, '0')
    else 'U-' || lpad(nextval('public.seq_client')::text, 4, '0') end
$$;

update public.profils set numero = 'U-' || substring(numero from 3) where numero like 'C-%';
