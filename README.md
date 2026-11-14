# Motus

*Éclairer ce qui se passe en soi*

Web app (PWA) pour les personnes suivies par un thérapeute : noter ses émotions au fil de la journée, faire une synthèse quotidienne avec une couleur (vert / jaune / rouge), voir le calendrier coloré et exporter un tableau Excel pour le thérapeute.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de l'application : structure, choix de l'apparence, puis chargement du style et du code |
| `css/motus.css` | Tous les styles |
| `js/*.js` | Le code de l'application, un fichier par sujet (voir « Organisation du code ») |
| `sw.js` | Fonctionnement hors connexion (liste de tous les fichiers à garder en cache) |
| `confidentialite.html` | Politique de confidentialité, à accepter à l'inscription (version dans `RGPD_VERSION`, dans `js/constantes.js`) |
| `fonts/` | Police Plus Jakarta Sans (licence libre), livrée avec l'app pour qu'elle soit la même partout, sans jamais appeler Google |
| `guide/` | Guide d'utilisation : son texte (`guide.md`, modifiable sans toucher au code) et ses captures (voir « Modifier le guide d'utilisation ») |
| `communes.txt` | Liste des communes françaises (nom + coordonnées du centre) pour trouver la ville sans connexion |
| `manifest.webmanifest`, `icon-*.png` | Installation sur l'écran d'accueil |
| `outils/generer-communes.ps1` | Régénère `communes.txt` depuis geo.api.gouv.fr |
| `outils/serveur-local.ps1` | Serveur de test sur ce PC (http://localhost:8765) |
| `outils/generer-icones.ps1` | Régénère les icônes |
| `outils/compter-heures.ps1` | Estime les heures de travail, pour le compteur de la page admin |

## Organisation du code

Depuis la version 39, le code est réparti en fichiers de `js/`, chargés par `index.html` dans cet ordre. Ce sont des scripts ordinaires (pas des modules) : ils partagent leurs fonctions et leurs variables, et chacun peut utiliser au chargement ce que définissent ceux d'avant. Une fonction appelée plus tard (à un appui, à l'affichage) peut se trouver dans n'importe quel fichier.

| Fichier | Contenu |
|---|---|
| `repertoires.js` | Répertoires des émotions (`FAM`) et des besoins (`BES`), intensités, couleurs de la journée |
| `utilitaires.js` | Dates, textes, phrases des émotions et des besoins |
| `connecteurs.js` | Connecteurs (@travail) : lecture dans les notes, mise en forme |
| `constantes.js` | `APP_VERSION`, compteurs de travail, `RGPD_VERSION`, engagements de la version d'essai, `toast` |
| `chiffrement.js` | Chiffrement du journal |
| `donnees.js` | Ouverture et normalisation du journal, enregistrement, emplacement du stockage |
| `serveur.js` | Serveur Supabase (`SERVER`) et mode démonstration |
| `connexion.js` | Écran de connexion et d'inscription, installation sur téléphone |
| `compte.js` | Ouverture du journal, récupération, politique, engagements, effacement, suppression, sauvegarde |
| `app.js` | État de l'app, affichage (`render`), onglets, icônes |
| `vue-quotidien.js`, `vue-journal.js`, `vue-repertoire.js`, `vue-parametres.js` | Les onglets |
| `import-texte.js`, `page-connecteurs.js` | Pages Importer des notes et Connecteurs |
| `guide.js` | Page Guide d'utilisation : met en page le texte de `guide/guide.md` |
| `therapeute-lien.js`, `therapeute-canal.js`, `vue-clients.js` | Lien client-thérapeute, envois, fiches clients |
| `admin.js` | Administration (`LIMITES`) |
| `saisie.js` | Ville automatique, fenêtre d'une émotion (volets émotions et besoins), note personnelle |
| `export-excel.js` | Exports Excel et texte (.txt), selon le choix des données |
| `dialogue-code.js` | Fenêtre de saisie d'un mot de passe ou d'un code |
| `actions.js` | Actions des boutons (`ACT`), registre des pages des Paramètres (`PAGES_REGLAGES`) |
| `gestes.js` | Balayages (jour, semaine, mois, retour), cartes émotion / besoin / action, appui long (Modifier, Afficher, Supprimer), volets de la saisie |
| `fenetres.js` | Confirmation, choix d'une action, bulle d'un connecteur, choix des connecteurs, fond immobile derrière les fenêtres |
| `journal-defilement.js` | Journal : en-têtes collés, barre compacte, choix du mois |
| `saisie-champs.js` | Propositions de connecteurs, hauteur des champs, majuscules, état unique du clavier (barre du bas, fenêtres, `--clavier`) |
| `demarrage.js` | Écouteurs généraux, lien d'invitation, service worker, démarrage (`boot`) |

Pour ajouter, renommer ou retirer un fichier : le faire dans `index.html` **et** dans la liste `CODE` de `sw.js`, sinon l'app ne fonctionnerait plus hors connexion.

## Modifier le guide d'utilisation

Le guide (Paramètres › Guide d'utilisation) n'est pas dans le code : son texte est dans `guide/guide.md`, un fichier texte à
modifier avec n'importe quel éditeur (Bloc-notes compris), et ses captures sont dans le même dossier `guide/`.

- La syntaxe est rappelée en tête de `guide/guide.md` : `## Rubrique`, `### Intertitre`, `- liste`, `> astuce`, `**gras**`,
  `![Légende](capture.jpg)`. Une rubrique marquée `{utilisateur}` ou `{therapeute}` n'est montrée qu'à ce type de compte.
- Une capture citée dans le texte est gardée hors connexion d'elle-même : rien à ajouter dans `sw.js`.
- Captures : thème clair, largeur d'un téléphone (375 px), au format JPEG, et jamais la barre d'onglets du bas (l'onglet
  Admin ne doit pas y figurer).
- Pour que les téléphones reçoivent le guide modifié, augmenter `APP_VERSION` (`js/constantes.js`) et `CACHE` (`sw.js`).

## Règles des zones de texte et des fenêtres (à respecter partout, y compris pour tout nouveau champ)

Fixées par l'administrateur (dernière mise à jour le 2026-11-08) : ne pas les changer sans son accord.

Dans le code, tout ce qui touche au clavier part d'**un seul état**, `clavier` (`majClavier`, dans `saisie-champs.js`) : la barre
du bas, la place des fenêtres, la marge de la page et le geste qui range le clavier le lisent, et rien d'autre ne les change.
Un nouveau champ ou une nouvelle fenêtre n'a donc rien à faire de spécial pour respecter les règles 2 à 4.

1. **Majuscules automatiques**
   - Tout champ de texte libre : `autocapitalize="sentences"`.
   - Champ qui continue une phrase de l'app (« … car », « Plus précisément… », « Je pourrais… ») : pas de majuscule au premier
     mot, mais une au début de chaque nouvelle ligne et de chaque nouvelle phrase, après . ! ? ou … (`majLigne`, `CHAMPS_MAJ`). Chaque action à cocher en prend une dès sa première lettre.
   - Jamais dans les identifiants, mails, mots de passe, codes et recherches (`autocapitalize="none"`).
2. **Le clavier ne recouvre jamais la zone de texte** (le texte, son cadre et ses boutons)
   - La barre d'onglets du bas se cache tant que le clavier est là (`body.clavier`), et revient dès qu'il se range, même sans
     quitter le champ (bouton retour d'Android).
   - Une fenêtre se pose juste au-dessus du clavier et rétrécit ; seul son contenu défile. Exceptions : le mini-calendrier
     (accroché sous la date) et les fenêtres plein écran.
   - Toute la zone remonte au-dessus du clavier (ou des boutons du bas de la fenêtre) : le champ entier et ses boutons, sans que
     son haut passe sous la date ou le titre (`zoneVisible`). À chaque frappe, la ligne du curseur reste visible (`curseurVisible`).
   - La page gagne en bas la hauteur du clavier (`--clavier`) : de quoi remonter le texte, sans grand vide ni page visible sous le clavier.
   - Un champ s'allonge avec son texte, sans barre de défilement à l'intérieur ni saut de la page (`allonger`, `sansSaut`).
   - Une fenêtre ne s'ouvre pas avec le clavier (le titre prend le focus, `autofocus`), sauf celles où l'on doit aussitôt taper
     un code ou un mot de passe.
3. **Un geste vers le bas range le clavier**, partout : le doigt qui descend jusqu'au clavier, ou qui glisse vers le bas sur ce
   qui ne défile pas (`fenetres.js`).
4. **Une fenêtre ouverte immobilise la page derrière elle** : seul ce qui défile dans la fenêtre défile, sans entraîner le fond.
   - La fenêtre des connecteurs se ferme d'un geste vers le bas depuis son haut ou d'un appui à côté ; la fenêtre du choix du
     jour, qui descend de la date, d'un geste vers le haut.
   - Quotidien : le « mini-calendrier », c'est la frise de la semaine (pas le mois). Elle redescend sous la date avec la même
     règle que la barre Calendrier/Liste du Journal : au rythme du doigt quand on remonte la page, cachée tant que la vraie frise est visible.
5. **Connecteurs** (`@mot` dans le texte)
   - Dans tous les textes libres du journal : « … car », « Plus précisément… », chaque action à cocher, « Plus librement… »,
     note personnelle, synthèse (`CHAMPS_CONN`, `champConn`). Ils y sont proposés, comptés, filtrés, renommés et mis en forme
     (`texteEmotion` réunit les textes d'une émotion). Pas dans les notes de l'administrateur, la fiche d'un client ni les messages,
     qui ne font pas partie du journal.
   - Les formes proches sont un seul connecteur (`racineConn`, `cleC`) : article élidé (@l’entreprise = @entreprise), pluriel
     (@entreprises), infinitif et participe (@procrastiné = @procrastiner), et un e final sans accent si le verbe est écrit
     ailleurs (« je @procrastine »). Un e final seul ne suffit pas : @Michel et @Michèle restent deux connecteurs. Le nom retenu :
     sans article, l'infinitif d'abord, puis le singulier, puis la forme la plus fréquente ; dans le texte, chaque forme reste écrite telle quelle.
   - Propositions dès la première lettre après le @ : 4 au plus, en petite liste sous la ligne en cours (au-dessus seulement si
     le clavier la cacherait), retirées quand on touche le texte.
   - Une fois la note enregistrée : italique, couleur normale, souligné fin couleur accent ; jamais de gras ni de couleur de texte.
   - Pendant la frappe, le champ montre son propre texte, sans mise en forme (v38 : une copie superposée décalait le curseur sur iPhone).
6. **Gestes et confirmations**
   - Balayages faciles (45°, 60 px, 1,25 s), jamais pendant une sélection de texte ; un retour en arrière peut partir d'un
     champ, sauf de celui où l'on écrit.
   - Toute recherche a sa croix pour s'effacer ; tout mot de passe a son œil.
   - Toute action qui efface du texte ou des données demande confirmation, dans une fenêtre de l'app.

## Confidentialité

- Aucune donnée ne quitte le téléphone : pas de compte, pas de serveur, aucune bibliothèque externe. La politique de sécurité de la page (CSP `connect-src 'self'`) n'autorise le code qu'à lire les fichiers de l'app elle-même : aucune requête vers un autre site n'est possible.
- Ville automatique : la position GPS est comparée, sur le téléphone, à la liste des communes intégrée (`communes.txt`). Elle n'est ni envoyée ni enregistrée ; seul le nom de la ville est noté. Fonctionne en France uniquement ; désactivable dans les Paramètres.
- Les notes sont chiffrées (AES-GCM 256 bits) avec une clé dérivée du code de l'utilisateur (PBKDF2-SHA-256, 250 000 itérations), puis stockées dans le `localStorage` du navigateur.
- Le code n'est stocké nulle part : **code oublié = notes perdues**.
- Verrouillage automatique quand l'app passe en arrière-plan (délai réglable).
- Envoi par mail, en un appui : le menu de partage du téléphone joint le fichier et préremplit le texte, mais aucune app web ne peut y indiquer le destinataire ; le mail du thérapeute lié est donc copié pour être collé. Sans menu de partage (PC), le fichier est téléchargé et la messagerie s'ouvre avec le destinataire, l'objet et le texte, et le fichier s'y joint à la main. Le texte du mail ne contient que le nom et les dates de la période.
- Les exports (Excel ou texte `.txt`) et la sauvegarde sont générés sur le téléphone ; l'utilisateur décide à qui les envoyer. La sauvegarde (`.json`) reste chiffrée ; les exports, eux, sont en clair, avec les données choisies dans Partage et export › Choix des données (tout, par défaut).
- Recherche (Journal › Liste) : un mot est cherché dans tous les mois, sur l'appareil, sans tenir compte des accents ni des majuscules.
- Les notes personnelles (texte libre, à côté des émotions) sont dans le journal chiffré et la sauvegarde ; elles ne vont dans les envois au thérapeute ou dans les exports que si l'utilisateur les y coche (Choix des données).

## Comptes et administration

L'app s'ouvre sur un écran de **connexion** (identifiant + mot de passe), avec un lien pour créer un compte.

- **Compte utilisateur ou thérapeute** (v46) : le formulaire d'inscription crée toujours un compte utilisateur. Un thérapeute
  demande un lien à l'administrateur, qui le crée dans sa page Admin (carte « Comptes thérapeute ») : `#t=` suivi d'un code de
  32 caractères, à usage unique, valable 30 jours, retirable tant qu'il n'a pas servi. Ouvert, ou collé dans le champ
  Identifiant (iPhone : le lien n'ouvre pas l'app installée), il affiche le formulaire thérapeute. Aucune mention des
  thérapeutes n'apparaît sur les écrans de connexion et d'inscription d'un utilisateur. Le serveur ne garde que l'empreinte du code et ses dates,
  efface le lien dès qu'il a servi, et refuse toute inscription de thérapeute sans lien valable (`serveur/lien-therapeute.sql`).
  L'administrateur peut toujours changer le type d'un compte existant.

- **Préférences à la création du compte** : une fenêtre propose le temps de verrouillage et, pour un client, la ville automatique (GPS), sur « Oui » par défaut. Elle s'affiche avant l'envoi du code de confirmation.
- **Mail de récupération (obligatoire)** : demandé à l'inscription, et à l'ouverture de l'app pour les comptes plus anciens tant qu'il n'est pas confirmé. Sans internet, si l'envoi échoue ou si rien n'arrive au bout de 2 minutes, le journal reste accessible et un bandeau le redemande. Confirmé par un code à 6 chiffres reçu par e-mail (renvoi possible après 1 minute), il peut être changé dans les Paramètres mais pas retiré. Il permet de recevoir un code à 6 chiffres si le mot de passe est oublié (5 demandes par 24 heures, 5 essais par code, validité 15 minutes). Le serveur n'en garde qu'une empreinte illisible : elle n'apparaît ni dans la page admin ni dans Supabase, et l'utilisateur la retape à l'identique en cas d'oubli. Le service d'envoi (Brevo) reçoit l'adresse à chaque envoi et l'affiche dans l'historique du compte Brevo, conservé 1 mois et visible par la personne qui gère ce compte. Sans adresse enregistrée, un mot de passe perdu ne peut pas être réinitialisé.
- **Thérapeute : un seul mail** : son mail professionnel sert aussi de mail de récupération. Dès qu'il est confirmé, il devient le mail de contact transmis aux clients avec le lien d'invitation, en clair sur le serveur avec ses coordonnées.
- **Effacer ses données** : avec une adresse confirmée, l'utilisateur la retape et saisit un code à 6 chiffres reçu par e-mail (fonction `recuperation`, actions `effacer_demande` et `effacer_confirme`) ; tant que le mail n'est pas confirmé, il confirme avec son mot de passe. Le fichier chiffré « données utilisateur » a trois sections : `journal` (jours, date de sauvegarde), `donneesClients` (thérapeute) et `parametres` (profil, réglages, libellés, thérapeute lié, historique des envois, clé du thérapeute, mail masqué). L'effacement vide le journal et les données reçues des clients sur l'appareil, sans déconnecter ; le compte, les paramètres et les fiches clients restent, et un mail le confirme quand un code a été utilisé. Les sauvegardes, fichiers Excel et envois déjà créés ne sont pas concernés. Une version masquée du mail (`adre*******@domaine.fr`) est gardée sur l'appareil pour aider l'utilisateur à s'en souvenir : dans le journal chiffré, et en clair pour la page « Mot de passe oublié », où le journal est verrouillé. Le mail complet n'y est pas conservé, et cette version masquée n'est jamais envoyée au serveur.
- **Supprimer son compte** : Paramètres › Supprimer mon compte, avec internet. Avec une adresse confirmée, l'utilisateur la retape et saisit un code à 6 chiffres (actions `supprimer_demande` et `supprimer_confirme`) ; sinon il confirme avec son mot de passe, vérifié par le serveur (action `supprimer_mdp`). Le serveur supprime d'abord le compte, et le profil, les compteurs et la récupération suivent par cascade ; l'appareil n'est vidé qu'ensuite, donc rien n'est effacé si le serveur refuse. Le compte administrateur ne peut pas être supprimé ainsi. Les sauvegardes, fichiers Excel, envois déjà créés et notes d'un autre appareil ne sont pas concernés.
- **Changer de mot de passe** (v40) : Paramètres › Mot de passe et verrouillage, avec internet. Le mot de passe actuel est demandé d'abord, et vérifié sur l'appareil (il ouvre le journal). S'il est oublié et qu'une adresse est confirmée, un code à 6 chiffres le remplace (actions `mdp_demande` et `mdp_confirme`). Ensuite seulement, le nouveau mot de passe est demandé.
- **Reprise des notes** : le serveur garde une clé de secours, et l'appareil la clé du journal chiffrée par cette clé de secours. Aucun des deux, seul, n'ouvre les notes ; une personne ayant à la fois le téléphone et l'accès à la boîte mail le pourrait. Sur un nouvel appareil, seul le compte est récupéré : les notes reviennent avec une sauvegarde.
- **Déconnexion automatique** : réglable, jusqu'à « Jamais ». Le journal s'ouvre alors sans mot de passe sur cet appareil, même après fermeture de l'app, jusqu'à « Se déconnecter ».

- Le **serveur** (Supabase, hébergé en Europe) ne connaît que les comptes : identifiant, prénom, nom de famille (uniquement l'initiale pour un utilisateur ; le nom complet reste sur son appareil et dans ses envois au thérapeute), code utilisateur (`U-0001` pour un utilisateur, `C-0001` avant novembre 2026 ; `T-0001` pour un thérapeute), type de compte, coordonnées des thérapeutes, date et nombre de connexions, et des **compteurs** (notes saisies, envois au thérapeute). Jamais le contenu des notes.
- Le **journal** reste chiffré sur l'appareil, avec le mot de passe du compte. Hors connexion, le journal déjà présent sur l'appareil s'ouvre quand même.
- L'**administrateur** (un seul compte) a un onglet « Admin » : statistiques d'utilisation, liste des utilisateurs, désactivation, suppression et changement de type de compte.
- Tant que `SERVER.url` est vide dans `js/serveur.js`, l'app fonctionne en **mode démonstration** : les comptes sont simulés dans le navigateur, et le premier compte créé est administrateur.

### Mise en place du serveur

1. Créer un projet sur https://supabase.com (région Europe).
2. *SQL Editor* : coller et exécuter `serveur/schema.sql`.
3. *Authentication › Sign In / Providers › Email* : désactiver « Confirm email » (les identifiants ne sont pas de vraies adresses).
4. *Project Settings › API Keys* : copier l'adresse du projet et la clé publique (« Publishable key » ou, dans l'ancien écran, « anon public ») dans `SERVER`, dans `js/serveur.js`. Cette clé est publique par nature ; ne jamais y mettre une clé secrète (« Secret key » ou « service_role »).
5. Créer son compte dans l'app, puis dans *SQL Editor* : `update public.profils set est_admin = true where identifiant = 'votre-identifiant';`
6. Récupération par e-mail : exécuter `serveur/recuperation.sql`, puis créer dans *Edge Functions* une fonction nommée `recuperation` avec le contenu de `serveur/recuperation-fonction.ts`, vérification JWT désactivée. Définir ses secrets : `RECUPERATION_SECRET`, `BREVO_API_KEY`, `EMAIL_EXPEDITEUR`. À chaque modification de ce fichier, recoller son contenu dans la fonction et cliquer sur *Deploy*. La même fonction change l'identifiant après avoir vérifié le mot de passe (`identite_mdp`) : un nouvel identifiant change aussi l'adresse de connexion du compte. Le nom et le prénom, eux, se confirment par le mot de passe sur l'appareil. Sur l'appareil, le journal change d'emplacement avec lui ; sur un autre appareil, il est retrouvé à la connexion grâce au code utilisateur (`reprendreJournal`).
7. Lien d'invitation court : exécuter `serveur/invitation-courte.sql`. Le serveur garde la clé publique du thérapeute et un code de 30 caractères (`#i=…`), soit un lien de 60 caractères environ, et un utilisateur connecté lit l'invitation avec ce code. Sans ce fichier, ou sans réponse du serveur, l'app garde le lien long (`#inv=…`), qui reste valable. Le code de sécurité à comparer de vive voix protège contre une clé remplacée sur le serveur.
8. Lien client-thérapeute : exécuter `serveur/canal.sql`, après `invitation-courte.sql`, puis `serveur/invitation-sans-coordonnees.sql` si `invitation-courte.sql` avait été exécuté avant novembre 2026. Voir « Lien entre un client et son thérapeute » plus bas.
9. Carte « Services et limites » de la page admin : exécuter `serveur/limites.sql`. Les valeurs maximales sont inscrites dans `LIMITES`, dans `js/admin.js`, à mettre à jour si les offres changent.
10. Trace après suppression d'un compte : exécuter `serveur/comptes-supprimes.sql`. Avant chaque suppression, le code utilisateur, l'identifiant, le prénom, le nom tel que le serveur le connaît, les dates de création et de suppression et l'accord à la politique sont copiés dans `comptes_supprimes`, lisible seulement depuis le tableau de bord Supabase, puis effacés au bout de 5 ans.
11. Compteurs « Aujourd'hui » de la page admin : exécuter `serveur/compteur-du-jour.sql`.
12. Journal de connexion gardé 6 mois (recommandation de la CNIL) : dans *Authentication › Configuration › Audit Logs*, activer « Write audit logs to the database », puis exécuter `serveur/journal-connexions.sql`. Supabase note alors chaque connexion, reconnexion et déconnexion dans `auth.audit_log_entries` ; une tâche planifiée (`pg_cron`) efface chaque nuit les lignes de plus de 6 mois. La page admin ne lit pas ce journal.
13. Comptes thérapeute sur lien de l'administrateur : exécuter `serveur/lien-therapeute.sql` (après `schema.sql`). Il remplace la
    fonction qui crée le profil à l'inscription : un compte thérapeute exige désormais un lien valable.
14. Activité de chaque compte dans la page Admin (notes saisies, envois) : exécuter `serveur/activite-utilisateurs.sql`. Facultatif :
    sans lui, ces deux lignes n'apparaissent pas dans le détail d'un compte.
15. Compte désactivé en lecture seule, et connexions comptées par l'app (même sans internet) : exécuter `serveur/compte-desactive.sql`
    **avant** de publier la version 47. Il remplace `ouvrir_session` (un compte désactivé reçoit son profil au lieu d'être refusé) et
    `compter` (nouveau paramètre `p_connexions`). Tant qu'il n'est pas exécuté, l'app refuse un compte désactivé comme avant.
    Règle : un compte désactivé se connecte, lit et exporte ses notes, mais plus rien ne s'écrit (`lectureSeule`, `ECRITURES` dans
    `serveur.js`). L'état est relu à chaque ouverture et au retour de l'app au premier plan (`verifierCompte`), puis gardé dans le
    journal chiffré (`data.account.lecture`) pour tenir hors connexion. Tout nouveau bouton qui écrit une note doit rejoindre `ECRITURES`.

## Lien entre un client et son thérapeute

- **Liaison** : le client ouvre ou colle l'invitation, vérifie le code de sécurité et coche son accord. Il partage son prénom, son nom et son code utilisateur, jamais son identifiant de connexion. Son app crée un secret commun et le dépose sur le serveur, chiffré pour le seul thérapeute (`deposer_arrivee`, sans le compte du client). L'app du thérapeute le lit (`lire_arrivees`), crée ou reprend la fiche du client, puis efface le dépôt.
- **Demande à accepter** : toute liaison arrive chez le thérapeute dans « Demandes en attente », même pour un ancien client. Il l'accepte ou la refuse. Tant qu'elle n'est pas acceptée, le client ne peut rien lui envoyer. Un refus ou une acceptation lui est signalé dans une fenêtre. Le lien d'invitation peut ainsi circuler sans risque : il ne montre que le nom et le type de thérapie, les coordonnées du thérapeute n'arrivent qu'aux clients acceptés, et personne ne devient client sans son accord. Un fichier reçu d'une personne inconnue arrive lui aussi en demande.
- **Canal** : chaque lien a un canal sur le serveur (`canaux`), rangé sous un identifiant dérivé du secret et chiffré avec lui. Chaque côté y écrit sa fiche de coordonnées, mise à jour automatiquement, et l'état du lien. Le canal n'est rattaché à aucun compte, et le client y accède sans se connecter : le serveur ne sait pas quel client est lié à quel thérapeute. Le journal n'y passe jamais.
- **Rupture** : l'un ou l'autre y met fin après avoir recopié un code. L'autre voit une fenêtre, avec le prénom et le nom, quelle que soit la page ouverte, puis le canal est effacé. Le client passe dans « Anciens clients », sa fiche et ses données reçues restent chez le thérapeute. Sur la fiche, « Effacer les données reçues » les retire sans toucher au suivi. Supprimer la fiche d'un client lié met aussi fin au suivi, et le client en est prévenu. Sans connexion, la rupture part au retour du réseau (`canauxARompre`).
- **Données transmises** : la couleur de la journée, et au moins un choix parmi les émotions (avec leur heure et leur raison), la synthèse et les notes personnelles. Les lieux s'ajoutent en plus. Le choix se fait au premier envoi, et se change dans Paramètres › Données transmises.
- **Réception** : le thérapeute dépose les fichiers reçus en vrac, par glisser-déposer sur ordinateur ou par sélection multiple. Chacun se range seul dans la fiche de son client, par date, avec une pastille « nouveau ». Une fenêtre indique le nombre de fichiers, leurs expéditeurs et ce qui n'a pas pu être rangé.

## Profils client et thérapeute

L'inscription crée un compte « Utilisateur » ; un compte « Thérapeute » se crée avec un lien de l'administrateur (voir « Comptes et administration »). Pour le thérapeute, les utilisateurs qu'il suit sont ses « clients » ; dans le code, le rôle interne reste `client`. Il n'y a toujours **aucun serveur** : tout passe par des fichiers que l'utilisateur envoie lui-même.

1. **Invitation** : le thérapeute partage son lien d'invitation (Paramètres). Ce lien contient un code court (`#i=…`) : le client s'en sert pour lire sur le serveur la clé publique, le nom et le type de thérapie du thérapeute. Le client ouvre le lien, ou le colle dans Paramètres › Mon thérapeute. Les deux voient le même **code de sécurité** (ex. `F455-D132`), à comparer de vive voix pour s'assurer que le lien n'a pas été modifié.
2. **Envoi** : le client choisit une période (par défaut les 7 derniers jours) puis appuie sur « Envoyer à … ». L'app crée un fichier chiffré (ECDH P-256 + AES-GCM 256) que seul ce thérapeute peut ouvrir, puis l'envoie par e-mail ou messagerie depuis le menu de partage. Rien n'est envoyé automatiquement, et aucun rappel d'envoi ne s'affiche (retiré en v46) ; seul le rappel d'export, que l'utilisateur règle lui-même, existe.
3. **Fiches clients** : le thérapeute crée une fiche par client (onglet Clients : nom, coordonnées, notes personnelles), avec recherche dès que la liste s'allonge.
4. **Import** : depuis la fiche du client, « Importer un fichier reçu », autant de fois que nécessaire. Au premier import, la fiche est liée à l'app du client ; si un fichier est ensuite importé dans la mauvaise fiche, l'app le signale. Le thérapeute voit l'historique des envois, le calendrier du client (avec le filtre par émotion), ses journées en lecture seule, et peut exporter en Excel. Les données reçues restent chiffrées sur son appareil.

Important pour le thérapeute : sa clé de déchiffrement est dans le journal chiffré de son appareil. Une sauvegarde régulière (Paramètres › Sauvegarde) est indispensable : sans elle, un nouvel appareil ne pourra plus ouvrir les fichiers des clients.

## Mise en ligne

L'app doit être servie en **HTTPS** (le chiffrement du navigateur l'exige). N'importe quel hébergement de fichiers statiques convient, car le serveur ne fait que livrer les fichiers et ne reçoit jamais les notes :

- **Netlify Drop** (le plus simple) : glisser le dossier `journal-emotions` sur https://app.netlify.com/drop
- **GitHub Pages** : publier le dossier dans un dépôt et activer Pages.

Ensuite, sur le téléphone : ouvrir l'adresse puis l'ajouter à l'écran d'accueil (iPhone : Partager → « Sur l'écran d'accueil » ; Android : menu ⋮ → « Installer l'application »).

Sur téléphone, Motus ne fonctionne que depuis l'écran d'accueil : dans un navigateur, une page guide l'installation selon le téléphone et le navigateur. Un lien d'invitation y devient une page relais, car un lien ne peut pas ouvrir l'app installée sur iPhone : l'invitation se copie, puis se colle dans Paramètres › Mon thérapeute. Si le navigateur contient déjà des notes, la connexion reste possible pour les sauvegarder. Un lien discret permet de continuer dans le navigateur si l'installation est impossible. Sur ordinateur, Motus reste utilisable dans le navigateur.

À savoir : sur iPhone, Safari et l'app de l'écran d'accueil ont chacun leur stockage, et les notes de l'un n'apparaissent pas dans l'autre. Pour restaurer une sauvegarde, installer d'abord l'app, puis restaurer depuis l'icône. Safari peut aussi effacer les données d'un site non installé après 7 jours sans visite. Installer l'app sur l'écran d'accueil évite ce problème. Il est conseillé de faire régulièrement une sauvegarde depuis les Paramètres.

## Avant chaque mise à jour : ne perdre aucune note

Les notes n'existent que sur l'appareil de l'utilisateur : une mise à jour ne doit jamais les modifier sans les conserver. Avant de publier, vérifier sur une copie de test, à partir de la **version actuellement en ligne** :

1. Créer un compte avec la version en ligne et saisir des notes, une synthèse et une couleur.
2. Passer à la nouvelle version, puis se reconnecter : tout doit être présent.
3. Faire de même avec « déconnexion automatique : Jamais ».
4. Vérifier « Sauvegarder » puis « Restaurer » (un bandeau propose la sauvegarde en un appui si la dernière date de plus de 7 jours).
5. Tout changement du format ou de l'emplacement des données doit relire l'ancien format et n'effacer l'ancienne copie qu'après avoir vérifié la nouvelle.

Rappel : une mise à jour ne protège pas contre la perte du téléphone ou l'effacement des données du navigateur. Seule une sauvegarde le permet.

## Mettre à jour

Après une modification, augmenter le numéro de `CACHE` dans `sw.js` et donner le même à `APP_VERSION` dans `js/constantes.js`. Les téléphones installent alors la nouvelle version en arrière-plan, puis l'app affiche « Nouvelle version disponible » avec un bouton « Mettre à jour ». Le numéro installé se lit dans Paramètres › À propos.

À chaque nouvelle version, lancer aussi `outils/compter-heures.ps1` et reporter ses résultats dans `HEURES_TRAVAIL` et `JETONS_CONSOMMES`, dans `js/constantes.js` : ce sont les compteurs de la page admin. Les jetons relus depuis le cache sont la plus grosse part : à chaque réponse, Claude relit toute la conversation, mise en cache.
