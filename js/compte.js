// Motus — Ouverture du journal, récupération, politique, engagements, effacement, suppression, sauvegarde
'use strict';

/* À la création du compte : temps de verrouillage et, pour un client, ville automatique */
function choixInitiaux() {
  return new Promise(resolve => {
    const D = $('#codeDlg'), th = data.role === 'therapeute';
    D.innerHTML = `<form method="dialog" id="chForm">
      <div class="dlg-h"><h2>Vos préférences</h2></div>
      <div class="dlg-b">
        <p class="small muted">Vous pourrez les changer à tout moment dans les Paramètres.</p>
        <label class="label" for="chLock">Temps de verrouillage</label>
        <select id="chLock">${optionsVerrou()}</select>
        <p class="small muted" style="margin:6px 0 0">Après ce délai hors de l’app, votre mot de passe est redemandé.</p>
        ${th ? '' : `<p class="label">Remplir la ville automatiquement (GPS)</p>
        <div class="roles">
          <label class="role"><input type="radio" name="chGeo" value="oui" checked> Oui</label>
          <label class="role"><input type="radio" name="chGeo" value="non"> Non</label>
        </div>
        <p class="small muted" style="margin:6px 0 0">La position est convertie en nom de ville directement sur le téléphone. Elle n’est ni envoyée ni enregistrée : seule la ville est notée.</p>`}
      </div>
      <div class="dlg-f"><button class="btn primary" id="chOk">Continuer</button></div>
    </form>`;
    D.oncancel = e => e.preventDefault();
    $('#chForm').onsubmit = async e => {
      e.preventDefault();
      const sel = $('#chLock'), v = +sel.value;
      if (!th) data.settings.geoloc = $('input[name=chGeo]:checked').value === 'oui';
      await setAutolock(sel);
      if (data.settings.autolock !== v) return;   // « Jamais » refusé : le choix reste à faire
      await saveNow();
      busy = false; D.oncancel = null; D.close(); resolve();
    };
    busy = true;
    D.showModal();
  });
}

/* Ouvre (ou crée) le journal chiffré de ce compte sur cet appareil */
async function openJournal(id, pw, init) {
  VKEY = vaultKey(id);
  const raw = localStorage.getItem(VKEY) || (session && !init ? await reprendreJournal(id, pw) : null);
  if (raw) {
    let r;
    try { r = await openVault(JSON.parse(raw), pw); }
    catch {
      if (!session) throw apiErr('journal', 'Mot de passe incorrect.');   // hors connexion
      // mot de passe changé depuis un autre appareil : l'ancien rouvre le journal de celui-ci
      const old = await askCode('Journal de cet appareil', {label:'Ancien mot de passe', hint:'Votre mot de passe a changé depuis votre dernière connexion ici. Entrez l’ancien pour rouvrir le journal de cet appareil.'});
      if (old == null) throw apiErr('journal', 'Journal de cet appareil non ouvert.');
      try { r = await openVault(JSON.parse(raw), old); } catch { throw apiErr('journal', 'Ancien mot de passe incorrect.'); }
      r.s = crypto.getRandomValues(new Uint8Array(16)); r.k = await deriveKey(pw, r.s);
    }
    key = r.k; salt = r.s; data = defaults(r.obj);
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16)); key = await deriveKey(pw, salt);
    data = defaults(init || {});
  }
  applyProfil();
  data.account ||= {identifiant:id};
  localStorage.setItem(LAST_ID, id);
  if (data.settings.autolock === -1) { await rememberKey().catch(() => {}); rememberSession(); }
  if (data.role === 'therapeute') await ensureKeys(); else await saveNow();
  navigator.storage?.persist?.();
  showApp();
  countStat('connexions');   // une ouverture de l'app, comptée même sans internet
  if (!await exigerRgpd() || !await exigerEssai()) return;
  pushProfile(); flushStats(); assurerLienCourt(); synchroCanaux(true); ensureSecours(pw).then(ok => ok && exigerMail());
}

function applyProfil() {
  if (!profil) return;
  data.role = profil.role;
  data.account = {identifiant:profil.identifiant, numero:codeU(profil.numero), est_admin:!!profil.est_admin, recup:!!data.account?.recup, cree_le:profil.cree_le || data.account?.cree_le,
    lecture:profil.actif === false};   // v47 : compte désactivé = lecture seule, aussi hors connexion
  if (!data.profile.nom && !data.profile.prenom) Object.assign(data.profile, {nom:profil.nom, prenom:profil.prenom});
}

/* Récupération par e-mail : le serveur garde une clé de secours et seulement une empreinte de l'adresse.
   Cet appareil garde la clé du journal chiffrée par la clé de secours : aucun des deux, seul, n'ouvre les notes. */
const secoursKey = id => 'journal-emotions.secours.' + id;
/* Aide-mémoire pour « Mot de passe oublié » : uniquement la version masquée, lisible sans ouvrir le journal */
const indiceKey = id => 'journal-emotions.indice.' + id;
function syncIndice() {
  const k = indiceKey(data.account.identifiant);
  if (data.recupIndice) localStorage.setItem(k, data.recupIndice); else localStorage.removeItem(k);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function passwordBits(pw, saltU8) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({name:'PBKDF2', salt:saltU8, iterations:ITER, hash:'SHA-256'}, base, 256);
}
/* Met à jour l'état de la récupération ; avec le mot de passe, recrée aussi la copie de secours de la clé */
async function ensureSecours(pw) {
  if (!session || !data) return;
  try {
    const cle = await API.rpc('ma_cle_secours');
    if (!data) return;
    const sk = secoursKey(data.account.identifiant);
    const etat = cle ? await API.rpc('ma_recuperation_etat') : null;
    if (!data) return;
    data.account.recup = etat?.confirmee ? 'confirmee' : etat?.attente ? 'attente' : false;
    data.account.recupChange = !!(etat?.confirmee && etat.attente);
    if (data.account.recup !== 'attente' && !data.account.recupChange) {
      // thérapeute : un seul mail, celui qui vient d'être confirmé devient aussi celui transmis aux clients
      if (data.role === 'therapeute' && data.account.recup && data.recupMail) { data.thera.email = data.recupMail; pushProfile(); }
      delete data.recupMail; delete data.recupEnvoi;
    }
    if (!cle) { delete data.recupIndice; delete data.recupIndiceNouveau; }
    else if (etat?.confirmee && !etat.attente && data.recupIndiceNouveau) { data.recupIndice = data.recupIndiceNouveau; delete data.recupIndiceNouveau; }
    syncIndice();
    if (!cle) localStorage.removeItem(sk);
    else if (pw) {
      const k = await crypto.subtle.importKey('raw', fromB64(cle), 'AES-GCM', false, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, k, await passwordBits(pw, salt)));
      localStorage.setItem(sk, JSON.stringify({iv:toB64(iv), ct:toB64(ct)}));
    }
    save();
    if (view === 'set' && !src) render(true);
    else majRappelRecup();
    return true;
  } catch (x) { console.warn('Récupération indisponible', x.code); }
}
/* Après un mot de passe oublié : rouvre le journal de l'appareil avec la clé de secours et le rechiffre */
async function rescueJournal(id, cle, newPw) {
  try {
    const v = JSON.parse(localStorage.getItem(vaultKey(id))), b = JSON.parse(localStorage.getItem(secoursKey(id)));
    if (!v || !b) return false;
    const ks = await crypto.subtle.importKey('raw', fromB64(cle), 'AES-GCM', false, ['decrypt']);
    const bits = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(b.iv)}, ks, fromB64(b.ct));
    const old = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
    const obj = JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(v.iv)}, old, fromB64(v.ct))));
    const s = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(vaultKey(id), JSON.stringify(await sealData(obj, await deriveKey(newPw, s), s)));
    return true;
  } catch (x) { console.warn('Journal non repris', x); return false; }
}
/* Politique de confidentialité : acceptation demandée à l'ouverture aux comptes plus anciens et à chaque nouvelle version.
   Refuser déconnecte, sans toucher aux notes de l'appareil. La preuve est gardée sur l'appareil et, dès que possible, sur le compte. */
function envoyerConsentement() {
  const c = data?.consentement;
  if (!c || c.envoye || !session) return;
  API.setConsent({version:c.version, date:c.date}).then(() => { c.envoye = true; if (data?.consentement === c) save(); }).catch(() => {});
}
function exigerRgpd() {
  if (data.consentement?.version === RGPD_VERSION) { envoyerConsentement(); return Promise.resolve(true); }
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="rgForm">
      <div class="dlg-h"><h2>Politique de confidentialité</h2></div>
      <div class="dlg-b">
        <p class="small muted">Pour continuer à utiliser Motus, merci de lire et d’accepter notre politique de confidentialité. Sans cet accord, vous serez déconnecté(e) ; vos notes restent sur ce téléphone.</p>
        <label class="rgpd"><input type="checkbox" id="rgOui"><span>J’ai lu la <a href="confidentialite.html" target="_blank" rel="noopener" data-act="voirPolitique">politique de confidentialité</a> et j’accepte le traitement de mes données, y compris celles qui peuvent concerner ma santé.</span></label>
        <div class="err" id="rgErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="rgNon">Se déconnecter</button><button class="btn primary">Accepter</button></div>
    </form>`;
    D.onclose = null;
    D.oncancel = e => e.preventDefault();
    $('#rgNon').onclick = async () => { busy = false; D.oncancel = null; D.close(); await lock(); resolve(false); };
    $('#rgForm').onsubmit = async e => {
      e.preventDefault();
      if (!$('#rgOui').checked) return $('#rgErr').textContent = 'Cochez la case pour accepter la politique de confidentialité.';
      data.consentement = {version:RGPD_VERSION, date:new Date().toISOString(), envoye:false};
      await saveNow();
      busy = false; D.oncancel = null; D.close(); envoyerConsentement(); resolve(true);
    };
    busy = true;   // le temps de lire la politique, sans que l'app se verrouille
    D.showModal();
  });
}
/* Version d'essai : chaque compte s'engage une fois, case par case, à la connexion ou à la création du compte.
   L'accord est gardé dans le journal chiffré de l'appareil (rien n'est envoyé au serveur). Refuser déconnecte, sans toucher aux notes. */
function exigerEssai() {
  if (data.essai?.version === ESSAI_VERSION) return Promise.resolve(true);
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="esForm" class="essai">
      <div class="dlg-h"><h2>${ico('info', '')}Version d’essai</h2></div>
      <div class="dlg-b">
        <p class="essai-intro">${ESSAI_INTRO}</p>
        ${ENGAGEMENTS.map(t => `<label class="choix-case"><input type="checkbox"><span>${t}</span></label>`).join('')}
        <p class="small muted" id="esAide" style="margin:4px 0 0">Cochez chaque engagement pour continuer.</p>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="esNon">Se déconnecter</button><button class="btn primary" id="esOui" disabled>J’accepte</button></div>
    </form>`;
    D.onclose = null;
    D.oncancel = e => e.preventDefault();
    $('#esForm').onchange = () => { const ok = [...D.querySelectorAll('#esForm input')].every(c => c.checked); $('#esOui').disabled = !ok; $('#esAide').hidden = ok; };
    $('#esNon').onclick = async () => { busy = false; D.oncancel = null; D.close(); await lock(); resolve(false); };
    $('#esForm').onsubmit = async e => {
      e.preventDefault();
      if ($('#esOui').disabled) return;
      data.essai = {version:ESSAI_VERSION, date:new Date().toISOString()};
      await saveNow();
      busy = false; D.oncancel = null; D.close(); resolve(true);
    };
    busy = true;   // le temps de lire, sans que l'app se verrouille
    D.showModal();
  });
}
/* Mail de récupération obligatoire : il est demandé à l'ouverture tant qu'il n'est pas confirmé.
   Sans internet ou si l'envoi échoue, le journal reste accessible : un compte ne perd jamais l'accès à ses notes pour cette raison. */
let differeMail = false, mailPasse = false;
function exigerMail() {
  if (differeMail || mailPasse || !session || !data?.account || $('dialog[open]')) return;
  if (data.account.recup === 'attente') openRecupCode(true);
  else if (!data.account.recup) demanderMail(true);
}
async function demanderMail(oblig) {
  const r = await askRecovery(oblig);
  if (!r) { if (oblig) await lock(); return; }
  const res = await setRecovery(r.email, r.pw, oblig);
  if (res === true || !oblig) return;
  if (res === 'patience') return demanderMail(true);
  mailPasse = true; majRappelRecup();
}
function askRecovery(oblig) {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="recForm">
      <div class="dlg-h"><h2>${data.account?.recup ? 'Changer de' : 'Ajouter un'} ${MAIL_NOM[data.role].toLowerCase()}</h2></div>
      <div class="dlg-b">
        ${data.recupIndice ? `<p class="small muted">Mail actuel : <b>${esc(data.recupIndice)}</b></p>` : ''}
        <p class="small muted">${oblig ? 'Il est obligatoire pour continuer. ' : ''}${MAIL_AIDE[data.role] || MAIL_AIDE.client}</p>
        <label class="label" for="rMail">Adresse e-mail</label>
        <input type="email" id="rMail" autocomplete="email" autocapitalize="none">
        <label class="label" for="rMail2">Confirmez l’adresse</label>
        <input type="email" id="rMail2" autocomplete="off" autocapitalize="none">
        <label class="label" for="rPw">Votre mot de passe</label>
        <input type="password" id="rPw" autocomplete="current-password">
        <div class="err" id="rErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="rCancel">${oblig ? 'Se déconnecter' : 'Annuler'}</button><button class="btn primary">Enregistrer</button></div>
    </form>`;
    const done = v => { D.close(); resolve(v); };
    $('#rCancel').onclick = () => done(null);
    D.oncancel = e => { if (oblig) e.preventDefault(); else resolve(null); };
    $('#recForm').onsubmit = async e => {
      e.preventDefault();
      const m = $('#rMail').value.trim().toLowerCase(), pw = $('#rPw').value, err = $('#rErr');
      if (!EMAIL_RE.test(m)) return err.textContent = 'Adresse e-mail invalide.';
      if (m !== $('#rMail2').value.trim().toLowerCase()) return err.textContent = 'Les deux adresses ne correspondent pas.';
      try { await saveNow(); await openVault(JSON.parse(localStorage.getItem(VKEY)), pw); }
      catch { return err.textContent = 'Mot de passe incorrect.'; }
      done({email:m, pw});
    };
    D.showModal();
  });
}
async function setRecovery(email, pw, oblig) {
  try {
    await API.recup({action:'definir', email});
    // gardée dans le journal chiffré de l'appareil, le temps de pouvoir renvoyer le code
    data.recupMail = email; data.recupEnvoi = new Date().toISOString(); data.recupIndiceNouveau = masque(email);
    await saveNow();
    await ensureSecours(pw);
    openRecupCode(oblig);
    return true;
  } catch (x) {
    toast(ENVOI_ERR[x.code] || 'Mail non enregistré : réessayez plus tard.');
    await ensureSecours(pw);
    return x.code || false;
  }
}
const ENVOI_ERR = {reseau:'Pas de connexion internet.', patience:'Attendez une minute avant un nouvel envoi.', envoi:'L’e-mail n’a pas pu être envoyé : réessayez dans un instant.'};
const recupAConfirmer = () => data?.account?.recup === 'attente' || !!data?.account?.recupChange;
const attenteRenvoi = () => data?.recupEnvoi ? Math.max(0, 60 - Math.floor((Date.now() - new Date(data.recupEnvoi)) / 1000)) : 0;

/* Rappel permanent tant que l'adresse n'est pas confirmée : sans confirmation, aucun code de récupération ne peut partir */
function recupReminder() {
  if (!session) return '';
  if (!data.account?.recup) return `<div class="banner recup-rappel"><span>Ajoutez votre mail de récupération : il est obligatoire pour récupérer votre compte et pour effacer vos données.</span>
    <button class="btn primary" data-act="addRecovery">Ajouter</button></div>`;
  if (!recupAConfirmer()) return '';
  return `<div class="banner recup-rappel"><span>${data.account.recupChange ? 'Votre nouvelle adresse de récupération' : 'Votre adresse de récupération'} n’est pas encore confirmée. Entrez le code reçu par e-mail, et pensez à regarder dans vos courriers indésirables.</span>
    <button class="btn primary" data-act="confirmRecovery">Confirmer</button></div>`;
}
function majRappelRecup() {
  if (!data) return;
  $('.recup-rappel')?.remove();
  if (!src && (view === 'day' || view === 'clients')) $('#view').insertAdjacentHTML('afterbegin', recupReminder());
}
let recupTimer;
function openRecupCode(oblig) {
  const D = $('#codeDlg'), mail = data.recupMail;
  D.innerHTML = `<form method="dialog" id="rcForm">
    <div class="dlg-h"><h2>Confirmez votre adresse</h2></div>
    <div class="dlg-b">
      <p class="small muted">${mail ? `Un code à 6 chiffres a été envoyé à <b>${esc(mail)}</b>.` : 'Entrez le code à 6 chiffres reçu par e-mail.'} Il est valable 30 minutes. <b>Pensez à regarder dans vos courriers indésirables.</b></p>
      <label class="label" for="rcCode">Code de confirmation</label>
      <input type="text" id="rcCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
      <div class="err" id="rcErr"></div>
      <button type="button" class="btn block" id="rcResend"></button>
      ${oblig ? `<button type="button" class="link small" id="rcFix" style="display:block;margin-top:8px">Changer l’adresse mail de récupération</button>
      <button type="button" class="link small" id="rcSkip" hidden style="display:block">Je n’ai rien reçu : continuer pour l’instant</button>` : ''}
    </div>
    <div class="dlg-f"><button type="button" class="btn" id="rcLater">${oblig ? 'Se déconnecter' : 'Plus tard'}</button><button class="btn primary">Confirmer</button></div>
  </form>`;
  const maj = () => {
    const b = $('#rcResend'); if (!b) return clearInterval(recupTimer);
    const s = attenteRenvoi();
    b.disabled = !!mail && s > 0;
    b.textContent = !mail ? 'Saisir de nouveau l’adresse' : s ? `Renvoyer le code dans ${s} s` : 'Renvoyer le code';
    // Un mail qui n'arrive jamais ne doit pas priver de ses notes
    const skip = $('#rcSkip');
    if (skip) skip.hidden = !!data.recupEnvoi && Date.now() - new Date(data.recupEnvoi) < 120000;
  };
  clearInterval(recupTimer); recupTimer = setInterval(maj, 1000); maj();
  const fermer = () => { busy = false; clearInterval(recupTimer); D.close(); };
  D.oncancel = e => { if (oblig) e.preventDefault(); else { busy = false; clearInterval(recupTimer); } };
  $('#rcLater').onclick = async () => { fermer(); if (oblig) await lock(); };
  if (oblig) {
    $('#rcFix').onclick = () => { fermer(); demanderMail(true); };
    $('#rcSkip').onclick = () => { mailPasse = true; fermer(); majRappelRecup(); };
  }
  $('#rcResend').onclick = async () => {
    if (!mail) { fermer(); return oblig ? demanderMail(true) : ACT.addRecovery(); }
    const err = $('#rcErr'); err.textContent = '';
    try { await API.recup({action:'definir', email:mail}); data.recupEnvoi = new Date().toISOString(); save(); maj(); toast('Nouveau code envoyé'); }
    catch (x) { err.textContent = ENVOI_ERR[x.code] || 'Envoi impossible pour le moment.'; }
  };
  $('#rcForm').onsubmit = async e => {
    e.preventDefault();
    const code = $('#rcCode').value.trim(), err = $('#rcErr');
    if (!/^\d{6}$/.test(code)) return err.textContent = 'Entrez les 6 chiffres du code.';
    err.textContent = '';
    try { await API.recup({action:'confirmer', code}); fermer(); await ensureSecours(); toast('Votre adresse de récupération est confirmée'); }
    catch (x) { err.textContent = x.code === 'code' ? 'Code incorrect ou expiré. Vous pouvez en demander un nouveau.' : x.code === 'reseau' ? 'Pas de connexion internet.' : 'Confirmation impossible pour le moment.'; }
  };
  busy = true;   // le temps d'aller chercher le code dans la boîte mail, sans que l'app se verrouille
  D.showModal();
  $('#rcCode').focus();
}
/* Effacer ses données : code reçu par e-mail si une adresse est confirmée, sinon mot de passe.
   L'adresse n'est connue du serveur que par son empreinte : l'utilisateur la retape pour recevoir le code. */
const EFFACER_ERR = {reseau:'Pas de connexion internet.', patience:'Attendez une minute avant un nouvel envoi.', envoi:'L’e-mail n’a pas pu être envoyé : réessayez dans un instant.',
  adresse:'Cette adresse n’est pas votre adresse de récupération confirmée.', limite:'Trop de demandes aujourd’hui : réessayez demain.', code:'Code incorrect ou expiré. Vous pouvez en demander un nouveau.',
  admin:'Le compte administrateur ne peut pas être supprimé depuis l’app.', action:'Cette fonction n’est pas encore activée sur le serveur.',
  pris:'Cet identifiant est déjà utilisé : annulez et choisissez-en un autre.', identifiant:'Identifiant non valable : annulez et choisissez-en un autre.'};
const CODE_EFFACER = {titre:'Confirmer l’effacement', demande:'effacer_demande', confirme:'effacer_confirme', avertissement:'Saisir ce code effacera définitivement vos notes de ce téléphone.', bouton:'Effacer définitivement'};
const CODE_SUPPRIMER = {titre:'Confirmer la suppression', demande:'supprimer_demande', confirme:'supprimer_confirme', avertissement:'Saisir ce code supprimera définitivement votre compte et les données de ce téléphone.', bouton:'Supprimer définitivement'};
function effacerParCode(cfg = CODE_EFFACER) {
  return new Promise(resolve => {
    const dlg = $('#codeDlg');
    let mail = '', envoi = 0, enCours = false, minuteur;
    dlg.innerHTML = `<form method="dialog" id="efForm">
      <div class="dlg-h"><h2>${cfg.titre}</h2></div>
      <div class="dlg-b">
        <p class="small muted" id="efInfo">Pour vérifier que c’est bien vous, entrez votre adresse de récupération : un code à 6 chiffres vous sera envoyé.</p>
        <div id="efMailBloc"><label class="label" for="efMail">Adresse de récupération</label><input type="email" id="efMail" autocomplete="email" autocapitalize="none" placeholder="${esc(data.recupIndice || '')}">
          ${data.recupIndice ? `<div class="small muted" style="margin-top:4px">Pour vous aider : <b>${esc(data.recupIndice)}</b></div>` : ''}</div>
        <div id="efCodeBloc" hidden>
          <label class="label" for="efCode">Code reçu par e-mail</label>
          <input type="text" id="efCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
          <button type="button" class="btn block" id="efResend"></button>
        </div>
        <div class="err" id="efErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="efCancel">Annuler</button><button class="btn primary" id="efOk">Recevoir un code</button></div>
    </form>`;
    const fin = ok => { busy = false; clearInterval(minuteur); dlg.onclose = null; if (dlg.open) dlg.close(); resolve(ok); };
    const err = m => $('#efErr').textContent = m;
    const maj = () => {
      const b = $('#efResend'), s = Math.max(0, 60 - Math.floor((Date.now() - envoi) / 1000));
      if (b) { b.disabled = s > 0; b.textContent = s ? `Renvoyer le code dans ${s} s` : 'Renvoyer le code'; }
    };
    const demander = () => API.recup({action:cfg.demande, email:mail, ...cfg.extra}).then(() => {
      envoi = Date.now(); maj();
      if (!data.recupIndice) { data.recupIndice = masque(mail); save(); syncIndice(); }   // compte confirmé avant l'existence de l'aide-mémoire
    });
    $('#efCancel').onclick = () => fin(false);
    dlg.onclose = () => { if (!dlg.open) fin(false); };   // touche Échap ; la fermeture d'une fenêtre précédente, qui arrive en retard, est ignorée
    $('#efResend').onclick = async () => {
      err('');
      try { await demander(); toast('Nouveau code envoyé'); } catch (x) { err(EFFACER_ERR[x.code] || 'Envoi impossible pour le moment.'); }
    };
    $('#efForm').onsubmit = async e => {
      e.preventDefault();
      if (enCours) return;
      err(''); enCours = true;
      try {
        if (!mail) {
          const m = $('#efMail').value.trim().toLowerCase();
          if (!EMAIL_RE.test(m)) return err('Indiquez votre adresse de récupération.');
          mail = m;
          try { await demander(); } catch (x) { mail = ''; throw x; }
          $('#efMailBloc').hidden = true; $('#efCodeBloc').hidden = false;
          $('#efInfo').innerHTML = `Un code à 6 chiffres a été envoyé à <b>${esc(mail)}</b>. Il est valable 15 minutes. <b>Pensez à regarder dans vos courriers indésirables.</b><br>${cfg.avertissement}`;
          $('#efOk').textContent = cfg.bouton; $('#efOk').className = `btn ${cfg.classe || 'danger'}`;
          minuteur = setInterval(maj, 1000);
          return;
        }
        const code = $('#efCode').value.trim();
        if (!/^\d{6}$/.test(code)) return err('Entrez les 6 chiffres du code.');
        await API.recup({action:cfg.confirme, code, email:mail, ...cfg.extra});
        fin(true);
      } catch (x) { err(EFFACER_ERR[x.code] || 'Action impossible pour le moment.'); }
      finally { enCours = false; }
    };
    busy = true;   // le temps d'aller chercher le code dans la boîte mail, sans que l'app se verrouille
    dlg.showModal();
    $('#efMail').focus();
  });
}
async function confirmerEffacement() {
  let confirmee = !!data.account.recup && data.account.recup !== 'attente';
  if (session) { try { confirmee = !!(await API.rpc('ma_recuperation_etat'))?.confirmee; } catch {} }
  if (confirmee) {
    if (session) return effacerParCode();
    toast('Connexion internet nécessaire pour recevoir le code.');
    return false;
  }
  const pw = await askCode('Confirmer l’effacement', {label:'Mot de passe', hint:'Votre mail de récupération n’est pas encore confirmé : entrez votre mot de passe pour effacer définitivement vos notes de ce téléphone.'});
  if (pw == null) return false;
  try { await saveNow(); await openVault(JSON.parse(localStorage.getItem(VKEY)), pw); return true; }
  catch { toast('Mot de passe incorrect : rien n’a été effacé.'); return false; }
}

/* Changer de mot de passe : d'abord prouver que c'est bien soi. Par défaut, le mot de passe actuel, vérifié en ouvrant le journal
   de l'appareil (il est chiffré avec lui) ; sinon, un code reçu sur l'adresse de récupération confirmée (mot de passe oublié).
   Renvoie true quand l'un ou l'autre est confirmé. */
const CODE_MDP = {titre:'Confirmer par e-mail', demande:'mdp_demande', confirme:'mdp_confirme', avertissement:'Vous choisirez ensuite votre nouveau mot de passe.', bouton:'Continuer', classe:'primary'};
function verifierAvantMdp() {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="vmForm">
      <div class="dlg-h"><h2>Changer mon mot de passe</h2></div>
      <div class="dlg-b">
        <p class="small muted" style="margin:0">Pour commencer, confirmez que c’est bien vous.</p>
        <label class="label" for="vmMdp">Mot de passe actuel</label>
        <input type="password" id="vmMdp" autocomplete="current-password">
        <div class="err" id="vmErr"></div>
        <p class="small muted" style="margin:6px 0 0">Mot de passe oublié ? <button type="button" class="link small" id="vmMail">Confirmer plutôt par e-mail</button></p>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="vmNon">Annuler</button><button class="btn primary" id="vmOk">Continuer</button></div>
    </form>`;
    let fait = false;
    const fin = ok => { if (fait) return; fait = true; D.onclose = D.oncancel = null; if (D.open) D.close(); resolve(ok); };
    const err = m => $('#vmErr').textContent = m;
    D.oncancel = null; D.onclose = () => fin(false);   // touche Échap, ou fenêtre fermée autrement
    $('#vmNon').onclick = () => fin(false);
    $('#vmMail').onclick = async () => {
      err('');
      let confirmee = !!data.account?.recup && data.account.recup !== 'attente';
      try { confirmee = !!(await API.rpc('ma_recuperation_etat'))?.confirmee; } catch {}
      if (!confirmee) return err('Aucune adresse de récupération confirmée : un code ne peut pas vous être envoyé. Utilisez votre mot de passe actuel (l’adresse s’ajoute dans Paramètres › Informations personnelles).');
      fait = true; D.onclose = D.oncancel = null; D.close();
      resolve(await effacerParCode(CODE_MDP));
    };
    $('#vmForm').onsubmit = async e => {
      e.preventDefault();
      const pw = $('#vmMdp').value, ok = $('#vmOk');
      if (!pw) return err('Tapez votre mot de passe actuel.');
      ok.disabled = true; ok.textContent = 'Vérification…'; err('');
      try { await saveNow(); await openVault(JSON.parse(localStorage.getItem(VKEY)), pw); }
      catch { ok.disabled = false; ok.textContent = 'Continuer'; return err('Ce n’est pas votre mot de passe actuel.'); }
      fin(true);
    };
    D.showModal();
  });
}

/* Nom, prénom ou identifiant : le mot de passe confirme la modification (ACT.modifierIdentite) */
function formIdentite() {
  return new Promise(resolve => {
    const D = $('#codeDlg'), p = data.profile, a = data.account;
    D.innerHTML = `<form method="dialog" id="idForm">
      <div class="dlg-h"><h2>Modifier mes informations</h2></div>
      <div class="dlg-b">
        <div class="row">
          <div><label class="label" for="idPrenom">Prénom</label><input type="text" id="idPrenom" value="${esc(p.prenom)}" autocomplete="given-name"></div>
          <div><label class="label" for="idNom">Nom</label><input type="text" id="idNom" value="${esc(p.nom)}" autocomplete="family-name"></div>
        </div>
        <label class="label" for="idId">Identifiant de connexion</label>
        <input type="text" id="idId" value="${esc(a.identifiant)}" autocapitalize="none" spellcheck="false" autocomplete="username">
        <p class="small muted" style="margin:6px 0 0">Un nouvel identifiant remplace l’ancien pour vous connecter, sur tous vos appareils. Vos notes ne changent pas.</p>
        <div class="err" id="idErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="idNon">Annuler</button><button class="btn primary">Continuer</button></div>
    </form>`;
    const fin = v => { D.oncancel = null; if (D.open) D.close(); resolve(v); };
    $('#idNon').onclick = () => fin(null);
    D.oncancel = () => resolve(null);
    $('#idId').oninput = e => { const v = e.target.value.replace(/\s/g, '').toLowerCase(); if (v !== e.target.value) e.target.value = v; };
    $('#idForm').onsubmit = e => {
      e.preventDefault();
      const v = {prenom:$('#idPrenom').value.trim(), nom:$('#idNom').value.trim(), identifiant:$('#idId').value.trim()}, err = m => $('#idErr').textContent = m;
      if (!v.prenom || !v.nom) return err('Indiquez votre prénom et votre nom.');
      if (!ID_RE.test(v.identifiant)) return err('Identifiant : 3 à 30 caractères, lettres minuscules, chiffres, point ou tiret.');
      if (v.prenom === p.prenom && v.nom === p.nom && v.identifiant === a.identifiant) return err('Vous n’avez rien modifié.');
      fin(v);
    };
    D.showModal();
  });
}
/* Le journal de cet appareil est rangé sous l'identifiant : il change d'emplacement avec lui.
   La copie est relue avec la clé du journal avant que l'ancien emplacement soit retiré. */
async function renommerStockage(ancien, nouveau) {
  if (ancien === nouveau) return;
  for (const f of [secoursKey, indiceKey]) { const v = localStorage.getItem(f(ancien)); if (v != null) localStorage.setItem(f(nouveau), v); }
  VKEY = vaultKey(nouveau); data.account.identifiant = nouveau;
  await saveNow();
  const v = JSON.parse(localStorage.getItem(VKEY));
  await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(v.iv)}, key, fromB64(v.ct));   // échoue si la copie est illisible : l'ancienne reste
  for (const k of [vaultKey(ancien), 'journal-emotions.vault.' + ancien, secoursKey(ancien), indiceKey(ancien)]) localStorage.removeItem(k);
  if (localStorage.getItem(LAST_ID) === ancien) localStorage.setItem(LAST_ID, nouveau);
  if (data.settings.autolock === -1) await rememberKey().catch(() => {});
}
/* Identifiant changé depuis un autre appareil (ou dans l'autre app de l'iPhone) : le journal d'ici est encore sous l'ancien.
   On le reconnaît à son code utilisateur, après l'avoir ouvert avec le mot de passe. */
async function reprendreJournal(id, pw) {
  const P = 'journal-emotions.donnees.';
  if (!profil?.numero) return null;
  for (const k of Object.keys(localStorage).filter(k => k.startsWith(P) && k !== vaultKey(id))) {
    let r;
    try { r = await openVault(JSON.parse(localStorage.getItem(k)), pw); } catch { continue; }
    if (!memeCode(depuisFichier(r.obj).account?.numero, profil.numero)) continue;
    const ancien = k.slice(P.length);
    localStorage.setItem(vaultKey(id), localStorage.getItem(k));
    for (const f of [secoursKey, indiceKey]) { const v = localStorage.getItem(f(ancien)); if (v != null) localStorage.setItem(f(id), v); }
    for (const x of [k, 'journal-emotions.vault.' + ancien, secoursKey(ancien), indiceKey(ancien)]) localStorage.removeItem(x);
    return localStorage.getItem(vaultKey(id));
  }
  return null;
}
/* Supprimer son compte : le serveur supprime d'abord le compte et ses données ; l'appareil n'est vidé qu'ensuite.
   Si le serveur refuse ou ne répond pas, rien n'est effacé. */
async function supprimerCompte() {
  if (!session) return toast('Connexion internet nécessaire pour supprimer votre compte.');
  if (data.account?.est_admin) return toast(EFFACER_ERR.admin);
  const th = data.role === 'therapeute';
  if (!confirm(`Supprimer définitivement votre compte Motus ?\n\nVotre compte, vos données sur le serveur et ${th ? 'vos fiches clients, les données reçues et votre clé de déchiffrement' : 'toutes vos notes'} sur ce téléphone seront effacés. Cette action est irréversible.`)) return;
  let ok = false;
  try {
    if ((await API.rpc('ma_recuperation_etat'))?.confirmee) ok = await effacerParCode(CODE_SUPPRIMER);
    else {
      const pw = await askCode('Confirmer la suppression', {label:'Mot de passe', hint:'Votre mail de récupération n’est pas confirmé : entrez votre mot de passe pour supprimer définitivement votre compte.'});
      if (pw == null) return;
      await API.recup({action:'supprimer_mdp', mot_de_passe:pw});
      ok = true;
    }
  } catch (x) { return toast(x.code === 'mot_de_passe' ? 'Mot de passe incorrect : rien n’a été supprimé.' : EFFACER_ERR[x.code] || 'Suppression impossible pour le moment : rien n’a été supprimé.'); }
  if (!ok) return;
  await oublierCompte();
}
/* Retire de cet appareil tout ce qui concerne le compte. Le choix d'apparence, qui ne concerne que l'appareil, reste. */
async function oublierCompte() {
  const id = data.account.identifiant;
  // le compte n'existe plus : chaque thérapeute ou client lié en est prévenu
  if (data.therapist?.canal) await rompreCanal(data.therapist.canal, 'client');
  for (const c of Object.values(data.clients)) if (c.canal && c.statut !== 'ancien') await rompreCanal(c.canal, 'therapeute');
  clearTimeout(saveTimer); clearTimeout(profTimer);
  key = null;   // plus aucun enregistrement ne peut recréer le fichier
  await savePending.catch(() => {});
  await forgetKey();
  [vaultKey(id), 'journal-emotions.vault.' + id, secoursKey(id), indiceKey(id)].forEach(k => localStorage.removeItem(k));
  if (localStorage.getItem(LAST_ID) === id) localStorage.removeItem(LAST_ID);
  session = null; profil = null; salt = null; data = null; src = null; VKEY = null; mailPasse = false; adm = admInit();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('#view').innerHTML = '';
  showLock();
  $('#lockErr').textContent = 'Votre compte et vos données ont été supprimés de ce téléphone et du serveur.';
  $('#lockErr').style.color = 'var(--text)';
}
let recupId = '';
async function onForgot(e) {
  e.preventDefault();
  const id = $('#fId').value.trim().toLowerCase(), m = $('#fMail').value.trim().toLowerCase(), err = $('#lockErr'), btn = $('#forgotBtn');
  if (!id || !EMAIL_RE.test(m)) return err.textContent = 'Indiquez votre identifiant et votre adresse de récupération.';
  btn.disabled = true; err.textContent = '';
  try { await API.recup({action:'demande', identifiant:id, email:m}); recupId = id; showLock('code'); }
  catch (x) { btn.disabled = false; err.textContent = x.code === 'reseau' ? 'Pas de connexion internet.' : 'Envoi impossible pour le moment. Réessayez plus tard.'; }
}
async function onResetCode(e) {
  e.preventDefault();
  const code = $('#cCode').value.trim(), pw = $('#cPw').value, err = $('#lockErr'), btn = $('#codeBtn');
  if (!code) return err.textContent = 'Entrez le code reçu par e-mail.';
  if (pw.length < 8) return err.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
  if (pw !== $('#cPw2').value) return err.textContent = 'Les deux mots de passe ne correspondent pas.';
  btn.disabled = true; err.textContent = '';
  try {
    const r = await API.recup({action:'confirme', identifiant:recupId, code, mot_de_passe:pw});
    const repris = await rescueJournal(recupId, r.cle_secours, pw);
    if (!repris && localStorage.getItem(vaultKey(recupId))) toast('Le journal de cet appareil n’a pas pu être repris.');
    showLock('login');
    $('#lId').value = recupId; $('#lPw').value = pw;
    $('#loginForm').requestSubmit();
  } catch (x) {
    btn.disabled = false;
    err.textContent = {code:'Code incorrect ou expiré.', faible:'Mot de passe trop simple.', reseau:'Pas de connexion internet.'}[x.code] || 'Récupération impossible pour le moment.';
  }
}

/* « Rester connecté » (déconnexion automatique : Jamais) : la clé du journal, non exportable, reste dans ce
   navigateur ; le jeton de connexion au serveur est enregistré dans le journal chiffré. */
function keyDb(mode, fn) {
  return new Promise((ok, ko) => {
    const o = indexedDB.open('journal-emotions', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('cle');
    o.onerror = () => ko(o.error);
    o.onsuccess = () => {
      const t = o.result.transaction('cle', mode), r = fn(t.objectStore('cle'));
      t.oncomplete = () => { o.result.close(); ok(r.result); };
      t.onerror = t.onabort = () => { o.result.close(); ko(t.error); };
    };
  });
}
const rememberKey = () => keyDb('readwrite', s => s.put({id:data.account.identifiant, key}, 'courante'));
const forgetKey = () => keyDb('readwrite', s => s.delete('courante')).catch(() => {});
function rememberSession() {
  if (data?.settings.autolock !== -1) return;
  const t = API.token();
  if (t) { data.resume = t; save(); }
}
async function setAutolock(t) {
  const v = +t.value;
  if (v === -1 && !confirm('Rester connecté sur cet appareil ?\n\nToute personne ayant accès à ce téléphone déverrouillé pourra ouvrir votre journal sans mot de passe. À éviter sur un appareil partagé.')) {
    t.value = data.settings.autolock; return;
  }
  data.settings.autolock = v;
  try {
    if (v === -1) { await rememberKey(); rememberSession(); }
    else { await forgetKey(); delete data.resume; }
  } catch { data.settings.autolock = 1; t.value = 1; toast('Ce navigateur ne permet pas de rester connecté.'); }
  save();
}
/* À l'ouverture : journal rouvert sans mot de passe si l'utilisateur a choisi de rester connecté */
async function boot() {
  migrerStockage();
  if (!doitInstaller()) {   // sur Android, l'app installée peut retrouver une invitation ouverte dans le navigateur
    pendingInv ||= localStorage.getItem(INVIT);
    localStorage.removeItem(INVIT);
  }
  const s = await keyDb('readonly', st => st.get('courante')).catch(() => null);
  if (!s) return showLock();
  try {
    const v = JSON.parse(localStorage.getItem(vaultKey(s.id)));
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(v.iv)}, s.key, fromB64(v.ct));
    VKEY = vaultKey(s.id); key = s.key; salt = fromB64(v.salt); data = defaults(JSON.parse(dec.decode(pt)));
  } catch { await forgetKey(); return showLock(); }
  showApp();
  countStat('connexions');   // une ouverture de l'app, comptée même sans internet
  if (await exigerRgpd() && await exigerEssai()) syncSession();
}
/* En arrière-plan : reprend la connexion au serveur. Sans internet, le journal reste simplement ouvert. */
async function syncSession() {
  if (!data?.resume) return;
  try {
    await API.resume(data.resume);
    profil = await API.rpc('ouvrir_session');
    if (!data) return;
    if (!profil?.id) return lock(LOGIN_ERR.desactive);   // ancien serveur (serveur/compte-desactive.sql pas exécuté) : un compte désactivé est refusé
    const role = data.role, ici = VKEY.slice(vaultKey('').length), lecture = !!data.account?.lecture;
    applyProfil(); rememberSession();
    if (data.account.identifiant !== ici) await renommerStockage(ici, data.account.identifiant).catch(console.error);   // identifiant changé ailleurs
    if (data.role !== role) showApp();
    else {
      if (lecture !== !!data.account.lecture) render(true);   // compte désactivé ou réactivé depuis la dernière ouverture
      renderNav(); markTabs();
      // journal rouvert avant la reprise de la connexion : le rappel n'a pas encore pu s'afficher
      const rappel = !src && (view === 'day' || view === 'clients') && !$('.admin-rappel') ? adminReminder() : '';
      if (rappel) $('#view').insertAdjacentHTML('afterbegin', rappel);
    }
    pushProfile(); flushStats(); envoyerConsentement(); assurerLienCourt(); synchroCanaux(true); ensureSecours().then(ok => ok && exigerMail());
    if (pendingInv && !doitInstaller()) { const c = pendingInv; pendingInv = null; offerInvite(c); }   // lien court ouvert avant la reprise de la connexion
  } catch (x) {
    if (!data) return;
    if (x.code === 'desactive') lock(LOGIN_ERR.desactive);
    else if (x.code === 'session') lock('Votre session a expiré : reconnectez-vous.');
  }
}

/* Sauvegarde : le fichier est chiffré avec le mot de passe actuel, qui sera demandé pour l'ouvrir. On le fait donc d'abord
   taper, et on vérifie qu'il ouvre bien le journal de cet appareil (donc la sauvegarde). Ensuite seulement, un second appui
   enregistre le fichier : le menu de partage du téléphone doit s'ouvrir directement après un appui (l'iPhone le refuse après
   une attente). Rappel si la dernière sauvegarde date de plus de 7 jours. */
const SAUVEGARDE_JOURS = 7;
const aDesDonnees = () => Object.values(data.days).some(dayFilled) || Object.keys(data.clients).length > 0;
const joursDepuis = iso => Math.floor((Date.now() - new Date(iso)) / 864e5);
function sauvegardeReminder() {
  if (!aDesDonnees() || data.backupPlusTard === today()) return '';
  const premier = Object.keys(data.days).filter(k => dayFilled(data.days[k])).sort()[0];
  const j = data.backupAt ? joursDepuis(data.backupAt) : premier ? joursDepuis(parse(premier)) : SAUVEGARDE_JOURS + 1;
  if (j <= SAUVEGARDE_JOURS) return '';
  return `<div class="banner sauvegarde-rappel"><span>${data.backupAt ? `Dernière sauvegarde il y a ${j} jours.` : 'Aucune sauvegarde pour l’instant.'} Sans sauvegarde, vos notes seraient perdues avec votre téléphone.</span>
    <div class="banner-actions"><button class="btn primary" data-act="backup">Sauvegarder</button><button class="link small" data-act="backupLater">Plus tard</button></div></div>`;
}
function sauvegarder() {
  const contenu = localStorage.getItem(VKEY);
  if (!contenu) return toast('Rien à sauvegarder pour le moment.');
  const D = $('#codeDlg');
  D.innerHTML = `<form method="dialog" id="svForm">
    <div class="dlg-h"><h2>Créer une sauvegarde</h2></div>
    <div class="dlg-b" id="svCorps">
      <p class="small muted" style="margin:0">La sauvegarde est chiffrée avec votre mot de passe actuel : <b>il vous sera demandé pour l’ouvrir</b>, même sur un autre téléphone. Tapez-le pour vérifier que vous vous en souvenez.</p>
      <label class="label" for="svMdp">Mot de passe actuel</label>
      <input type="password" id="svMdp" autocomplete="current-password">
      <div class="err" id="svErr"></div>
      <p class="small muted" id="svOubli" hidden style="margin:4px 0 0">Mot de passe oublié ? <button type="button" class="link small" id="svChanger">Choisissez-en un nouveau</button>, puis refaites la sauvegarde.</p>
    </div>
    <div class="dlg-f"><button type="button" class="btn" id="svNon">Annuler</button><button class="btn primary" id="svOk">Vérifier</button></div>
  </form>`;
  let verifie = false, essais = 0;
  const ok = $('#svOk');
  D.onclose = D.oncancel = null;   // rien d'une fenêtre précédente ne doit réagir à la fermeture de celle-ci
  $('#svNon').onclick = () => D.close();
  $('#svChanger').onclick = () => { D.close(); view = 'set'; setPage = 'secu'; render(); };
  $('#svForm').onsubmit = async e => {
    e.preventDefault();
    if (verifie) return;
    const pw = $('#svMdp').value;
    if (!pw) return $('#svErr').textContent = 'Tapez votre mot de passe.';
    ok.disabled = true; ok.textContent = 'Vérification…'; $('#svErr').textContent = '';
    try { await openVault(JSON.parse(contenu), pw); }
    catch {
      ok.disabled = false; ok.textContent = 'Vérifier'; essais++;
      $('#svErr').textContent = 'Ce n’est pas votre mot de passe actuel : la sauvegarde ne pourrait pas s’ouvrir avec lui.';
      if (essais >= 2) $('#svOubli').hidden = false;
      return;
    }
    verifie = true;
    $('#svCorps').innerHTML = `<p class="small" style="margin:0"><b>✓ Mot de passe vérifié.</b></p>
      <p class="small muted" style="margin:8px 0 0">Gardez-le en lieu sûr : sans lui, cette sauvegarde ne pourra pas être ouverte. Si vous le changez plus tard, cette sauvegarde s’ouvrira toujours avec celui-ci.</p>`;
    ok.disabled = false; ok.textContent = 'Enregistrer la sauvegarde'; ok.type = 'button';
    ok.onclick = () => { D.close(); enregistrerSauvegarde(contenu); };   // dans l'appui même : le menu de partage peut s'ouvrir
  };
  D.showModal();
}
async function enregistrerSauvegarde(contenu) {
  const name = `motus-sauvegarde_${today()}.json`, file = new File([contenu], name, {type:'application/json'});
  busy = true;
  try {
    if (navigator.canShare?.({files:[file]})) await navigator.share({files:[file], title:'Sauvegarde Motus'});
    else download(file, name);
  } catch (err) {
    if (err.name === 'AbortError') return;   // annulé par l'utilisateur : le rappel reste affiché
    download(file, name);
  } finally { setTimeout(() => busy = false, 1500); }
  data.backupAt = new Date().toISOString(); delete data.backupPlusTard;
  await saveNow();
  $('.sauvegarde-rappel')?.remove();
  if (view === 'set' && !src) render(true);
  toast('Sauvegarde créée. Elle s’ouvre avec le mot de passe que vous venez de taper.');
}

async function lock(msg) {
  if (!key) return;
  await flushStats();
  delete data.resume; await forgetKey(); await saveNow();
  API.signOut(); profil = null; mailPasse = false;
  key = null; salt = null; data = null; src = null; VKEY = null; adm = admInit();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('#view').innerHTML = '';
  showLock();
  if (msg) { const e = $('#lockErr'); if (e) e.textContent = msg; else toast(msg); }
}

let swReg = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); if (key) saveNow(); return; }
  swReg?.update().catch(() => {});   // l'app revient au premier plan : y a-t-il une nouvelle version ?
  if (key && !busy && data.settings.autolock >= 0 && Date.now() - hiddenAt >= data.settings.autolock * 60000) lock();
  else if (key && !doitInstaller()) {
    synchroCanaux();   // coordonnées et ruptures, au plus une fois par minute
    if (Date.now() - hiddenAt >= 5 * 60000) countStat('connexions');   // retour dans l'app après une vraie pause : une nouvelle ouverture
    verifierCompte();
  }
});
/* Retour au premier plan : le compte a-t-il été désactivé ou réactivé depuis ? (au plus une fois par minute). Sans cela, une app
   restée ouverte sur le téléphone ne l'apprendrait qu'à sa prochaine ouverture complète. */
let verifieA = 0;
async function verifierCompte() {
  if (!session || !data || Date.now() - verifieA < 60000) return;
  verifieA = Date.now();
  try {
    const p = await API.rpc('ouvrir_session');
    if (!data || !p?.id) return;
    const avant = !!data.account?.lecture, role = data.role;
    profil = p; applyProfil(); save();
    if (data.role !== role) showApp(); else if (avant !== !!data.account.lecture) render(true);
  } catch {}
}
window.addEventListener('pagehide', () => { if (key) saveNow(); });

