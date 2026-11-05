// Motus — Chiffrement du journal (AES-GCM, clé dérivée du mot de passe)
'use strict';

/* ───────────── Chiffrement (AES-GCM 256, clé dérivée du code par PBKDF2) ───────────── */
let VKEY = null;                                  // journal de l'utilisateur connecté sur cet appareil
const vaultKey = id => 'journal-emotions.donnees.' + id;
const ITER = 250000;
let key = null, salt = null, data = null;

function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

async function deriveKey(code, saltU8, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt:saltU8, iterations:iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function sealData(obj, k, saltU8) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, k, enc.encode(JSON.stringify(obj))));
  return {app:'journal-emotions', v:1, iter:ITER, salt:toB64(saltU8), iv:toB64(iv), ct:toB64(ct)};
}
async function openVault(v, code) {
  const s = fromB64(v.salt);
  const k = await deriveKey(code, s, v.iter || ITER);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(v.iv)}, k, fromB64(v.ct));
  return {k, s, obj: JSON.parse(dec.decode(pt))};
}

let saveTimer, savePending = Promise.resolve();
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!key) return savePending;
  const snapshot = data, k = key, s = salt, vk = VKEY;
  savePending = savePending.then(async () => {
    localStorage.setItem(vk, JSON.stringify(await sealData(versFichier(snapshot), k, s)));
  }).catch(err => { console.error(err); toast('Erreur d’enregistrement'); });
  return savePending;
}

