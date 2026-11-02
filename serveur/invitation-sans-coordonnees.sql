-- ════════════════════════════════════════════════════════════════════
-- Motus — l'invitation ne montre plus les coordonnées du thérapeute
-- À exécuter une fois (SQL Editor › New query › Run), après canal.sql.
--
-- Toute personne qui a le lien d'invitation voit seulement le nom et le type
-- de thérapie. Le mail, le téléphone et l'adresse n'arrivent qu'aux clients
-- dont le thérapeute a accepté la demande, par le canal chiffré.
-- Sans ce fichier, l'app les ignore déjà, mais le serveur les renvoie encore.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.lire_invitation(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('v', 1, 'pk', cle_publique, 'nom', nom, 'prenom', prenom, 'type', therapie)
    from public.profils
   where code_invitation = lower(p_code) and role = 'therapeute' and actif and cle_publique is not null
$$;

revoke all on function public.lire_invitation(text) from public;
grant execute on function public.lire_invitation(text) to anon, authenticated;
