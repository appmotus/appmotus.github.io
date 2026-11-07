// Motus — Petites fonctions communes : dates, textes, phrases des émotions et des besoins
'use strict';

/* ───────────── Utilitaires ───────────── */
const $ = s => document.querySelector(s);
const enc = new TextEncoder(), dec = new TextDecoder();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const mondayOf = s => { const d = parse(s); d.setDate(d.getDate() - (d.getDay()+6)%7); return ymd(d); };
const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const fmtLong = s => { const d = parse(s); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtFR = s => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lc = w => w.charAt(0).toLowerCase() + w.slice(1);
const joinFr = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' et ' + a[a.length-1];
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cleanCar = e => (e.car || '').trim().replace(/[.\s]+$/, '');
const where = e => [e.ville, e.lieu].filter(Boolean).join(' · ');
const fmtDay = s => { const d = parse(s); return `${JOURS[d.getDay()].toLowerCase()} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const weekday = s => s ? JOURS[parse(s).getDay()].toLowerCase() : '';

function sentence(e) {
  const car = cleanCar(e);
  return 'Je me sens ' + joinFr(e.emos.map(x => lc(x.w))) + (car ? ' car ' + car : '') + '.';
}
function sentenceHtml(e, actif = false) {
  const car = cleanCar(e);
  return 'Je me sens ' + joinFr(e.emos.map(x => `<b style="--fc:${FAMK[x.f].c}">${esc(lc(x.w))}</b>`)) + (car ? ' car ' + avecConnecteurs(car, actif) : '') + '.';
}
/* Les cartes d'une note d'émotion (v40) : l'émotion, puis la carte Besoin (besoins choisis `bes`, et `bdet`, ce besoin dit avec
   ses mots) et la carte Action (`piste` : « Je pourrais… »). Les deux dernières sont facultatives.
   « J’ai besoin de sécurité, de repos et d’écoute. Être rassuré sur la suite. » · « Je pourrais appeler un ami. » */
const besoinsDe = e => (e?.bes || []).filter(x => BESK[x.b]);
const pisteDe = e => (e?.piste || '').trim().replace(/[.\s]+$/, '');
const detailDe = e => (e?.bdet || '').trim();
const aBesoin = e => besoinsDe(e).length > 0 || !!detailDe(e);   // carte Besoin
/* Carte Action (v41) : des actions à cocher (`taches` : [{id, t, ok}]), puis le texte libre (`piste`). Une action cochée reste là,
   cochée ; on la coche sur la carte, dans la synthèse du jour ou dans la fenêtre de saisie. */
const tachesDe = e => (e?.taches || []).filter(x => x?.t?.trim());
const aAction = e => !!pisteDe(e) || tachesDe(e).length > 0;      // carte Action
const aBesoins = e => aBesoin(e) || aAction(e);                  // au moins une carte après l'émotion
const cartesDe = e => ['e', ...(aBesoin(e) ? ['b'] : []), ...(aAction(e) ? ['a'] : [])];
const deMot = w => /^[aeiouyhàâéèêëîïôûü]/i.test(w) ? 'd’' : 'de ';   // « d’écoute », « d’harmonie », « de repos »
const finPhrase = s => { s = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?…]$/.test(s) ? s : s + '.'; };   // une phrase à part entière
function besoinHtml(e) {
  const bs = besoinsDe(e), d = detailDe(e);
  return (bs.length ? 'J’ai besoin ' + joinFr(bs.map(x => `${deMot(x.w)}<b style="--fc:${coulB(x.b)}">${esc(lc(x.w))}</b>`)) + '.' : '')
    + (d ? `${bs.length ? ' ' : ''}${esc(finPhrase(d))}` : '');
}
/* Une action à cocher, affichée (carte Action, synthèse du jour) ; actif : on peut la cocher (ses propres notes), k : le jour.
   Sans espace entre les balises : le texte des cartes garde ses blancs (pre-wrap). */
const caseTache = (e, x, k, actif) => `<span class="tache${x.ok ? ' ok' : ''}" role="checkbox" aria-checked="${!!x.ok}"${actif ? ` data-act="cocher" data-k="${k}" data-tache="${e.id}:${x.id}"` : ' aria-disabled="true"'}><span class="coche"></span><span class="tache-txt">${esc(x.t.trim())}</span></span>`;
function actionHtml(e, k, actif = false) {
  const ts = tachesDe(e), p = pisteDe(e);
  return (ts.length ? `<span class="taches-v">${ts.map(x => caseTache(e, x, k, actif)).join('')}</span>` : '') + (p ? `Je pourrais ${esc(p)}.` : '');
}
const tachesTexte = e => tachesDe(e).map(x => `${x.ok ? '☑' : '☐'} ${x.t.trim()}`);   // sans mise en forme (export Excel)
function besoinsTexte(e) {   // les deux cartes, sans mise en forme (export Excel)
  const bs = besoinsDe(e), d = detailDe(e), p = pisteDe(e);
  return [bs.length ? 'J’ai besoin ' + joinFr(bs.map(x => deMot(x.w) + lc(x.w))) + '.' : '', d ? finPhrase(d) : '', ...tachesTexte(e), p ? `Je pourrais ${p}.` : ''].filter(Boolean).join(' ');
}
/* Les pastilles des cartes, à droite de la ligne (son choix du 2026-11-07, à la place de « Besoin › ») : toujours les trois, dans
   l'ordre émotion, besoin, action. Celle de la carte affichée est pleine ; une autre carte remplie est cerclée de sa couleur, et la
   toucher y mène ; une carte vide est grisée. Les icônes sont celles d'ICO (app.js). */
const CARTES = ['e', 'b', 'a'], NOM_CARTE = {e:'Émotion', b:'Besoin', a:'Action'}, ICO_CARTE = {e:'emotion', b:'besoin', a:'action'};
const couleursCartes = e => { const fe = FAMK[e.emos[0].f].c, b0 = besoinsDe(e)[0]; return {e:fe, b:b0 ? coulB(b0.b) : fe, a:fe}; };
/* items : [{k, etat ('on', 'lien' ou 'vide'), coul, nom, attrs (ce que fait l'appui)}] */
const pastilles = items => `<span class="pastilles">${items.map(({k, etat, coul, nom, attrs = ''}) => {
  const i = ico(ICO_CARTE[k], ''), st = ` style="--pc:${coul}"`;
  return etat === 'on' ? `<span class="pc on"${st} role="img" aria-label="${nom}, affichée">${i}</span>`
    : etat === 'vide' ? `<span class="pc vide" role="img" aria-label="${nom}, vide">${i}</span>`
    : `<span class="pc"${st} ${attrs} role="button" aria-label="Voir : ${nom}">${i}</span>`;
}).join('')}</span>`;
function pastillesCartes(e, c) {   // c : la carte affichée
  const cs = cartesDe(e), coul = couleursCartes(e);
  return pastilles(CARTES.map(k => ({k, coul:coul[k], nom:`carte ${NOM_CARTE[k]}`, etat:k === c ? 'on' : cs.includes(k) ? 'lien' : 'vide', attrs:`data-act="voirFace" data-k="${cs.indexOf(k)}"`})));
}

