-- Facultatif, à exécuter après la publication de la version 16 de l'app.
-- L'app n'envoie plus que l'initiale du nom de famille des clients, et remplace l'ancien nom à leur prochaine
-- connexion. Ce script fait le ménage tout de suite, y compris pour les comptes qui ne se reconnectent pas.
-- Les noms complets restent sur les appareils des clients. Irréversible sur le serveur.

update public.profils
   set nom = upper(left(btrim(nom), 1)) || '.'
 where role = 'client' and btrim(nom) <> '';

-- Le nom saisi à l'inscription est aussi gardé par Supabase dans les informations techniques du compte.
update auth.users u
   set raw_user_meta_data = jsonb_set(u.raw_user_meta_data, '{nom}',
         to_jsonb(upper(left(btrim(u.raw_user_meta_data->>'nom'), 1)) || '.'))
  from public.profils p
 where p.id = u.id and p.role = 'client'
   and btrim(coalesce(u.raw_user_meta_data->>'nom', '')) <> '';
