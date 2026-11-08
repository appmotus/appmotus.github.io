// Motus — Champs de saisie : propositions de connecteurs, hauteur automatique, majuscules, et l'état du clavier (barre du bas, fenêtres)
'use strict';

/* Saisie : dès qu'on tape « @ », une petite liste (4 lignes au plus) propose les connecteurs déjà utilisés qui commencent par
   ce qui est tapé (puis ceux qui le contiennent), les plus fréquents d'abord. Elle s'ouvre juste sous la ligne en cours, à partir
   du @ ; au-dessus seulement si le clavier la cacherait. */
const CHAMPS_CONN = ['eCar', 'nText', 'synth'];
const CONN_PROPOSES = 4;
const ancreConn = ta => ta.previousElementSibling?.classList.contains('conn-ancre') ? ta.previousElementSibling : null;
/* Où se trouve, dans le champ, le caractère n° i : une copie invisible du champ, même largeur et même police, le mesure */
function positionDans(ta, i) {
  const s = getComputedStyle(ta), m = document.createElement('div'), b = document.createElement('span');
  for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'tabSize']) m.style[p] = s[p];
  Object.assign(m.style, {position:'absolute', visibility:'hidden', top:'0', left:'-9999px', whiteSpace:'pre-wrap', overflowWrap:'break-word', borderStyle:'solid'});
  m.textContent = ta.value.slice(0, i); b.textContent = '​'; m.appendChild(b);
  document.body.appendChild(m);
  const r = {x:b.offsetLeft, y:b.offsetTop - ta.scrollTop, h:parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.25};
  m.remove();
  return r;
}
function suggererConn(ta) {
  const avant = ta.value.slice(0, ta.selectionStart);
  // rien tant qu'aucune lettre ne suit le @
  const m = ta.selectionStart === ta.selectionEnd && avant.match(/(?:^|[^\p{L}\p{N}_@])@([\p{L}\p{N}][\p{L}\p{N}'’-]*)$/u);
  let a = ancreConn(ta);
  const q = m ? cleConn(m[1]) : null, tous = m ? [...connecteurs().values()] : [];
  const tri = (x, y) => y.n - x.n || x.label.localeCompare(y.label, 'fr');
  const liste = [...tous.filter(c => c.k.startsWith(q)).sort(tri), ...(q ? tous.filter(c => !c.k.startsWith(q) && c.k.includes(q)).sort(tri) : [])].slice(0, CONN_PROPOSES);
  if (!liste.length) { a?.remove(); return; }
  if (!a) { a = document.createElement('div'); a.className = 'conn-ancre'; ta.before(a); }
  a.innerHTML = `<div class="conn-sugg" role="listbox" aria-label="Connecteurs">${liste.map(c => `<button type="button" role="option" data-conn-mot="${esc(c.label)}"><span class="conn">${esc(c.label)}</span><small>${c.n}</small></button>`).join('')}</div>`;
  const menu = a.firstElementChild, p = positionDans(ta, avant.length - m[1].length - 1), rt = ta.getBoundingClientRect(), ra = a.getBoundingClientRect();
  const ligne = Math.min(Math.max(p.y, 0), ta.clientHeight - p.h);   // la ligne du @, gardée dans la partie visible du champ
  menu.style.left = `${rt.left - ra.left + Math.max(0, Math.min(p.x, ta.clientWidth - menu.offsetWidth))}px`;
  let top = rt.top - ra.top + ligne + p.h + 2;
  const vv = window.visualViewport, basVisible = vv ? vv.offsetTop + vv.height : innerHeight;
  if (ra.top + top + menu.offsetHeight > basVisible - 4) top = rt.top - ra.top + ligne - menu.offsetHeight - 2;
  menu.style.top = `${top}px`;
}
function placerConn(ta, label) {
  const pos = ta.selectionStart, debut = ta.value.slice(0, pos).replace(/@[\p{L}\p{N}'’-]*$/u, ''), apres = ta.value.slice(pos).replace(/^[\p{L}\p{N}'’-]*/u, '');
  const mot = motConn(label) + (/^\s/.test(apres) ? '' : ' ');
  ta.value = debut + mot + apres;
  ta.focus();
  ta.setSelectionRange(debut.length + mot.length, debut.length + mot.length);
  ta.dispatchEvent(new Event('input', {bubbles:true}));   // enregistrement de la synthèse, et la liste se referme
}
/* Pendant la frappe, le champ affiche son propre texte, sans mise en forme : les connecteurs prennent la leur une fois la note
   enregistrée. (v36-37 : le texte du champ était invisible sous une copie mise en forme ; sur iPhone, la copie se décalait du
   vrai texte et le curseur ne tombait plus au bon endroit. Ne pas y revenir sans pouvoir l'essayer sur un iPhone.)
   Le champ s'allonge avec son texte, sans barre de défilement à l'intérieur. */
function allonger(ta) {
  const s = getComputedStyle(ta);
  sansSaut(ta, () => {   // même précaution que pour les notes de l'administrateur : la fenêtre ne saute pas
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth)}px`;
  });
}
function champAllonge(ta) {
  if (!ta || ta.dataset.surligne) return;
  ta.dataset.surligne = '1';
  ta.classList.add('auto-h');
  allonger(ta);
}
function surlignerChamps() { document.querySelectorAll('#eCar, #nText, #synth, #eBdet, #ePiste').forEach(champAllonge); }   // les champs de CHAMPS_CONN, le besoin en détail et « Je pourrais… »
// toucher une proposition ne doit pas fermer le clavier
for (const ev of ['pointerdown', 'mousedown']) document.addEventListener(ev, e => { if (e.target.closest('[data-conn-mot]')) e.preventDefault(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-conn-mot]');
  if (b) { e.preventDefault(); const ta = b.closest('.conn-ancre')?.nextElementSibling; if (ta) placerConn(ta, b.dataset.connMot); }
  // un appui dans le texte : l'iPhone peut y ouvrir sa barre (Sélectionner, Copier…) ; la liste se retire pour ne pas passer
  // dessous, et revient dès la lettre suivante
  else if (CHAMPS_CONN.includes(e.target.id)) ancreConn(e.target)?.remove();
});
document.addEventListener('focusout', e => {
  const ta = e.target;
  if (CHAMPS_CONN.includes(ta.id)) setTimeout(() => { if (document.activeElement !== ta) ancreConn(ta)?.remove(); }, 200);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && CHAMPS_CONN.includes(e.target.id) && ancreConn(e.target)) { e.preventDefault(); ancreConn(e.target).remove(); } });

/* Champs des cartes (… car, Plus précisément…, Je pourrais…) : le premier mot suit la phrase de l'app (« car », « Je pourrais »),
   donc pas de majuscule (autocapitalize="none") ; mais chaque nouvelle ligne (v41) et chaque nouvelle phrase, après . ! ? ou …
   suivis d'un espace (v42), commencent par une majuscule, mise ici puisque le clavier ne la met plus. Seule la lettre change, le
   curseur ne bouge pas. Rien à un collage, ni sur une lettre qu'on n'a pas tapée à l'instant : une minuscule voulue, remise après
   coup, le reste. */
const CHAMPS_MAJ = ['eCar', 'eBdet', 'ePiste'];
// une action de la carte Action (une ligne à elle seule) prend une majuscule dès sa première lettre (sa demande du 2026-11-07)
const ligneAction = t => !!t.matches?.('#eTaches .tache-t');
const avecMaj = t => CHAMPS_MAJ.includes(t.id) || ligneAction(t);
function majLigne(ta, ajout) {   // ajout : ce qui vient d'être tapé, juste avant le curseur
  const p = ta.selectionStart;
  if (!ajout || p !== ta.selectionEnd) return;
  const j = ajout.search(/\p{L}/u);   // la première lettre de ce qui vient d'être tapé
  if (j < 0) return;
  const i = p - ajout.length + j, avant = ta.value.slice(0, i);
  const debutLigne = /(^|\n)[ \t]*$/.test(avant), apresPhrase = /[.!?…]["»”’)]*\s+$/.test(avant);
  if (!debutLigne && !apresPhrase) return;
  if (debutLigne && !avant.includes('\n') && !ligneAction(ta)) return;   // tout début d'un champ de carte : il continue la phrase de l'app
  const c = ta.value[i], C = c.toLocaleUpperCase('fr');
  if (C === c || C.length !== 1) return;
  ta.setRangeText(C, i, i + 1);
  ta.setSelectionRange(p, p);   // sinon la lettre remplacée resterait sélectionnée, et la suivante l'effacerait
}
document.addEventListener('input', e => {
  if (!avecMaj(e.target) || e.isComposing) return;   // un mot en cours de composition (Android) : à la fin du mot
  if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') majLigne(e.target, e.data ?? e.dataTransfer?.getData('text/plain') ?? '');
});
document.addEventListener('compositionend', e => { if (avecMaj(e.target)) majLigne(e.target, e.data || ''); });

/* ───────────── Clavier : un seul état pour toute l'app (v42) ─────────────
   Les règles des zones de texte (README) reposent toutes sur cet état, calculé en un seul endroit (majClavier) :
   - clavier.ouvert : un champ de texte a le focus sur un écran tactile, et le clavier est là (l'écran visible a rétréci de plus
     de 120 px) ou s'ouvre (moins d'une seconde après le focus). Sur Android, le bouton retour range le clavier sans quitter le
     champ : l'état le voit, et la barre du bas revient ;
   - clavier.hauteur : la hauteur du clavier ; clavier.bas : ce qu'il cache en bas de l'écran à cet instant (l'iPhone peut
     décaler la partie visible pendant le défilement).
   Il en découle, et rien d'autre ne les change : la classe body.clavier (barre du bas cachée), la variable --clavier (la page
   gagne la hauteur du clavier en bas, de quoi remonter le texte au-dessus, sans plus) et la place des fenêtres, posées juste
   au-dessus du clavier (sauf le mini-calendrier, accroché en haut, et les fenêtres plein écran). Puis, à chaque frappe, la
   ligne du curseur est ramenée au-dessus du clavier et des boutons du bas de la fenêtre (curseurVisible). */
const champTexte = el => !!el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea');
const tactile = () => matchMedia('(pointer:coarse)').matches;
const clavier = {ouvert:false, hauteur:0, bas:0, focusA:0, plein:0, largeur:0};
const clavierOuvert = () => clavier.ouvert;
function majClavier() {
  const vv = window.visualViewport, h = vv ? vv.height : innerHeight, champ = tactile() && champTexte(document.activeElement);
  // la hauteur de l'écran sans clavier, remesurée dès qu'aucun champ n'a le focus ; inconnue juste après une rotation
  if (innerWidth !== clavier.largeur) { clavier.largeur = innerWidth; clavier.plein = champ ? 0 : h; }
  else if (!champ) clavier.plein = h;
  const ouvert = champ && (!clavier.plein || clavier.plein - h > 120 || Date.now() - clavier.focusA < 1000);
  const hauteur = ouvert && vv ? Math.max(0, Math.round(innerHeight - vv.height)) : 0;
  const bas = ouvert && vv ? Math.max(0, Math.round(innerHeight - (vv.offsetTop + vv.height))) : 0;
  if (ouvert !== clavier.ouvert) document.body.classList.toggle('clavier', ouvert);
  if (hauteur !== clavier.hauteur) document.documentElement.style.setProperty('--clavier', `${hauteur}px`);
  Object.assign(clavier, {ouvert, hauteur, bas});
  document.querySelectorAll('dialog[open]').forEach(placerFenetre);
}
/* Clavier ouvert, la fenêtre occupe toute la partie visible de l'écran, de la barre d'état au clavier : aucune page visible
   au-dessus ni au-dessous (sous elle, derrière la barre ^ v ✓ de l'iPhone, sa couleur se prolonge : motus.css, body.clavier) */
function placerFenetre(d) {
  if (d.matches('.pleine, .en-haut')) return;
  d.style.marginBottom = clavier.bas ? `${clavier.bas}px` : '';
  d.style.maxHeight = clavier.bas ? `calc(${Math.round(window.visualViewport.height)}px - env(safe-area-inset-top))` : '';
}
document.addEventListener('focusin', e => {
  if (!champTexte(e.target)) return;
  clavier.focusA = Date.now(); majClavier();
  // le clavier s'ouvre en quelques centaines de millisecondes ; après une seconde, seul l'écran rétréci compte
  for (const t of [400, 1050]) setTimeout(() => { majClavier(); zoneVisible(); }, t);
});
document.addEventListener('focusout', () => setTimeout(majClavier, 60));   // d'un champ à l'autre, la barre ne clignote pas
window.visualViewport?.addEventListener('resize', () => { majClavier(); requestAnimationFrame(() => zoneVisible()); });
window.visualViewport?.addEventListener('scroll', majClavier);
// une fenêtre refermée clavier ouvert reprend sa place pour la prochaine fois
document.addEventListener('close', e => { const d = e.target; if (d?.tagName === 'DIALOG') { d.style.marginBottom = ''; d.style.maxHeight = ''; } }, true);
majClavier();

/* Règle 2 : le clavier ne recouvre jamais la zone de texte. Clavier ouvert, toute la zone remonte au-dessus de lui (ou au-dessus
   des boutons du bas de la fenêtre) : le champ entier et, juste après lui, ses boutons ou son état (« Enregistré ✓ »), avec un
   peu d'air ; jamais au point de faire passer le haut du champ sous la date collée ou sous le titre de la fenêtre. Puis la ligne
   du curseur, pour un texte plus haut que la place disponible (curseurVisible). */
function zoneVisible(el = document.activeElement) {
  const vv = window.visualViewport;
  if (!vv || !clavier.ouvert || !champTexte(el)) return;
  const d = el.closest('dialog'), pied = d?.querySelector('.dlg-f'), tete = d ? d.querySelector('.dlg-h') : $('#view .dayhead, #view .calhead');
  let limite = vv.offsetTop + vv.height;
  if (pied) limite = Math.min(limite, pied.getBoundingClientRect().top);
  const haut = Math.max(vv.offsetTop, tete ? tete.getBoundingClientRect().bottom : 0) + 8;
  const r = el.getBoundingClientRect(), apres = el.nextElementSibling;
  const bas = Math.max(r.bottom, apres?.matches('.row, .btn, button, .saved') ? apres.getBoundingClientRect().bottom : 0) + 12;
  const ecart = Math.round(Math.min(bas - limite, r.top - haut));
  if (ecart > 0) { if (d) d.scrollTop += ecart; else window.scrollBy(0, ecart); }
  curseurVisible(el);
}
function curseurVisible(ta = document.activeElement) {
  const vv = window.visualViewport;
  if (!vv || ta?.tagName !== 'TEXTAREA' || !clavier.ouvert) return;
  const p = positionDans(ta, ta.selectionEnd), r = ta.getBoundingClientRect();
  const bas = r.top + Math.min(Math.max(p.y, 0) + p.h, ta.clientHeight) + 12;   // bas de la ligne du curseur, et un peu d'air
  const d = ta.closest('dialog'), pied = d?.querySelector('.dlg-f');
  let limite = vv.offsetTop + vv.height;
  if (pied) limite = Math.min(limite, pied.getBoundingClientRect().top);
  const ecart = Math.round(bas - limite);
  if (ecart <= 0) return;
  if (d) d.scrollTop += ecart; else window.scrollBy(0, ecart);
}
document.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') requestAnimationFrame(() => curseurVisible(e.target)); });
