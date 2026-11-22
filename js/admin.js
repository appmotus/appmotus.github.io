// Motus — Administration : tableau de bord, comptes, limites, notes de l'administrateur
'use strict';

/* ───────────── Administration (compte administrateur uniquement) ─────────────
   Données venant du serveur : comptes et compteurs, jamais le contenu des journaux. */
const admInit = () => ({users:null, stats:null, err:'', filtre:'tous', ouvert:null});
let adm = admInit();
/* v49 : l'onglet Admin est organisé comme les Paramètres : un menu, puis une page par sujet (registre PAGES_ADMIN dans actions.js).
   admPage : la page ouverte (null : le menu) ; ADM_PARENT : la page où ramène le retour, quand ce n'est pas le menu. */
const ADM_PARENT = {bilan:'bilans', compare:'bilans'};
const parentAdm = p => ADM_PARENT[p] || null;
const admPos = {};   // position de défilement du parent, retrouvée au retour
const ROLE_N = {client:'Utilisateur', therapeute:'Thérapeute'};   // le rôle interne reste « client » ; seul l'affichage change
const fmtDT = iso => { if (!iso) return 'jamais'; const d = new Date(iso); return `${fmtFR(ymd(d))} à ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nomAdmin = u => u.role === 'therapeute' ? u.nom : initiale(u.nom);   // client : initiale seulement
const who = u => `${u.prenom} ${nomAdmin(u)}`.trim() || u.identifiant;

async function loadAdmin() {
  if (adm.charge) return;
  const moi = adm; adm.charge = true;
  try {
    // v47 : l'activité de chaque compte vient de serveur/activite-utilisateurs.sql ; sans lui, la liste s'affiche sans ces deux lignes
    [adm.users, adm.stats, adm.activite] = await Promise.all([API.rpc('admin_utilisateurs'), API.rpc('admin_stats'), API.rpc('admin_activite').catch(() => null)]);
    adm.err = '';
  }
  catch (x) { adm.err = x.code === 'reseau' ? 'Pas de connexion internet.' : x.message || 'Erreur du serveur.'; adm.users ||= []; }
  moi.charge = false;
  // seules les pages qui montrent ces données se réaffichent : un questionnaire en cours de saisie ne doit pas être touché
  if (adm === moi && view === 'admin' && (!admPage || PAGES_ADMIN[admPage]?.[2])) render(true);
}
/* Un cadre de saisie aussi haut que son texte : jamais de barre de défilement à l'intérieur */
/* Le cadre est d'abord remis à sa hauteur minimale pour mesurer le texte : la page raccourcit un instant et le navigateur la faisait
   remonter (la page « sautait » à chaque lettre). Les positions de défilement sont donc remises à l'identique, avant tout affichage. */
function sansSaut(el, fn) {
  const pile = [];
  for (let p = el.parentElement; p; p = p.parentElement) if (p.scrollTop) pile.push([p, p.scrollTop]);
  const y = scrollY;
  fn();
  pile.forEach(([p, t]) => { if (p.scrollTop !== t) p.scrollTop = t; });
  if (scrollY !== y) window.scrollTo(0, y);
}
function ajusterHauteur(t) { sansSaut(t, () => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }); }
/* Mes notes : le bloc-notes de l'administrateur, en trois catégories, chiffré avec son journal sur cet appareil */
let admPage = null;
const NOTES_ADMIN = [['maj', 'À travailler pour la prochaine mise à jour', 'Corrections et demandes à traiter…'], ['plusTard', 'Travaux ultérieurs', 'Idées et chantiers pour plus tard…'], ['libres', 'Notes libres', 'Tout le reste…']];
function pageNotesAdmin() {
  const n = data.notesAdmin;
  return `<p class="small muted" style="margin:0 2px 12px">Pour vous seul(e) : ces notes restent chiffrées sur cet appareil, avec votre journal, et font partie de vos sauvegardes. Elles s’enregistrent au fil de la frappe.</p>
  ${NOTES_ADMIN.map(([k, titre, aide]) => `<section class="card">
    <div class="card-h" style="margin-bottom:0"><h2>${titre}</h2><span class="card-btns"><button type="button" class="icon-btn copier" data-act="viderNoteAdmin" data-k="${k}" aria-label="Effacer tout le texte de « ${titre} »">${ico('gomme', '')}</button><button type="button" class="icon-btn copier" data-act="copierNoteAdmin" data-k="${k}" aria-label="Copier tout le texte de « ${titre} »">${ico('copie', '')}</button></span></div>
    <textarea data-notes-admin="${k}" rows="3" autocapitalize="sentences" placeholder="${aide}" style="margin-top:10px">${esc(n[k])}</textarea>
    <div class="small muted" data-etat="${k}" style="margin-top:6px;text-align:right">${n[k] ? 'Enregistré ✓' : ''}</div>
  </section>`).join('')}`;
}
/* Le menu de l'onglet Admin : des groupes, une ligne par page (même présentation que les Paramètres) */
function vAdminMenu() {
  if (session && !adm.users) loadAdmin();   // les nombres du menu viennent du serveur
  const s = adm.stats;
  return `
  <div class="sethead"><div><div class="eyebrow">Administrateur</div><h1>Administration</h1></div></div>
  ${groupeMenu('Mes outils', [
    ligneMenu('importer', 'Mes notes', {page:'notes', act:'admOuvrir'}),
  ])}
  ${groupeMenu('Application', [
    ligneMenu('courbe', 'Utilisation de l’app', {val:s ? `${s.comptes} compte${s.comptes > 1 ? 's' : ''}` : '', page:'usage', act:'admOuvrir'}),
    ligneMenu('serveur', 'Services et limites', {page:'limites', act:'admOuvrir'}),
    ligneMenu('sablier', 'Travail sur Motus', {val:`≈ ${HEURES_TRAVAIL} h`, page:'travail', act:'admOuvrir'}),
  ])}
  ${groupeMenu('Mes questionnaires (réservés à l’administrateur)', Object.entries(QUESTIONNAIRES).map(([k, q]) =>
    ligneMenu('questionnaire', q.court, {val:resumeQuestionnaire(k), page:k, act:'admQuest'})))}`;
}
function vAdmin() {
  const page = admPage && PAGES_ADMIN[admPage];
  if (!page) return vAdminMenu();
  const titre = typeof page[0] === 'function' ? page[0]() : page[0];
  return `<div class="subhead"><button class="icon-btn" data-act="admRetour" aria-label="Retour">‹</button><h1>${titre}</h1></div>${page[1]()}`;
}
const admHors = '<section class="card"><p class="empty">Hors connexion : cette page nécessite internet.</p></section>';
/* Utilisation de l'app (v50 : les anciennes pages Comptes, Activité, Comptes thérapeute et Liste des comptes, réunies) */
function pageUsage() {
  if (!session) return admHors;
  if (!adm.users) { loadAdmin(); return '<section class="card"><p class="empty">Chargement…</p></section>'; }
  if (adm.liensTh === undefined && !adm.liensEnCours) loadLiensTh();
  return (adm.err ? `<div class="banner"><span>${esc(adm.err)}</span><button class="btn" data-act="admReload">Réessayer</button></div>` : '')
    + `<div class="gl">Comptes</div>${carteComptes()}<div class="gl">Activité</div>${carteActivite()}<div class="gl">Comptes thérapeute</div>${carteLiensTh()}`
    + `<div class="gl">Liste des comptes</div>${carteListeComptes()}`;
}
function carteComptes() {
  const s = adm.stats, j1 = n => n ?? '—';   // « aujourd'hui » : absent tant que serveur/compteur-du-jour.sql n'est pas exécuté
  const tile = (n, l) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`;
  return s ? `<section class="card">
    <div class="tiles">${tile(s.comptes, 'au total')}${tile(s.clients, 'utilisateurs')}${tile(s.therapeutes, 'thérapeutes')}${tile(s.desactives, 'désactivés')}</div>
    <table class="stats">
      <thead><tr><th></th><th>Aujourd’hui</th><th>7 jours</th><th>30 jours</th></tr></thead>
      <tbody>
        <tr><th scope="row">Nouveaux inscrits</th><td>${j1(s.inscrits_1j)}</td><td>${s.inscrits_7j}</td><td>${s.inscrits_30j}</td></tr>
        <tr><th scope="row">Comptes actifs</th><td>${j1(s.actifs_1j)}</td><td>${s.actifs_7j}</td><td>${s.actifs_30j}</td></tr>
      </tbody>
    </table>
  </section>` : '<section class="card"><p class="empty">Statistiques indisponibles.</p></section>';
}
function carteActivite() {
  const a = adm.stats?.activite;
  if (!a) return '<section class="card"><p class="empty">Statistiques indisponibles.</p></section>';
  const j1 = n => n ?? '—';
  const act = (l, o) => `<tr><th scope="row">${l}</th><td>${j1(o.j1)}</td><td>${o.j7}</td><td>${o.j30}</td><td>${o.total}</td></tr>`;
  // v49 : les notes de l'administrateur ne sont pas comptées (serveur/notes-hors-admin.sql) ; sans ce fichier, le total les contient encore
  const hors = a.notes_hors_admin;
  return `<section class="card">
    <table class="stats">
      <thead><tr><th></th><th title="Aujourd’hui">Auj.</th><th>7 jours</th><th>30 jours</th><th>Total</th></tr></thead>
      <tbody>${act('Connexions', a.connexions)}${act(hors ? 'Notes saisies (hors admin)' : 'Notes saisies (admin compris)', hors || a.notes)}${act('Envois au thérapeute', a.envois)}</tbody>
    </table>
    ${hors ? '' : '<p class="small muted" style="margin:8px 0 0">Pour ne plus compter vos propres notes, exécutez serveur/notes-hors-admin.sql dans Supabase (SQL Editor).</p>'}
    <p class="small muted" style="margin:8px 0 0">Une connexion est une ouverture de l’app, avec ou sans internet : une même personne en fait plusieurs par jour. Une note saisie est une émotion ou une note personnelle, comptée à sa création ; les synthèses ne le sont pas. Les chiffres arrivent dès que le téléphone est de nouveau connecté.</p>
    <p class="small muted" style="margin:6px 0 0">Seuls des nombres sont transmis : le contenu des notes reste sur les téléphones.</p>
  </section>`;
}
function carteListeComptes() {
  const list = adm.users.filter(u => adm.filtre === 'tous' || (adm.filtre === 'off' ? !u.actif : u.role === adm.filtre))
    .sort((x, y) => who(x).localeCompare(who(y), 'fr', {sensitivity:'base'}));
  return `<section class="card">
    <div class="card-h"><h2>${list.length} compte${list.length > 1 ? 's' : ''}</h2></div>
    <div class="chips" style="margin-bottom:10px">${[['tous', 'Tous'], ['client', 'Utilisateurs'], ['therapeute', 'Thérapeutes'], ['off', 'Désactivés']].map(([k, n]) =>
      `<button class="chip neutre ${adm.filtre === k ? 'on' : ''}" data-act="admFiltre" data-f="${k}" aria-pressed="${adm.filtre === k}">${n}</button>`).join('')}</div>
    ${champRecherche('admSearch', '', 'Rechercher : nom, code, identifiant', 'margin-bottom:10px')}
    ${list.length ? list.map(userRow).join('') : '<p class="empty">Aucun compte dans cette catégorie.</p>'}
  </section>`;
}
function pageLimites() {
  if (!session) return admHors;
  if (!adm.limites && !adm.limEnCours) loadLimites();
  return limitsCard();
}
function pageTravail() {
  return `<section class="card">
    <div class="heures"><b>≈ ${HEURES_TRAVAIL} h</b><span class="small muted">de travail</span></div>
    <p class="small muted" style="margin:6px 0 0">Estimation à partir des échanges avec Claude, sans les pauses de plus de 30 minutes.</p>
    <div class="heures" style="margin-top:14px"><b>≈ ${JETONS_CONSOMMES.total.toLocaleString('fr-FR')} M</b><span class="small muted">de jetons consommés par Claude</span></div>
    <p class="small muted" style="margin:6px 0 0">Dont ${mio(JETONS_CONSOMMES.cache)} relus depuis le cache, ${mio(JETONS_CONSOMMES.envoyes)} envoyés à Claude et ${mio(JETONS_CONSOMMES.ecrits)} écrits par Claude.</p>
    <p class="small muted" style="margin:10px 0 0">Jusqu’à la version ${APP_VERSION}, mis à jour à chaque version.</p>
  </section>`;
}
/* Limites des offres gratuites, relevées sur les pages officielles le 31/10/2026.
   Sans clé secrète dans l'app, seules certaines consommations se mesurent : les autres renvoient au service. */
const LIMITES = {base:500e6, actifs:50000, envois:300, depot:1e9, journal:5e6};
const LIMITES_DATE = '31/10/2026';
const GH_DEPOT = 'appmotus/appmotus.github.io';
const fmtOctets = n => n < 1e6 ? `${Math.round(n / 1e3)} Ko` : n < 1e9 ? `${(n / 1e6).toLocaleString('fr-FR', {maximumFractionDigits:1})} Mo` : `${(n / 1e9).toLocaleString('fr-FR', {maximumFractionDigits:1})} Go`;
const fmtNombre = n => Math.round(n).toLocaleString('fr-FR');
const mio = n => `${n.toLocaleString('fr-FR')} million${n >= 2 ? 's' : ''}`;   // avec une virgule : 7,6 millions, 1,6 million

/* Rappel à l'administrateur : ouvrir l'onglet Admin interroge Brevo, dont la clé expire après 90 jours sans utilisation.
   La date est gardée dans le journal de chaque appareil. */
const ADMIN_RAPPEL_JOURS = 30;
function adminReminder() {
  if (!session || !data.account?.est_admin) return '';
  if (!data.adminVu) { data.adminVu = new Date().toISOString(); save(); return ''; }
  const j = Math.floor((Date.now() - new Date(data.adminVu)) / 864e5);
  if (j <= ADMIN_RAPPEL_JOURS) return '';
  return `<div class="banner admin-rappel"><span>Vous n’avez pas ouvert « Services et limites » (onglet Admin) depuis ${j} jours. Ouvrez cette page pour vérifier les services et garder active la clé d’envoi des e-mails, qui expire après 90 jours sans utilisation.</span>
    <button class="btn primary" data-act="goAdmin">Ouvrir</button></div>`;
}
async function loadLimites() {
  adm.limEnCours = true;
  const moi = adm;
  const [r, g, b] = await Promise.allSettled([
    API.rpc('admin_ressources'),
    fetch(`https://api.github.com/repos/${GH_DEPOT}`).then(x => x.ok ? x.json() : Promise.reject()),
    API.recup({action:'quota_envoi'}),
  ]);
  if (adm !== moi) return;
  const val = p => p.status === 'fulfilled' ? p.value : null;
  adm.limites = {res:val(r), depotKo:val(g)?.size ?? null, envoi:val(b)};
  adm.limEnCours = false;
  data.adminVu = new Date().toISOString(); save();   // la clé Brevo vient d'être utilisée : le rappel repart de zéro (v49 : à l'ouverture de cette page)
  const c = $('#limCard');
  if (c) c.outerHTML = limitsCard();
}
/* Jauge : la couleur porte la sévérité, toujours accompagnée d'un texte */
function jauge(label, used, max, fmt, note = '') {
  if (used == null) return `<div class="lim"><div class="lim-h"><span>${label}</span><span class="muted">Non disponible</span></div>${note ? `<div class="small muted">${note}</div>` : ''}</div>`;
  const pct = Math.min(100, used / max * 100), niv = pct >= 95 ? 'crit' : pct >= 80 ? 'warn' : '';
  return `<div class="lim">
    <div class="lim-h"><span>${label}</span><b>${fmt(used)} / ${fmt(max)}</b></div>
    <div class="meter ${niv && 'm-' + niv}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="small muted">${niv ? `<b class="lim-alerte">⚠ ${niv === 'crit' ? 'Limite atteinte ou presque' : 'Limite proche'}</b> · ` : ''}Il reste ${fmt(Math.max(max - used, 0))}${note ? ` · ${note}` : ''}</div>
  </div>`;
}
const limInfo = (label, limite, note = '') => `<div class="lim"><div class="lim-h"><span>${label}</span><b>${limite}</b></div><div class="small muted">Consommation non mesurable depuis l’app${note ? ` · ${note}` : ''}</div></div>`;
const limLien = (url, txt) => `<a class="small" href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`;

function limitsCard() {
  if (!adm.limites) return `<section class="card" id="limCard"><p class="empty">Chargement…</p></section>`;
  const {res, depotKo, envoi} = adm.limites;
  const local = Object.keys(localStorage).filter(k => k.startsWith('journal-emotions')).reduce((n, k) => n + k.length + localStorage.getItem(k).length, 0);
  const restants = envoi?.type === 'free' && envoi.credits != null ? Math.max(LIMITES.envois - envoi.credits, 0) : null;
  return `<section class="card" id="limCard">
    <p class="small muted" style="margin:0">Offres gratuites ; limites relevées le ${LIMITES_DATE}, elles peuvent changer.</p>

    <div class="lim-g"><h3>Supabase (comptes et serveur)</h3>${limLien('https://supabase.com/dashboard/org/_/usage', 'Voir la consommation ↗')}</div>
    ${jauge('Base de données', res?.base_octets ?? null, LIMITES.base, fmtOctets)}
    ${jauge('Comptes actifs (30 jours)', res?.actifs_30j ?? null, LIMITES.actifs, fmtNombre, 'estimation : Supabase compte par mois de facturation')}
    ${limInfo('Bande passante', '5 Go par mois')}
    ${limInfo('Appels de fonctions', '500 000 par mois')}
    <p class="small muted" style="margin:8px 0 0">Le projet est suspendu automatiquement après 1 semaine sans activité ; il se réactive depuis le tableau de bord Supabase.</p>

    <div class="lim-g"><h3>GitHub Pages (mise en ligne)</h3>${limLien(`https://github.com/${GH_DEPOT}`, 'Voir le dépôt ↗')}</div>
    ${jauge('Taille du dépôt', depotKo == null ? null : depotKo * 1e3, LIMITES.depot, fmtOctets, 'limite recommandée')}
    ${limInfo('Bande passante', '100 Go par mois', 'limite souple')}

    <div class="lim-g"><h3>Brevo (e-mails de récupération)</h3>${limLien('https://app.brevo.com', 'Voir le compte ↗')}</div>
    ${jauge('E-mails envoyés aujourd’hui', restants, LIMITES.envois, fmtNombre, restants == null ? 'la fonction d’envoi n’est pas encore en place ou Brevo n’a pas répondu' : '')}

    <div class="lim-g"><h3>Cet appareil</h3></div>
    ${jauge('Données de Motus', local, LIMITES.journal, fmtOctets, 'notes, réglages et compte, chiffrés : c’est sur elles que porte la limite du navigateur. Les réglages du téléphone affichent davantage, car ils comptent aussi les fichiers qui les contiennent.')}
  </section>`;
}
/* Comptes thérapeute (v46) : un thérapeute crée son compte avec un lien que l'administrateur lui envoie, à sa demande. Chaque lien
   sert une seule fois et reste valable 30 jours (serveur/lien-therapeute.sql). Le serveur n'en garde que l'empreinte : le lien ne
   s'affiche qu'au moment de sa création (adm.lienNeuf). adm.liensTh : ceux qui n'ont pas encore servi, null s'ils sont indisponibles. */
const lienThUrl = code => `${location.origin}${location.pathname}#t=${code}`;
async function loadLiensTh() {
  adm.liensEnCours = true;
  const moi = adm;
  let l = null;
  try { l = await API.rpc('admin_liens_therapeute'); } catch {}
  if (adm !== moi) return;
  adm.liensTh = Array.isArray(l) ? l : null;
  adm.liensEnCours = false;
  const c = $('#carteLiensTh');
  if (c) c.outerHTML = carteLiensTh();
}
function carteLiensTh() {
  const L = adm.liensTh, n = adm.lienNeuf, jour = iso => fmtFR(ymd(new Date(iso)));
  const corps = L === undefined ? '<p class="empty">Chargement…</p>'
    : L === null ? '<p class="small muted" style="margin:10px 0 0">Liens indisponibles : vérifiez la connexion, ou exécutez <b>serveur/lien-therapeute.sql</b> dans Supabase (SQL Editor).</p>'
    : `${n ? `<div class="lien-neuf">
        <label class="label" for="lienThNeuf">Nouveau lien, valable jusqu’au ${jour(n.expire_le)}</label>
        <textarea id="lienThNeuf" rows="2" readonly aria-label="Lien de création d’un compte thérapeute">${esc(lienThUrl(n.code))}</textarea>
        <p class="small muted" style="margin:6px 0 0">Envoyez-le maintenant : pour la sécurité des comptes, il ne pourra plus être affiché.</p>
        <div class="row" style="margin-top:8px"><button class="btn primary" data-act="partagerLienTh">Partager</button><button class="btn" data-act="copierLienTh">Copier</button></div>
      </div>` : ''}
      <button class="btn block" data-act="creerLienTh">Créer un lien</button>
      ${L.length ? `<p class="label">En attente d’utilisation</p>
      ${L.map(l => `<div class="stat"><span>Créé le ${jour(l.cree_le)}<br><span class="small muted">valable jusqu’au ${jour(l.expire_le)}</span></span><button class="btn" data-act="retirerLienTh" data-id="${esc(String(l.id))}">Retirer</button></div>`).join('')}` : ''}`;
  return `<section class="card" id="carteLiensTh">
    <p class="small muted" style="margin:0">Un thérapeute crée son compte avec un lien que vous lui envoyez, à sa demande. Chaque lien sert une seule fois et reste valable 30 jours. L’inscription ordinaire crée un compte utilisateur.</p>
    ${corps}
  </section>`;
}
function userRow(u) {
  const open = adm.ouvert === u.id, moi = u.id === profil?.id, th = u.role === 'therapeute';
  const act = Array.isArray(adm.activite) ? adm.activite.find(a => a.id === u.id) || {envois:0} : null;   // null : serveur/activite-utilisateurs.sql pas encore exécuté
  return `<div class="urow" data-name="${esc(`${who(u)} ${codeU(u.numero)} ${u.identifiant}`.toLowerCase())}">
    <button class="uhead" data-act="admOpen" data-id="${esc(u.id)}" aria-expanded="${open}">
      <span><b>${esc(u.prenom)}</b> ${esc(nomAdmin(u))}</span>
      <span class="badge ${th ? 'th' : ''}">${esc(codeU(u.numero))}</span>
      <span class="small muted ufoot">${ROLE_N[u.role]}${u.est_admin ? ' · administrateur' : ''}${u.actif ? '' : ' · <b class="off">désactivé</b>'} · dernière connexion : ${fmtDT(u.derniere_connexion)}</span>
    </button>
    ${open ? `<div class="udetail">
      <dl>
        <dt>Identifiant</dt><dd>${esc(u.identifiant)}</dd>
        <dt>Inscription</dt><dd>${fmtDT(u.cree_le)}</dd>
        <dt>Connexions</dt><dd>${u.nb_connexions}<span class="small muted"> ouvertures de l’app</span></dd>
        ${act ? `<dt>Envois au thérapeute</dt><dd>${act.envois}</dd>` : ''}
        ${th ? `<dt>Thérapie</dt><dd>${esc(u.therapie) || '—'}</dd>
        <dt>Téléphone</dt><dd>${esc(u.telephone) || '—'}</dd>
        <dt>E-mail</dt><dd>${esc(u.email_contact) || '—'}</dd>
        <dt>Adresse</dt><dd>${esc(u.adresse) || '—'}</dd>` : ''}
      </dl>
      ${moi ? '<p class="small muted" style="margin:8px 0 0">C’est votre compte.</p>' : `
      <div class="row" style="margin-top:10px">
        <button class="btn" data-act="admActif" data-id="${esc(u.id)}">${u.actif ? 'Désactiver' : 'Réactiver'}</button>
        <button class="btn" data-act="admType" data-id="${esc(u.id)}">Passer en ${th ? 'utilisateur' : 'thérapeute'}</button>
      </div>
      <button class="btn danger block" data-act="admSuppr" data-id="${esc(u.id)}">Supprimer le compte</button>`}
    </div>` : ''}
  </div>`;
}
/* Action d'administrateur sur un compte : un code à recopier évite toute erreur de manipulation */
async function admAction(id, question, run) {
  const u = adm.users.find(x => x.id === id);
  if (!u || !await confirmerCode(question(u))) return;
  try { await run(u); toast('Modification enregistrée'); }
  catch (x) { toast(x.code === 'reseau' ? 'Pas de connexion internet.' : x.message || 'Action impossible'); }
  adm = {...admInit(), filtre:adm.filtre, ouvert:adm.ouvert, lienNeuf:adm.lienNeuf};   // un lien qui vient d'être créé reste affiché
  render(true);
}

