// Motus — Paramètres : menu et pages (compte, partage et export, apparence, contact…)
'use strict';

/* — Vue Paramètres : un menu, puis une page par sujet — */
const LOCK_N = {0:'Immédiate', 1:'1 min', 5:'5 min', 15:'15 min', '-1':'Jamais'};
const THEME_N = {auto:'Automatique', clair:'Clair', sombre:'Sombre'};
const ligneMenu = (icone, nom, {val, page, act, cl = ''} = {}) => `<button class="ro ${cl}" data-act="${act || 'setPage'}"${page ? ` data-p="${page}"` : ''}>${ico(icone)}<span class="rn">${nom}</span>${val ? `<em>${esc(val)}</em>` : ''}${ico('ch', 'rc')}</button>`;
const groupeMenu = (titre, lignes) => `<div class="gl">${titre}</div><div class="grp">${lignes.join('')}</div>`;

function vSet() {
  const page = setPage && PAGES_REGLAGES[setPage];
  if (!page) return vSetMenu();
  return `<div class="subhead"><button class="icon-btn" data-act="setBack" aria-label="Retour aux paramètres">‹</button><h1>${page[0]}</h1></div>${page[1]()}`;
}

function vSetMenu() {
  const a = data.account || {}, p = data.profile, th = data.role === 'therapeute', t = data.therapist;
  const nom = (th ? `${p.prenom} ${p.nom}` : `${p.prenom} ${initiale(p.nom)}`).trim() || a.identifiant || '';
  const mail = a.recup === 'attente' ? 'Mail à confirmer' : a.recup ? '' : 'Mail à ajouter';
  return `
  <div class="sethead">
    <div>${th ? '<div class="eyebrow">Espace thérapeute</div>' : ''}<h1>Paramètres</h1></div>
    <button class="toggle" data-act="toggleTheme" aria-label="Passer en mode ${document.documentElement.dataset.theme === 'dark' ? 'clair' : 'sombre'}"><b>${ico(document.documentElement.dataset.theme === 'dark' ? 'moon' : 'sun', '')}</b></button>
  </div>
  <div class="whois"><div class="avatar" aria-hidden="true">${esc([...(p.prenom || a.identifiant || '?').trim()][0].toUpperCase())}</div><div><b>${esc(nom)}</b><span>${ROLE_N[data.role]}${a.numero ? ' · ' + esc(a.numero) : ''}</span></div></div>
  ${groupeMenu('Mon compte', [
    ligneMenu('user', 'Informations personnelles', {val:mail, page:'infos'}),
    ligneMenu('lock', 'Mot de passe et verrouillage', {val:LOCK_N[data.settings.autolock], page:'secu'}),
    ligneMenu('out', 'Se déconnecter', {act:'lockNow'}),
  ])}
  ${th ? groupeMenu('Mon cabinet', [
    ligneMenu('link', 'Mon lien d’invitation', {page:'invite'}),
    ligneMenu('user', 'Mon profil professionnel', {page:'pro'}),
  ]) : groupeMenu('Mon suivi', [
    ligneMenu('thera', 'Mon thérapeute', {val:t ? (attenteAcceptation(t) ? 'En attente' : `${initiale(t.prenom)} ${t.nom}`.trim()) : 'À ajouter', page:'thera'}),
    ligneMenu('send', 'Partage et export', {page:'partage'}),
    ligneMenu('shield', 'Données transmises', {val:resumePartage(), page:'donnees'}),
    ligneMenu('col', 'Code couleur', {page:'couleurs'}),
    ligneMenu('at', 'Connecteurs', {val:connecteurs().size ? String(connecteurs().size) : '', page:'connecteurs'}),
    ligneMenu('pin', 'Localisation', {val:data.settings.geoloc ? 'Activée' : 'Désactivée', page:'geo'}),
  ])}
  ${groupeMenu('Mes données', [
    ligneMenu('save', 'Sauvegarde', {val:data.backupAt ? fmtFR(ymd(new Date(data.backupAt))) : 'Aucune', page:'sauvegarde'}),
    ...(th ? [] : [ligneMenu('importer', 'Importer des notes', {page:'importer'})]),
    ligneMenu('trash', 'Effacer mes données', {page:'effacer', cl:'dan'}),
    ligneMenu('usersup', 'Supprimer mon compte', {page:'supprimer', cl:'dan'}),
  ])}
  ${groupeMenu('Application', [
    ligneMenu('sun', 'Apparence', {val:THEME_N[themeChoisi()], page:'apparence'}),
    ligneMenu('share', 'Partager Motus', {act:'partagerApp'}),
    ...(CONTACT_MAIL ? [ligneMenu('mail', 'Nous contacter', {page:'contact'})] : []),   // visible dès que l'adresse de contact est renseignée
    ...(appInstallee() ? [] : [ligneMenu('phone', 'Installer sur l’écran d’accueil', {page:'installer'})]),
    `<a class="ro" href="confidentialite.html" target="_blank" rel="noopener" data-act="voirPolitique">${ico('shield')}<span class="rn">Confidentialité</span>${ico('ch', 'rc')}</a>`,
    ligneMenu('info', 'À propos', {val:`Version ${APP_VERSION}`, page:'apropos'}),
  ])}`;
}

function pageInfos() {
  const a = data.account || {}, p = data.profile, th = data.role === 'therapeute';
  return `<section class="card">
    <div class="stat"><span class="muted">Prénom</span><b>${esc(p.prenom || '—')}</b></div>
    <div class="stat"><span class="muted">Nom</span><b>${esc(p.nom || '—')}</b></div>
    <div class="stat"><span class="muted">Identifiant</span><b>${esc(a.identifiant || '—')}</b></div>
    <div class="stat"><span class="muted">Code utilisateur</span><b>${esc(a.numero || '—')}</b></div>
    <div class="stat"><span class="muted">Type de compte</span><b>${ROLE_N[data.role]}${a.est_admin ? ' · administrateur' : ''}</b></div>
    <div class="stat"><span class="muted">Compte créé le</span><b>${a.cree_le ? fmtFR(ymd(new Date(a.cree_le))) : '—'}</b></div>
    ${session ? '' : '<p class="small muted" style="margin:8px 0 0">Hors connexion : le compte sera synchronisé à la prochaine connexion avec internet.</p>'}
    <button class="btn block" data-act="modifierIdentite">Modifier mon nom ou mon identifiant</button>
    <p class="small muted" style="margin:6px 0 0">Votre mot de passe vous sera demandé pour confirmer.${th ? '' : ' Votre nom figure dans l’export Excel et dans les envois à votre thérapeute.'}</p>
  </section>
  ${pageMail()}`;
}

function pageMail() {
  const a = data.account || {};
  return `<section class="card">
    <h2>${MAIL_NOM[data.role]}</h2>
    <div class="stat"><span class="muted">Adresse</span><b style="overflow-wrap:anywhere;text-align:right">${esc(a.recup === 'attente' ? `${data.recupIndiceNouveau || data.recupIndice || 'Adresse'} (à confirmer)` : a.recup ? data.recupIndice || 'Confirmé' : 'À ajouter')}</b></div>
    <p class="small muted" style="margin:8px 0 0">${MAIL_AIDE[data.role]}</p>
    ${a.recup === 'attente' || a.recupChange ? `<p class="small muted" style="margin:6px 0 0">${a.recupChange ? 'Votre nouvelle adresse attend sa confirmation ; l’ancienne reste valable d’ici là.' : 'Tant qu’elle n’est pas confirmée, aucun code de récupération ne peut y être envoyé.'} Pas de message ? Regardez dans vos courriers indésirables.</p>
    <button class="btn primary block" data-act="confirmRecovery">Entrer le code</button>` : ''}
    <button class="btn ${a.recup ? '' : 'primary'} block" data-act="addRecovery">${a.recup ? (data.role === 'therapeute' ? 'Changer de mail professionnel' : 'Changer de mail de récupération') : 'Ajouter mon mail'}</button>
  </section>`;
}

function pageSecu() {
  return `<section class="card">
    <h2>Mot de passe</h2>
    <p class="small muted" style="margin:6px 0 0">Vos notes sont chiffrées avec votre mot de passe et enregistrées uniquement sur cet appareil. Rien n’en sort sans une action de votre part.</p>
    <button class="btn block" data-act="changeCode">Changer mon mot de passe</button>
  </section>
  <section class="card">
    <h2>Verrouillage</h2>
    <div class="setrow">
      <label for="autolock">Déconnexion automatique</label>
      <select id="autolock">${optionsVerrou()}</select>
    </div>
    <p class="small muted" style="margin:0">Avec « Jamais », le journal s’ouvre sans mot de passe sur cet appareil, même après avoir fermé l’app, jusqu’à ce que vous cliquiez sur « Se déconnecter ».</p>
  </section>`;
}

/* La période choisie sert aux deux : l'envoi chiffré au thérapeute et le fichier Excel */
function pagePartage() {
  const t = today(), th = data.therapist, attente = attenteAcceptation(th), peutEnvoyer = th && !attente, qui = esc(th?.prenom || 'votre thérapeute');
  return `<section class="card">
    <h2>Période</h2>
    <div class="weeknav">
      <button class="icon-btn" data-act="xPrevWeek" aria-label="7 jours plus tôt">‹</button>
      <div class="wk" id="wkLabel" aria-live="polite">${weekLabel()}</div>
      <button class="icon-btn" data-act="xNextWeek" id="xNext" aria-label="7 jours plus tard" ${addDays(xStart, 6) >= t ? 'disabled' : ''}>›</button>
    </div>
    <details class="custom" id="xCustom">
      <summary>Choisir une autre période</summary>
      <div class="row">
        <div><label class="label" for="xFrom">Du</label><input type="date" id="xFrom" value="${xStart}"><div class="wd-hint" id="xFromWd">${weekday(xStart)}</div></div>
        <div><label class="label" for="xTo">Au</label><input type="date" id="xTo" value="${addDays(xStart, 6)}"><div class="wd-hint" id="xToWd">${weekday(addDays(xStart, 6))}</div></div>
      </div>
    </details>
  </section>
  <section class="card">
    <h2>Partage à mon thérapeute</h2>
    <button class="stat" data-act="setPage" data-p="donnees" style="margin-top:4px"><span>Données transmises</span><b>${esc(resumePartage())} ›</b></button>
    ${!th ? `<p class="small muted" style="margin:6px 0 0">Vous n’êtes lié(e) à aucun thérapeute : le partage n’est pas possible pour l’instant. Ajoutez d’abord votre thérapeute, avec le lien d’invitation qu’il vous a donné.</p>
    <button class="btn primary block" data-act="voirThera">Ajouter mon thérapeute</button>`
    : attente ? `<p class="small muted" style="margin:6px 0 0">${esc(nomDe(th) || 'Votre thérapeute')} n’a pas encore accepté votre demande : le partage sera possible dès qu’il l’aura acceptée.</p>`
    : `<p class="small muted" style="margin:6px 0 0">Le fichier est chiffré : seul(e) ${qui} peut l’ouvrir.</p>
    <button class="btn primary block" data-act="sendWeek">Envoyer à ${qui}</button>
    <p class="small muted" style="margin:6px 0 0">${aideEnvoi(th.email)}</p>
    <div class="small muted" id="sentSt" style="margin-top:6px;text-align:center">${sentStatus()}</div>`}
  </section>
  <section class="card">
    <h2>Export Excel</h2>
    <div class="row" style="margin-top:10px">
      <button class="btn ${peutEnvoyer ? '' : 'primary'}" data-act="exportXlsx">Télécharger</button>
      ${navigator.canShare ? '<button class="btn" data-act="shareXlsx">Partager…</button>' : ''}
    </div>
    ${peutEnvoyer ? '' : '<button class="btn block" data-act="mailXlsx">Envoyer par mail</button>'}
    <p class="small muted" style="margin:6px 0 0"><b>Vos notes personnelles n’y figurent pas.</b> <b>Le fichier n’est pas chiffré :</b> vos émotions y sont lisibles.${peutEnvoyer ? '' : ` ${aideEnvoi('')}`}</p>
  </section>
  <section class="card">
    <h2>Mes semaines</h2>
    <p class="small muted" style="margin:4px 0 6px">Ce que vous avez envoyé à votre thérapeute, de la semaine en cours à la création de votre compte. Touchez une semaine pour la choisir.</p>
    <div id="listeSem">${listeSemaines()}</div>
  </section>`;
}
/* Semaines du lundi au dimanche, de la création du compte à aujourd'hui, avec la date de leur envoi.
   Les périodes choisies à la main peuvent ne couvrir qu'une partie d'une semaine : on compte jour par jour. */
function listeSemaines() {
  const t = today(), couvert = {};   // jour → date d'envoi la plus récente
  for (const [from, s] of Object.entries(data.sent)) for (let k = from; k <= s.to; k = addDays(k, 1)) if (!couvert[k] || s.at > couvert[k]) couvert[k] = s.at;
  const premier = Object.keys(data.days).sort()[0], cree = data.account?.cree_le ? ymd(new Date(data.account.cree_le)) : t;
  const debut = premier && premier < cree ? premier : cree, court = k => fmtFR(k).slice(0, k.slice(0, 4) === t.slice(0, 4) ? 5 : 10);
  const lignes = [];
  for (let lun = mondayOf(t); lun >= mondayOf(debut); lun = addDays(lun, -7)) {
    const dim = addDays(lun, 6), jours = [];
    for (let k = lun; k <= dim && k <= t; k = addDays(k, 1)) jours.push(k);
    const faits = jours.filter(k => couvert[k]), dernier = faits.map(k => couvert[k]).sort().pop();
    const etat = !faits.length ? '<span class="muted">Non envoyée</span>'
      : faits.length === jours.length ? `Envoyée ${sentAt(dernier)}`
      : `En partie (${faits.length} jour${faits.length > 1 ? 's' : ''} sur ${jours.length}), ${sentAt(dernier)}`;
    lignes.push(`<button class="stat" data-act="choisirSemaine" data-k="${lun}"><span>Du ${court(lun)} au ${court(dim)}${dim > t ? '<br><span class="small muted">en cours</span>' : ''}</span><b class="small">${etat}</b></button>`);
  }
  return lignes.join('');
}

function pageCouleurs() {
  return `<section class="card">
    <p class="small muted" style="margin:0">Le nom de chaque couleur, dans votre journal et dans vos envois.</p>
    ${COL.map(c => `<label class="label" for="lab-${c}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--${c});margin-right:6px"></span>${COLNAME[c]}</label>
      <input type="text" id="lab-${c}" data-label="${c}" value="${esc(data.labels[c])}" maxlength="40">`).join('')}
  </section>`;
}

function pageInvite() {
  const t = data.thera;
  return `<section class="card">
    <p class="small muted" style="margin:0">Donnez ce lien à vos clients. Ils le collent dans leur app (Paramètres › Mon thérapeute) et peuvent ensuite vous envoyer chaque semaine un fichier chiffré que vous seul(e) pouvez ouvrir.</p>
    <div class="small" style="margin-top:10px">Code de sécurité à leur confirmer : <span class="fp">${esc(data.keys?.fp || '…')}</span></div>
    <textarea id="invField" rows="3" readonly aria-label="Lien d’invitation">${data.keys ? esc(inviteLink()) : ''}</textarea>
    <div class="row" style="margin-top:10px">
      <button class="btn primary" data-act="shareInvite">Partager</button>
      <button class="btn" data-act="copyInvite">Copier</button>
    </div>
  </section>`;
}

function pagePro() {
  const t = data.thera;
  return `<section class="card">
    <p class="small muted" style="margin:0">Vos clients reçoivent ces coordonnées une fois leur demande acceptée, et chaque modification leur parvient automatiquement. Votre nom se change dans « Informations personnelles ».</p>
    <label class="label" for="tType">Type de thérapeute</label>
    <select id="tType" data-thera="type"><option value="">— Choisir —</option>${THERA_TYPES.map(x => `<option ${t.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="label" for="tTel">Téléphone</label>
    <input type="text" id="tTel" data-thera="tel" inputmode="tel" value="${esc(t.tel)}">
    <div class="stat" style="margin-top:14px"><span class="muted">Mail professionnel</span><b style="overflow-wrap:anywhere;text-align:right">${esc(t.email || '—')}</b></div>
    <p class="small muted" style="margin:4px 0 0">Il se change dans « Informations personnelles », après confirmation par un code.</p>
    <label class="label" for="tAdr">Adresse du cabinet</label>
    <input type="text" id="tAdr" data-thera="adresse" value="${esc(t.adresse)}">
  </section>`;
}

function pageGeo() {
  return `<section class="card">
    <div class="setrow" style="padding-top:0">
      <label for="geoloc">Remplir la ville automatiquement (GPS)</label>
      <input type="checkbox" id="geoloc" ${data.settings.geoloc ? 'checked' : ''}>
    </div>
    <p class="small muted" style="margin:0">La position est convertie en nom de ville directement sur le téléphone, grâce à la liste des communes intégrée à l’app. Elle n’est ni envoyée ni enregistrée : seule la ville est notée.</p>
    <button class="btn block" data-act="geoTest">Tester la localisation</button>
    <div class="geo-st small muted" id="geoTest" aria-live="polite"></div>
  </section>`;
}

function pageSauvegarde() {
  return `<section class="card">
    <p class="small muted" style="margin:0">${data.role === 'therapeute' ? 'Votre clé de déchiffrement et les données reçues de vos clients sont dans cette sauvegarde. Sans elle, un nouvel appareil ne pourra plus ouvrir les fichiers de vos clients.' : 'Si vous changez de téléphone ou effacez les données du navigateur, vos notes sont perdues. Faites régulièrement une sauvegarde : le fichier reste chiffré avec votre mot de passe.'}</p>
    <div class="stat" style="margin-top:6px"><span class="muted">Dernière sauvegarde</span><b>${data.backupAt ? fmtFR(ymd(new Date(data.backupAt))) : 'Aucune'}</b></div>
    <div class="row" style="margin-top:12px">
      <button class="btn primary" data-act="backup">Sauvegarder</button>
      <button class="btn" data-act="restore">Restaurer</button>
    </div>
  </section>`;
}

function pageEffacer() {
  const th = data.role === 'therapeute';
  return `<section class="card">
    <p class="small muted" style="margin:0">Efface ${th ? 'les données reçues de vos clients' : 'vos émotions, couleurs, synthèses et notes personnelles'} de ce téléphone. Votre compte et vos réglages${th ? ', ainsi que vos fiches clients,' : ''} sont conservés. Un code reçu par e-mail vous sera demandé.</p>
    <button class="btn danger block" data-act="wipe">Effacer toutes mes données</button>
  </section>`;
}

function pageSupprimer() {
  const th = data.role === 'therapeute';
  if (data.account?.est_admin) return `<section class="card"><p class="small muted" style="margin:0">${EFFACER_ERR.admin} Retirez d’abord son rôle d’administrateur dans Supabase.</p></section>`;
  return `<section class="card">
    <h2>Ce qui sera supprimé</h2>
    <ul class="small muted" style="margin:8px 0 0;padding-left:18px">
      <li>Votre compte et toutes vos données sur nos serveurs${th ? ', dont vos coordonnées professionnelles' : ''}.</li>
      <li>${th ? 'Vos fiches clients, les données reçues et votre clé de déchiffrement' : 'Vos émotions, couleurs, synthèses et notes personnelles'} sur ce téléphone.</li>
    </ul>
  </section>
  <section class="card">
    <h2>Ce que l’app ne peut pas supprimer</h2>
    <ul class="small muted" style="margin:8px 0 0;padding-left:18px">
      <li>Les sauvegardes, fichiers Excel et envois au thérapeute déjà créés : à supprimer vous-même.</li>
      <li>Les notes sur un autre appareil : effacez-y les données de l’app.</li>
      <li>L’historique d’envoi des e-mails, conservé 1 mois par notre prestataire.</li>
      ${th ? '<li>Vos clients gardent votre lien : ils ne sont pas prévenus et ne pourront plus vous envoyer de fichier lisible.</li>' : ''}
    </ul>
  </section>
  <section class="card">
    <p class="small muted" style="margin:0">Cette action est irréversible. Pour garder vos notes, faites d’abord une sauvegarde. Une connexion internet est nécessaire et un code reçu par e-mail vous sera demandé.</p>
    <button class="btn danger block" data-act="deleteAccount">Supprimer définitivement mon compte</button>
  </section>`;
}

function pageApparence() {
  const c = themeChoisi();
  return `<section class="card" style="padding:4px 0">${Object.entries(THEME_N).map(([k, n]) => `<button class="choix ${c === k ? 'on' : ''}" data-act="setTheme" data-t="${k}" aria-pressed="${c === k}"><span>${n}</span><i></i></button>`).join('')}</section>
  <p class="small muted" style="margin:0 2px">« Automatique » suit le réglage clair ou sombre de votre téléphone. Ce choix ne concerne que cet appareil.</p>`;
}

function pageInstaller() {
  return `<section class="card">
    <p class="small muted" style="margin:0">Recommandé : l’app s’ouvre en plein écran, fonctionne hors connexion et vos données sont mieux conservées.<br>
    <b>iPhone</b> : bouton Partager de Safari → « Sur l’écran d’accueil ». Notez ensuite uniquement depuis l’icône : Safari et l’app ne partagent pas leurs notes.<br>
    <b>Android</b> : menu ⋮ de Chrome → « Installer l’application ».</p>
    ${installEvt ? '<button class="btn primary block" data-act="install">Installer l’application</button>' : ''}
  </section>`;
}

/* Nous contacter : le message part depuis la messagerie de l'utilisateur, vers l'adresse de Motus */
const CONTACT_MAIL = 'motus.app@outlook.fr';   // adresse de contact de Motus (aussi dans la politique de confidentialité)
const SUJETS_CONTACT = ['Une question', 'Signaler un problème', 'Une suggestion', 'Mes données personnelles', 'Autre chose'];
function pageContact() {
  return `<section class="card">
    <p class="small muted" style="margin:0">Une question, un problème, une idée ? Écrivez-nous : le message part depuis votre messagerie.</p>
    <label class="label" for="ctSujet">Sujet</label>
    <select id="ctSujet">${SUJETS_CONTACT.map(s => `<option>${s}</option>`).join('')}</select>
    <label class="label" for="ctMsg">Votre message</label>
    <textarea id="ctMsg" rows="7" placeholder="Écrivez votre message…"></textarea>
    <p class="small muted" style="margin:6px 0 0">Pour vous répondre plus facilement, votre code utilisateur et la version de l’app sont ajoutés au message. N’y mettez pas le contenu de vos notes.</p>
    <button class="btn primary block" data-act="envoyerContact" ${CONTACT_MAIL ? '' : 'disabled'}>Écrire à Motus</button>
    ${CONTACT_MAIL ? `<p class="small muted" style="margin:8px 0 0;text-align:center">${esc(CONTACT_MAIL)}</p>` : '<p class="small muted" style="margin:8px 0 0">L’adresse de contact sera bientôt disponible.</p>'}
  </section>`;
}
