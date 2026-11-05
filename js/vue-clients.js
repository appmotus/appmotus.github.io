// Motus — Thérapeute : liste des clients et fiche client
'use strict';

/* — Thérapeute : gestion des clients et fiche client (import, calendrier et journées en lecture seule) —
   Le thérapeute crée ses fiches ; au premier import, la fiche est liée à l'app du client (c.uid),
   ce qui permet de repérer un fichier importé dans la mauvaise fiche. */
const fullName = c => `${c.profile.prenom} ${c.profile.nom}`.trim() || 'Client sans nom';
let importTarget = null;

function ligneClient(c) {
  const l = lastOf(c.envois), pastille = c.nouveauClient ? 'Nouveau client' : c.nouveau ? `${c.nouveau} nouveau${c.nouveau > 1 ? 'x' : ''}` : '';
  return `
      <button class="clientrow" data-act="openClient" data-id="${esc(c.id)}" data-name="${esc(fullName(c).toLowerCase())}">
        <b>${esc(fullName(c))}${c.numero ? ` <span class="small muted" style="white-space:nowrap">${esc(c.numero)}</span>` : ''}</b>
        ${pastille ? `<span class="pastille">${pastille}</span>` : `<span class="strip" aria-hidden="true">${l ? [0, 1, 2, 3, 4, 5, 6].map(i => `<i class="${c.days[addDays(l.from, i)]?.color || ''}"></i>`).join('') : ''}</span>`}
        <span class="small muted">${l ? `Dernier envoi : du ${fmtFR(l.from).slice(0, 5)} au ${fmtFR(l.to).slice(0, 5)} · importé le ${fmtFR(ymd(new Date(l.importedAt))).slice(0, 5)}` : 'Aucune donnée reçue pour l’instant'}</span>
      </button>`;
}
function vClients() {
  const key = c => `${c.profile.nom} ${c.profile.prenom}`, tri = (a, b) => key(a).localeCompare(key(b), 'fr', {sensitivity:'base'});
  const tous = Object.values(data.clients), par = s => tous.filter(c => c.statut === s).sort(tri);
  const actuels = par('actuel'), anciens = par('ancien'), attente = par('attente');
  const origine = c => ({ancien:'Ancien client', actuel:'Déjà dans vos clients', nouveau:'Envoi reçu d’une personne inconnue'})[c.demande?.avant] || 'Nouvelle personne';
  return `
  ${sauvegardeReminder()}${recupReminder()}${adminReminder()}
  <div style="margin:4px 0 16px"><div class="eyebrow">Espace thérapeute</div><h1>Mes clients</h1></div>
  <section class="card depot" id="depot">
    <h2>Fichiers reçus</h2>
    <p class="small muted" style="margin:6px 0 0">Déposez ici, en vrac, les fichiers reçus de vos clients : chacun se range seul dans la bonne fiche, par date.</p>
    <button class="btn primary block" data-act="importerLot">Choisir des fichiers</button>
  </section>
  ${attente.length ? `<section class="card">
    <div class="card-h"><h2>Demandes en attente</h2><span class="count">${attente.length}</span></div>
    <p class="small muted" style="margin:0 0 8px">Ces personnes ont utilisé votre lien d’invitation. N’acceptez que celles que vous suivez : elles pourront alors vous envoyer leurs données.</p>
    ${attente.map(c => `<div class="demande">
      <b>${esc(fullName(c))}</b>${c.numero ? ` <span class="small muted" style="white-space:nowrap">${esc(c.numero)}</span>` : ''}
      <div class="small muted">${origine(c)}${c.demande?.at ? ` · le ${fmtFR(ymd(new Date(c.demande.at)))}` : ''}</div>
      <div class="row" style="margin-top:8px"><button class="btn" data-act="refuserClient" data-id="${esc(c.id)}">Refuser</button><button class="btn primary" data-act="accepterClient" data-id="${esc(c.id)}">Accepter</button></div>
    </div>`).join('')}
  </section>` : ''}
  <section class="card">
    <div class="card-h"><h2>Clients actuels</h2><span class="count">${actuels.length}</span></div>
    ${tous.length > 5 ? champRecherche('cliSearch', '', 'Rechercher un client', 'margin-bottom:10px') : ''}
    ${actuels.length ? actuels.map(ligneClient).join('') : '<p class="empty">Aucun client pour l’instant. Envoyez votre lien d’invitation : la fiche se crée quand votre client vous rejoint.</p>'}
    <button class="btn block" data-act="newClient">+ Ajouter un client à la main</button>
  </section>
  ${anciens.length ? `<section class="card">
    <div class="card-h"><h2>Anciens clients</h2><span class="count">${anciens.length}</span></div>
    ${anciens.map(ligneClient).join('')}
  </section>` : ''}
  <section class="card">
    <h2>Inviter un client</h2>
    <p class="small muted" style="margin:6px 0 0">Envoyez votre lien d’invitation à votre client : il pourra ensuite vous transmettre ses semaines dans un fichier chiffré. Code de sécurité à lui confirmer : <span class="fp">${esc(data.keys?.fp || '…')}</span></p>
    <button class="btn block" data-act="shareInvite">Partager mon lien d’invitation</button>
  </section>`;
}
function clientBar() {
  if (!src) return '';
  const [act, label] = view === 'day' ? ['clientCal', 'Journal'] : ['backClients', 'Mes clients'];
  return `<div class="clientbar"><button class="link" data-act="${act}">‹ ${label}</button><span class="who">${esc(fullName(src))}</span></div>`;
}
/* Haut de la fiche : import (répétable) et historique des envois reçus */
function srcImportCard() {
  if (!src) return '';
  const n = src.envois.length, shown = [...src.envois].reverse().slice(0, 4);
  return `<section class="card">
    <div class="card-h"><h2>Envois reçus</h2><span class="count">${n}</span></div>
    ${n ? `<ul class="envois">${shown.map(e => `<li>Du ${fmtFR(e.from)} au ${fmtFR(e.to)}<span class="muted"> · importé le ${fmtFR(ymd(new Date(e.importedAt)))}</span></li>`).join('')}
      ${n > 4 ? `<li class="muted">… et ${n - 4} plus ancien${n > 5 ? 's' : ''}</li>` : ''}</ul>`
    : `<p class="empty">Rien reçu pour l’instant. Quand ${esc(src.profile.prenom || 'votre client')} vous envoie un fichier, déposez-le dans Clients › Fichiers reçus.</p>`}
  </section>`;
}
/* Bas de la fiche : coordonnées, export, modification, suppression */
function srcCard() {
  if (!src) return '';
  const k = src.contact || {};
  // un client accepté avant que la date soit enregistrée garde celle de son premier envoi reçu
  const debut = src.statut !== 'attente' && (src.debutSuivi || src.profile.start);
  const suivi = src.statut === 'ancien'
    ? `<p class="small muted" style="margin:6px 0 0">Ancien client : le suivi a pris fin${src.rupture ? ` le ${fmtFR(ymd(new Date(src.rupture.at)))}, ${src.rupture.par === 'client' ? 'à sa demande' : 'à votre demande'}` : ''}.</p>`
    : src.canal ? '<p class="small muted" style="margin:6px 0 0">Lié à votre compte : ses coordonnées se mettent à jour seules.</p>' : '';
  return `<section class="card">
    <h2>Fiche client</h2>
    ${src.numero ? `<div class="stat" style="margin-top:6px"><span class="muted">Code utilisateur</span><b>${esc(src.numero)}</b></div>` : ''}
    ${debut ? `<div class="stat"><span class="muted">Début du suivi</span><b>${fmtFR(debut)}</b></div>` : ''}
    ${suivi}
    ${k.email ? `<div class="small" style="margin-top:8px"><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></div>` : ''}
    ${k.tel ? `<div class="small"><a href="tel:${esc(k.tel.replace(/\s/g, ''))}">${esc(k.tel)}</a></div>` : ''}
    ${src.note ? `<p class="synth-ro small" style="margin-top:8px">${esc(src.note)}</p>` : ''}
    ${!k.email && !k.tel && !src.note ? '<p class="small muted" style="margin:6px 0 0">Aucune coordonnée enregistrée.</p>' : ''}
    <div class="row" style="margin-top:12px">
      <button class="btn" data-act="editClient">Modifier</button>
      <button class="btn" data-act="exportClient" ${Object.keys(src.days).length ? '' : 'disabled'}>Exporter en Excel</button>
    </div>
    ${src.envois.length || Object.keys(src.days).length ? '<button class="btn danger block" data-act="effacerRecu">Effacer les données reçues</button>' : ''}
    ${src.statut === 'actuel' ? '<button class="btn danger block" data-act="finSuivi">Mettre fin au suivi</button>' : ''}
    <button class="btn danger block" data-act="removeClient">Supprimer ce client</button>
  </section>`;
}
function openClient(id) {
  src = data.clients[id]; if (!src) return;
  if (src.nouveau || src.nouveauClient) { delete src.nouveau; delete src.nouveauClient; save(); renderNav(); }
  const l = lastOf(src.envois), d = parse(l && l.to < today() ? l.to : today());
  calY = d.getFullYear(); calM = d.getMonth(); calF = calW = null; view = 'cal'; render();
}
function openClientForm(id) {
  const c = id ? data.clients[id] : null, k = c?.contact || {}, D = $('#clientDlg');
  D.innerHTML = `<form method="dialog" id="clientForm">
    <div class="dlg-h"><h2>${c ? 'Modifier le client' : 'Nouveau client'}</h2><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      <div class="row">
        <div><label class="label" for="cfPrenom">Prénom</label><input type="text" id="cfPrenom" value="${esc(c?.profile.prenom || '')}" autocomplete="off"></div>
        <div><label class="label" for="cfNom">Nom</label><input type="text" id="cfNom" value="${esc(c?.profile.nom || '')}" autocomplete="off"></div>
      </div>
      <label class="label" for="cfNumero">Code utilisateur Motus</label>
      <input type="text" id="cfNumero" value="${esc(c?.numero || '')}" placeholder="ex. U-0012" autocomplete="off" autocapitalize="characters" ${c?.canal ? 'readonly' : ''}>
      <div class="small muted" style="margin-top:4px">Il permet de reconnaître votre client sans le confondre avec un homonyme.</div>
      <label class="label" for="cfTel">Téléphone</label>
      <input type="text" id="cfTel" inputmode="tel" value="${esc(k.tel || '')}" autocomplete="off">
      <label class="label" for="cfEmail">E-mail</label>
      <input type="text" id="cfEmail" inputmode="email" value="${esc(k.email || '')}" autocomplete="off">
      <label class="label" for="cfNote">Notes (visibles par vous seul(e))</label>
      <textarea id="cfNote" rows="3">${esc(c?.note || '')}</textarea>
      <div class="err" id="cfErr"></div>
    </div>
    <div class="dlg-f"><button type="button" class="btn primary" data-act="saveClient" data-id="${c ? esc(c.id) : ''}">Enregistrer</button></div>
  </form>`;
  D.showModal();
}

