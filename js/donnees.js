// Motus — Journal : ouverture, normalisation, enregistrement, emplacement du stockage
'use strict';

/* ───────────── Données ─────────────
   Fichier « données utilisateur », chiffré, en sections. Effacer ses données ne vide que le journal et les données reçues des clients : les fiches clients restent. */
function versFichier(d) {
  const {days, backupAt, backupPlusTard, clients, ...parametres} = d;
  return {v:2, journal:{days, backupAt, backupPlusTard}, donneesClients:{clients}, parametres};
}
function depuisFichier(o) { return o.parametres ? {...o.parametres, ...o.journal, ...o.donneesClients} : o; }   // sans sections : ancien format ou ancienne sauvegarde
function viderJournal() {
  data.days = {}; delete data.backupAt; delete data.backupPlusTard;
  for (const c of Object.values(data.clients)) { c.days = {}; c.envois = []; c.labels = {...DEF_LABELS}; }
}
/* Les versions précédentes ne savent pas lire les sections : le fichier change d'emplacement pour qu'elles ne puissent jamais l'écraser.
   L'ancienne copie n'est retirée qu'après vérification de la nouvelle. */
function migrerStockage() {
  const P = 'journal-emotions.vault.';
  Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => {
    const n = vaultKey(k.slice(P.length)), v = localStorage.getItem(k);
    if (localStorage.getItem(n) != null) return;
    localStorage.setItem(n, v);
    if (localStorage.getItem(n) === v) localStorage.removeItem(k);
  });
}
function defaults(d = {}) {
  d = depuisFichier(d);
  d.profile = Object.assign({nom:'', prenom:'', start:today()}, d.profile);
  d.labels = Object.assign({}, DEF_LABELS, d.labels);
  d.settings = Object.assign({autolock:1, geoloc:true}, d.settings);
  // données transmises au thérapeute ; les besoins (v39) accompagnent les émotions, sauf si on les retire
  d.settings.partage = Object.assign({emotions:true, besoins:true, synthese:false, notes:false, lieu:false}, d.settings.partage);
  d.days = d.days || {};
  d.role ||= 'client';            // 'client' ou 'therapeute'
  d.uid ||= rid(8);               // identifiant anonyme, transmis au thérapeute avec les envois
  d.sent ||= {};                  // client : début de la période envoyée → {to, at}
  for (const [f, v] of Object.entries(d.sent)) if (typeof v === 'string') d.sent[f] = {to:addDays(f, 6), at:v};
  d.therapist ??= null;           // client : thérapeute lié (clé publique + coordonnées)
  d.clients ||= {};               // thérapeute : fiches clients (coordonnées + données reçues)
  for (const c of Object.values(d.clients)) { if (!('uid' in c)) c.uid = c.id; c.contact ||= {}; c.note ??= ''; c.statut ||= 'actuel'; if (c.numero) c.numero = codeU(c.numero); }
  if (d.account?.numero) d.account.numero = codeU(d.account.numero);
  // admin : notes en trois catégories ; celles de la version 27, d'un seul bloc, deviennent des notes libres
  d.notesAdmin = typeof d.notesAdmin === 'string' ? {maj:'', plusTard:'', libres:d.notesAdmin} : Object.assign({maj:'', plusTard:'', libres:''}, d.notesAdmin);
  d.thera = Object.assign({type:'', tel:'', email:'', adresse:''}, d.thera);
  d.pending ||= {notes:0, envois:0};   // compteurs pas encore transmis au serveur (hors connexion)
  return d;
}
const getDay = k => D().days[k] || {color:null, synth:'', entries:[]};
const ensureDay = k => (data.days[k] ||= {color:null, synth:'', entries:[]});
const dayUsed = d => !!(d && (d.color || d.synth?.trim() || d.entries?.length));   // partie partageable d'une journée
const dayNotes = d => d?.notes || [];   // notes personnelles : envoyées au thérapeute seulement si l'utilisateur le choisit ; jamais dans son propre Excel
const dayFilled = d => dayUsed(d) || dayNotes(d).length > 0;
const initiale = s => { const c = [...String(s || '').trim()][0]; return c ? c.toUpperCase() + '.' : ''; };
/* Aide-mémoire du mail de récupération, gardé uniquement dans le journal chiffré de l'appareil */
const masque = m => { const [u, d] = String(m).split('@'); return d ? `${u.slice(0, Math.min(4, Math.ceil(u.length / 2)))}*******@${d}` : ''; };

