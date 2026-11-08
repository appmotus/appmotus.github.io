// Motus — Fenêtres : confirmation, choix des connecteurs, fond immobile, clavier
'use strict';

/* Fenêtre Annuler / Confirmer de l'app, à la place de la boîte du navigateur */
function confirmerAction({titre, texte = '', bouton = 'Confirmer'}) {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="caForm">
      <div class="dlg-h"><h2>${esc(titre)}</h2></div>
      ${texte ? `<div class="dlg-b"><p class="small muted" style="margin:0">${texte}</p></div>` : ''}
      <div class="dlg-f"><button type="button" class="btn" id="caNon">Annuler</button><button class="btn danger">${bouton}</button></div>
    </form>`;
    let fait = false;
    const fin = ok => { if (fait) return; fait = true; D.onclose = null; if (D.open) D.close(); resolve(ok); };
    $('#caNon').onclick = () => fin(false);
    $('#caForm').onsubmit = e => { e.preventDefault(); fin(true); };
    // la fermeture d'une fenêtre précédente dans ce même cadre (le choix de l'appui long) arrive parfois après sa réouverture : ignorée
    D.onclose = () => { if (!D.open) fin(false); };
    D.showModal();
  });
}
/* Un choix entre quelques actions (appui long sur une note) : les boutons les uns sous les autres, Annuler en dernier.
   choix : [{k, t (texte du bouton), style ('primary' ou 'danger')}] ; renvoie la clé choisie, ou null. */
function choisirAction({titre, texte = '', choix}) {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="chForm">
      <div class="dlg-h"><h2>${esc(titre)}</h2></div>
      ${texte ? `<div class="dlg-b"><p class="small muted" style="margin:0">${texte}</p></div>` : ''}
      <div class="dlg-f choix-f">${choix.map(c => `<button type="button" class="btn${c.style ? ' ' + c.style : ''}" data-choix="${c.k}">${esc(c.t)}</button>`).join('')}
        <button type="button" class="btn" data-choix="">Annuler</button></div>
    </form>`;
    let fait = false;
    const fin = r => { if (fait) return; fait = true; D.onclose = null; if (D.open) D.close(); resolve(r); };
    D.querySelectorAll('[data-choix]').forEach(b => b.onclick = () => fin(b.dataset.choix || null));
    D.onclose = () => { if (!D.open) fin(null); };
    D.showModal();
  });
}
/* Un connecteur touché dans une note (Quotidien, Journal) : une petite bulle, juste sous lui (au-dessus s'il est trop bas),
   propose de voir toutes les notes qui le contiennent : le Journal en liste, filtré sur ce connecteur. Un appui ailleurs,
   un défilement ou un changement de page la referment. */
const fermerBulle = () => document.querySelector('.bulle-conn')?.remove();
function bulleConn(t) {
  fermerBulle();
  const k = t.dataset.c, nom = connecteurs().get(k)?.label || t.textContent, b = document.createElement('div');
  b.className = 'bulle-conn';
  b.innerHTML = `<button type="button" data-act="connecteur" data-c="${esc(k)}">Voir toutes les notes avec <span class="conn">${esc(nom)}</span>${ico('ch', '')}</button>`;
  document.body.appendChild(b);
  const r = t.getClientRects()[0] || t.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;   // un connecteur coupé en fin de ligne : sa première partie
  const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  const nav = $('nav.tabs')?.getBoundingClientRect().top ?? innerHeight, dessous = r.bottom + 8 + h < nav - 4;
  b.classList.toggle('dessus', !dessous);
  b.dataset.y = scrollY;
  b.style.left = `${x + scrollX}px`;
  b.style.top = `${(dessous ? r.bottom + 8 : r.top - 8 - h) + scrollY}px`;
  b.style.setProperty('--fl', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x))}px`);   // la pointe, sous le connecteur
}
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.bulle-conn, .conn[data-act]')) fermerBulle(); }, true);
addEventListener('scroll', () => { const b = $('.bulle-conn'); if (b && Math.abs(scrollY - (+b.dataset.y || 0)) > 40) fermerBulle(); }, {passive:true});
/* Journal (calendrier ou liste) : choisir jusqu'à 3 connecteurs, classés par ordre alphabétique ou par nombre de notes, avec une recherche */
const CONN_MAX = 3;
function ouvrirConnecteurs() {
  let choix = calC.filter(k => connecteurs().has(k)), et = calCEt;
  // ceux déjà choisis en haut, pour pouvoir les retirer sans les chercher ; puis tous les autres, dans l'ordre choisi (A→Z ou nombre)
  const D = $('#codeDlg'), tous = [...connecteurs().values()].sort((a, b) => choix.includes(b.k) - choix.includes(a.k) || triConn(a, b));
  const etat = () => JSON.stringify([[...choix].sort(), et]), avant = etat();
  D.innerHTML = `<form method="dialog" id="connForm">
    <div class="dlg-h"><div class="titre-i"><h2 tabindex="-1" autofocus>Connecteurs</h2><button type="button" class="btn-i" id="connI" aria-expanded="false" aria-controls="connAide" aria-label="Qu’est-ce qu’un connecteur ?">i</button></div><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      <p class="small muted" id="connAide" hidden style="margin:10px 2px 0">Un connecteur relie des notes entre elles : écrivez @ suivi d’un mot dans une émotion, une note ou une synthèse (@travail, @un-ami). Exemples, explications et modification d’un connecteur : <button type="button" class="link" data-act="voirConnecteurs">Paramètres › Connecteurs</button>.</p>${tous.length ? `
      ${champRecherche('connQ', '', 'Rechercher un connecteur')}
      <div class="conn-outils"><p class="small muted" id="connInfo"></p>${boutonsTri()}</div>
      <div class="seg two" id="connMode" hidden><button type="button" data-et="1">Tous à la fois</button><button type="button" data-et="">Au moins un</button></div>
      <div class="conn-liste" id="connListe">${tous.map(c => `<label class="conn-ligne" data-k="${esc(c.k)}" data-t="${esc(sansAccent(c.label))}" data-l="${esc(c.label)}" data-n="${c.n}"><input type="checkbox" value="${esc(c.k)}" ${choix.includes(c.k) ? 'checked' : ''}><span>${esc(c.label)}</span><small>${c.n} note${c.n > 1 ? 's' : ''}</small></label>`).join('')}
        <p class="small muted" id="connRien" hidden style="margin:12px">Aucun connecteur ne correspond.</p></div>`
    : '<p class="small muted" style="margin:0">Aucun connecteur pour l’instant. Dans une émotion, une note ou une synthèse, écrivez @ suivi d’un mot : par exemple @travail, ou @un-ami (le tiret remplace l’espace). Les villes et lieux déjà saisis sont aussi des connecteurs.</p>'}
    </div>
    <div class="dlg-f">${tous.length ? '<button type="button" class="btn" id="connEff">Tout retirer</button>' : ''}<button class="btn primary">${tous.length ? 'Afficher' : 'Fermer'}</button></div>
  </form>`;
  const cases = [...D.querySelectorAll('#connListe input')];
  const maj = () => {
    choix = cases.filter(c => c.checked).map(c => c.value);
    cases.forEach(c => c.disabled = !c.checked && choix.length >= CONN_MAX);
    const i = $('#connInfo');
    if (i) i.textContent = choix.length >= CONN_MAX ? `${CONN_MAX} connecteurs au plus : retirez-en un pour en choisir un autre.` : `${choix.length ? `${choix.length} choisi${choix.length > 1 ? 's' : ''} · ` : ''}jusqu’à ${CONN_MAX} à la fois`;
    // à partir de deux : les notes qui les contiennent tous, ou au moins l'un d'eux
    const m = $('#connMode');
    if (m) { m.hidden = choix.length < 2; m.querySelectorAll('button').forEach(b => { const on = !!b.dataset.et === et; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); }
  };
  const q = $('#connQ'), L = $('#connListe');
  // ceux qui sont cochés en haut, puis tous les autres dans l'ordre choisi ; la liste repart de son début
  const ranger = () => {
    if (!L) return;
    const fiche = l => ({n:+l.dataset.n, label:l.dataset.l}), coche = l => l.querySelector('input').checked;
    [...L.querySelectorAll('.conn-ligne')].sort((a, b) => coche(b) - coche(a) || triConn(fiche(a), fiche(b))).forEach(l => L.insertBefore(l, $('#connRien')));
    L.scrollTop = 0;
  };
  const filtrer = () => {
    const m = cleConn(q.value), t = sansAccent(q.value.trim());
    // pendant une recherche, ceux qui sont choisis restent visibles, en haut
    cases.filter(c => c.checked).reverse().forEach(c => L.prepend(c.closest('.conn-ligne')));
    let n = 0;
    D.querySelectorAll('.conn-ligne').forEach(l => { l.hidden = !!m && !l.querySelector('input').checked && !l.dataset.k.includes(m) && !l.dataset.t.includes(t); if (!l.hidden) n++; });
    $('#connRien').hidden = n > 0;
  };
  // un connecteur choisi pendant une recherche : la recherche s'efface et toute la liste revient, le choix en haut
  cases.forEach(c => c.onchange = () => { maj(); if (q?.value.trim()) { q.value = ''; filtrer(); ranger(); } });
  D.querySelectorAll('#connMode button').forEach(b => b.onclick = () => { et = !!b.dataset.et; maj(); });
  D.querySelectorAll('.tri-conn button').forEach(b => b.onclick = () => {
    choisirTri(b.dataset.tri);
    D.querySelectorAll('.tri-conn button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    ranger();
  });
  if (q) q.oninput = filtrer;
  const eff = $('#connEff'); if (eff) eff.onclick = () => { cases.forEach(c => c.checked = false); maj(); };
  $('#connI').onclick = () => { const a = $('#connAide'), b = $('#connI'); a.hidden = !a.hidden; b.setAttribute('aria-expanded', !a.hidden); };
  $('#connForm').onsubmit = e => { e.preventDefault(); D.close(); };   // le choix s'applique à la fermeture
  maj();
  D.classList.add('conn-dlg');
  D.onclick = e => { if (e.target === D) D.close(); };   // un appui sur le voile, à côté de la fenêtre, la ferme toujours
  // le clavier ne cache jamais la fenêtre : comme toutes les autres, elle se pose juste au-dessus (majClavier) ; seule la liste défile
  const vv = window.visualViewport, ac = new AbortController(), o = {signal:ac.signal, passive:false};
  /* Gestes : la liste défile ; le doigt qui y descend jusqu'au clavier le range ; glisser vers le bas depuis le haut de la fenêtre
     (titre, recherche) la ferme ; partout ailleurs, rien ne bouge, ni la fenêtre ni le fond de l'app */
  let g = null;
  D.addEventListener('touchstart', e => {
    const t = e.touches[0];
    g = e.touches.length === 1 ? {y:t.clientY, t:Date.now(), dy:0, liste:!!e.target.closest('.conn-liste'), fermer:!e.target.closest('.conn-liste, .dlg-f')} : null;
  }, o);
  D.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], q = $('#connQ');
    if (q && document.activeElement === q && vv && t.clientY > vv.offsetTop + vv.height - 40) q.blur();
    if (g.liste) return;
    if (e.cancelable) e.preventDefault();
    if (g.fermer) { g.dy = Math.max(0, t.clientY - g.y); D.style.transition = 'none'; D.style.transform = g.dy ? `translateY(${g.dy}px)` : ''; }
  }, o);
  D.addEventListener('touchend', () => {
    const x = g; g = null;
    if (!x?.dy) return;
    if (x.dy > 90 || (x.dy > 30 && x.dy / (Date.now() - x.t) > .5)) {
      D.style.transition = 'transform .18s ease-in'; D.style.transform = `translateY(${D.offsetHeight}px)`; setTimeout(() => D.close(), 180);
    } else { D.style.transition = 'transform .2s ease-out'; D.style.transform = ''; }
  }, o);
  // quelle que soit la façon de fermer (Afficher, ×, glisser, appui à côté), ce qui est coché s'applique : « Tout retirer » puis fermer retire tout
  D.addEventListener('close', () => {
    ac.abort(); D.classList.remove('conn-dlg'); D.onclick = null;
    Object.assign(D.style, {transform:'', transition:'', marginBottom:'', maxHeight:''});
    if (etat() !== avant) { calC = choix; calCEt = et; listeAPlacer = true; render(true); }
  }, {once:true});
  D.showModal();
  // sécurité : si la mise en page en colonne écrasait la fenêtre (cas de la v35 sur iPhone), on revient à la fenêtre ordinaire
  if (D.querySelector('form').offsetHeight < 60) D.classList.remove('conn-dlg');
}
/* Une fenêtre ouverte (émotion, note, connecteurs, choix du mois…) : le fond de l'app ne bouge jamais. Seul ce qui peut défiler
   dans la fenêtre défile, et sans entraîner le fond une fois au bout (overscroll-behavior). Un doigt resté appuyé dans un champ
   (sélection de texte, curseur déplacé) n'est pas gêné. */
/* Ce qui défile ne défile que dans son sens possible : arrivé tout en haut (ou tout en bas), le geste ne passe plus au fond
   (la fenêtre d'émotion, plus haute que l'écran, entraînait la page derrière elle sur iPhone).
   Le clavier, lui, se range toujours d'un geste vers le bas : le doigt qui descend jusqu'au clavier, ou qui glisse vers le bas
   sur ce qui ne défile pas (haut d'une fenêtre, fenêtre déjà tout en haut). Un doigt resté appuyé (sélection, curseur) n'y touche pas. */
const appui = {t:0, attente:null, y0:0, y:0, bloque:0};   // début du toucher, temps immobile avant de bouger, positions, chemin bloqué vers le bas
document.addEventListener('touchstart', e => {
  const y = e.touches[0]?.clientY ?? 0;
  Object.assign(appui, {t:Date.now(), attente:null, y0:y, y, bloque:0});
}, {passive:true, capture:true});
function peutDefiler(el, dy) {
  const oy = getComputedStyle(el).overflowY;
  if ((oy !== 'auto' && oy !== 'scroll') || el.scrollHeight <= el.clientHeight + 1) return false;
  return dy > 0 ? el.scrollTop > 0 : dy < 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : true;
}
document.addEventListener('touchmove', e => {
  appui.attente ??= Date.now() - appui.t;
  const y = e.touches[0]?.clientY ?? appui.y, dy = y - appui.y;
  appui.y = y;
  const long = appui.attente > 450, vv = window.visualViewport;
  // le doigt qui descend jusqu'au clavier le range, où qu'il soit
  if (!long && dy > 0 && clavierOuvert() && y > vv.offsetTop + vv.height - 40) document.activeElement.blur();
  const d = e.target.closest?.('dialog[open]');
  if (!d || !e.cancelable) return;
  if (e.target.closest('input, textarea, select') && long) return;
  for (let el = e.target; el && el !== d.parentElement; el = el.parentElement) if (peutDefiler(el, dy)) return;
  e.preventDefault();
  // rien ne bouge : un geste franc vers le bas range le clavier
  if (dy > 0) appui.bloque += dy;
  if (!long && appui.bloque > 50 && clavierOuvert()) document.activeElement.blur();
}, {passive:false});
