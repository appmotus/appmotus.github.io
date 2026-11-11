// Motus — Connecteurs (@travail) : lecture dans les notes et mise en forme
'use strict';

/* ───────────── Connecteurs : « @travail », « @un-ami » relient les notes entre elles ─────────────
   On les écrit dans tout texte libre du journal : émotion (… car), besoin (Plus précisément…), actions et « Je pourrais… »,
   note personnelle, synthèse (v46 : les champs des cartes Besoin et Action en faisaient partie à l'écrit, mais n'étaient ni
   proposés, ni comptés, ni mis en forme). Le tiret remplace l'espace et s'affiche comme un espace. Les villes et lieux déjà
   saisis sont aussi des connecteurs. Rien n'est enregistré à part : tout se déduit des notes.
   Deux écritures d'un même connecteur se rejoignent, sans tenir compte des majuscules, des accents, ni des espaces, tirets ou
   signes (« @Saint-Étienne » et la ville « Saint-Étienne »), ni des formes proches (voir racineConn). */
// une apostrophe peut précéder le @ : « l’@atelier », « d’@Annecy »
const RE_CONN = /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*)/gu;
// l'écriture sans majuscules, accents ni signes : sert à comparer et à chercher (la clé d'un connecteur, c'est cleC)
const cleConn = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/’/g, "'").replace(/[^\p{L}\p{N}']+/gu, '-').replace(/^-+|-+$/g, '');
const motConn = label => '@' + String(label).trim().replace(/[^\p{L}\p{N}'’]+/gu, '-').replace(/^-+|-+$/g, '');   // ce qu'on écrit
/* Formes proches (v46, sa demande du 2026-11-11) : un seul connecteur malgré
   - l'article ou le pronom élidé : @l’entreprise = @entreprise (l’, d’, j’, m’, t’, s’, n’, c’, qu’, jusqu’, lorsqu’, puisqu’) ;
   - le pluriel (s ou x final) : @entreprises = @entreprise ;
   - l'infinitif et le participe d'un verbe : @procrastiné, @procrastinée, @procrastinés = @procrastiner ;
   - un e final sans accent (« je @procrastine », ou l'accent oublié) rejoint ce verbe s'il est écrit ailleurs à l'infinitif ou
     au participe (alias, dans connecteurs()).
   Un e final seul ne suffit jamais : @Michel et @Michèle, @mari et @Marie restent deux connecteurs. Chaque coupe laisse au
   moins 3 lettres : @été, @thé, @mer ne changent pas.
   Le nom du connecteur : sa forme sans article, l'infinitif d'abord, puis le singulier, puis la plus fréquente. Dans le texte,
   chaque connecteur garde sa forme écrite (« … car l’entreprise »). */
const RE_ART = /^(?:l|d|j|m|t|s|n|c|qu|jusqu|lorsqu|puisqu)['’](?=[\p{L}\p{N}])/iu;
const sansElision = w => String(w ?? '').trim().replace(RE_ART, '');
const nbLettres = s => (s.match(/[\p{L}\p{N}]/gu) || []).length;
function formeNue(w) {   // sans article ni pluriel, en minuscules ; les accents restent (le é final compte)
  const s = sansElision(w).toLowerCase().normalize('NFC');
  return /[sx]$/.test(s) && nbLettres(s) > 3 ? s.slice(0, -1) : s;
}
function racineConn(w) {
  const s = formeNue(w), coupe = n => nbLettres(s) - n >= 3 ? s.slice(0, -n) : s;
  return cleConn(/ée$/.test(s) ? coupe(2) : /é$/.test(s) ? coupe(1) : /er$/.test(s) ? coupe(2) : s);
}
// « procrastine » (e ou ee final sans accent) : la racine du verbe qu'il pourrait être, sinon ''
function racineE(w) {
  const s = formeNue(w), r = s.replace(/e?e$/, '');
  return /e$/.test(s) && !/ée$/.test(s) && nbLettres(r) >= 3 ? cleConn(r) : '';
}
/* Tous les textes libres d'une note d'émotion, réunis : là où ses connecteurs se cherchent, se comptent et se filtrent */
const texteEmotion = e => [e?.car, e?.bdet, ...(e?.taches || []).map(x => x?.t), e?.piste].filter(Boolean).join('\n');
let connCache = null;   // recalculé à chaque affichage (render)
function connecteurs() {
  if (connCache) return connCache;
  const textes = [];   // [texte, ville, lieu] de chaque émotion, note et synthèse
  for (const d of Object.values(D()?.days || {})) {
    for (const e of d.entries || []) textes.push([texteEmotion(e), e.ville, e.lieu]);
    for (const n of dayNotes(d)) textes.push([n.text, n.ville, n.lieu]);
    if (d.synth) textes.push([d.synth]);
  }
  // alias : une forme en e sans accent rejoint un verbe écrit ailleurs à l'infinitif ou au participe
  const mots = textes.flatMap(([t]) => [...String(t ?? '').matchAll(RE_CONN)].map(x => x[2]));
  const verbes = new Set(mots.filter(w => /(?:é|ée|er)$/.test(formeNue(w))).map(racineConn)), alias = new Map();
  for (const w of mots) { const r = racineConn(w), v = racineE(w); if (v && v !== r && verbes.has(v)) alias.set(r, v); }
  const cle = w => { const r = racineConn(w); return alias.get(r) || r; };
  const m = new Map(), fiche = k => { let c = m.get(k); if (!c) m.set(k, c = {k, n:0, formes:{}, lieu:''}); return c; };
  for (const [texte, ville, lieu] of textes) {   // n : nombre d'émotions, de notes et de synthèses qui contiennent le connecteur
    const vus = new Set();
    for (const x of String(texte ?? '').matchAll(RE_CONN)) { const k = cle(x[2]), c = fiche(k), f = sansElision(x[2]); c.formes[f] = (c.formes[f] || 0) + 1; vus.add(k); }
    for (const l of [ville, lieu]) { const k = cle(l); if (k) { fiche(k).lieu ||= l.trim(); vus.add(k); } }
    vus.forEach(k => m.get(k).n++);
  }
  // le nom affiché : celui de la ville ou du lieu, sinon l'infinitif, puis le singulier, puis la forme la plus fréquente,
  // tirets changés en espaces
  const rang = f => (/er$/i.test(f) ? 0 : 2) + (/[sx]$/i.test(f) ? 1 : 0);
  for (const c of m.values()) c.label = c.lieu || Object.entries(c.formes).sort((a, b) => rang(a[0]) - rang(b[0]) || b[1] - a[1])[0][0].replace(/-/g, ' ');
  m.cle = cle;
  return connCache = m;
}
const cleC = w => connecteurs().cle(w);   // la clé d'un connecteur écrit, formes proches comprises
const nomConn = mot => connecteurs().get(cleC(mot))?.lieu || mot.replace(/-/g, ' ');
/* Texte affiché : chaque connecteur ressort, sans son @ ; dans Quotidien et le Journal (actif), le toucher ouvre une bulle qui
   propose de voir toutes les notes qui le contiennent (bulleConn, fenetres.js) */
function avecConnecteurs(s, actif) {
  s = String(s ?? '');
  let html = '', i = 0;
  for (const x of s.matchAll(RE_CONN)) {   // découpé avant l'échappement : une apostrophe peut faire partie du connecteur
    const debut = x.index + x[1].length;
    html += esc(s.slice(i, debut)) + `<span class="conn"${actif ? ` data-act="voirConn" data-c="${esc(cleC(x[2]))}"` : ''}>${esc(nomConn(x[2]))}</span>`;
    i = debut + 1 + x[2].length;
  }
  return html + esc(s.slice(i));
}
/* Ordre des listes de connecteurs (Journal › Connecteurs, Paramètres › Connecteurs) : alphabétique ou du plus fréquent au moins
   fréquent. Le choix est gardé sur l'appareil, pour les deux listes à la fois. */
const CONN_TRI = 'motus.connTri';
let connTri = (() => { try { return localStorage.getItem(CONN_TRI) === 'nb' ? 'nb' : 'az'; } catch { return 'az'; } })();
const alphaConn = (a, b) => a.label.localeCompare(b.label, 'fr', {sensitivity:'base'});
const triConn = (a, b) => connTri === 'nb' ? b.n - a.n || alphaConn(a, b) : alphaConn(a, b);
function choisirTri(t) { connTri = t === 'nb' ? 'nb' : 'az'; try { localStorage.setItem(CONN_TRI, connTri); } catch {} }
const boutonsTri = () => `<div class="tri-conn" role="group" aria-label="Ordre de la liste">${[['az', 'A→Z', 'Ordre alphabétique'], ['nb', 'Nombre', 'Les plus utilisés d’abord']]
  .map(([k, t, a]) => `<button type="button" data-tri="${k}" class="${connTri === k ? 'on' : ''}" aria-pressed="${connTri === k}" aria-label="${a}">${t}</button>`).join('')}</div>`;
/* Exports (Excel, tableau) : le texte lisible, sans @ ni tirets */
const sansArobase = s => String(s ?? '').replace(RE_CONN, (x, avant, mot) => avant + nomConn(mot));
/* Les connecteurs d'une émotion, d'une note ou d'une synthèse, pour le filtre du Journal */
function clesDe(texte, ville, lieu) {
  const s = new Set();
  for (const x of String(texte ?? '').matchAll(RE_CONN)) s.add(cleC(x[2]));
  for (const l of [ville, lieu]) { const k = cleC(l); if (k) s.add(k); }
  return s;
}

