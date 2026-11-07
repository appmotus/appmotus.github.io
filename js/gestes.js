// Motus — Gestes : balayages des pages, faces émotion / besoins, appui long, volets de la saisie
'use strict';

/* Glisser le doigt : sur la frise de la semaine, change de semaine ; dans le Journal, sur le calendrier ou sur la liste des notes,
   change de mois ; dans une page des Paramètres ou dans « Mes notes » de l'admin, vers la droite, revient en arrière.
   Le geste part plutôt à l'horizontale (moins de 45°) et fait 60 px en moins d'une seconde et quart, ou 30 px d'un geste vif :
   il ne gêne ni le défilement ni un simple appui, et tolère un doigt qui dévie ensuite.
   Seule la partie balayée bouge, et la page voisine arrive à côté d'elle en suivant le doigt. Le reste de la page se met à jour ensuite. */
let glisse = null;
const ECART = 16;   // espace entre la page et sa voisine pendant le geste
/* Une sélection de texte en cours (dans la page ou dans un champ) : le doigt sélectionne, la page ne doit pas bouger */
function texteSelectionne() {
  const a = document.activeElement;
  try { if (a?.matches('input, textarea') && a.selectionStart !== a.selectionEnd) return true; } catch {}
  return !!getSelection()?.toString();
}
document.addEventListener('touchstart', e => {
  if (texteSelectionne()) { glisse = null; return; }
  // pour revenir en arrière, le geste peut partir de n'importe où, même d'un champ de saisie (la page des notes en est presque entièrement couverte)
  const retour = (view === 'set' && setPage) || (view === 'admin' && admPage), champ = e.target.closest('input, textarea, select');
  // dans le Journal, une émotion reliée à des besoins (.duo) se retourne sous le doigt : là, le mois ne change pas
  const zone = view === 'cal' ? !calQ.trim() && !e.target.closest('.duo') && e.target.closest('#carteCal, #listeNotes') : view === 'day' ? e.target.closest('.week') : retour;
  // … sauf du champ où l'on écrit : là, le doigt sert à placer le curseur et à sélectionner le texte
  const ok = zone && !$('#app').hidden && e.touches.length === 1 && !$('dialog[open]') && (!champ || (retour && !champ.matches('select, input[type=range]') && champ !== document.activeElement));
  glisse = ok ? {x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now(), sens:null, el:null, voisine:null, cote:0} : null;
}, {passive:true});
// ce qui bouge : la frise de la semaine, le calendrier, la liste des notes, ou toute la page pour un retour en arrière
const cibleGlisse = () => view === 'day' ? $('#view .week') : view === 'cal' ? $(calMode === 'list' ? '#listeNotes' : '#carteCal') : $('#view');
function glissePossible(dx) {
  if (view === 'day') return dx > 0 || mondayOf(cur) < mondayOf(today());   // pas de semaine à venir
  if (view === 'set' || view === 'admin') return dx > 0;                    // retour en arrière : vers la droite
  if (view === 'cal' && calMode === 'list') return !!moisListe(dx > 0 ? -1 : 1);   // seulement vers un mois affiché
  const now = new Date();
  return dx > 0 || calY !== now.getFullYear() || calM !== now.getMonth();   // pas de mois à venir
}
/* La page voisine (cote 1 : celle d'avant, à gauche ; -1 : celle d'après, à droite), construite par les fonctions d'affichage habituelles */
function voisineHtml(cote) {
  if (view === 'day') { const c = cur; cur = addDays(cur, cote < 0 ? 7 : -7); if (cur > today()) cur = today(); try { return weekStrip(); } finally { cur = c; } }
  if (view === 'set') { const p = setPage; setPage = pageRetour()?.de || null; try { return `<div>${vSet()}</div>`; } finally { setPage = p; } }
  if (view === 'admin') { const p = admPage; admPage = null; try { return `<div>${vAdmin()}</div>`; } finally { admPage = p; } }
  if (calMode === 'list') {   // la liste contient déjà tous les mois affichés
    const v = moisListe(cote < 0 ? 1 : -1);
    return v ? $(`#listeNotes .mois-bloc[data-mois="${v[0]}-${v[1]}"]`)?.outerHTML || '' : '';
  }
  const [y, m] = cote < 0 ? (calM === 11 ? [calY + 1, 0] : [calY, calM + 1]) : (calM === 0 ? [calY - 1, 11] : [calY, calM - 1]);
  const avant = [calY, calM]; [calY, calM] = [y, m];
  try { const t = document.createElement('template'); t.innerHTML = vCal(); return t.content.querySelector('#carteCal')?.outerHTML || ''; }
  finally { [calY, calM] = avant; }
}
function poserVoisine(g, cote) {
  const el = g.el, p = el.parentNode, t = document.createElement('template');
  t.innerHTML = voisineHtml(cote).trim();
  const v = t.content.firstElementChild; if (!v) return null;
  v.removeAttribute('id'); v.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
  v.setAttribute('aria-hidden', 'true');
  if (g.posP === undefined) { g.posP = p.style.position; if (getComputedStyle(p).position === 'static') p.style.position = 'relative'; }
  let top = el.offsetTop;
  if (view === 'set' || view === 'admin') top += scrollY - (view === 'set' ? pageRetour()?.y ?? menuScroll : admScroll);   // le menu revient là où on l'avait laissé
  else if (view === 'cal' && calMode === 'list') {   // le mois voisin prend la place du nom du mois affiché, comme après le changement
    const sep = v.querySelector('.mois-sep'); if (sep) sep.style.marginTop = '0';
    top = posListe(true) - p.getBoundingClientRect().top;
  }
  Object.assign(v.style, {position:'absolute', top:`${top}px`, left:`${el.offsetLeft - cote * (el.offsetWidth + ECART)}px`, width:`${el.offsetWidth}px`, margin:'0', pointerEvents:'none'});
  p.appendChild(v);
  return v;
}
function bouger(g, x, transition = 'none') {
  for (const e of [g.el, g.voisine]) if (e) { e.style.transition = transition; e.style.transform = x ? `translateX(${x}px)` : ''; }
}
function nettoyer(g) {
  g.voisine?.remove(); g.voisine = null;
  if (g.el) { g.el.style.transition = ''; g.el.style.transform = ''; }
  if (g.posP !== undefined && g.el?.parentNode) g.el.parentNode.style.position = g.posP;
}
/* Dès que le geste est franchement horizontal, l'écran ne défile plus verticalement ; un geste vertical, lui, n'est jamais gêné */
document.addEventListener('touchmove', e => {
  const g = glisse;
  if (!g || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
  // un doigt resté appuyé avant de bouger commence une sélection de texte, pas un balayage
  if (!g.sens && Math.hypot(dx, dy) > 12) g.sens = Date.now() - g.t > 450 ? 'selection' : Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
  if (g.sens === 'h' && texteSelectionne()) {   // la sélection a commencé en cours de geste : la page revient en place
    glisse = null; bouger(g, 0, 'transform .2s ease-out'); setTimeout(() => nettoyer(g), 220); return;
  }
  if (g.sens !== 'h') return;
  if (e.cancelable) e.preventDefault();
  if (!(g.el ||= cibleGlisse())) return;
  const possible = glissePossible(dx), cote = possible ? Math.sign(dx) : 0;
  if (cote !== g.cote) { g.voisine?.remove(); g.voisine = cote ? poserVoisine(g, cote) : null; g.cote = cote; }   // le doigt peut repartir de l'autre côté
  bouger(g, possible ? dx : dx / 4);   // là où il n'y a rien, la page résiste
}, {passive:false});
document.addEventListener('touchend', e => {
  const g = glisse;
  if (!g) return;
  glisse = null;
  const p = e.changedTouches[0], dx = p.clientX - g.x, dy = p.clientY - g.y, dt = Date.now() - g.t;
  // une fois le geste parti à l'horizontale, l'écran ne défile plus : le doigt peut alors dévier sans annuler le balayage
  const va = g.sens === 'h' && glissePossible(dx) && dt < 1250 && Math.abs(dy) <= 1.2 * Math.abs(dx) && (Math.abs(dx) >= 60 || (Math.abs(dx) >= 30 && Math.abs(dx) / dt > .5));
  if (!va) { bouger(g, 0, 'transform .2s ease-out'); setTimeout(() => nettoyer(g), 220); return; }
  const cote = dx < 0 ? -1 : 1;
  const changer = () => {
    if (view === 'day') { cur = addDays(cur, cote < 0 ? 7 : -7); if (cur > today()) cur = today(); render(true); }   // on reste au même endroit de la page
    else if (view === 'set') ACT.setBack();
    else if (view === 'admin') ACT.admRetour();
    else if (cote < 0) ACT.nextMonth(); else ACT.prevMonth();
  };
  if (!g.el || matchMedia('(prefers-reduced-motion: reduce)').matches) { nettoyer(g); return changer(); }
  if (g.cote !== cote) { g.voisine?.remove(); g.voisine = poserVoisine(g, cote); }
  bouger(g, cote * (g.el.offsetWidth + ECART), 'transform .18s ease-out');   // la voisine prend la place de la page
  // puis la vraie page s'affiche à cet endroit, identique à la voisine qui disparaît
  setTimeout(() => { changer(); nettoyer(g); }, 180);
}, {passive:true});
document.addEventListener('touchcancel', () => { const g = glisse; glisse = null; if (g) { bouger(g, 0, 'transform .2s ease-out'); setTimeout(() => nettoyer(g), 220); } }, {passive:true});
/* Quotidien et Journal : une émotion a ses cartes (émotion, puis besoin et action quand ils existent), la synthèse du jour deux
   faces (émotions traversées / besoins exprimés). Un balayage vers la gauche passe à la carte suivante, vers la droite revient à la
   précédente ; mêmes règles de geste que ci-dessus. Là où il n'y a plus de carte, la ligne résiste au doigt. Un appui long (sans
   bouger) sur une émotion ou une note propose de la supprimer, puis demande confirmation : le balayage sert aux cartes. */
let ligne = null, avalerClic = 0;
const APPUI_LONG = 550;   // durée d'un appui long, en millisecondes
const entreeDe = li => li.querySelector('.entry');
const sansAnim = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const facesDe = c => [...c.children].filter(x => x.classList.contains('face'));
const faceDe = c => +(c.style.getPropertyValue('--k') || 0);   // la carte affichée (0 : l'émotion)
/* Les cartes suivent le doigt (dx) ; les autres attendent à côté, à ECART de distance (leur place est donnée par --i et --k) */
function placerFaces(c, dx, transition = 'none') {
  const k = faceDe(c);
  facesDe(c).forEach((el, i) => {
    el.style.transition = transition;
    el.style.transform = dx ? `translateX(calc(${(i - k) * 100}% + ${(i - k) * ECART + dx}px))` : '';
  });
}
/* Montre la carte k ; la hauteur passe en douceur de l'une à l'autre. Une carte plus courte que celle de l'émotion garde la
   hauteur de celle-ci : la liste ne bouge pas en dessous. */
function poserFace(c, k, anim = !sansAnim()) {
  const fs = facesDe(c), k0 = faceDe(c);
  if (fs.length < 2) return;
  k = Math.max(0, Math.min(fs.length - 1, k));
  if (k === k0) return placerFaces(c, 0, anim ? 'transform .2s ease-out' : 'none');
  placerFaces(c, (k0 - k) * (c.offsetWidth + ECART), anim ? 'transform .18s ease-out' : 'none');
  const fin = () => {
    const h0 = c.offsetHeight;
    c.style.setProperty('--k', k);
    fs.forEach((x, i) => { x.style.transition = 'none'; x.style.transform = ''; x.inert = i !== k; x.classList.toggle('on', i === k); });
    c.style.minHeight = k ? `${fs[0].offsetHeight}px` : '';
    const h1 = c.offsetHeight;
    if (anim && Math.abs(h1 - h0) > 1) {
      c.style.height = `${h0}px`; c.offsetHeight;
      c.style.transition = 'height .18s ease-out'; c.style.height = `${h1}px`;
      setTimeout(() => { c.style.height = ''; c.style.transition = ''; }, 200);
    }
  };
  anim ? setTimeout(fin, 180) : fin();
}
function lacherAppui(l) {
  clearTimeout(l.minuteur); clearTimeout(l.marque);
  if (!l.long) l.li?.classList.remove('appuye');
}
function revenir(l) {
  if (l.c.classList.contains('duo')) placerFaces(l.c, 0, 'transform .2s ease-out');
  else { const f = l.c.firstElementChild; if (f) { f.style.transition = 'transform .2s ease-out'; f.style.transform = ''; } }
}
document.addEventListener('touchstart', e => {
  if (ligne) lacherAppui(ligne);
  ligne = null;
  if ($('dialog[open]') || (view !== 'day' && view !== 'cal') || e.touches.length !== 1 || texteSelectionne()) return;
  // Journal : seulement les émotions à deux faces (le reste de la liste change de mois) ; Quotidien : toutes les lignes
  const c = e.target.closest(view === 'cal' ? '#view .duo' : '#view .duo, #view .entries li');
  if (!c) return;
  const li = !src && c.matches('.entries li') && c.querySelector('button.entry') ? c : null;   // appui long : seulement sur ses propres notes
  const l = ligne = {c, li, x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now(), sens:null, long:false};
  if (li) {
    l.marque = setTimeout(() => li.classList.add('appuye'), 150);   // la ligne se teinte : l'appui est en cours
    l.minuteur = setTimeout(() => {
      if (ligne !== l || l.sens) return;
      l.long = true; avalerClic = Date.now() + 3000;   // jusqu'au lever du doigt, aucun appui ne passe
      navigator.vibrate?.(12);
      proposerSuppression(li).finally(() => li.classList.remove('appuye'));
    }, APPUI_LONG);
  }
}, {passive:true});
document.addEventListener('touchmove', e => {
  const l = ligne;
  if (!l || e.touches.length !== 1) return;
  if (l.long) { if (e.cancelable) e.preventDefault(); return; }
  const dx = e.touches[0].clientX - l.x, dy = e.touches[0].clientY - l.y;
  if (!l.sens && Math.hypot(dx, dy) > 10) {
    lacherAppui(l);
    // sur ses propres notes, rien ne se sélectionne : un doigt resté appuyé puis déplacé reste un geste
    l.sens = !l.li && Date.now() - l.t > 450 ? 'selection' : Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
  }
  if (l.sens !== 'h') return;
  if (texteSelectionne()) { ligne = null; return revenir(l); }
  if (e.cancelable) e.preventDefault();
  if (!l.c.classList.contains('duo')) { const f = l.c.firstElementChild; f.style.transition = 'none'; f.style.transform = `translateX(${dx / 4}px)`; return; }
  placerFaces(l.c, carteVoisine(l.c, dx) ? dx : dx / 4);   // là où il n'y a rien, la ligne résiste
}, {passive:false});
document.addEventListener('touchend', e => {
  const l = ligne;
  if (!l) return;
  ligne = null;
  lacherAppui(l);
  if (l.long) { if (e.cancelable) e.preventDefault(); avalerClic = Date.now(); return; }   // le doigt levé ne touche pas la fenêtre ouverte
  if (l.sens !== 'h') return;
  avalerClic = Date.now();
  const p = e.changedTouches[0], dx = p.clientX - l.x, dy = p.clientY - l.y, dt = Date.now() - l.t;
  const va = dt < 1250 && Math.abs(dy) <= 1.2 * Math.abs(dx) && (Math.abs(dx) >= 60 || (Math.abs(dx) >= 30 && Math.abs(dx) / dt > .5));
  if (!l.c.classList.contains('duo')) return revenir(l);
  poserFace(l.c, faceDe(l.c) + (va && carteVoisine(l.c, dx) ? (dx < 0 ? 1 : -1) : 0));
}, {passive:false});
/* Une carte existe-t-elle du côté où va le doigt ? vers la gauche : la suivante ; vers la droite : la précédente */
const carteVoisine = (c, dx) => dx < 0 ? faceDe(c) < facesDe(c).length - 1 : faceDe(c) > 0;
document.addEventListener('touchcancel', () => { const l = ligne; ligne = null; if (l) { lacherAppui(l); if (l.long) avalerClic = Date.now(); else revenir(l); } }, {passive:true});
// juste après un balayage ou un appui long, le doigt levé ne déclenche rien (ni ouverture de la note, ni bouton de la fenêtre)
document.addEventListener('click', e => {
  if (Date.now() - avalerClic < 400) { e.stopPropagation(); e.preventDefault(); }
}, true);
// Android : l'appui long n'ouvre pas le menu du navigateur sur ses notes
document.addEventListener('contextmenu', e => { if (view === 'day' && !src && e.target.closest('#view .entries.tenir li')) e.preventDefault(); });
async function proposerSuppression(li) {
  const b = li && entreeDe(li);
  if (!b) return;
  const note = b.dataset.act === 'editNote', id = b.dataset.id, txt = b.querySelector('.txt')?.textContent.trim() || '';
  const meta = [...(b.querySelector('.meta')?.childNodes || [])].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const autres = note ? [] : cartesDe(getDay(cur).entries.find(x => x.id === id)).slice(1).map(c => NOM_CARTE[c]);   // ses cartes Besoin et Action
  const ok = await confirmerAction({titre:note ? 'Supprimer cette note personnelle ?' : 'Supprimer cette émotion ?',
    texte:`${esc(meta)}<br>« ${esc(txt.length > 140 ? txt.slice(0, 140) + '…' : txt)} »${autres.length ? `<br>${autres.length > 1 ? `Ses cartes ${joinFr(autres)} seront supprimées` : `Sa carte ${autres[0]} sera supprimée`} avec elle.` : ''}`, bouton:'Supprimer'});
  if (!ok) return;
  const d = ensureDay(cur);
  if (note) d.notes = dayNotes(d).filter(x => x.id !== id); else d.entries = d.entries.filter(x => x.id !== id);
  save(); render(true); toast(note ? 'Note supprimée' : 'Émotion supprimée');
}
/* Fenêtre d'une émotion : balayer vers la gauche passe à la carte suivante (besoin, puis action), vers la droite revient à la précédente.
   Le geste peut partir de n'importe où dans les volets, même d'un champ, sauf de celui où l'on écrit. */
let gv = null;
document.addEventListener('touchstart', e => {
  gv = null;
  const V = e.target.closest?.('#entryDlg[open] #volets'), champ = e.target.closest?.('input, textarea, select');
  if (!V || e.touches.length !== 1 || texteSelectionne() || (champ && champ === document.activeElement)) return;
  gv = {V, x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now(), sens:null};
}, {passive:true});
document.addEventListener('touchmove', e => {
  const g = gv;
  if (!g || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
  if (!g.sens && Math.hypot(dx, dy) > 12) g.sens = Date.now() - g.t > 450 ? 'selection' : Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
  if (g.sens !== 'h') return;
  if (texteSelectionne()) { gv = null; return poserVolet(ed.volet); }
  if (e.cancelable) e.preventDefault();
  const i = VOLETS.indexOf(ed.volet), possible = dx < 0 ? i < VOLETS.length - 1 : i > 0, inn = g.V.firstElementChild;
  inn.style.transition = 'none';
  inn.style.transform = `translateX(calc(${decalVolet(i)} + ${possible ? dx : dx / 4}px))`;
}, {passive:false});
document.addEventListener('touchend', e => {
  const g = gv;
  if (!g) return;
  gv = null;
  if (g.sens !== 'h') return;
  avalerClic = Date.now();
  const p = e.changedTouches[0], dx = p.clientX - g.x, dy = p.clientY - g.y, dt = Date.now() - g.t;
  const va = dt < 1250 && Math.abs(dy) <= 1.2 * Math.abs(dx) && (Math.abs(dx) >= 60 || (Math.abs(dx) >= 30 && Math.abs(dx) / dt > .5));
  const i = VOLETS.indexOf(ed.volet), j = i + (dx < 0 ? 1 : -1);
  poserVolet(va && j >= 0 && j < VOLETS.length ? VOLETS[j] : ed.volet);
}, {passive:true});
document.addEventListener('touchcancel', () => { if (gv) { gv = null; poserVolet(ed.volet); } }, {passive:true});
