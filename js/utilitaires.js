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
/* Besoins d'une note d'émotion : « J’ai besoin de sécurité, de repos et d’écoute. Je pourrais appeler un ami. » */
const besoinsDe = e => (e?.bes || []).filter(x => BESK[x.b]);
const pisteDe = e => (e?.piste || '').trim().replace(/[.\s]+$/, '');
const aBesoins = e => besoinsDe(e).length > 0 || !!pisteDe(e);
const deMot = w => /^[aeiouyhàâéèêëîïôûü]/i.test(w) ? 'd’' : 'de ';   // « d’écoute », « d’harmonie », « de repos »
function besoinsHtml(e) {
  const bs = besoinsDe(e), p = pisteDe(e);
  return (bs.length ? 'J’ai besoin ' + joinFr(bs.map(x => `${deMot(x.w)}<b style="--fc:${coulB(x.b)}">${esc(lc(x.w))}</b>`)) + '.' : '')
    + (p ? `${bs.length ? ' ' : ''}Je pourrais ${esc(p)}.` : '');
}
function besoinsTexte(e) {   // la même phrase, sans mise en forme (export Excel)
  const bs = besoinsDe(e), p = pisteDe(e);
  return (bs.length ? 'J’ai besoin ' + joinFr(bs.map(x => deMot(x.w) + lc(x.w))) + '.' : '') + (p ? `${bs.length ? ' ' : ''}Je pourrais ${p}.` : '');
}

