// Motus — Lien client-thérapeute : canal, demandes, rupture, données transmises, envois
'use strict';

/* ───────────── Lien client ↔ thérapeute : le canal ─────────────
   À la liaison, l'app du client crée un secret qu'elle remet au thérapeute, chiffré pour lui seul. Les deux apps échangent ensuite
   leurs coordonnées et l'état du lien dans un canal du serveur, chiffré avec ce secret et rangé sous un identifiant qui en dérive.
   Le journal n'y passe jamais (il voyage par mail), et le serveur ne sait pas quel client est lié à quel thérapeute :
   le client n'y accède pas avec son compte. */
const hexDe = u8 => [...new Uint8Array(u8)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256hex = async s => hexDe(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const idCanal = S => sha256hex('motus-canal|' + S), jetonCanal = S => sha256hex('motus-ecrire|' + S);
const cleCanal = async S => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode('motus-cle|' + S)), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function chiffrerCanal(S, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, await cleCanal(S), enc.encode(JSON.stringify(obj))));
  return JSON.stringify({iv:toB64(iv), ct:toB64(ct)});
}
async function dechiffrerCanal(S, txt) {
  const o = JSON.parse(txt);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(o.iv)}, await cleCanal(S), fromB64(o.ct))));
}
/* Ce que chacun montre à l'autre : jamais l'identifiant de connexion */
const ficheClient = () => ({prenom:data.profile.prenom, nom:data.profile.nom, numero:data.account?.numero || '', uid:data.uid});
const ficheTherapeute = () => ({prenom:data.profile.prenom, nom:data.profile.nom, numero:data.account?.numero || '', type:data.thera.type, tel:data.thera.tel, email:data.thera.email, adresse:data.thera.adresse});
const nomDe = o => `${o?.prenom || ''} ${o?.nom || ''}`.trim();

let synchroEnCours = false, derniereSynchro = 0, relancer = false, synchroTimer;
async function synchroCanaux(force) {
  if (!data) return;
  if (synchroEnCours) { if (force) relancer = true; return; }   // une demande arrivée pendant la synchro n'est pas perdue
  if (!force && Date.now() - derniereSynchro < 60000) return;
  synchroEnCours = true; derniereSynchro = Date.now();
  let change = false;
  try { change = data.role === 'therapeute' ? await synchroTherapeute() : await synchroClient(); }
  catch (x) { console.warn('Lien thérapeute', x.code || x); }
  finally { synchroEnCours = false; }
  if (relancer) { relancer = false; setTimeout(() => synchroCanaux(true)); }
  if (!change || !data) return;
  save(); renderNav(); markTabs();
  if (!$('dialog[open]') && !document.activeElement?.matches('input, textarea, select')) render(true);   // jamais pendant une saisie
  montrerAvis();
}
/* Coordonnées modifiées : l'autre côté les reçoit sans attendre la prochaine ouverture de l'app */
const planifierSynchro = () => { clearTimeout(synchroTimer); synchroTimer = setTimeout(() => synchroCanaux(true), 1500); };
async function synchroClient() {
  let change = false;
  const r = data.ruptureAEnvoyer;
  if (r && await API.rpcAnon('canal_rompre', {p_id:await idCanal(r), p_jeton:await jetonCanal(r), p_par:'client'})) { delete data.ruptureAEnvoyer; change = true; }
  const th = data.therapist, S = th?.canal;
  if (!S) return change;
  if (!th.arrivee) {
    const p = await sealFor(th, {type:'liaison', secret:S, client:ficheClient(), at:new Date().toISOString()});
    if (await API.rpcAnon('deposer_arrivee', {p_pk:th.pk, p_contenu:JSON.stringify(p)})) { th.arrivee = true; change = true; }
  }
  const id = await idCanal(S), jeton = await jetonCanal(S), f = JSON.stringify(ficheClient());
  if (th.ficheEnvoyee !== f && await API.rpcAnon('canal_ecrire', {p_id:id, p_jeton:jeton, p_cote:'client', p_fiche:await chiffrerCanal(S, ficheClient())})) { th.ficheEnvoyee = f; change = true; }
  const c = await API.rpcAnon('canal_lire', {p_id:id});
  if (c?.statut === 'rompu' && c.rompu_par === 'therapeute') {
    data.ruptureRecue = {nom:nomDe(th) || 'Votre thérapeute', at:new Date().toISOString(), refus:!th.accepte};
    data.therapist = null;
    await API.rpcAnon('canal_supprimer', {p_id:id, p_jeton:jeton}).catch(() => {});
    return true;
  }
  if (c?.therapeute) {   // le thérapeute n'écrit sa fiche qu'après avoir accepté la demande
    const t = await dechiffrerCanal(S, c.therapeute);
    for (const k of ['prenom', 'nom', 'type', 'tel', 'email', 'adresse']) if (k in t && t[k] !== th[k]) { th[k] = t[k]; change = true; }
    if (!th.accepte) {
      th.accepte = true; change = true;
      if (th.enAttente) data.accepteRecue = {nom:nomDe(th) || 'Votre thérapeute', at:new Date().toISOString()};   // un lien d'avant la v25 s'active sans message
      delete th.enAttente;
    }
  } else if (c && !th.accepte) {
    // Demande pas encore acceptée : seuls le nom et le type de thérapie sont connus, les coordonnées n'arrivent qu'après
    if (!th.enAttente) { th.enAttente = true; change = true; }
    for (const k of ['tel', 'email', 'adresse']) if (k in th) { delete th[k]; change = true; }
  }
  return change;
}
async function synchroTherapeute() {
  let change = false;
  if (session) {
    const arr = await API.rpc('lire_arrivees') || [], lus = [];
    for (const a of arr) {
      try { const o = await openEnvoi(JSON.parse(a.contenu)); if (o.type === 'liaison' && o.secret) { lierClient(o); change = true; } } catch (x) { console.warn('Arrivée illisible', x); }
      lus.push(a.id);
    }
    if (lus.length) await API.rpc('supprimer_arrivees', {p_ids:lus});
  }
  if (data.canauxARompre?.length) {
    const restent = [];
    for (const S of data.canauxARompre) if (!await rompreCanal(S, 'therapeute')) restent.push(S);
    if (restent.length !== data.canauxARompre.length) { data.canauxARompre = restent; change = true; }
  }
  const fiche = ficheTherapeute(), f = JSON.stringify(fiche);
  for (const c of Object.values(data.clients)) {
    if (c.ruptureAEnvoyer && await API.rpcAnon('canal_rompre', {p_id:await idCanal(c.ruptureAEnvoyer), p_jeton:await jetonCanal(c.ruptureAEnvoyer), p_par:'therapeute'})) { delete c.ruptureAEnvoyer; change = true; }
    const S = c.canal;
    if (!S || c.statut === 'ancien') continue;
    const id = await idCanal(S), jeton = await jetonCanal(S);
    if (c.statut === 'actuel' && c.ficheEnvoyee !== f && await API.rpcAnon('canal_ecrire', {p_id:id, p_jeton:jeton, p_cote:'therapeute', p_fiche:await chiffrerCanal(S, fiche)})) { c.ficheEnvoyee = f; change = true; }
    const r = await API.rpcAnon('canal_lire', {p_id:id});
    if (r?.statut === 'rompu' && r.rompu_par === 'client') {
      await API.rpcAnon('canal_supprimer', {p_id:id, p_jeton:jeton}).catch(() => {});
      if (c.statut === 'attente') finDemande(c);   // demande retirée par la personne : rien à signaler
      else {
        c.statut = 'ancien'; c.rupture = {par:'client', at:new Date().toISOString()}; delete c.canal;
        (data.rupturesRecues ||= []).push({nom:fullName(c), at:c.rupture.at});
      }
      change = true;
    } else if (r?.client) {
      const k = await dechiffrerCanal(S, r.client);
      if (k.prenom !== c.profile.prenom || k.nom !== c.profile.nom || codeU(k.numero) !== c.numero) { Object.assign(c.profile, {prenom:k.prenom, nom:k.nom}); c.numero = codeU(k.numero); change = true; }
    }
  }
  return change;
}
/* Reconnaître la fiche d'un client : par son app, puis par son code utilisateur. Le nom ne sert que pour une fiche créée à la main,
   sans code, et seulement s'il n'y a aucun homonyme : deux clients du même nom ne sont jamais confondus. */
const ficheLibre = x => (!x.uid || x.uid === x.id) && !x.canal && !x.numero;
// les codes utilisateur s'écrivaient C-0012 avant novembre 2026, U-0012 depuis : les deux désignent le même compte, toujours affiché en U-
function codeU(n) { return n ? String(n).trim().toUpperCase().replace(/^C-/, 'U-') : n; }
const memeCode = (a, b) => !!a && !!b && codeU(a) === codeU(b);
function ficheConnue(k) {
  const tous = Object.values(data.clients), nom = nomDe(k).toLowerCase();
  const memeNom = tous.filter(x => fullName(x).toLowerCase() === nom);
  return tous.find(x => k.uid && x.uid === k.uid) || tous.find(x => memeCode(x.numero, k.numero))
    || (memeNom.length === 1 && ficheLibre(memeNom[0]) ? memeNom[0] : null);
}
/* Une personne a collé le lien du thérapeute : sa demande attend qu'il l'accepte, même s'il s'agit d'un ancien client.
   Le lien du thérapeute peut ainsi circuler sans risque. Sa fiche existante est reprise si on la reconnaît, sinon elle est créée. */
function lierClient(o) {
  const k = o.client || {};
  let c = ficheConnue(k), nouvelle = !c;
  if (!c) { const id = 'c' + rid(6); c = data.clients[id] = {id, uid:null, profile:{nom:'', prenom:'', start:''}, contact:{}, note:'', labels:{...DEF_LABELS}, days:{}, envois:[]}; }
  Object.assign(c.profile, {prenom:k.prenom || c.profile.prenom, nom:k.nom || c.profile.nom});
  if (c.statut !== 'attente') c.demande = {nouvelle, avant:nouvelle ? '' : c.statut || 'actuel', at:new Date().toISOString()};
  Object.assign(c, {uid:k.uid || c.uid, numero:codeU(k.numero) || c.numero, canal:o.secret, statut:'attente'});
  delete c.rupture; delete c.ficheEnvoyee;
  return c;
}
/* Demande refusée ou retirée : une fiche créée pour elle disparaît avec ce qu'elle contient, une fiche existante redevient ancienne */
function finDemande(c) {
  if (c.demande?.nouvelle) { delete data.clients[c.id]; return; }
  c.statut = 'ancien'; delete c.canal; delete c.demande;
}
/* Rompre le lien : l'autre le verra à sa prochaine ouverture de Motus. Sans connexion, la rupture part plus tard. */
async function rompreCanal(S, par) {
  try { if (await API.rpcAnon('canal_rompre', {p_id:await idCanal(S), p_jeton:await jetonCanal(S), p_par:par})) return true; } catch {}
  return false;
}
/* Côté thérapeute : rompre maintenant, ou dès le retour de la connexion, même si la fiche du client a disparu entre-temps */
async function rompreOuPlusTard(S) { if (S && !await rompreCanal(S, 'therapeute')) (data.canauxARompre ||= []).push(S); }
/* Nouvelle du lien (fin de suivi, demande refusée ou acceptée) : une fenêtre s'affiche, quelle que soit la page, jusqu'à ce qu'on l'ait lue */
function montrerAvis() {
  if (!data || !key || $('#app').hidden || $('dialog[open]')) return;
  const th = data.role === 'therapeute', r = th ? data.rupturesRecues || [] : data.ruptureRecue ? [data.ruptureRecue] : [];
  const quand = x => fmtFR(ymd(new Date(x.at))), a = !th && data.accepteRecue;
  let titre, textes;
  if (r.length) {
    titre = !th && r[0].refus ? 'Demande non acceptée' : 'Fin de suivi';
    textes = th ? r.map(x => `${esc(x.nom)} a mis fin au suivi le ${quand(x)}. ${r.length > 1 ? 'Ces clients sont' : 'Ce client est'} maintenant dans « Anciens clients », avec sa fiche et ses données reçues.`)
      : r.map(x => x.refus ? `${esc(x.nom)} n’a pas accepté votre demande de suivi.` : `${esc(x.nom)} a mis fin au suivi le ${quand(x)}. Vous ne pouvez plus lui envoyer vos données. Vos notes restent sur votre téléphone.`);
  } else if (a) {
    titre = 'Demande acceptée';
    textes = [`${esc(a.nom)} a accepté votre demande de suivi.`, 'Ses coordonnées sont dans Paramètres › Mon thérapeute, et vous pouvez maintenant lui envoyer vos données depuis Paramètres › Partage et export.'];
  } else return;
  const D = $('#codeDlg');
  D.innerHTML = `<form method="dialog" id="rpForm">
    <div class="dlg-h"><h2>${titre}</h2></div>
    <div class="dlg-b">${textes.map(t => `<p>${t}</p>`).join('')}</div>
    <div class="dlg-f"><button class="btn primary">J’ai compris</button></div>
  </form>`;
  D.oncancel = e => e.preventDefault();
  $('#rpForm').onsubmit = e => { e.preventDefault(); D.oncancel = null; D.close(); ACT.avisLu(); };
  D.showModal();
}

/* Code à recopier avant une action qu'on ne doit pas faire par erreur */
function confirmerCode({titre, texte, bouton}) {
  return new Promise(resolve => {
    const D = $('#codeDlg'), code = String(1000 + crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
    D.innerHTML = `<form method="dialog" id="rtForm">
      <div class="dlg-h"><h2>${esc(titre)}</h2></div>
      <div class="dlg-b">
        <p class="small muted">${texte}</p>
        <label class="label" for="rtCode">Pour confirmer, saisissez le code <b class="fp">${code}</b></label>
        <input type="text" id="rtCode" inputmode="numeric" maxlength="4" autocomplete="off">
        <div class="err" id="rtErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="rtNon">Annuler</button><button class="btn danger">${bouton}</button></div>
    </form>`;
    const fin = ok => { D.oncancel = null; if (D.open) D.close(); resolve(ok); };
    $('#rtNon').onclick = () => fin(false);
    D.oncancel = () => resolve(false);
    $('#rtForm').onsubmit = e => {
      e.preventDefault();
      if ($('#rtCode').value.trim() !== code) return $('#rtErr').textContent = 'Code incorrect : recopiez le code affiché.';
      fin(true);
    };
    D.showModal();
    $('#rtCode').focus();
  });
}

/* Rejoindre un thérapeute : le client vérifie le code de sécurité et donne son accord */
function consentirLien(o, ancien) {
  return new Promise(resolve => {
    const D = $('#codeDlg'), nom = nomDe(o) || 'ce thérapeute';
    D.innerHTML = `<form method="dialog" id="lnForm">
      <div class="dlg-h"><h2>Rejoindre ${esc(nom)}</h2></div>
      <div class="dlg-b">
        ${o.type ? `<p class="small muted" style="margin-top:0">${esc(o.type)}</p>` : ''}
        <div class="stat"><span class="muted">Code de sécurité</span><b class="fp">${esc(o.fp)}</b></div>
        <p class="small muted">Vérifiez qu’il correspond à celui que vous a donné votre thérapeute.</p>
        <p class="small">En le rejoignant, vous partagez avec lui votre prénom, votre nom et votre code utilisateur${data.account?.numero ? ` (${esc(data.account.numero)})` : ''}. Votre thérapeute doit ensuite accepter votre demande : vous recevrez alors ses coordonnées, et celles de chacun se mettront à jour automatiquement.</p>
        <p class="small">Par sécurité, les données de votre journal ne lui sont pas transmises automatiquement : vous les lui envoyez quand vous le souhaitez, depuis Paramètres › Partage et export.${ancien ? ` <b>${esc(nomDe(ancien))} ne sera plus votre thérapeute</b>, et il en sera prévenu.` : ''}</p>
        <label class="rgpd"><input type="checkbox" id="lnOui"><span>J’accepte que ${esc(nom)} reçoive et lise les données que je lui enverrai.</span></label>
        <div class="err" id="lnErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="lnNon">Annuler</button><button class="btn primary">Rejoindre</button></div>
    </form>`;
    const fin = ok => { D.oncancel = null; if (D.open) D.close(); resolve(ok); };
    $('#lnNon').onclick = () => fin(false);
    D.oncancel = () => resolve(false);
    $('#lnForm').onsubmit = e => {
      e.preventDefault();
      if (!$('#lnOui').checked) return $('#lnErr').textContent = 'Cochez la case pour donner votre accord.';
      fin(true);
    };
    D.showModal();
  });
}

/* Données transmises au thérapeute : au moins un choix parmi les émotions, les synthèses et les notes personnelles ;
   les lieux en plus, au choix. La couleur de la journée est toujours transmise. */
const PARTAGE = [['emotions', 'Les émotions, avec leur heure et leur raison'], ['synthese', 'La synthèse de la journée'], ['notes', 'Les notes personnelles']];
const PARTAGE_N = {emotions:'Émotions', synthese:'synthèses', notes:'notes'};
const partageValide = p => PARTAGE.some(([k]) => p[k]);
const resumePartage = () => { const p = data.settings.partage || {}, n = PARTAGE.filter(([k]) => p[k]).map(([k]) => PARTAGE_N[k]); const t = [...n, ...(p.emotions && p.besoins ? ['besoins'] : []), ...(p.lieu ? ['lieux'] : [])].join(', '); return t.charAt(0).toUpperCase() + t.slice(1); };
function formPartage() {
  const p = data.settings.partage || {}, ligne = (k, n) => `<label class="choix-case"><input type="checkbox" data-partage="${k}" ${p[k] ? 'checked' : ''}><span>${n}</span></label>`;
  return `<p class="small muted" style="margin:0">Au moins un choix parmi :</p>
    ${PARTAGE.map(([k, n]) => ligne(k, n)).join('')}
    <p class="small muted" style="margin:10px 0 0">En plus, si vous le souhaitez :</p>
    ${ligne('besoins', 'Les besoins reliés aux émotions, et « Je pourrais… » (aussi dans le fichier Excel)')}
    ${ligne('lieu', 'Les lieux (ville et précision)')}
    <p class="small muted" style="margin:10px 0 0">La couleur de la journée est toujours transmise.</p>`;
}
function choisirPartage() {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="ptForm">
      <div class="dlg-h"><h2>Que transmettre à votre thérapeute ?</h2></div>
      <div class="dlg-b">
        <p class="small muted">Ce choix vaut pour tous vos envois. Vous pourrez le changer dans Paramètres › Données transmises.</p>
        ${formPartage()}
        <div class="err" id="ptErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="ptNon">Annuler</button><button class="btn primary">Continuer</button></div>
    </form>`;
    const fin = ok => { D.oncancel = null; if (D.open) D.close(); resolve(ok); };
    $('#ptNon').onclick = () => fin(false);
    D.oncancel = () => resolve(false);
    $('#ptForm').onsubmit = e => {
      e.preventDefault();
      const choix = {};
      D.querySelectorAll('[data-partage]').forEach(c => choix[c.dataset.partage] = c.checked);
      if (!partageValide(choix)) return $('#ptErr').textContent = 'Choisissez au moins les émotions, les synthèses ou les notes.';
      Object.assign(data.settings.partage, choix); data.settings.partageChoisi = true; save(); fin(true);
    };
    D.showModal();
  });
}
function aTransmettre(d) {
  const p = data.settings.partage || {}, lieu = x => p.lieu ? x : {...x, ville:'', lieu:''};
  const besoins = e => { if (p.besoins) return e; const {bes, bdet, piste, taches, ...reste} = e; return reste; };   // sans les cartes Besoin et Action, si on ne les transmet pas
  const o = {color:d.color || null, entries:p.emotions ? (d.entries || []).map(lieu).map(besoins) : [], synth:p.synthese ? d.synth || '' : ''};
  if (p.notes && dayNotes(d).length) o.notes = dayNotes(d).map(lieu);
  return o;
}
const aEnvoyer = d => { const p = data.settings.partage || {}; return !!d && (!!d.color || (p.emotions && !!d.entries?.length) || (p.synthese && !!d.synth?.trim()) || (p.notes && dayNotes(d).length > 0)); };

/* Thérapeute : fichiers déposés en vrac, chacun rangé dans la fiche de son client */
async function importerFichiers(fichiers, cibleId) {
  const ranges = {}, refus = [], liaisons = [];
  for (const f of fichiers) {
    let pkg, o;
    try { pkg = JSON.parse(await f.text()); if (pkg.app !== 'journal-emotions' || pkg.type !== 'envoi') throw 0; }
    catch { refus.push(`${f.name} : ce n’est pas un envoi Motus`); continue; }
    if (pkg.to !== data.keys?.fp) { refus.push(`${f.name} : chiffré pour un autre thérapeute`); continue; }
    try { o = await openEnvoi(pkg); } catch { refus.push(`${f.name} : fichier abîmé`); continue; }
    if (o.type === 'liaison') { liaisons.push(fullName(lierClient(o))); continue; }
    const c = ficheDe(o.client || {}, cibleId);
    if (c.statut === 'ancien') { refus.push(`${f.name} : ${fullName(c)} n’est plus votre client`); continue; }
    integrer(c, o);
    ranges[c.id] = (ranges[c.id] || 0) + 1;
  }
  await saveNow();
  montrerImport(fichiers.length, ranges, liaisons, refus);   // avant l'affichage : une autre fenêtre attendra qu'on ferme celle-ci
  if (cibleId && Object.keys(ranges).length === 1 && ranges[cibleId]) openClient(cibleId);
  else { src = null; view = 'clients'; render(); }
  renderNav(); markTabs();
}
/* Fenêtre de bilan : combien de fichiers, de qui, et ce qui n'a pas pu être rangé */
function montrerImport(n, ranges, liaisons, refus) {
  const s = k => k > 1 ? 's' : '', D = $('#codeDlg');
  const rangs = Object.entries(ranges).map(([id, k]) => [data.clients[id], k]).sort((a, b) => fullName(a[0]).localeCompare(fullName(b[0]), 'fr'));
  const attente = rangs.some(([c]) => c.statut === 'attente') || liaisons.length;
  if (D.open) D.close();
  D.innerHTML = `<form method="dialog" id="imForm">
    <div class="dlg-h"><h2>${n} fichier${s(n)} reçu${s(n)}</h2></div>
    <div class="dlg-b">
      ${rangs.length ? `<p style="margin-top:0">${rangs.length > 1 ? `De ${rangs.length} expéditeurs :` : 'Expéditeur :'}</p>
      <ul class="liste-import">${rangs.map(([c, k]) => `<li><b>${esc(fullName(c))}</b> · ${k} fichier${s(k)}${c.statut === 'attente' ? ' <span class="muted">(demande à accepter)</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${liaisons.length ? `<p>Demande${s(liaisons.length)} de suivi : ${liaisons.map(esc).join(', ')}.</p>` : ''}
      ${attente ? '<p class="small muted">Les personnes que vous ne suivez pas encore sont dans « Demandes en attente » : acceptez-les pour les compter parmi vos clients.</p>' : ''}
      ${refus.length ? `<p class="label">Non importé${s(refus.length)}</p><ul class="liste-import small">${refus.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="dlg-f"><button class="btn primary">OK</button></div>
  </form>`;
  $('#imForm').onsubmit = e => { e.preventDefault(); D.close(); };
  D.onclose = () => { D.onclose = null; montrerAvis(); };
  D.showModal();
}
function ficheDe(k, cibleId) {
  let c = ficheConnue({...k, uid:k.id});
  if (!c && cibleId && ficheLibre(data.clients[cibleId])) c = data.clients[cibleId];
  if (!c) {   // envoi d'une personne inconnue : à accepter avant d'être rangé parmi les clients
    const id = 'c' + rid(6);
    c = data.clients[id] = {id, uid:null, profile:{nom:k.nom || '', prenom:k.prenom || '', start:''}, contact:{}, note:'', labels:{...DEF_LABELS}, days:{}, envois:[], statut:'attente', demande:{nouvelle:true, avant:'nouveau', at:new Date().toISOString()}};
  }
  if (k.id) c.uid = k.id;
  if (k.numero && (!c.numero || memeCode(c.numero, k.numero))) c.numero = codeU(k.numero);
  return c;
}
function integrer(c, o) {
  if (!c.profile.start || o.from < c.profile.start) c.profile.start = o.from;
  c.labels = {...DEF_LABELS, ...o.labels};
  for (let k = o.from; k <= o.to; k = addDays(k, 1)) { if (o.days[k]) c.days[k] = o.days[k]; else delete c.days[k]; }
  c.envois = c.envois.filter(x => !(x.from === o.from && x.to === o.to));
  c.envois.push({from:o.from, to:o.to, sentAt:o.sentAt, importedAt:new Date().toISOString()});
  c.envois.sort((a, b) => a.from.localeCompare(b.from));
  c.nouveau = (c.nouveau || 0) + 1;
}
const nbNouveaux = () => Object.values(data.clients || {}).filter(c => c.nouveau || c.nouveauClient || c.statut === 'attente').length;

function pageDonnees() {
  return `<section class="card">
    <p class="small muted" style="margin:0 0 6px">Ce que contiennent vos envois à votre thérapeute. Le fichier Excel, lui, contient tout sauf les notes personnelles, et les besoins seulement s’ils sont cochés ici.</p>
    ${formPartage()}
  </section>`;
}
let retraitFait = null;
function therapistCard() {
  const th = data.therapist, fait = retraitFait;
  retraitFait = null;
  const attente = attenteAcceptation(th);
  return `${fait ? `<div class="banner"><span>✓ ${esc(fait)} n’est plus votre thérapeute. Il en sera prévenu à sa prochaine ouverture de Motus. Vous pouvez en ajouter un autre ci-dessous.</span></div>` : ''}<section class="card">
    ${th ? `
      ${attente ? `<div class="attente-th">${ico('sablier', 'bi')}<span><b>${th.arrivee ? 'En attente d’acceptation' : 'Demande prête à partir'}</b><br>${th.arrivee
        ? `Votre demande a été envoyée${th.addedAt ? ` le ${fmtFR(ymd(new Date(th.addedAt)))}` : ''}. ${esc(nomDe(th) || 'Votre thérapeute')} doit l’accepter dans son app. Ses coordonnées s’afficheront alors ici, et vous pourrez lui envoyer vos données.`
        : 'Elle partira dès que votre téléphone sera connecté à internet.'}</span></div>` : ''}
      <div class="stat"><span class="muted">Prénom</span><b>${esc(th.prenom || '—')}</b></div>
      <div class="stat"><span class="muted">Nom</span><b>${esc(th.nom || '—')}</b></div>
      <div class="stat"><span class="muted">Type de thérapie</span><b>${esc(th.type || '—')}</b></div>
      ${attente ? ['Mail', 'Téléphone', 'Adresse du cabinet'].map(n => `<div class="stat"><span class="muted">${n}</span><b class="muted masque">Après acceptation</b></div>`).join('')
      : `<div class="stat"><span class="muted">Mail</span><b style="overflow-wrap:anywhere;text-align:right">${th.email ? `<a href="mailto:${esc(th.email)}">${esc(th.email)}</a>` : '—'}</b></div>
      <div class="stat"><span class="muted">Téléphone</span><b>${th.tel ? `<a href="tel:${esc(th.tel.replace(/\s/g, ''))}">${esc(th.tel)}</a>` : '—'}</b></div>
      <div class="stat"><span class="muted">Adresse du cabinet</span><b style="text-align:right">${esc(th.adresse || '—')}</b></div>`}
      <div class="stat"><span class="muted">Code de sécurité</span><b class="fp">${esc(th.fp)}</b></div>
      ${th.addedAt && !attente ? `<div class="stat"><span class="muted">Ajouté le</span><b>${fmtFR(ymd(new Date(th.addedAt)))}</b></div>` : ''}
      ${attente ? '' : `<div class="stat"><span class="muted">Lien</span><b>${th.canal ? 'Actif' : 'À activer'}</b></div>`}
      ${th.canal ? '' : `<p class="small muted" style="margin:8px 0 0">Activez le lien pour partager vos coordonnées avec votre thérapeute, les tenir à jour et être prévenu(e) si l’un de vous met fin au suivi.</p>
      <button class="btn primary block" data-act="activerLien">Activer le lien</button>`}
      <button class="btn danger block" data-act="removeTherapist">Retirer ce thérapeute</button>` : `
      <label class="label" for="invCode" style="margin-top:0">Lien d’invitation de votre thérapeute</label>
      <textarea id="invCode" rows="3" placeholder="Touchez ici, puis Coller" autocapitalize="none" spellcheck="false"></textarea>
      <p class="small muted" style="margin:6px 0 0">Copiez le lien qu’il vous a envoyé, puis collez-le dans ce champ : il s’ouvre aussitôt.</p>
      <button class="btn primary block" data-act="addTherapist">Ajouter mon thérapeute</button>`}
  </section>`;
}
/* data.sent : début de période → {to, at} */
const sentAt = iso => { const d = new Date(iso); return `le ${fmtFR(ymd(d)).slice(0, 5)} à ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const lastSent = () => lastOf(Object.entries(data.sent).sort((a, b) => a[1].at.localeCompare(b[1].at)));
function sentStatus() {
  const same = data.sent[xStart];
  if (same && same.to === addDays(xStart, 6)) return `✓ Période déjà envoyée ${sentAt(same.at)}`;
  const l = lastSent();
  return l ? `Dernier envoi : du ${fmtFR(l[0]).slice(0, 5)} au ${fmtFR(l[1].to).slice(0, 5)}, ${sentAt(l[1].at)}` : 'Aucun envoi pour l’instant.';
}
async function sendWeek() {
  const x = exportRange(); if (!x) return;
  const th = data.therapist, p = data.profile;
  if (!p.prenom.trim() && !p.nom.trim()) return toast('Indiquez d’abord votre nom dans « Informations personnelles ».');
  if (th.canal && !th.accepte) return toast(`${th.prenom || 'Votre thérapeute'} n’a pas encore accepté votre demande : vous pourrez lui envoyer vos données ensuite.`);
  if (!data.settings.partageChoisi && !await choisirPartage()) return;   // au premier envoi
  const days = {};
  for (let k = x.from; k <= x.to; k = addDays(k, 1)) if (aEnvoyer(data.days[k])) days[k] = aTransmettre(data.days[k]);
  if (!Object.keys(days).length && !confirm('Aucune note sur cette période. Envoyer quand même ?')) return;
  const pkg = await sealFor(th, {client:{id:data.uid, nom:p.nom, prenom:p.prenom, numero:data.account?.numero || ''}, from:x.from, to:x.to, sentAt:new Date().toISOString(), labels:data.labels, days});
  const name = `motus-envoi_${x.from}.json`;
  envoyerParMail({file:new File([JSON.stringify(pkg)], name, {type:'application/json'}), from:x.from, to:x.to, chiffre:true, fait:() => {
    data.sent[x.from] = {to:x.to, at:new Date().toISOString(), dest:nomDe(th)}; countStat('envois');
    const st = $('#sentSt'); if (st) st.textContent = sentStatus();
    const ls = $('#listeSem'); if (ls) ls.innerHTML = listeSemaines();
  }});
}
/* Mail prérempli : seulement la période et le nom, jamais le contenu des notes */
function mailEnvoi(from, to, chiffre) {
  const p = data.profile, periode = `du ${fmtFR(from)} au ${fmtFR(to)}`, signe = `${p.prenom} ${p.nom}`.trim();
  return {
    objet:`Export données Motus ${periode}`,
    corps:`Bonjour,\n\nVous trouverez en pièce jointe mon ${chiffre ? 'fichier Motus' : 'tableau Excel Motus'} pour la période ${periode}.${chiffre ? ' Il est chiffré : il s’ouvre dans Motus, depuis ma fiche (Importer un fichier reçu).' : ''}\n\nBien cordialement,\n${signe}`,
  };
}
const lienMail = (a, {objet, corps}) => `mailto:${encodeURIComponent(a || '').replace(/%40/g, '@')}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps.replace(/\n/g, '\r\n'))}`;
/* Dans l'ordre : joindre le fichier, puis le destinataire, puis le texte. Le menu de partage joint le fichier et le texte, mais aucune app web ne peut y
   indiquer de destinataire : son adresse est copiée pour être collée. Sans menu de partage (PC), le fichier est téléchargé et la messagerie s'ouvre préremplie. */
async function envoyerParMail({file, from, to, chiffre, fait}) {
  const a = data.therapist?.email || '', mail = mailEnvoi(from, to, chiffre);
  if (navigator.canShare?.({files:[file]})) {
    if (a) navigator.clipboard?.writeText(a).catch(() => {});
    busy = true;
    try {
      // la messagerie de l'iPhone prend la première ligne du texte comme objet
      await navigator.share({files:[file], title:mail.objet, text:`${mail.objet}\n\n${mail.corps}`});
      fait?.();
      return toast(a ? `Pensez à coller l’adresse de votre thérapeute : ${a}` : 'Fichier prêt à envoyer');
    } catch (err) {
      if (err.name === 'AbortError') return;
    } finally { setTimeout(() => busy = false, 1500); }
  }
  download(file, file.name); fait?.();
  location.href = lienMail(a, mail);
  toast('Joignez au mail le fichier téléchargé.');
}
const aideEnvoi = a => navigator.canShare
  ? `Choisissez votre messagerie : le fichier est joint et le texte prérempli.${a ? ' L’adresse de votre thérapeute est copiée : collez-la dans « À ».' : ''}`
  : 'Le fichier se télécharge et votre messagerie s’ouvre, préremplie : joignez-y le fichier.';
/* Rappel si rien n'a été envoyé depuis 7 jours (ou depuis l'ajout du thérapeute) et qu'il y a des notes non envoyées */
const attenteAcceptation = th => !!(th?.canal && !th.accepte);
function sendReminder() {
  const th = data.therapist;
  if (!th) return '';
  if (attenteAcceptation(th)) return `<div class="banner attente">${ico('sablier', 'bi')}<span><b>Demande envoyée à ${esc(nomDe(th) || 'votre thérapeute')}</b><br>En attente de son acceptation. Vous pourrez ensuite lui envoyer vos données.</span>
    <button class="btn" data-act="voirThera">Voir</button></div>`;
  const l = lastSent(), ref = l ? l[1].at : data.therapist.addedAt;
  const since = Math.floor((Date.now() - new Date(ref)) / 864e5);
  const coveredTo = Object.values(data.sent).reduce((m, s) => s.to > m ? s.to : m, '');
  if (since < 7 || !Object.keys(data.days).some(k => k > coveredTo && k <= today() && dayUsed(data.days[k]))) return '';
  const who = esc(data.therapist.prenom || 'votre thérapeute');
  return `<div class="banner"><span>${l ? `Votre dernier envoi à ${who} date d’il y a ${since} jours.` : `Vous n’avez encore rien envoyé à ${who}.`}</span>
    <button class="btn primary" data-act="goSend">Envoyer</button></div>`;
}

