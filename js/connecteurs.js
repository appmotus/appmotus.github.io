// Motus — Connecteurs (@travail) : lecture dans les notes et mise en forme
'use strict';

/* ───────────── Connecteurs : « @travail », « @un-ami » relient les notes entre elles ─────────────
   On les écrit dans le texte d'une émotion (… car), d'une note personnelle ou d'une synthèse ; le tiret remplace l'espace
   et s'affiche comme un espace. Les villes et lieux déjà saisis sont aussi des connecteurs. Rien n'est enregistré à part :
   tout se déduit des notes. Deux écritures d'un même connecteur se rejoignent, sans tenir compte des majuscules, des accents,
   ni des espaces, tirets ou signes (clé : « saint-etienne » pour « @Saint-Étienne » comme pour la ville « Saint-Étienne »). */
// une apostrophe peut précéder le @ : « l’@atelier », « d’@Annecy »
const RE_CONN = /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*)/gu;
const cleConn = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/’/g, "'").replace(/[^\p{L}\p{N}']+/gu, '-').replace(/^-+|-+$/g, '');
const motConn = label => '@' + String(label).trim().replace(/[^\p{L}\p{N}'’]+/gu, '-').replace(/^-+|-+$/g, '');   // ce qu'on écrit
let connCache = null;   // recalculé à chaque affichage (render)
function connecteurs() {
  if (connCache) return connCache;
  const m = new Map(), fiche = k => { let c = m.get(k); if (!c) m.set(k, c = {k, n:0, formes:{}, lieu:''}); return c; };
  const compter = (texte, ville, lieu) => {   // n : nombre d'émotions, de notes et de synthèses qui contiennent le connecteur
    const vus = new Set();
    for (const x of String(texte ?? '').matchAll(RE_CONN)) { const k = cleConn(x[2]), c = fiche(k); c.formes[x[2]] = (c.formes[x[2]] || 0) + 1; vus.add(k); }
    for (const l of [ville, lieu]) { const k = cleConn(l); if (k) { fiche(k).lieu ||= l.trim(); vus.add(k); } }
    vus.forEach(k => m.get(k).n++);
  };
  for (const d of Object.values(D()?.days || {})) {
    for (const e of d.entries || []) compter(e.car, e.ville, e.lieu);
    for (const n of dayNotes(d)) compter(n.text, n.ville, n.lieu);
    if (d.synth) compter(d.synth);
  }
  // le nom affiché : celui de la ville ou du lieu, sinon l'écriture la plus fréquente, tirets changés en espaces
  for (const c of m.values()) c.label = c.lieu || Object.entries(c.formes).sort((a, b) => b[1] - a[1])[0][0].replace(/-/g, ' ');
  return connCache = m;
}
const nomConn = mot => connecteurs().get(cleConn(mot))?.lieu || mot.replace(/-/g, ' ');
/* Texte affiché : chaque connecteur ressort, sans son @ ; dans le Journal (actif), le toucher affiche les notes qui le contiennent */
function avecConnecteurs(s, actif) {
  s = String(s ?? '');
  let html = '', i = 0;
  for (const x of s.matchAll(RE_CONN)) {   // découpé avant l'échappement : une apostrophe peut faire partie du connecteur
    const debut = x.index + x[1].length;
    html += esc(s.slice(i, debut)) + `<span class="conn"${actif ? ` data-act="connecteur" data-c="${esc(cleConn(x[2]))}"` : ''}>${esc(nomConn(x[2]))}</span>`;
    i = debut + 1 + x[2].length;
  }
  return html + esc(s.slice(i));
}
/* Exports (Excel, tableau) : le texte lisible, sans @ ni tirets */
const sansArobase = s => String(s ?? '').replace(RE_CONN, (x, avant, mot) => avant + nomConn(mot));
/* Les connecteurs d'une émotion, d'une note ou d'une synthèse, pour le filtre du Journal */
function clesDe(texte, ville, lieu) {
  const s = new Set();
  for (const x of String(texte ?? '').matchAll(RE_CONN)) s.add(cleConn(x[2]));
  for (const l of [ville, lieu]) { const k = cleConn(l); if (k) s.add(k); }
  return s;
}

