// Motus — Guide d'utilisation (Paramètres) : son texte est dans guide/guide.md, à modifier sans toucher au code
'use strict';

/* Le texte du guide est lu à la première ouverture de la page (guide/guide.md, gardé hors connexion par le service worker),
   puis mis en page ici. Sa syntaxe, volontairement très simple, est rappelée en tête de guide/guide.md. Chaque rubrique (##)
   s'ouvre d'un appui ; une rubrique marquée {utilisateur} ou {therapeute} n'est montrée qu'à ce type de compte. */
let guideTexte = null, guideErreur = false;
async function chargerGuide() {
  try { const r = await fetch('guide/guide.md', {cache:'no-cache'}); if (!r.ok) throw 0; guideTexte = await r.text(); }
  catch { guideErreur = true; }
  if (view === 'set' && setPage === 'guide') render(true);
}
const enLigneGuide = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
/* Les lignes d'une rubrique deviennent des paragraphes, intertitres, listes, astuces et captures */
function blocsGuide(lignes) {
  const h = []; let liste = null, para = [], astuce = [];
  const fermer = () => {
    if (para.length) { h.push(`<p>${enLigneGuide(para.join(' '))}</p>`); para = []; }
    if (astuce.length) { h.push(`<div class="astuce">${enLigneGuide(astuce.join(' '))}</div>`); astuce = []; }
    if (liste) { h.push(`<${liste.t}>${liste.li.map(x => `<li>${enLigneGuide(x)}</li>`).join('')}</${liste.t}>`); liste = null; }
  };
  for (const brut of lignes) {
    const l = brut.trim();
    let m;
    if (!l) fermer();
    else if ((m = l.match(/^###\s+(.+)$/))) { fermer(); h.push(`<h3>${enLigneGuide(m[1])}</h3>`); }
    else if ((m = l.match(/^!\[([^\]]*)\]\(([\w.-]+)\)$/))) { fermer(); h.push(`<figure><img src="guide/${m[2]}" alt="${esc(m[1])}" loading="lazy"><figcaption>${esc(m[1])}</figcaption></figure>`); }
    else if ((m = l.match(/^(-|\d+\.)\s+(.+)$/))) {
      const t = m[1] === '-' ? 'ul' : 'ol';
      if (para.length || astuce.length || liste?.t !== t) { fermer(); liste = {t, li:[]}; }
      liste.li.push(m[2]);
    }
    else if ((m = l.match(/^>\s*(.*)$/))) { if (!astuce.length) fermer(); astuce.push(m[1]); }
    else if (liste) liste.li[liste.li.length - 1] += ' ' + l;   // une ligne qui continue l'élément de liste
    else { if (astuce.length) fermer(); para.push(l); }
  }
  fermer();
  return h.join('');
}
function guideHtml(md) {
  const role = data.role === 'therapeute' ? 'therapeute' : 'utilisateur', rubriques = [];
  let r = {titre:null, lignes:[]};
  for (const l of md.replace(/\r/g, '').split('\n')) {
    if (l.trim().startsWith('//')) continue;
    const m = l.match(/^##\s+(.+?)\s*(?:\{(\w+)\})?\s*$/);
    if (m) { rubriques.push(r); r = {titre:m[1], pour:m[2], lignes:[]}; } else r.lignes.push(l);
  }
  rubriques.push(r);
  return rubriques.filter(x => !x.pour || x.pour === role).map(x => {
    const corps = blocsGuide(x.lignes);
    if (x.titre === null) return corps ? `<section class="card guide-intro">${corps}</section>` : '';
    return `<details class="card guide-r"><summary>${enLigneGuide(x.titre)}</summary><div class="guide-c">${corps}</div></details>`;
  }).join('');
}
function pageGuide() {
  if (guideTexte == null && !guideErreur) { chargerGuide(); return '<p class="small muted" style="margin:0 2px">Chargement du guide…</p>'; }
  if (guideTexte == null) {   // une prochaine ouverture réessaiera
    guideErreur = false;
    return '<section class="card"><p class="small muted" style="margin:0">Le guide n’a pas pu être chargé. Vérifiez votre connexion internet, puis rouvrez cette page.</p></section>';
  }
  return `<div class="guide">${guideHtml(guideTexte)}</div>`;
}
