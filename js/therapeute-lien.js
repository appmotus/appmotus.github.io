// Motus — Lien client-thérapeute : clés et invitation
'use strict';

/* ───────────── Lien client ↔ thérapeute (sans serveur) ─────────────
   Le thérapeute possède une paire de clés ECDH P-256 ; sa clé publique circule dans le lien d'invitation.
   Chaque envoi du client est chiffré avec une clé éphémère : seul ce thérapeute peut le déchiffrer. */
const ECDH = {name:'ECDH', namedCurve:'P-256'};
const THERA_TYPES = ['Psychologue','Psychiatre','Psychothérapeute','Thérapie brève','Gestalt-thérapie','TCC','Hypnothérapeute','Sophrologue','Autre'];
const rid = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const b64url = s => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); return s + '='.repeat((4 - s.length % 4) % 4); };
const lastOf = a => a[a.length - 1];

async function fingerprint(pkB64) {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', fromB64(pkB64)))].slice(0, 4);
  const x = h.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return x.slice(0, 4) + '-' + x.slice(4);
}
async function ensureKeys() {
  if (data.keys) return;
  const kp = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const pub = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  data.keys = {pub, priv: await crypto.subtle.exportKey('jwk', kp.privateKey), fp: await fingerprint(pub)};
  await saveNow();
}
async function sharedKey(priv, pub, usage) {
  const bits = await crypto.subtle.deriveBits({name:'ECDH', public:pub}, priv, 256);
  const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF', hash:'SHA-256', salt:enc.encode('journal-emotions'), info:enc.encode('envoi-v1')}, hk, {name:'AES-GCM', length:256}, false, [usage]);
}
async function sealFor(th, obj) {
  const pub = await crypto.subtle.importKey('raw', fromB64(th.pk), ECDH, false, []);
  const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const k = await sharedKey(eph.privateKey, pub, 'encrypt'), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, k, enc.encode(JSON.stringify(obj))));
  const epk = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey)));
  return {app:'journal-emotions', type:'envoi', v:1, to:th.fp, epk, iv:toB64(iv), ct:toB64(ct)};
}
async function openEnvoi(pkg) {
  const priv = await crypto.subtle.importKey('jwk', data.keys.priv, ECDH, false, ['deriveBits']);
  const epk = await crypto.subtle.importKey('raw', fromB64(pkg.epk), ECDH, false, []);
  const k = await sharedKey(priv, epk, 'decrypt');
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(pkg.iv)}, k, fromB64(pkg.ct))));
}

/* — Invitation : clé publique, nom et type de thérapie, dans la partie « # » du lien (jamais envoyée à un serveur).
   Le lien peut circuler : les coordonnées n'arrivent qu'aux clients acceptés, par le canal. — */
function inviteCode() {
  const p = data.profile, t = data.thera;
  const o = {v:1, pk:data.keys.pub, nom:p.nom, prenom:p.prenom, type:t.type};
  return b64url(toB64(enc.encode(JSON.stringify(o))));
}
const inviteLink = () => `${location.origin}${location.pathname}#${data.invCode ? 'i=' + data.invCode : 'inv=' + inviteCode()}`;
const refreshInvite = () => { const f = $('#invField'); if (f && data.keys) f.value = inviteLink(); };
/* Lien court : le serveur garde la clé publique et un code de 30 caractères. Sans réponse du serveur, le lien long reste valable. */
const CODE_COURT = /(?:#i=|^)([0-9a-f]{30})$/i;
async function assurerLienCourt() {
  if (!session || !data?.keys || data.role !== 'therapeute') return;
  try {
    const c = await API.rpc('mon_lien_invitation', {p_pk:data.keys.pub});
    if (c && data && c !== data.invCode) { data.invCode = c; save(); refreshInvite(); }
  } catch {}
}
async function readInvite(text) {
  const s = String(text).trim(), court = s.match(CODE_COURT);
  let o;
  if (court) o = await API.rpcAnon('lire_invitation', {p_code:court[1]});
  else {
    const m = s.match(/(?:#inv=)?([A-Za-z0-9_-]{40,})\s*$/);
    if (!m) throw new Error('format');
    o = JSON.parse(dec.decode(fromB64(unb64url(m[1]))));
  }
  if (o?.v !== 1 || !o.pk) throw new Error('format');
  await crypto.subtle.importKey('raw', fromB64(o.pk), ECDH, false, []); // clé valide ?
  // les coordonnées d'un ancien lien ou d'un serveur pas encore mis à jour sont ignorées : elles arriveront après acceptation
  return {v:1, pk:o.pk, fp:await fingerprint(o.pk), prenom:o.prenom || '', nom:o.nom || '', type:o.type || ''};
}
async function offerInvite(text) {
  let o;
  try { o = await readInvite(text); } catch (x) { return toast(x.code === 'reseau' ? 'Connexion internet nécessaire pour lire cette invitation.' : 'Lien d’invitation non reconnu.'); }
  if (data.role === 'therapeute') return toast('Ce lien est destiné à vos clients.');
  const who = nomDe(o) || 'ce thérapeute', old = data.therapist;
  if (old?.fp === o.fp && old.canal) return toast(old.accepte ? `${who} est déjà votre thérapeute` : `Votre demande attend déjà l’acceptation de ${who}`);
  if (!await consentirLien(o, old?.fp === o.fp ? null : old)) return;
  if (old?.canal && old.fp !== o.fp && !await rompreCanal(old.canal, 'client')) data.ruptureAEnvoyer = old.canal;
  data.therapist = {...o, addedAt:new Date().toISOString(), canal:hexDe(crypto.getRandomValues(new Uint8Array(32))), enAttente:true};
  delete data.ruptureRecue;
  await saveNow(); await synchroCanaux(true); render(); toast(`Demande envoyée : ${who} doit l’accepter`);
}
async function shareInvite() {
  if (!data.keys) return;
  const url = inviteLink(), p = data.profile;
  const text = `${p.prenom} ${p.nom} vous invite à relier votre journal Motus. Copiez ce lien dans l’app (Paramètres › Mon thérapeute). Code de sécurité : ${data.keys.fp}`;
  busy = true;
  try {
    if (navigator.share) await navigator.share({title:'Invitation — Motus', text, url});
    else { await navigator.clipboard.writeText(url); toast('Lien copié'); }
  } catch (err) { if (err.name !== 'AbortError') ACT.copyInvite(); }
  finally { setTimeout(() => busy = false, 1500); }
}

/* — Client : carte « Mon thérapeute », envoi de la semaine, rappel — */
/* Retirer le thérapeute : un code affiché à recopier évite une erreur de manipulation */
