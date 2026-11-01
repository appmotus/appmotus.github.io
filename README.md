# Motus

*Éclairer ce qui se passe en soi*

Web app (PWA) pour les personnes suivies par un thérapeute : noter ses émotions au fil de la journée, faire une synthèse quotidienne avec une couleur (vert / jaune / rouge), voir le calendrier coloré et exporter un tableau Excel pour le thérapeute.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'application (interface, chiffrement, export Excel) |
| `sw.js` | Fonctionnement hors connexion |
| `confidentialite.html` | Politique de confidentialité, à accepter à l'inscription (version dans `RGPD_VERSION`, dans `index.html`) |
| `fonts/` | Police Plus Jakarta Sans (licence libre), livrée avec l'app pour qu'elle soit la même partout, sans jamais appeler Google |
| `communes.txt` | Liste des communes françaises (nom + coordonnées du centre) pour trouver la ville sans connexion |
| `manifest.webmanifest`, `icon-*.png` | Installation sur l'écran d'accueil |
| `outils/generer-communes.ps1` | Régénère `communes.txt` depuis geo.api.gouv.fr |
| `outils/serveur-local.ps1` | Serveur de test sur ce PC (http://localhost:8765) |
| `outils/generer-icones.ps1` | Régénère les icônes |
| `outils/compter-heures.ps1` | Estime les heures de travail, pour le compteur de la page admin |

## Confidentialité

- Aucune donnée ne quitte le téléphone : pas de compte, pas de serveur, aucune bibliothèque externe. La politique de sécurité de la page (CSP `connect-src 'self'`) n'autorise le code qu'à lire les fichiers de l'app elle-même : aucune requête vers un autre site n'est possible.
- Ville automatique : la position GPS est comparée, sur le téléphone, à la liste des communes intégrée (`communes.txt`). Elle n'est ni envoyée ni enregistrée ; seul le nom de la ville est noté. Fonctionne en France uniquement ; désactivable dans les Réglages.
- Les notes sont chiffrées (AES-GCM 256 bits) avec une clé dérivée du code de l'utilisateur (PBKDF2-SHA-256, 250 000 itérations), puis stockées dans le `localStorage` du navigateur.
- Le code n'est stocké nulle part : **code oublié = notes perdues**.
- Verrouillage automatique quand l'app passe en arrière-plan (délai réglable).
- L'export Excel et la sauvegarde sont générés sur le téléphone ; l'utilisateur décide à qui les envoyer. La sauvegarde (`.json`) reste chiffrée ; le fichier Excel, lui, est en clair.
- Les notes personnelles (texte libre, à côté des émotions) restent privées : elles sont dans le journal chiffré et la sauvegarde, mais jamais dans les envois au thérapeute ni dans le fichier Excel.

## Comptes et administration

L'app s'ouvre sur un écran de **connexion** (identifiant + mot de passe), avec un lien pour créer un compte.

- **Mail de récupération (obligatoire)** : demandé à l'inscription, et à l'ouverture de l'app pour les comptes plus anciens tant qu'il n'est pas confirmé. Sans internet, si l'envoi échoue ou si rien n'arrive au bout de 2 minutes, le journal reste accessible et un bandeau le redemande. Confirmé par un code à 6 chiffres reçu par e-mail (renvoi possible après 1 minute), il peut être changé dans les Réglages mais pas retiré. Il permet de recevoir un code à 6 chiffres si le mot de passe est oublié (5 demandes par 24 heures, 5 essais par code, validité 15 minutes). Le serveur n'en garde qu'une empreinte illisible : elle n'apparaît ni dans la page admin ni dans Supabase, et l'utilisateur la retape à l'identique en cas d'oubli. Le service d'envoi (Brevo) reçoit l'adresse à chaque envoi et l'affiche dans l'historique du compte Brevo, conservé 1 mois et visible par la personne qui gère ce compte. Sans adresse enregistrée, un mot de passe perdu ne peut pas être réinitialisé.
- **Thérapeute : un seul mail** : son mail professionnel sert aussi de mail de récupération. Dès qu'il est confirmé, il devient le mail de contact transmis aux clients avec le lien d'invitation, en clair sur le serveur avec ses coordonnées.
- **Effacer ses données** : avec une adresse confirmée, l'utilisateur la retape et saisit un code à 6 chiffres reçu par e-mail (fonction `recuperation`, actions `effacer_demande` et `effacer_confirme`) ; tant que le mail n'est pas confirmé, il confirme avec son mot de passe. Le fichier chiffré « données utilisateur » a trois sections : `journal` (jours, date de sauvegarde), `donneesClients` (thérapeute) et `parametres` (profil, réglages, libellés, thérapeute lié, historique des envois, clé du thérapeute, mail masqué). L'effacement vide le journal et les données reçues des clients sur l'appareil, sans déconnecter ; le compte, les paramètres et les fiches clients restent, et un mail le confirme quand un code a été utilisé. Les sauvegardes, fichiers Excel et envois déjà créés ne sont pas concernés. Une version masquée du mail (`adre*******@domaine.fr`) est gardée sur l'appareil pour aider l'utilisateur à s'en souvenir : dans le journal chiffré, et en clair pour la page « Mot de passe oublié », où le journal est verrouillé. Le mail complet n'y est pas conservé, et cette version masquée n'est jamais envoyée au serveur.
- **Supprimer son compte** : Réglages › Supprimer mon compte, avec internet. Avec une adresse confirmée, l'utilisateur la retape et saisit un code à 6 chiffres (actions `supprimer_demande` et `supprimer_confirme`) ; sinon il confirme avec son mot de passe, vérifié par le serveur (action `supprimer_mdp`). Le serveur supprime d'abord le compte, et le profil, les compteurs et la récupération suivent par cascade ; l'appareil n'est vidé qu'ensuite, donc rien n'est effacé si le serveur refuse. Le compte administrateur ne peut pas être supprimé ainsi. Les sauvegardes, fichiers Excel, envois déjà créés et notes d'un autre appareil ne sont pas concernés.
- **Reprise des notes** : le serveur garde une clé de secours, et l'appareil la clé du journal chiffrée par cette clé de secours. Aucun des deux, seul, n'ouvre les notes ; une personne ayant à la fois le téléphone et l'accès à la boîte mail le pourrait. Sur un nouvel appareil, seul le compte est récupéré : les notes reviennent avec une sauvegarde.
- **Déconnexion automatique** : réglable, jusqu'à « Jamais ». Le journal s'ouvre alors sans mot de passe sur cet appareil, même après fermeture de l'app, jusqu'à « Se déconnecter ».

- Le **serveur** (Supabase, hébergé en Europe) ne connaît que les comptes : identifiant, prénom, nom de famille (uniquement l'initiale pour un client ; le nom complet reste sur son appareil et dans ses envois au thérapeute), numéro (`C-0001` pour un client, `T-0001` pour un thérapeute), type de compte, coordonnées des thérapeutes, date et nombre de connexions, et des **compteurs** (notes saisies, envois au thérapeute). Jamais le contenu des notes.
- Le **journal** reste chiffré sur l'appareil, avec le mot de passe du compte. Hors connexion, le journal déjà présent sur l'appareil s'ouvre quand même.
- L'**administrateur** (un seul compte) a un onglet « Admin » : statistiques d'utilisation, liste des utilisateurs, désactivation, suppression et changement de type de compte.
- Tant que `SERVER.url` est vide dans `index.html`, l'app fonctionne en **mode démonstration** : les comptes sont simulés dans le navigateur, et le premier compte créé est administrateur.

### Mise en place du serveur

1. Créer un projet sur https://supabase.com (région Europe).
2. *SQL Editor* : coller et exécuter `serveur/schema.sql`.
3. *Authentication › Sign In / Providers › Email* : désactiver « Confirm email » (les identifiants ne sont pas de vraies adresses).
4. *Project Settings › API Keys* : copier l'adresse du projet et la clé publique (« Publishable key » ou, dans l'ancien écran, « anon public ») dans `SERVER`, dans `index.html`. Cette clé est publique par nature ; ne jamais y mettre une clé secrète (« Secret key » ou « service_role »).
5. Créer son compte dans l'app, puis dans *SQL Editor* : `update public.profils set est_admin = true where identifiant = 'votre-identifiant';`
6. Récupération par e-mail : exécuter `serveur/recuperation.sql`, puis créer dans *Edge Functions* une fonction nommée `recuperation` avec le contenu de `serveur/recuperation-fonction.ts`, vérification JWT désactivée. Définir ses secrets : `RECUPERATION_SECRET`, `BREVO_API_KEY`, `EMAIL_EXPEDITEUR`.
7. Carte « Services et limites » de la page admin : exécuter `serveur/limites.sql`. Les valeurs maximales sont inscrites dans `LIMITES`, dans `index.html`, à mettre à jour si les offres changent.

## Profils client et thérapeute

Au premier lancement, on choisit « Client(e) » ou « Thérapeute ». Il n'y a toujours **aucun serveur** : tout passe par des fichiers que l'utilisateur envoie lui-même.

1. **Invitation** : le thérapeute partage son lien d'invitation (Réglages). Ce lien contient sa clé publique et ses coordonnées, dans la partie `#…` de l'adresse, qui n'est jamais envoyée à un serveur. Le client ouvre le lien, ou le colle dans Réglages › Mon thérapeute. Les deux voient le même **code de sécurité** (ex. `F455-D132`), à comparer de vive voix pour s'assurer que le lien n'a pas été modifié.
2. **Envoi** : le client choisit une période (par défaut les 7 derniers jours) puis appuie sur « Envoyer à … ». L'app crée un fichier chiffré (ECDH P-256 + AES-GCM 256) que seul ce thérapeute peut ouvrir, puis l'envoie par e-mail ou messagerie depuis le menu de partage. Rien n'est envoyé automatiquement ; un rappel s'affiche si rien n'a été envoyé depuis 7 jours.
3. **Fiches clients** : le thérapeute crée une fiche par client (onglet Clients : nom, coordonnées, notes personnelles), avec recherche dès que la liste s'allonge.
4. **Import** : depuis la fiche du client, « Importer un fichier reçu », autant de fois que nécessaire. Au premier import, la fiche est liée à l'app du client ; si un fichier est ensuite importé dans la mauvaise fiche, l'app le signale. Le thérapeute voit l'historique des envois, le calendrier du client (avec le filtre par émotion), ses journées en lecture seule, et peut exporter en Excel. Les données reçues restent chiffrées sur son appareil.

Important pour le thérapeute : sa clé de déchiffrement est dans le journal chiffré de son appareil. Une sauvegarde régulière (Réglages › Sauvegarde) est indispensable : sans elle, un nouvel appareil ne pourra plus ouvrir les fichiers des clients.

## Mise en ligne

L'app doit être servie en **HTTPS** (le chiffrement du navigateur l'exige). N'importe quel hébergement de fichiers statiques convient, car le serveur ne fait que livrer les fichiers et ne reçoit jamais les notes :

- **Netlify Drop** (le plus simple) : glisser le dossier `journal-emotions` sur https://app.netlify.com/drop
- **GitHub Pages** : publier le dossier dans un dépôt et activer Pages.

Ensuite, sur le téléphone : ouvrir l'adresse puis l'ajouter à l'écran d'accueil (iPhone : Partager → « Sur l'écran d'accueil » ; Android : menu ⋮ → « Installer l'application »).

À savoir : sur iPhone, Safari et l'app de l'écran d'accueil ont chacun leur stockage, et les notes de l'un n'apparaissent pas dans l'autre. L'app affiche un avertissement quand elle est ouverte dans Safari. Pour restaurer une sauvegarde, installer d'abord l'app, puis restaurer depuis l'icône. Safari peut aussi effacer les données d'un site non installé après 7 jours sans visite. Installer l'app sur l'écran d'accueil évite ce problème. Il est conseillé de faire régulièrement une sauvegarde depuis les Réglages.

## Avant chaque mise à jour : ne perdre aucune note

Les notes n'existent que sur l'appareil de l'utilisateur : une mise à jour ne doit jamais les modifier sans les conserver. Avant de publier, vérifier sur une copie de test, à partir de la **version actuellement en ligne** :

1. Créer un compte avec la version en ligne et saisir des notes, une synthèse et une couleur.
2. Passer à la nouvelle version, puis se reconnecter : tout doit être présent.
3. Faire de même avec « déconnexion automatique : Jamais ».
4. Vérifier « Sauvegarder » puis « Restaurer » (un bandeau propose la sauvegarde en un appui si la dernière date de plus de 7 jours).
5. Tout changement du format ou de l'emplacement des données doit relire l'ancien format et n'effacer l'ancienne copie qu'après avoir vérifié la nouvelle.

Rappel : une mise à jour ne protège pas contre la perte du téléphone ou l'effacement des données du navigateur. Seule une sauvegarde le permet.

## Mettre à jour

Après une modification, augmenter le numéro de `CACHE` dans `sw.js` et donner le même à `APP_VERSION` dans `index.html`. Les téléphones installent alors la nouvelle version en arrière-plan, puis l'app affiche « Nouvelle version disponible » avec un bouton « Mettre à jour ». Le numéro installé se lit dans Réglages › À propos.

À chaque nouvelle version, lancer aussi `outils/compter-heures.ps1` et reporter le résultat dans `HEURES_TRAVAIL`, dans `index.html` : c'est le compteur de la page admin.
