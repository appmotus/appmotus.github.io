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
    D.onclose = () => fin(false);
    D.showModal();
  });
}
/* Journal en liste : choisir jusqu'à 3 connecteurs, classés par ordre alphabétique, avec une recherche */
const CONN_MAX = 3;
function ouvrirConnecteurs() {
  let choix = calC.filter(k => connecteurs().has(k)), et = calCEt;
  // ceux déjà choisis en haut, pour pouvoir les retirer sans les chercher ; puis tous les autres, par ordre alphabétique
  const D = $('#codeDlg'), tous = [...connecteurs().values()].sort((a, b) => choix.includes(b.k) - choix.includes(a.k) || a.label.localeCompare(b.label, 'fr', {sensitivity:'base'}));
  const etat = () => JSON.stringify([[...choix].sort(), et]), avant = etat();
  D.innerHTML = `<form method="dialog" id="connForm">
    <div class="dlg-h"><div class="titre-i"><h2 tabindex="-1" autofocus>Connecteurs</h2><button type="button" class="btn-i" id="connI" aria-expanded="false" aria-controls="connAide" aria-label="Qu’est-ce qu’un connecteur ?">i</button></div><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      <p class="small muted" id="connAide" hidden style="margin:10px 2px 0">Un connecteur relie des notes entre elles : écrivez @ suivi d’un mot dans une émotion, une note ou une synthèse (@travail, @un-ami). Exemples, explications et modification d’un connecteur : <button type="button" class="link" data-act="voirConnecteurs">Paramètres › Connecteurs</button>.</p>${tous.length ? `
      ${champRecherche('connQ', '', 'Rechercher un connecteur')}
      <p class="small muted" id="connInfo" style="margin:8px 2px 0"></p>
      <div class="seg two" id="connMode" hidden><button type="button" data-et="1">Tous à la fois</button><button type="button" data-et="">Au moins un</button></div>
      <div class="conn-liste" id="connListe">${tous.map(c => `<label class="conn-ligne" data-k="${esc(c.k)}" data-t="${esc(sansAccent(c.label))}"><input type="checkbox" value="${esc(c.k)}" ${choix.includes(c.k) ? 'checked' : ''}><span>${esc(c.label)}</span><small>${c.n} note${c.n > 1 ? 's' : ''}</small></label>`).join('')}
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
  cases.forEach(c => c.onchange = maj);
  D.querySelectorAll('#connMode button').forEach(b => b.onclick = () => { et = !!b.dataset.et; maj(); });
  const q = $('#connQ');
  if (q) q.oninput = () => {
    const m = cleConn(q.value), t = sansAccent(q.value.trim());
    // pendant une recherche, ceux qui sont choisis restent visibles, en haut
    const L = $('#connListe');
    cases.filter(c => c.checked).reverse().forEach(c => L.prepend(c.closest('.conn-ligne')));
    let n = 0;
    D.querySelectorAll('.conn-ligne').forEach(l => { l.hidden = !!m && !l.querySelector('input').checked && !l.dataset.k.includes(m) && !l.dataset.t.includes(t); if (!l.hidden) n++; });
    $('#connRien').hidden = n > 0;
  };
  const eff = $('#connEff'); if (eff) eff.onclick = () => { cases.forEach(c => c.checked = false); maj(); };
  $('#connI').onclick = () => { const a = $('#connAide'), b = $('#connI'); a.hidden = !a.hidden; b.setAttribute('aria-expanded', !a.hidden); };
  $('#connForm').onsubmit = e => { e.preventDefault(); D.close(); };   // le choix s'applique à la fermeture
  maj();
  D.classList.add('conn-dlg');
  D.onclick = e => { if (e.target === D) D.close(); };   // un appui sur le voile, à côté de la fenêtre, la ferme toujours
  // le clavier ne cache jamais la fenêtre : elle se pose juste au-dessus et rétrécit, seule la liste défile
  const vv = window.visualViewport, ac = new AbortController(), o = {signal:ac.signal, passive:false};
  const caler = () => {
    const bas = vv ? Math.max(0, innerHeight - (vv.offsetTop + vv.height)) : 0;
    D.style.marginBottom = bas > 0 ? `${bas}px` : '';
    D.style.maxHeight = bas > 0 ? `${vv.height - 8}px` : '';
  };
  vv?.addEventListener('resize', caler, {signal:ac.signal}); vv?.addEventListener('scroll', caler, {signal:ac.signal});
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
const clavierOuvert = () => { const vv = window.visualViewport, a = document.activeElement; return !!vv && innerHeight - vv.height > 120 && !!a?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea'); };
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
