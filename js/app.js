// Motus — État de l'app, affichage (render), onglets, icônes
'use strict';

/* ───────────── Application ───────────── */
let view = 'day', cur = today(), calY, calM, xStart, calF = null, calW = null, calMode = 'grid', setPage = null, calQ = '', menuScroll = 0;
// Paramètres : page d'où l'on vient quand une page en ouvre une autre ; valable seulement tant qu'on est sur cette autre page
let pagePrec = null;
const pageRetour = () => pagePrec && pagePrec.vers === setPage ? pagePrec : null;
let listeAPlacer = false;      // Journal en liste : amener la page au mois calM au prochain affichage
let calC = [], calCEt = true;  // Journal en liste : connecteurs choisis (3 au plus) ; true : notes qui les contiennent tous, false : au moins un
const connOk = cles => !calC.length || (calCEt ? calC.every(k => cles.has(k)) : calC.some(k => cles.has(k)));
let src = null;               // thérapeute : données d'un client consultées en lecture seule
let pendingInv = null;        // invitation reçue via un lien (#inv=…), proposée après déverrouillage
const D = () => src || data;  // source affichée par le calendrier, la journée et l'export Excel

function showApp() {
  if (doitInstaller()) { mailPasse = true; return showTransfert(); }
  $('#lock').hidden = true; $('#lock').innerHTML = '';
  $('#app').hidden = false;
  view = data.role === 'therapeute' ? 'clients' : 'day'; src = null;
  cur = today(); xStart = addDays(cur, -6); calF = calW = null; calC = []; calMode = 'grid'; setPage = null; calQ = '';
  const t = new Date(); calY = t.getFullYear(); calM = t.getMonth();
  renderNav(); render();
  if (data.role === 'therapeute' && !data.keys) ensureKeys().then(render);
  if (pendingInv && (session || !CODE_COURT.test(pendingInv))) { const c = pendingInv; pendingInv = null; offerInvite(c); }
}

const ICONS = {
  day: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M9 9h6M9 13h6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clients: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  rep: '<path d="M12 6.5C10 5 7.5 4.5 3.5 4.5v14c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2v-14c-4 0-6.5.5-8.5 2Z"/><path d="M12 6.5v14"/>',
  set: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  admin: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
};
const ICO = {
  // repères d'une émotion et d'un besoin (Quotidien, synthèse, saisie) : pour les changer, seulement ici.
  // Son choix du 2026-11-05 : le pouls pour ce que je ressens, la boussole pour le besoin qui oriente
  emotion:'<path d="M2.5 12h4l2.2-5.5 4.6 11 2.2-5.5h6"/>',
  besoin:'<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>', out:'<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4"/><path d="M19 12H9"/>',
  send:'<path d="M21 3 10 14"/><path d="m21 3-6.5 18-4.5-7-7-4.5L21 3Z"/>',
  col:'<rect x="2.5" y="7" width="19" height="10" rx="3"/><circle cx="7.2" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="16.8" cy="12" r="1.6"/>', pin:'<path d="M12 21s7-6.1 7-11.5a7 7 0 1 0-14 0C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  save:'<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', trash:'<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="m6.5 7 1 13h9l1-13"/>',
  usersup:'<circle cx="10" cy="8" r="4"/><path d="M3 21c1.3-4 3.8-6 7-6s4.2.7 5.5 2"/><path d="m17 15 4.5 4.5M21.5 15 17 19.5"/>', sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>', shield:'<path d="M12 3l7.5 3v5.5c0 4.7-3.2 8-7.5 9.5-4.3-1.5-7.5-4.8-7.5-9.5V6L12 3Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>', phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  share:'<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v14"/>', loupe:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4.5-4.5"/>',
  link:'<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>', ch:'<path d="m9 5 7 7-7 7"/>',
  sablier:'<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3v3.5L12 12l4-5.5V3M8 21v-3.5L12 12l4 5.5V21"/>',
  oeil:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  importer:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14l3 3 3-3"/>',
  at:'<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
  copie:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  filtre:'<circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5-5"/><path d="M8 9h5M8 12h3"/>',
  oeilBarre:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  thera:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.6 3.6-5.5 6.5-5.5s5.3 1.9 6.5 5.5"/><path d="M14.5 4.5h6a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H18l-2 2v-2h-1.5A1.5 1.5 0 0 1 13 9V6a1.5 1.5 0 0 1 1.5-1.5Z"/>',
  croix:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', coche:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
const ico = (n, cl = 'ri') => `<svg class="${cl}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
/* Champ de recherche : la loupe, et une croix qui efface le texte et annule la recherche */
const champRecherche = (id, val, ph, style = '') => `<div class="champ-recherche"${style ? ` style="${style}"` : ''}>${ico('loupe', '')}<input type="search" id="${id}" value="${esc(val)}" placeholder="${ph}" aria-label="${ph}" autocapitalize="none" enterkeyhint="search"><button type="button" class="croix" data-act="effacerRecherche" aria-label="Effacer la recherche">${ico('croix', '')}</button></div>`;
const TABN = {day:'Quotidien', cal:'Journal', clients:'Clients', rep:'Répertoire', admin:'Admin', set:'Paramètres'};
function renderNav() {
  const tabs = data.role === 'therapeute' ? ['clients', 'rep', 'set'] : ['day', 'cal', 'rep', 'set'];
  if (data.account?.est_admin && session) tabs.splice(tabs.length - 1, 0, 'admin');
  $('#tabs').innerHTML = tabs.map(v => `<button data-act="tab" data-v="${v}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[v]}</svg>${TABN[v]}${v === 'clients' && nbNouveaux() ? `<i class="badge-nav">${nbNouveaux()}</i>` : ''}</button>`).join('');
}

function markTabs() {
  const active = src ? 'clients' : view;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === active));
}
function render(keepScroll) {
  connCache = null;   // les connecteurs se recalculent avec les notes du moment
  markTabs();
  $('#view').innerHTML = ({day:vDay, cal:vCal, rep:vRep, set:vSet, clients:vClients, admin:vAdmin})[view]();
  if (!keepScroll) { window.scrollTo(0, 0); entJ.cache = Infinity; entJ.deploye = false; }
  entJ.y = Math.max(0, scrollY); entetesJournal();
  if (view === 'cal' && calMode === 'list' && !calQ.trim() && (listeAPlacer || !keepScroll)) allerAuMois();
  listeAPlacer = false;
  document.querySelectorAll('#view textarea[data-notes-admin]').forEach(ajusterHauteur);
  marquerEntete();
  surlignerChamps();   // la synthèse du jour
  montrerAvis();   // une fin de suivi ou une acceptation reçue s'affiche quelle que soit la page
}

