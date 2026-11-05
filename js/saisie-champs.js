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
function surlignerChamps() { document.querySelectorAll('#eCar, #nText, #synth, #ePiste').forEach(champAllonge); }   // les champs de CHAMPS_CONN, et « Je pourrais… »
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
