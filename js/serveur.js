// Motus — Serveur Supabase (comptes, compteurs, administration) et mode démonstration
'use strict';

/* ───────────── Serveur : comptes, compteurs, administration ─────────────
   Le serveur (Supabase) ne connaît que les comptes et des compteurs, jamais les notes.
   Tant que SERVER.url est vide, un « mode démonstration » simule le serveur sur cet appareil. */
const SERVER = {url:'https://bryabqhorqmsermzxuir.supabase.co', anon:'sb_publishable_LOYD3w3UhVbHwg41jqx0kw_Q-_P2WyN'};   // Supabase › Project Settings › API Keys : clé publique (« Publishable key »)
const ID_DOMAIN = 'comptes.journal-emotions.invalid';   // identifiant → adresse technique (aucun e-mail n'est envoyé)
const ID_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const DEMO = !SERVER.url;
let session = null;   // connexion au serveur, en mémoire uniquement
let profil = null;    // profil renvoyé par le serveur : numéro, type de compte, administrateur…
/* Compte désactivé par l'administrateur (v47) : la connexion reste possible, les notes restent lisibles et exportables, mais plus rien
   ne s'écrit (émotions, notes personnelles, synthèse, couleur, actions cochées, imports, restauration). L'état vient du serveur à
   chaque ouverture et au retour de l'app au premier plan ; il est gardé dans le journal chiffré (data.account.lecture) pour tenir
   hors connexion. Effacer ses données et supprimer son compte restent possibles. */
const lectureSeule = () => profil ? profil.actif === false : !!data?.account?.lecture;
const MSG_LECTURE = 'Compte désactivé : vos notes sont en lecture seule. Contactez l’administrateur.';
const ECRITURES = new Set(['newEntry', 'editEntry', 'newNote', 'editNote', 'saveNote', 'delNote', 'saveEntry', 'delEntry', 'setColor', 'cocher', 'cocherLigne',
  'choisirTxt', 'analyserCollage', 'restore', 'importerLot', 'importEnvoi', 'newClient', 'editClient', 'saveClient', 'accepterClient']);
const apiErr = (code, msg) => Object.assign(new Error(msg || code), {code});

function supabaseApi() {
  const email = id => `${id}@${ID_DOMAIN}`;
  async function call(path, body, method = 'POST', retry = true) {
    const headers = {apikey:SERVER.anon, 'Content-Type':'application/json'};
    if (session && !path.startsWith('/auth/v1/token')) headers.Authorization = 'Bearer ' + session.access_token;
    let r;
    try { r = await fetch(SERVER.url + path, {method, headers, body:JSON.stringify(body ?? {})}); }
    catch { throw apiErr('reseau'); }
    if (r.status === 401 && retry && session?.refresh_token && !path.startsWith('/auth/v1/token')) {
      session = await call('/auth/v1/token?grant_type=refresh_token', {refresh_token:session.refresh_token}, 'POST', false);
      rememberSession();
      return call(path, body, method, false);
    }
    const j = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) {
      const c = j?.error_code || j?.code || '';
      const banni = /banned/i.test(j?.msg || j?.message || '');
      throw apiErr(banni ? 'desactive' : {invalid_credentials:'identifiants', user_banned:'desactive', user_already_exists:'pris', email_exists:'pris', weak_password:'faible',
        code_invalide:'code', mot_de_passe_faible:'faible', email_invalide:'email', session:'session', patience:'patience', envoi:'envoi', adresse:'adresse', limite:'limite', admin:'admin', action:'action', mot_de_passe:'mot_de_passe', pris:'pris', identifiant:'identifiant',
        refresh_token_not_found:'session', refresh_token_already_used:'session', session_not_found:'session', session_expired:'session', user_not_found:'session'}[c] || 'serveur', j?.msg || j?.message);
    }
    return j;
  }
  return {
    async signUp(f) {
      // lien : le code du lien de l'administrateur, exigé par le serveur pour un compte thérapeute (serveur/lien-therapeute.sql)
      const j = await call('/auth/v1/signup', {email:email(f.identifiant), password:f.password, data:{identifiant:f.identifiant, role:f.role, nom:f.nom, prenom:f.prenom, rgpd:f.rgpd, ...(f.lien ? {lien:f.lien} : {})}});
      if (!j?.access_token) throw apiErr('confirmation');
      session = j;
    },
    async signIn(id, pw) { session = await call('/auth/v1/token?grant_type=password', {email:email(id), password:pw}); },
    async resume(t) { session = await call('/auth/v1/token?grant_type=refresh_token', {refresh_token:t}, 'POST', false); },
    token: () => session?.refresh_token,
    rpc: (fn, args) => call('/rest/v1/rpc/' + fn, args),
    /* Sans le compte de l'utilisateur : le serveur ne peut pas rattacher la demande à quelqu'un */
    async rpcAnon(fn, args) {
      let r;
      try { r = await fetch(SERVER.url + '/rest/v1/rpc/' + fn, {method:'POST', headers:{apikey:SERVER.anon, 'Content-Type':'application/json'}, body:JSON.stringify(args ?? {})}); }
      catch { throw apiErr('reseau'); }
      const j = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) throw apiErr('serveur', j?.message);
      return j;
    },
    recup: body => call('/functions/v1/recuperation', body),
    setPassword: pw => call('/auth/v1/user', {password:pw}, 'PUT'),
    setConsent: rgpd => call('/auth/v1/user', {data:{rgpd}}, 'PUT'),
    signOut() { if (session) call('/auth/v1/logout', {}).catch(() => {}); session = null; },
  };
}

/* Mode démonstration : mêmes fonctions que le serveur, simulées dans ce navigateur (le premier compte créé est administrateur) */
function demoApi() {
  const K = 'journal-emotions.serveur-demo';
  const db = () => JSON.parse(localStorage.getItem(K) || '{"comptes":{},"seq":{"C":0,"T":0},"usage":{}}');
  const put = x => localStorage.setItem(K, JSON.stringify(x));
  const hash = async s => toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('demo|' + s))));
  const numero = (x, role) => { const p = role === 'therapeute' ? 'T' : 'C'; return `${p === 'C' ? 'U' : p}-${String(++x.seq[p]).padStart(4, '0')}`; };   // compteur « C » : celui des utilisateurs
  const bump = (x, id, champ, n) => { const u = x.usage[id + '|' + today()] ||= {id, jour:today(), connexions:0, notes:0, envois:0}; u[champ] += n; };
  const moi = x => x.comptes[session?.id]?.profil;
  const admin = x => { if (!moi(x)?.est_admin) throw apiErr('serveur', 'Réservé à l’administrateur'); };
  const pasMoi = id => { if (id === session.id) throw apiErr('serveur', 'Impossible sur votre propre compte'); };
  const RPC = {
    // v47 : un compte désactivé reçoit son profil (actif:false) ; les connexions sont comptées par l'app (compter)
    ouvrir_session(x) { const p = moi(x); p.derniere_connexion = new Date().toISOString(); return p; },
    maj_profil(x, {p}) { const m = moi(x); for (const k of ['nom', 'prenom', 'therapie', 'telephone', 'email_contact', 'adresse']) if (k in p) m[k] = p[k]; },
    compter(x, {p_notes = 0, p_envois = 0, p_connexions = 0}) {
      const p = moi(x); if (!p.actif) return;   // comme le serveur : un compte désactivé ne compte plus
      bump(x, session.id, 'notes', p_notes); bump(x, session.id, 'envois', p_envois); bump(x, session.id, 'connexions', p_connexions); p.nb_connexions += p_connexions;
    },
    ma_cle_secours(x) { return x.recup?.[session.id]?.cle ?? null; },
    ma_recuperation_etat(x) { const l = x.recup?.[session.id]; return {confirmee:!!l?.email, attente:!!l?.attente}; },
    retirer_recuperation(x) { if (x.recup) delete x.recup[session.id]; },
    mon_lien_invitation(x, {p_pk}) {
      const p = moi(x); if (p?.role !== 'therapeute' || !p.actif) return null;
      p.cle_publique = p_pk; p.code_invitation ||= rid(15); return p.code_invitation;
    },
    deposer_arrivee(x, {p_pk, p_contenu}) {
      const p = Object.values(x.comptes).map(c => c.profil).find(q => q.cle_publique === p_pk && q.role === 'therapeute' && q.actif);
      if (!p) return false;
      (x.arrivees ||= []).push({id:Date.now() + Math.random(), therapeute:p.id, contenu:p_contenu}); return true;
    },
    lire_arrivees(x) { return (x.arrivees || []).filter(a => a.therapeute === session.id).map(({id, contenu}) => ({id, contenu})); },
    supprimer_arrivees(x, {p_ids}) { x.arrivees = (x.arrivees || []).filter(a => !(a.therapeute === session.id && p_ids.includes(a.id))); },
    canal_ecrire(x, {p_id, p_jeton, p_cote, p_fiche}) {
      const c = (x.canaux ||= {})[p_id] ||= {jeton:p_jeton, statut:'actif'};
      if (c.jeton !== p_jeton || c.statut !== 'actif') return false;
      c[p_cote] = p_fiche; return true;
    },
    canal_lire(x, {p_id}) { const c = x.canaux?.[p_id]; return c ? {client:c.client ?? null, therapeute:c.therapeute ?? null, statut:c.statut, rompu_par:c.rompu_par ?? null} : null; },
    canal_rompre(x, {p_id, p_jeton, p_par}) {
      const c = (x.canaux ||= {})[p_id] ||= {jeton:p_jeton};
      if (c.jeton !== p_jeton) return false;
      Object.assign(c, {statut:'rompu', rompu_par:p_par, client:null, therapeute:null}); return true;
    },
    canal_supprimer(x, {p_id, p_jeton}) { if (x.canaux?.[p_id]?.jeton === p_jeton && x.canaux[p_id].statut === 'rompu') delete x.canaux[p_id]; },
    lire_invitation(x, {p_code}) {
      const p = Object.values(x.comptes).map(c => c.profil).find(q => q.code_invitation === p_code.toLowerCase() && q.role === 'therapeute' && q.actif);
      return p ? {v:1, pk:p.cle_publique, nom:p.nom, prenom:p.prenom, type:p.therapie} : null;
    },
    admin_ressources(x) {
      admin(x);
      return {base_octets:JSON.stringify(x).length, actifs_30j:Object.values(x.comptes).filter(c => c.profil.derniere_connexion && Date.now() - new Date(c.profil.derniere_connexion) < 30 * 864e5).length};
    },
    admin_utilisateurs(x) { admin(x); return Object.values(x.comptes).map(c => c.profil); },
    admin_stats(x) {
      admin(x);
      const P = Object.values(x.comptes).map(c => c.profil), U = Object.values(x.usage);
      const recent = (iso, n) => !!iso && Date.now() - new Date(iso) < n * 864e5;
      const sum = (f, n) => U.filter(u => !n || u.jour >= addDays(today(), 1 - n)).reduce((a, u) => a + u[f], 0);
      const act = f => ({j1:sum(f, 1), j7:sum(f, 7), j30:sum(f, 30), total:sum(f)});
      const duJour = iso => !!iso && ymd(new Date(iso)) === today();
      const sem = {};
      U.filter(u => u.jour >= addDays(today(), -55)).forEach(u => {
        const s = sem[mondayOf(u.jour)] ||= {semaine:mondayOf(u.jour), connexions:0, notes:0, envois:0};
        s.connexions += u.connexions; s.notes += u.notes; s.envois += u.envois;
      });
      return {comptes:P.length, clients:P.filter(p => p.role === 'client').length, therapeutes:P.filter(p => p.role === 'therapeute').length,
        desactives:P.filter(p => !p.actif).length, inscrits_1j:P.filter(p => duJour(p.cree_le)).length, actifs_1j:P.filter(p => duJour(p.derniere_connexion)).length, inscrits_7j:P.filter(p => recent(p.cree_le, 7)).length, inscrits_30j:P.filter(p => recent(p.cree_le, 30)).length,
        actifs_7j:P.filter(p => recent(p.derniere_connexion, 7)).length, actifs_30j:P.filter(p => recent(p.derniere_connexion, 30)).length,
        activite:{connexions:act('connexions'), notes:act('notes'), envois:act('envois')},
        semaines:Object.values(sem).sort((a, b) => a.semaine.localeCompare(b.semaine))};
    },
    admin_activite(x) {   // somme des compteurs de chaque compte (serveur/activite-utilisateurs.sql)
      admin(x); const m = {};
      for (const u of Object.values(x.usage)) { const a = m[u.id] ||= {id:u.id, connexions:0, notes:0, envois:0}; a.connexions += u.connexions; a.notes += u.notes; a.envois += u.envois; }
      return Object.values(m);
    },
    admin_activer(x, {p_id, p_actif}) { admin(x); pasMoi(p_id); x.comptes[p_id].profil.actif = p_actif; },
    admin_type(x, {p_id, p_role}) { admin(x); const p = x.comptes[p_id].profil; if (p.role !== p_role) { p.role = p_role; p.numero = numero(x, p_role); } },
    admin_supprimer(x, {p_id}) {
      admin(x); pasMoi(p_id); delete x.comptes[p_id];
      for (const k of Object.keys(x.usage)) if (x.usage[k].id === p_id) delete x.usage[k];
    },
    // liens de création d'un compte thérapeute (en démonstration, le code est gardé tel quel)
    admin_creer_lien_therapeute(x) {
      admin(x); liensValables(x);
      const l = {id:Date.now(), code:rid(16), cree_le:new Date().toISOString(), expire_le:new Date(Date.now() + 30 * 864e5).toISOString()};
      x.liensTh.push(l); return l;
    },
    admin_liens_therapeute(x) { admin(x); return liensValables(x).map(({id, cree_le, expire_le}) => ({id, cree_le, expire_le})).reverse(); },
    admin_annuler_lien_therapeute(x, {p_id}) { admin(x); x.liensTh = liensValables(x).filter(l => l.id !== p_id); },
    lien_therapeute_valable(x, {p_code}) { const l = liensValables(x).find(l => l.code === String(p_code).toLowerCase()); return l ? {expire_le:l.expire_le} : null; },
  };
  const liensValables = x => x.liensTh = (x.liensTh || []).filter(l => new Date(l.expire_le) > Date.now());
  return {
    async signUp(f) {
      const x = db(); if (x.comptes[f.identifiant]) throw apiErr('pris');
      if (f.role === 'therapeute') {   // comme le serveur : un lien valable, qui ne resservira pas
        const n = liensValables(x).length;
        x.liensTh = x.liensTh.filter(l => l.code !== f.lien);
        if (x.liensTh.length === n) throw apiErr('serveur', 'lien_therapeute');
      }
      x.comptes[f.identifiant] = {mdp:await hash(f.password), profil:{id:f.identifiant, identifiant:f.identifiant, numero:numero(x, f.role), role:f.role,
        est_admin:!Object.keys(x.comptes).length, actif:true, nom:f.nom, prenom:f.prenom, therapie:'', telephone:'', email_contact:'', adresse:'',
        cree_le:new Date().toISOString(), derniere_connexion:null, nb_connexions:0}};
      put(x); session = {id:f.identifiant};
    },
    async signIn(id, pw) {
      const c = db().comptes[id];
      if (!c || c.mdp !== await hash(pw)) throw apiErr('identifiants');
      session = {id};
    },
    async resume(t) { if (!db().comptes[t]) throw apiErr('session'); session = {id:t}; },
    token: () => session?.id,
    async rpc(fn, args = {}) { const x = db(), r = RPC[fn](x, args); put(x); return r === undefined ? null : JSON.parse(JSON.stringify(r)); },
    rpcAnon(fn, args) { return API.rpc(fn, args); },
    /* En démonstration, rien n'est envoyé : les codes sont toujours 123456 */
    async recup(b) {
      if (b.action === 'quota_envoi') return {credits:287, type:'free'};
      const x = db(); x.recup ||= {};
      const e = String(b.email || '').trim().toLowerCase(), id = String(b.identifiant || '').trim().toLowerCase(), l = x.recup[id];
      if (b.action === 'definir') {
        const o = x.recup[session.id];
        x.recup[session.id] = {...o, attente:e, cle:o?.cle || toB64(crypto.getRandomValues(new Uint8Array(32)))};
      } else if (b.action === 'confirmer') {
        const c = x.recup[session.id];
        if (!c?.attente || b.code !== '123456') throw apiErr('code');
        c.email = c.attente; delete c.attente;
      } else if (b.action === 'demande') {
        if (l?.email && l.email === e) l.code = '123456';
      } else if (b.action === 'effacer_demande' || b.action === 'mdp_demande') {
        const c = x.recup[session.id];
        if (!c?.email || c.email !== e) throw apiErr('adresse');
        c[b.action === 'mdp_demande' ? 'mdp' : 'effacer'] = '123456';
      } else if (b.action === 'effacer_confirme' || b.action === 'mdp_confirme') {
        const c = x.recup[session.id], u = b.action === 'mdp_confirme' ? 'mdp' : 'effacer';
        if (!c?.[u] || c[u] !== b.code) throw apiErr('code');
        delete c[u];
      } else if (b.action === 'identite_mdp') {
        if (!ID_RE.test(id)) throw apiErr('identifiant');
        if (x.comptes[id] && id !== session.id) throw apiErr('pris');
        if (x.comptes[session.id].mdp !== await hash(b.mot_de_passe)) throw apiErr('mot_de_passe');
        if (id !== session.id) {   // les comptes de démonstration sont rangés sous leur identifiant
          const ancien = session.id;
          x.comptes[id] = x.comptes[ancien]; delete x.comptes[ancien];
          Object.assign(x.comptes[id].profil, {id, identifiant:id});
          if (x.recup[ancien]) { x.recup[id] = x.recup[ancien]; delete x.recup[ancien]; }
          for (const u of Object.values(x.usage || {})) if (u.id === ancien) u.id = id;
          session.id = id;
        }
      } else if (b.action === 'supprimer_demande') {
        const c = x.recup[session.id];
        if (moi(x)?.est_admin) throw apiErr('admin');
        if (!c?.email || c.email !== e) throw apiErr('adresse');
        c.supprimer = '123456';
      } else if (b.action === 'supprimer_confirme' || b.action === 'supprimer_mdp') {
        const c = x.recup[session.id];
        if (moi(x)?.est_admin) throw apiErr('admin');
        if (b.action === 'supprimer_mdp' ? (c?.email || x.comptes[session.id].mdp !== await hash(b.mot_de_passe)) : (!c?.supprimer || c.supprimer !== b.code)) throw apiErr(b.action === 'supprimer_mdp' ? 'mot_de_passe' : 'code');
        delete x.recup[session.id]; delete x.comptes[session.id];
        for (const k of Object.keys(x.usage)) if (x.usage[k].id === session.id) delete x.usage[k];
      } else {
        if (!l?.code || l.code !== b.code) throw apiErr('code');
        x.comptes[id].mdp = await hash(b.mot_de_passe); delete l.code; put(x);
        return {cle_secours:l.cle};
      }
      put(x); return {ok:true};
    },
    async setPassword(pw) { const x = db(); x.comptes[session.id].mdp = await hash(pw); put(x); },
    async setConsent() {},
    signOut() { session = null; },
  };
}
const API = DEMO ? demoApi() : supabaseApi();

/* Profil et compteurs envoyés au serveur (jamais de contenu) */
let profTimer;
function pushProfile() {
  clearTimeout(profTimer);
  profTimer = setTimeout(() => {
    if (!session || !data) return;
    const p = data.profile, t = data.thera;
    // client : le nom de famille complet reste sur l'appareil, le serveur n'en reçoit que l'initiale
    API.rpc('maj_profil', {p:{nom:data.role === 'therapeute' ? p.nom : initiale(p.nom), prenom:p.prenom, therapie:t.type, telephone:t.tel, email_contact:t.email, adresse:t.adresse}}).catch(() => {});
  }, 800);
}
function countStat(champ) { data.pending[champ]++; save(); flushStats(); }
async function flushStats() {
  if (!session || !data) return;
  const {notes, envois, connexions = 0} = data.pending;
  if (!notes && !envois && !connexions) return;
  data.pending = {notes:0, envois:0, connexions:0};
  try {
    try { await API.rpc('compter', {p_notes:notes, p_envois:envois, p_connexions:connexions}); }
    // serveur/compte-desactive.sql pas encore exécuté : l'ancienne fonction ne connaît pas les connexions ; elles attendent
    catch (x) { if (x.code === 'reseau' || !connexions) throw x; await API.rpc('compter', {p_notes:notes, p_envois:envois}); data.pending.connexions += connexions; }
  } catch { data.pending.notes += notes; data.pending.envois += envois; data.pending.connexions += connexions; }
  save();
}

