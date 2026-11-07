// Motus — Champs de saisie : propositions de connecteurs, hauteur automatique, barre du bas et clavier
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
/* Clavier ouvert sur un téléphone : la barre du bas se retire. Sur iPhone, une barre fixée en bas de l'écran peut remonter
   au-dessus du clavier pendant le défilement (par exemple en écrivant la synthèse du jour). */
const champTexte = el => !!el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea');
document.addEventListener('focusin', e => document.body.classList.toggle('clavier', champTexte(e.target)));
document.addEventListener('focusout', () => setTimeout(() => document.body.classList.toggle('clavier', champTexte(document.activeElement)), 60));
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
   donc pas de majuscule (autocapitalize="none") ; mais chaque nouvelle ligne commence par une majuscule (v41), mise ici puisque le
   clavier ne la met plus. Seule la lettre change, le curseur ne bouge pas. Rien à un collage, ni sur une lettre qu'on n'a pas
   tapée à l'instant : une minuscule voulue, remise après coup, le reste. */
const CHAMPS_MAJ = ['eCar', 'eBdet', 'ePiste'];
// une action de la carte Action (une ligne à elle seule) prend une majuscule dès sa première lettre (sa demande du 2026-11-07)
const ligneAction = t => !!t.matches?.('#eTaches .tache-t');
const avecMaj = t => CHAMPS_MAJ.includes(t.id) || ligneAction(t);
function majLigne(ta, ajout) {   // ajout : ce qui vient d'être tapé, juste avant le curseur
  const p = ta.selectionStart;
  if (!ajout || p !== ta.selectionEnd) return;
  const debut = ta.value.lastIndexOf('\n', p - 1) + 1;
  if (!debut && !ligneAction(ta)) return;   // première ligne d'un champ de carte : pas de majuscule
  const i = debut + ta.value.slice(debut, p).search(/\S|$/);   // première lettre de la ligne, après d'éventuels espaces
  if (i >= p || i < p - ajout.length) return;
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

/* Le texte qu'on écrit ne descend jamais sous le clavier (v40). Clavier ouvert, une fenêtre se pose juste au-dessus de lui et
   rétrécit (comme celle des connecteurs, qui a son propre réglage) ; la page gagne en bas la hauteur du clavier, de quoi remonter.
   Puis, à chaque frappe, la ligne du curseur est ramenée au-dessus du clavier, et au-dessus des boutons du bas de la fenêtre. */
const basClavier = () => { const vv = window.visualViewport; return vv && clavierOuvert() ? Math.max(0, innerHeight - (vv.offsetTop + vv.height)) : 0; };
const FENETRE_A_PART = 'conn-dlg, .pleine, .en-haut';   // fenêtres qui ne bougent pas ainsi (connecteurs : leur propre réglage)
function calerFenetres() {
  const vv = window.visualViewport, bas = basClavier();
  document.documentElement.style.setProperty('--clavier', `${bas}px`);
  for (const d of document.querySelectorAll('dialog[open]')) {
    if (d.matches(`.${FENETRE_A_PART}`)) continue;
    d.style.marginBottom = bas > 0 ? `${bas}px` : '';
    d.style.maxHeight = bas > 0 ? `${vv.height - 8}px` : '';
  }
}
function curseurVisible(ta = document.activeElement) {
  const vv = window.visualViewport;
  if (!vv || ta?.tagName !== 'TEXTAREA' || !clavierOuvert()) return;
  const p = positionDans(ta, ta.selectionEnd), r = ta.getBoundingClientRect();
  const bas = r.top + Math.min(Math.max(p.y, 0) + p.h, ta.clientHeight) + 12;   // bas de la ligne du curseur, et un peu d'air
  const d = ta.closest('dialog'), pied = d?.querySelector('.dlg-f');
  let limite = vv.offsetTop + vv.height;
  if (pied) limite = Math.min(limite, pied.getBoundingClientRect().top);
  const ecart = Math.round(bas - limite);
  if (ecart <= 0) return;
  if (d) d.scrollTop += ecart; else window.scrollBy(0, ecart);
}
window.visualViewport?.addEventListener('resize', () => { calerFenetres(); requestAnimationFrame(() => curseurVisible()); });
document.addEventListener('focusin', e => { if (champTexte(e.target)) setTimeout(() => { calerFenetres(); curseurVisible(); }, 350); });
document.addEventListener('focusout', () => setTimeout(calerFenetres, 80));
document.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') requestAnimationFrame(() => curseurVisible(e.target)); });
// une fenêtre refermée clavier ouvert reprend sa place pour la prochaine fois
document.addEventListener('close', e => { const d = e.target; if (d?.tagName === 'DIALOG' && !d.matches(`.${FENETRE_A_PART}`)) { d.style.marginBottom = ''; d.style.maxHeight = ''; } }, true);
