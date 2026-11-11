// Motus — Paramètres › Connecteurs : explication, exemple, renommage
'use strict';

/* ───────────── Paramètres › Connecteurs : explication, exemple, et renommage dans toutes les notes ───────────── */
let connQ = '';   // recherche dans la liste des connecteurs
let connAide = false;   // explication dépliée : repliée à l'ouverture, pour voir le début de la liste des connecteurs
function pageConnecteurs() {
  const tous = [...connecteurs().values()].sort(triConn);
  const q = sansAccent(connQ.trim()), k = cleConn(connQ);
  return `<section class="card">
    <h2>Relier ses notes</h2>
    <div class="pliable ${connAide ? 'ouvert' : ''}" id="connAideP">
    <p class="small muted" style="margin:6px 0 0">Un connecteur relie les notes qui parlent d’une même personne, d’un même lieu ou d’un même sujet. Écrivez @ suivi d’un mot, sans espace, dans n’importe quel texte de votre journal : émotion (… car), besoin, actions, note personnelle ou synthèse.</p>
    <div class="ex-conn">
      <div class="eyebrow">Ce que vous écrivez</div>
      <p>… car la réunion avec @Paul sur le @projet-Atlas a mal tourné.</p>
      <div class="eyebrow">Ce qui s’affiche</div>
      <p>… car la réunion avec <span class="conn">Paul</span> sur le <span class="conn">projet Atlas</span> a mal tourné.</p>
    </div>
    <ul class="small liste-aide">
      <li>Le tiret remplace l’espace : @un-ami s’affiche « un ami ».</li>
      <li>Dès la première lettre après le @, Motus propose les connecteurs déjà utilisés.</li>
      <li>Majuscules et accents ne comptent pas : @Écriture et @ecriture sont un seul connecteur.</li>
      <li>Les formes proches se rejoignent : @l’entreprise et @entreprises sont @entreprise ; @procrastiné et @procrastine sont @procrastiner.</li>
      <li>Les villes et les lieux saisis avec vos notes sont aussi des connecteurs.</li>
      <li>Journal, en calendrier comme en liste : le bouton « @ Connecteurs » affiche les notes qui contiennent un, deux ou trois connecteurs ; toucher un connecteur dans une note affiche toutes celles qui le contiennent.</li>
    </ul>
    </div>
    <button type="button" class="plier" data-act="plierAide" aria-expanded="${connAide}" aria-controls="connAideP" aria-label="${connAide ? 'Réduire l’explication' : 'Lire toute l’explication'}">${ico('ch', '')}</button>
  </section>
  <section class="card">
    <div class="card-h" style="margin:0"><h2>Mes connecteurs</h2>${tous.length > 1 ? boutonsTri() : ''}</div>
    ${tous.length ? `<p class="small muted" style="margin:6px 0 10px">Touchez un connecteur pour le renommer : il change dans toutes les notes qui le contiennent.</p>
    ${tous.length > 8 ? champRecherche('connGQ', connQ, 'Rechercher un connecteur') : ''}
    <div class="conn-liste conn-gestion" id="connGestion">${tous.map(c => `<button type="button" class="conn-ligne" data-act="renommerConn" data-k="${esc(c.k)}" data-t="${esc(sansAccent(c.label))}" ${q && !c.k.includes(k) && !sansAccent(c.label).includes(q) ? 'hidden' : ''}><span>${esc(c.label)}</span><small>${c.n} note${c.n > 1 ? 's' : ''}${c.lieu ? ' · lieu' : ''}</small>${ico('ch', 'rc')}</button>`).join('')}</div>`
    : '<p class="small muted" style="margin:6px 0 0">Aucun connecteur pour l’instant. Le premier apparaîtra ici dès que vous en écrirez un.</p>'}
  </section>
  <div id="connEspace"></div>`;
}
/* Dès qu'on cherche un connecteur, la recherche monte en haut de l'écran et n'en bouge plus : la place laissée sous la liste
   (#connEspace) garde la page assez longue, même quand il ne reste qu'un ou deux connecteurs */
const hautSur = () => { const p = document.createElement('div'); p.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'; document.body.appendChild(p); const h = p.offsetHeight; p.remove(); return h; };
function rechercheEnHaut() {
  const c = $('#connGQ')?.closest('.champ-recherche'), e = $('#connEspace');
  if (!c || !e) return;
  e.style.height = `${innerHeight}px`;
  window.scrollTo(0, Math.max(0, c.getBoundingClientRect().top + scrollY - hautSur() - 10));
}
document.addEventListener('focusin', e => { if (e.target.id === 'connGQ') { rechercheEnHaut(); setTimeout(rechercheEnHaut, 400); } });
// ordre de la liste (A→Z ou nombre) ; dans la fenêtre du Journal, les boutons ont leur propre réglage
document.addEventListener('click', e => { const b = e.target.closest('#view .tri-conn button'); if (b) { choisirTri(b.dataset.tri); render(true); } });
/* L'explication, repliée sous sa flèche, se déplie et se replie sans changer de page */
function plierAide(t) {
  const p = $('#connAideP'); if (!p) return;
  connAide = !p.classList.contains('ouvert');
  p.classList.toggle('ouvert', connAide);
  t.setAttribute('aria-expanded', connAide);
  t.setAttribute('aria-label', connAide ? 'Réduire l’explication' : 'Lire toute l’explication');
}
/* Ce que touche un renommage : les textes qui contiennent le connecteur, et les villes ou lieux qui portent ce nom */
function usagesConn(k) {
  let textes = 0, lieux = 0;
  const dans = s => [...String(s ?? '').matchAll(RE_CONN)].some(x => cleC(x[2]) === k);
  for (const d of Object.values(data.days)) {
    for (const o of [...(d.entries || []).map(e => [texteEmotion(e), e]), ...dayNotes(d).map(n => [n.text, n])]) {
      if (dans(o[0])) textes++;
      if (cleC(o[1].ville) === k || cleC(o[1].lieu) === k) lieux++;
    }
    if (dans(d.synth)) textes++;
  }
  return {textes, lieux};
}
const RE_MOT_CONN = /^@[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*$/u;
function ouvrirRenommer(k) {
  const c = connecteurs().get(k);
  if (!c) return;
  const D = $('#codeDlg'), u = usagesConn(k), s = n => n > 1 ? 's' : '';
  D.innerHTML = `<form method="dialog" id="rnForm">
    <div class="dlg-h"><h2>Renommer « ${esc(c.label)} »</h2><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      <label class="label" for="rnNom">Nouveau nom</label>
      <input type="text" id="rnNom" value="${esc(c.label)}" autocomplete="off" enterkeyhint="done">
      <p class="small muted" id="rnApercu" style="margin:8px 2px 0"></p>
      <p class="small muted" style="margin:6px 2px 0">${[u.textes ? `Il sera remplacé dans ${u.textes} note${s(u.textes)} (émotion avec son besoin et ses actions, note personnelle ou synthèse).` : '',
        u.lieux ? `C’est aussi la ville ou le lieu de ${u.lieux} note${s(u.lieux)} : ce champ prendra le nouveau nom.` : ''].filter(Boolean).join(' ')}</p>
      <p class="small" id="rnFusion" hidden style="margin:6px 2px 0"></p>
      <div class="err" id="rnErr"></div>
    </div>
    <div class="dlg-f"><button type="button" class="btn" id="rnNon">Annuler</button><button class="btn primary">Renommer</button></div>
  </form>`;
  const champ = $('#rnNom');
  const lire = () => {
    const nom = champ.value.replace(/^\s*@/, '').trim().replace(/\s+/g, ' '), mot = motConn(nom), nk = cleC(nom), autre = nk !== k && connecteurs().get(nk);
    return {nom, mot, nk, autre, ok:!!nom && RE_MOT_CONN.test(mot)};
  };
  const maj = () => {
    const r = lire();
    $('#rnApercu').innerHTML = r.ok ? `S’écrira ${esc(r.mot)}, et s’affichera <span class="conn">${esc(r.nom)}</span>.` : '';
    $('#rnFusion').hidden = !r.autre;
    if (r.autre) $('#rnFusion').textContent = `« ${r.autre.label} » existe déjà : les deux connecteurs n’en feront plus qu’un.`;
    $('#rnErr').textContent = '';
  };
  champ.oninput = maj;
  $('#rnNon').onclick = () => D.close();
  $('#rnForm').onsubmit = e => {
    e.preventDefault();
    const r = lire();
    if (!r.ok) return $('#rnErr').textContent = 'Utilisez des lettres et des chiffres, séparés au besoin par des espaces, des tirets ou une apostrophe.';
    if (r.nom === c.label) return D.close();
    const n = renommerConnecteur(k, r.nom);
    D.close();
    calC = [...new Set(calC.map(x => x === k ? r.nk : x))];
    save(); render(true);
    toast(`Connecteur renommé${n ? ` dans ${n} note${s(n)}` : ''}`);
  };
  maj();
  D.showModal();
}
/* Remplace le connecteur k partout dans le journal, toutes ses formes proches comprises ; renvoie le nombre d'émotions, de notes
   et de synthèses modifiées. Un article élidé reste devant un nom qui commence par une voyelle ou un h (@l’entreprise → @l’atelier). */
function renommerConnecteur(k, nom) {
  const mot = motConn(nom), voyelle = /^[aeiouyhàâäéèêëîïôöùûü]/i.test(mot.slice(1));
  const rempl = s => typeof s === 'string' ? s.replace(RE_CONN, (x, avant, w) => {
    if (cleC(w) !== k) return x;
    const art = voyelle ? w.match(RE_ART)?.[0] || '' : '';
    return avant + '@' + art + mot.slice(1);
  }) : s;
  let n = 0;
  for (const d of Object.values(data.days)) {
    // une émotion : tous ses textes (… car, besoin en détail, actions, « Je pourrais… ») ; une note : son texte
    for (const o of [...(d.entries || []), ...dayNotes(d)]) {
      const avant = JSON.stringify(o);
      for (const champ of ['car', 'bdet', 'piste', 'text']) if (typeof o[champ] === 'string') o[champ] = rempl(o[champ]);
      for (const x of o.taches || []) if (typeof x?.t === 'string') x.t = rempl(x.t);
      if (cleC(o.ville) === k) o.ville = nom;
      if (cleC(o.lieu) === k) o.lieu = nom;
      if (JSON.stringify(o) !== avant) n++;
    }
    const sy = rempl(d.synth);
    if (sy !== d.synth) { d.synth = sy; n++; }
  }
  connCache = null;
  return n;
}

