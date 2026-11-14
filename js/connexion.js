// Motus — Écran de connexion et d'inscription, installation sur téléphone
'use strict';

/* ───────────── Connexion et inscription ───────────── */
let fails = 0, blockedUntil = 0, busy = false, hiddenAt = 0;
const LAST_ID = 'journal-emotions.dernier-identifiant';

/* ───────────── Installation sur téléphone ─────────────
   Le navigateur et l'app de l'écran d'accueil ne partagent pas leurs notes sur iPhone : sur téléphone, Motus s'utilise donc depuis l'écran d'accueil.
   Un navigateur qui contient déjà des notes permet seulement de les sauvegarder, pour ne jamais les rendre inaccessibles.
   Un lien ne peut pas ouvrir l'app installée sur iPhone : une invitation reçue se copie, puis se colle dans l'app. */
const NAV_OK = 'journal-emotions.navigateur-accepte', INVIT = 'journal-emotions.invitation';
let recupNotes = false;
const surIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const surAndroid = () => /Android/.test(navigator.userAgent);
/* Samsung Internet : Google Play Protect bloque parfois l'app qu'il crée (« Appli non sécurisée bloquée ») ; avec Chrome, l'installation se passe bien */
const surSamsung = () => surAndroid() && /SamsungBrowser/.test(navigator.userAgent);
const appInstallee = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || document.referrer.startsWith('android-app://');
const doitInstaller = () => (surIOS() || surAndroid()) && !appInstallee() && !localStorage.getItem(NAV_OK);
const notesIci = () => Object.keys(localStorage).some(k => k.startsWith('journal-emotions.donnees.') || k.startsWith('journal-emotions.vault.'));
/* Navigateur intégré à une autre app (WhatsApp, Instagram, Gmail…) : on ne peut pas y installer Motus */
function navIntegre() {
  const u = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|Line\/|MicroMessenger|LinkedInApp|GSA\/|; wv\)/.test(u) || (surIOS() && !/Safari\//.test(u));
}
const lienInvitation = () => `${location.origin}${location.pathname}${lienTh ? `#t=${lienTh}` : pendingInv ? `#${CODE_COURT.test(pendingInv) ? 'i' : 'inv'}=${pendingInv}` : ''}`;

/* ───────────── Compte thérapeute (v46) ─────────────
   L'inscription ordinaire crée un compte utilisateur. Un compte thérapeute ne se crée qu'avec un lien personnel que
   l'administrateur crée dans sa page Admin (#t= suivi de 32 caractères) : à usage unique, valable 30 jours, vérifié par le
   serveur (serveur/lien-therapeute.sql), qui refuse toute autre inscription de thérapeute.
   lienTh : le code reçu ; lienThOk : sa date de fin, une fois vérifié ; lienThMsg : pourquoi il n'a pas pu servir.
   Le navigateur d'un téléphone garde le code pour l'app installée (Android) ; sur iPhone, ils ne partagent rien : le lien se
   copie, puis se colle dans le champ Identifiant (lienDansIdentifiant). Un utilisateur ne voit jamais de mention des
   thérapeutes en se connectant ou en créant son compte (sa demande du 2026-11-11). */
const LIEN_TH = 'journal-emotions.lien-therapeute';
let lienTh = null, lienThOk = null, lienThMsg = '';
try { lienTh = localStorage.getItem(LIEN_TH); } catch {}
const LIEN_TH_MSG = {
  invalide: 'Ce lien de création de compte thérapeute n’est plus valable : déjà utilisé, retiré ou expiré. Demandez-en un nouveau à l’administrateur de Motus.',
  reseau: 'Pas de connexion internet : impossible de vérifier votre lien thérapeute.',
  serveur: 'Votre lien thérapeute n’a pas pu être vérifié pour le moment. Réessayez plus tard.',
};
function oublierLienTh() { lienTh = lienThOk = null; try { localStorage.removeItem(LIEN_TH); } catch {} }
async function verifierLienTh(code) {
  lienTh = code.toLowerCase(); lienThOk = null; lienThMsg = '';
  try { localStorage.setItem(LIEN_TH, lienTh); } catch {}
  try {
    const r = await API.rpcAnon('lien_therapeute_valable', {p_code:lienTh});
    if (r?.expire_le) { lienThOk = r.expire_le; return true; }
    oublierLienTh(); lienThMsg = LIEN_TH_MSG.invalide;
  } catch (x) { lienThMsg = LIEN_TH_MSG[x.code === 'reseau' ? 'reseau' : 'serveur']; }
  return false;
}
function etapesInstall() {
  const u = navigator.userAgent, autre = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(u);
  const e = surIOS() ? [
    /FxiOS/.test(u) ? 'Touchez le menu ☰, puis « Partager ».' : 'Touchez le bouton Partager (le carré avec une flèche).',
    'Choisissez « Sur l’écran d’accueil ». Faites défiler la liste si besoin.',
    'Si c’est proposé, laissez « Ouvrir en tant qu’app web » activé, puis touchez « Ajouter ».',
    'Ouvrez Motus depuis sa nouvelle icône.',
  ] : [
    'Ouvrez le menu de votre navigateur (⋮ ou ☰).',
    'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    'Confirmez, puis ouvrez Motus depuis sa nouvelle icône.',
  ];
  return `<ol class="etapes">${e.map(x => `<li>${x}</li>`).join('')}</ol>${surIOS() && autre ? '<p class="small muted">Vous ne trouvez pas cette option ? Ouvrez cette page dans Safari.</p>' : ''}`;
}
function blocInstall() {
  if (navIntegre()) return `<section class="card">
    <h2>Ouvrez d’abord votre navigateur</h2>
    <p class="small muted" style="margin:6px 0 0">Motus ne peut pas s’installer depuis cette app. Ouvrez le menu (⋯ ou ⋮), puis « Ouvrir dans ${surIOS() ? 'Safari' : 'le navigateur'} ». Si cette option n’existe pas, copiez le lien et collez-le dans votre navigateur.</p>
    <button class="btn block" data-act="copierLien">Copier le lien</button>
  </section>`;
  if (surSamsung()) return `<section class="card">
    <h2>Installez Motus avec Chrome</h2>
    <p class="small muted" style="margin:6px 0 0">Depuis Samsung Internet, Google Play Protect bloque parfois l’installation des apps web comme Motus (« Appli non sécurisée bloquée »). Avec Chrome, l’installation se fait normalement.</p>
    <a class="btn primary block" href="intent://${esc(location.host + location.pathname)}#Intent;scheme=https;package=com.android.chrome;end">Ouvrir dans Chrome</a>
    ${pendingInv ? '<p class="small muted" style="margin:8px 0 0">Copiez d’abord votre invitation : vous la collerez ensuite dans Motus.</p>' : ''}
    <button class="btn block" data-act="copierLien">${pendingInv ? 'Copier l’invitation' : 'Copier le lien'}</button>
  </section>`;
  return `<section class="card">
    <h2>Installer Motus</h2>
    ${installEvt ? '<button class="btn primary block" data-act="install">Installer Motus</button>' : etapesInstall()}
  </section>`;
}
function showInstall() {
  $('#app').hidden = true;
  if (pendingInv) localStorage.setItem(INVIT, pendingInv);
  const L = $('#lock'); L.hidden = false;
  L.innerHTML = `<div class="lockcard install">
    <img class="logo" src="icon-192.png" alt="">
    <h1>Motus s’utilise depuis votre écran d’accueil</h1>
    <p class="muted">Cela protège vos notes et garde tout au même endroit.</p>
    ${lienTh ? `<section class="card">
      <h2>Votre lien pour créer un compte thérapeute</h2>
      <p class="small muted" style="margin:6px 0 0">Copiez d’abord ce lien. Puis ouvrez Motus depuis son icône (installez-le si besoin) et collez-le dans le champ « Identifiant » : le formulaire de votre compte thérapeute s’ouvrira.</p>
      <button class="btn primary block" data-act="copierLien">Copier le lien</button>
    </section>` : pendingInv ? `<section class="card">
      <h2>Vous avez reçu une invitation</h2>
      <p class="small muted" style="margin:6px 0 0">Motus est déjà installé ? Copiez l’invitation, ouvrez Motus depuis votre écran d’accueil, puis collez-la dans Paramètres › Mon thérapeute. Sinon, installez d’abord Motus.</p>
      <button class="btn primary block" data-act="copierLien">Copier l’invitation</button>
    </section>` : '<p class="small muted">Motus est déjà installé ? Fermez cette page et ouvrez-le depuis son icône.</p>'}
    ${blocInstall()}
    ${notesIci() ? `<section class="card">
      <h2>Vous avez déjà des notes dans ce navigateur</h2>
      <p class="small muted" style="margin:6px 0 0">Connectez-vous pour les sauvegarder, puis les retrouver dans l’app.</p>
      <button class="btn block" data-act="recupNotes">Récupérer mes notes</button>
    </section>` : ''}
    <p class="small"><button class="link small" data-act="navQuandMeme">Impossible d’installer Motus sur ce téléphone ?</button></p>
  </div>`;
}
/* Connecté depuis un navigateur de téléphone : seulement pour emporter ses notes vers l'app */
function showTransfert() {
  $('#app').hidden = true;
  const L = $('#lock'); L.hidden = false;
  L.innerHTML = `<div class="lockcard install">
    <h1>Récupérez vos notes</h1>
    <section class="card">
      <h2>1. Sauvegardez vos notes</h2>
      <p class="small muted" style="margin:6px 0 0">Enregistrez le fichier sur ce téléphone, par exemple dans Fichiers. Il reste chiffré avec votre mot de passe.</p>
      <button class="btn primary block" data-act="backup">Sauvegarder mes notes</button>
    </section>
    ${blocInstall().replace('Installer Motus</h2>', '2. Installez Motus</h2>')}
    <section class="card">
      <h2>3. Retrouvez vos notes dans l’app</h2>
      <p class="small muted" style="margin:6px 0 0">Connectez-vous depuis l’icône. Si vos notes n’y sont pas, ouvrez Paramètres › Sauvegarde › Restaurer et choisissez le fichier.</p>
    </section>
    <button class="btn block" data-act="lockNow">Se déconnecter</button>
    <p class="small"><button class="link small" data-act="navQuandMeme">Impossible d’installer Motus sur ce téléphone ?</button></p>
  </div>`;
}

function showLock(mode = 'login') {
  if (doitInstaller() && !recupNotes) return showInstall();
  $('#app').hidden = true;
  const L = $('#lock'); L.hidden = false;
  if (!window.crypto?.subtle) {
    L.innerHTML = `<div class="lockcard"><h1>Connexion non sécurisée</h1><p class="muted">Cette application doit être ouverte via une adresse <b>https://</b> pour pouvoir chiffrer vos notes.</p></div>`;
    return;
  }
  const demo = DEMO ? '<div class="warn">Mode démonstration : en attendant le serveur, les comptes sont simulés dans ce navigateur.</div>' : '';
  const inv = pendingInv ? '<div class="warn">Vous avez reçu une invitation de votre thérapeute : connectez-vous ou créez votre compte, elle vous sera proposée juste après.</div>' : '';
  // un lien thérapeute reçu se vérifie avant d'ouvrir son formulaire (une seule fois : un échec affiche le formulaire utilisateur)
  if (mode === 'signup' && lienTh && !lienThOk && !lienThMsg) {
    L.innerHTML = `<div class="lockcard"><img class="logo" src="icon-192.png" alt=""><h1>Créer un compte thérapeute</h1><p class="muted">Vérification de votre lien…</p></div>`;
    verifierLienTh(lienTh).then(() => showLock('signup'));
    return;
  }
  const th = mode === 'signup' && !!lienThOk;   // formulaire thérapeute : seulement avec un lien vérifié
  if (mode === 'forgot' || mode === 'code') {
    L.innerHTML = mode === 'forgot' ? `
    <div class="lockcard">
      <img class="logo" src="icon-192.png" alt="">
      <h1>Mot de passe oublié</h1>
      <p class="muted">Entrez votre identifiant et l’adresse de récupération confirmée de votre compte. Si elle correspond, vous recevrez un code à 6 chiffres par e-mail.</p>
      <form id="forgotForm">
        <label class="label" for="fId">Identifiant</label>
        <input type="text" id="fId" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(localStorage.getItem(LAST_ID) || '')}">
        <label class="label" for="fMail">Adresse de récupération</label>
        <input type="email" id="fMail" autocomplete="email" autocapitalize="none">
        <div class="small muted" id="fIndice" style="margin-top:4px"></div>
        <div class="err" id="lockErr"></div>
        <button class="btn primary block" id="forgotBtn">Recevoir un code</button>
      </form>
      <p class="small muted" style="margin-top:18px">Sans adresse de récupération enregistrée, aucun code ne peut être envoyé : demandez à l’administrateur de supprimer le compte, puis créez-en un nouveau. Vos notes ne pourront alors revenir qu’avec une sauvegarde.</p>
      <p style="margin-top:12px"><button class="link" data-act="goLogin">Retour à la connexion</button></p>
      ${demo}
    </div>` : `
    <div class="lockcard">
      <img class="logo" src="icon-192.png" alt="">
      <h1>Entrez le code reçu</h1>
      <p class="muted">Si l’adresse correspond à ce compte, un code valable 15 minutes vient d’être envoyé. Pensez à regarder dans les courriers indésirables.</p>
      <form id="resetForm">
        <label class="label" for="cCode">Code à 6 chiffres reçu par e-mail</label>
        <input type="text" id="cCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
        <label class="label" for="cPw">Nouveau mot de passe (8 caractères minimum)</label>
        <input type="password" id="cPw" autocomplete="new-password">
        <label class="label" for="cPw2">Confirmez le mot de passe</label>
        <input type="password" id="cPw2" autocomplete="new-password">
        <div class="err" id="lockErr"></div>
        <button class="btn primary block" id="codeBtn">Changer mon mot de passe</button>
      </form>
      <p style="margin-top:18px"><button class="link" data-act="goLogin">Retour à la connexion</button></p>
      ${demo}
    </div>`;
    $('#forgotForm')?.addEventListener('submit', onForgot);
    const majIndice = () => {
      const i = localStorage.getItem(indiceKey($('#fId').value.trim().toLowerCase())) || '';
      $('#fMail').placeholder = i; $('#fIndice').textContent = i ? `Pour vous aider : ${i}` : '';
    };
    if ($('#fId')) { $('#fId').oninput = majIndice; majIndice(); }
    $('#resetForm')?.addEventListener('submit', onResetCode);
    return;
  }
  L.innerHTML = mode === 'login' ? `
    <div class="lockcard">
      <img class="logo" src="icon-192.png" alt="">
      <h1>Motus</h1>
      <p class="tagline">Éclairer ce qui se passe en soi</p>
      <p class="muted">Connectez-vous pour ouvrir votre journal.</p>
      ${lienTh ? '<div class="warn">Vous avez reçu un lien pour créer votre compte thérapeute. <button class="link" data-act="goSignup">Créer mon compte thérapeute</button></div>' : inv}${safariAvis()}
      <form id="loginForm">
        <label class="label" for="lId">Identifiant</label>
        <input type="text" id="lId" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(localStorage.getItem(LAST_ID) || '')}">
        <label class="label" for="lPw">Mot de passe</label>
        <input type="password" id="lPw" autocomplete="current-password">
        <div class="err" id="lockErr"></div>
        <button class="btn primary block" id="loginBtn">Se connecter</button>
      </form>
      <p style="margin-top:20px">${recupNotes ? '<button class="link" data-act="retourInstall">Retour</button>' : 'Pas encore de compte ? <button class="link" data-act="goSignup">Créer un compte</button>'}</p>
      <p class="small" style="margin-top:4px"><button class="link small" data-act="forgot">Mot de passe oublié ?</button></p>
      ${demo}
    </div>` : `
    <div class="lockcard">
      <img class="logo" src="icon-192.png" alt="">
      <h1>${th ? 'Créer un compte thérapeute' : 'Créer un compte'}</h1>
      ${th ? `<ul>
        <li>Les données que vous recevrez de vos clients restent <b>uniquement sur votre appareil</b>, chiffrées avec votre mot de passe.</li>
        <li>Le serveur ne connaît que votre identifiant, votre nom, votre type de compte et les coordonnées professionnelles que vous indiquez.</li>
        <li>Vos clients vous rejoignent avec votre lien d’invitation, et vous acceptez chaque demande.</li>
      </ul>
      <p class="small muted">Lien personnel, valable jusqu’au ${fmtFR(ymd(new Date(lienThOk)))}, pour un seul compte.</p>` : `<ul>
        <li>Vos notes restent <b>uniquement sur votre téléphone</b>, chiffrées avec votre mot de passe.</li>
        <li>Le serveur ne connaît que votre identifiant, votre nom et votre type de compte.</li>
        <li>Vous choisissez ce que vous partagez, et avec qui : envoi chiffré, export Excel.</li>
      </ul>
      ${lienThMsg ? `<div class="warn">${esc(lienThMsg)}${lienTh ? ' <button class="link" data-act="reessayerLienTh">Réessayer</button>' : ''}</div>` : inv}`}${safariAvis()}
      <form id="signupForm">
        <div class="row">
          <div><label class="label" for="sPrenom">Prénom</label><input type="text" id="sPrenom" autocomplete="given-name"></div>
          <div><label class="label" for="sNom">Nom</label><input type="text" id="sNom" autocomplete="family-name"></div>
        </div>
        <label class="label" for="sId">Identifiant</label>
        <input type="text" id="sId" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex. julie.d">
        <div class="small muted" style="margin-top:4px">3 à 30 caractères, sans espace : lettres minuscules, chiffres, point, tiret.</div>
        <label class="label" for="sPw">Mot de passe (8 caractères minimum)</label>
        <input type="password" id="sPw" autocomplete="new-password">
        <label class="label" for="sPw2">Confirmez le mot de passe</label>
        <input type="password" id="sPw2" autocomplete="new-password">
        <label class="label" for="sMail" id="sMailNom">${MAIL_NOM[th ? 'therapeute' : 'client']}</label>
        <input type="email" id="sMail" autocomplete="email" autocapitalize="none">
        <div class="small muted" id="sMailAide" style="margin-top:4px">${MAIL_AIDE[th ? 'therapeute' : 'client']}</div>
        <label class="label" for="sMail2">Confirmez le mail</label>
        <input type="email" id="sMail2" autocomplete="off" autocapitalize="none">
        <label class="rgpd"><input type="checkbox" id="sRgpd"><span>J’ai lu la <a href="confidentialite.html" target="_blank" rel="noopener" data-act="voirPolitique">politique de confidentialité</a> et j’accepte le traitement de mes données, y compris celles qui peuvent concerner ma santé.</span></label>
        <div class="err" id="lockErr"></div>
        <button class="btn primary block" id="signupBtn">Créer mon compte${th ? ' thérapeute' : ''}</button>
      </form>
      <p style="margin-top:20px">Déjà un compte ? <button class="link" data-act="goLogin">Se connecter</button></p>
      ${demo}
    </div>`;
  $('#loginForm')?.addEventListener('submit', onLogin);
  $('#signupForm')?.addEventListener('submit', onSignup);
  if ($('#sId')) $('#sId').addEventListener('input', e => { const v = e.target.value.replace(/\s/g, ''); if (v !== e.target.value) e.target.value = v; });
  // un lien thérapeute collé dans l'identifiant (connexion ou inscription) ouvre le formulaire thérapeute
  for (const c of [$('#lId'), $('#sId')]) c?.addEventListener('input', lienDansIdentifiant);
  (mode === 'login' ? ($('#lId').value ? $('#lPw') : $('#lId')) : $('#sPrenom')).focus();
}
/* Sur iPhone, un lien n'ouvre pas l'app installée : le thérapeute colle son lien dans le champ Identifiant (la page
   d'installation le lui dit). Rien ne l'indique sur l'écran de connexion : un utilisateur n'y voit aucune mention des
   thérapeutes. Un identifiant ne peut pas contenir « #t= » suivi de 32 caractères : aucune confusion possible. */
const RE_LIEN_TH_COLLE = /#t=([0-9a-f]{32})\s*$/i;
async function lienDansIdentifiant(e) {
  const m = e.target.value.match(RE_LIEN_TH_COLLE);
  if (!m) return;
  e.target.value = '';
  const err = $('#lockErr');
  if (err) err.textContent = 'Vérification du lien…';
  if (await verifierLienTh(m[1])) return showLock('signup');
  if ($('#lockErr')) $('#lockErr').textContent = lienThMsg;
}

const LOGIN_ERR = {
  identifiants: 'Identifiant ou mot de passe incorrect.',
  desactive: 'Ce compte a été désactivé par l’administrateur. Contactez l’administrateur.',
  reseau: 'Pas de connexion internet : impossible de vérifier votre compte.',
};
async function onLogin(e) {
  e.preventDefault();
  const id = $('#lId').value.trim().toLowerCase(), pw = $('#lPw').value, err = $('#lockErr'), btn = $('#loginBtn');
  if (!id || !pw) return err.textContent = 'Indiquez votre identifiant et votre mot de passe.';
  if (Date.now() < blockedUntil) return err.textContent = `Trop d’essais. Réessayez dans ${Math.ceil((blockedUntil - Date.now()) / 1000)} s.`;
  const fail = msg => { err.textContent = msg; btn.disabled = false; btn.textContent = 'Se connecter'; };
  btn.disabled = true; btn.textContent = 'Connexion…'; err.textContent = '';
  try {
    await API.signIn(id, pw);
    profil = await API.rpc('ouvrir_session');
    // v47 : un compte désactivé se connecte, en lecture seule (profil.actif === false). Sans profil : ancien serveur, on le refuse comme avant.
    if (!profil?.id) { API.signOut(); profil = null; return fail(LOGIN_ERR.desactive); }
  } catch (x) {
    // hors connexion : le journal déjà présent sur cet appareil s'ouvre avec le mot de passe
    if (x.code === 'reseau' && localStorage.getItem(vaultKey(id))) { session = null; profil = null; }
    else {
      if (x.code === 'identifiants' && ++fails >= 5) blockedUntil = Date.now() + 30000 * (fails - 4);
      return fail(LOGIN_ERR[x.code] || 'Connexion impossible pour le moment. Réessayez plus tard.');
    }
  }
  fails = 0;
  try { await openJournal(id, pw); }
  catch (x) { if (x.code !== 'journal') console.error(x); API.signOut(); profil = null; fail(x.code === 'journal' ? x.message : 'Impossible d’ouvrir le journal de cet appareil.'); }
}

async function onSignup(e) {
  e.preventDefault();
  const v = s => $(s).value.trim(), err = $('#lockErr'), btn = $('#signupBtn');
  const f = {role:lienThOk ? 'therapeute' : 'client', prenom:v('#sPrenom'), nom:v('#sNom'), identifiant:v('#sId').toLowerCase(), password:$('#sPw').value};
  if (lienThOk) f.lien = lienTh;
  if (!f.prenom || !f.nom) return err.textContent = 'Indiquez votre prénom et votre nom.';
  if (!ID_RE.test(f.identifiant)) return err.textContent = 'Identifiant : 3 à 30 caractères, lettres minuscules, chiffres, point ou tiret.';
  if (f.password.length < 8) return err.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
  if (f.password !== $('#sPw2').value) return err.textContent = 'Les deux mots de passe ne correspondent pas.';
  const mail = v('#sMail').toLowerCase();
  if (!EMAIL_RE.test(mail)) return err.textContent = 'Indiquez un mail de récupération valide.';
  if (mail !== v('#sMail2').toLowerCase()) return err.textContent = 'Les deux mails de récupération ne correspondent pas.';
  if (!$('#sRgpd').checked) return err.textContent = 'Cochez la case pour accepter la politique de confidentialité.';
  f.rgpd = {version:RGPD_VERSION, date:new Date().toISOString()};   // preuve du consentement, côté compte et côté appareil
  btn.disabled = true; btn.textContent = 'Création…'; err.textContent = '';
  try { await API.signUp({...f, nom:f.role === 'therapeute' ? f.nom : initiale(f.nom)}); profil = await API.rpc('ouvrir_session'); }
  catch (x) {
    // thérapeute refusé par le serveur : le lien a servi entre-temps, a été retiré ou a expiré ; sans lien, c'est le formulaire utilisateur
    if (f.lien && x.code === 'serveur' && !await verifierLienTh(f.lien)) return showLock('signup');
    btn.disabled = false; btn.textContent = f.lien ? 'Créer mon compte thérapeute' : 'Créer mon compte';
    return err.textContent = {
      pris: 'Cet identifiant est déjà utilisé : choisissez-en un autre.',
      faible: 'Mot de passe trop simple : allongez-le ou ajoutez des chiffres.',
      reseau: 'Une connexion internet est nécessaire pour créer un compte.',
      confirmation: 'Le serveur demande une confirmation par e-mail : désactivez-la dans Supabase (Authentication › Email).',
    }[x.code] || 'Création impossible pour le moment. Réessayez plus tard.';
  }
  if (f.lien) oublierLienTh();   // le lien a servi : le serveur l'a effacé
  differeMail = true;   // le mail vient d'être saisi : rien à redemander
  try {
    await openJournal(f.identifiant, f.password, {role:f.role, profile:{prenom:f.prenom, nom:f.nom}, consentement:{...f.rgpd, envoye:true}});
    await choixInitiaux();
    if (await setRecovery(mail, f.password, true) !== true) { mailPasse = true; majRappelRecup(); }
  } finally { differeMail = false; }
}
const optionsVerrou = () => [[0,'Immédiate'],[1,'Après 1 minute'],[5,'Après 5 minutes'],[15,'Après 15 minutes'],[-1,'Jamais']].map(([v,n]) => `<option value="${v}" ${data.settings.autolock == v ? 'selected' : ''}>${n}</option>`).join('');
