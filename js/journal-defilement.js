// Motus — Journal : en-têtes collés, barre compacte, choix du mois, position dans la liste
'use strict';

/* Un trait sous la date ou le mois quand ils restent collés en haut pendant le défilement */
function marquerEntete() {
  const h = $('#view .dayhead, #view .calhead');
  h?.classList.toggle('colle', scrollY > 0 && h.getBoundingClientRect().top <= parseFloat(getComputedStyle(h).top) + .5);
}
/* Journal : la barre compacte qui suit le doigt. Le mois reste toujours en haut. Tant que le vrai choix calendrier/liste
   est visible en haut de page, la barre reste cachée ; plus bas, elle redescend sous le mois au rythme du doigt quand on
   remonte, et remonte quand on redescend. Déployée (recherche et filtres), elle se replie dès qu'on redescend. */
const entJ = {y:0, cache:Infinity, deploye:false};   // dernière position de la page, part de la barre cachée, recherche et filtres déployés
function entetesJournal() {
  const bar = $('#view #barreJ'), h = $('#view .calhead'), nat = $('#view #enteteJ .seg');
  if (!bar || !h || !nat) return;
  const inn = bar.firstElementChild, y = Math.max(0, scrollY), d = y - entJ.y, haut = parseFloat(getComputedStyle(h).top) + h.offsetHeight;
  entJ.y = y;
  bar.style.top = `${haut}px`;
  if (d > 0 && entJ.deploye) replierEntete();
  const H = inn.offsetHeight, segB = inn.querySelector('.seg');
  // la barre ne s'efface que lorsque le vrai choix calendrier/liste est entièrement revenu à sa place sous le mois, juste derrière elle :
  // avant, il est encore en partie caché sous le mois et la barre disparaissait trop tôt
  const revenu = y <= 0 || nat.getBoundingClientRect().top >= haut + (segB ? segB.offsetTop : 0) - 1;
  entJ.cache = revenu ? H : Math.min(H, Math.max(0, entJ.cache + d));
  inn.style.transform = `translateY(${-entJ.cache}px)`;
  inn.style.visibility = entJ.cache >= H ? '' : 'visible';
  h.classList.toggle('sans-trait', entJ.cache < H);
}
/* Répertoire : la même barre compacte, en haut de l'écran (il n'y a pas d'en-tête collé au-dessus). Elle descend avec le doigt
   qui fait remonter la page, remonte quand on redescend, et s'efface dès que le vrai choix Émotions / Besoins est revenu à sa place. */
const entR = {y:0, cache:Infinity};
function barreRepertoire() {
  const bar = $('#view #barreR'), nat = $('#view #repSeg');
  if (!bar || !nat) return;
  const inn = bar.firstElementChild, y = Math.max(0, scrollY), d = y - entR.y, haut = parseFloat(getComputedStyle(bar).top) || 0;
  entR.y = y;
  const H = inn.offsetHeight, segB = inn.querySelector('.seg');
  const revenu = y <= 0 || nat.getBoundingClientRect().top >= haut + (segB ? segB.offsetTop : 0) - 1;
  entR.cache = revenu ? H : Math.min(H, Math.max(0, entR.cache + d));
  inn.style.transform = `translateY(${-entR.cache}px)`;
  inn.style.visibility = entR.cache >= H ? '' : 'visible';
}
/* Quotidien : le mini-calendrier, avec la même règle que la barre Calendrier/Liste du Journal (sa demande, v42). Sous la date
   collée en haut, il descend au rythme du doigt quand on remonte la page, et remonte quand on redescend ; tout en haut de la
   page, tirer vers le bas le fait descendre de même. Lâché à moitié, il finit de s'ouvrir ou de se refermer. Toucher un jour
   y mène ; ‹ › changent de mois. */
const entQ = {y:0, cache:Infinity, ref:null, an:0, mo:0, fin:null};
function contenuQ() {
  if (entQ.ref !== cur) { entQ.ref = cur; entQ.an = +cur.slice(0, 4); entQ.mo = +cur.slice(5, 7) - 1; }
  const n = new Date(), dernier = entQ.an === n.getFullYear() && entQ.mo >= n.getMonth();
  return `<div class="annee-nav"><button type="button" class="icon-btn" data-act="moisQ" data-pas="-1" aria-label="Mois précédent">‹</button><b>${MOIS[entQ.mo]} ${entQ.an}</b><button type="button" class="icon-btn" data-act="moisQ" data-pas="1" aria-label="Mois suivant" ${dernier ? 'disabled' : ''}>›</button></div>
    <div class="cal jours-grille">${grilleJours(entQ.an, entQ.mo, 'jourQ')}</div>`;
}
const barreQ = () => `<div id="barreQ"><div class="barreJ-in barreQ-in" aria-label="Mini-calendrier">${contenuQ()}</div></div>`;
function poserQ(anim = false) {
  const inn = $('#view #barreQ .barreQ-in'); if (!inn) return;
  const H = inn.offsetHeight, c = Math.min(entQ.cache, H);
  inn.style.transition = anim ? 'transform .2s ease-out' : 'none';
  inn.style.transform = `translateY(${-c}px)`;
  if (c < H) inn.style.visibility = 'visible';
  else if (anim) setTimeout(() => { if (entQ.cache >= inn.offsetHeight) inn.style.visibility = ''; }, 210);
  else inn.style.visibility = '';
  $('#view .dayhead')?.classList.toggle('sans-trait', c < H);
}
function barreQuotidien() {
  const bar = $('#view #barreQ'), h = $('#view .dayhead');
  if (!bar || !h) return;
  const y = Math.max(0, scrollY), d = y - entQ.y, H = bar.firstElementChild.offsetHeight;
  entQ.y = y;
  bar.style.top = `${parseFloat(getComputedStyle(h).top) + h.offsetHeight}px`;
  entQ.cache = Math.min(H, Math.max(0, entQ.cache + d));
  poserQ();
  // le défilement fini, un mini-calendrier à moitié sorti s'ouvre ou se referme
  clearTimeout(entQ.fin);
  entQ.fin = setTimeout(() => { const H2 = bar.firstElementChild?.offsetHeight || 0; if (entQ.cache > 0 && entQ.cache < H2 && !gq) { entQ.cache = entQ.cache < H2 / 2 ? 0 : H2; poserQ(true); } }, 180);
}
// tout en haut de la page, rien ne défile : le doigt qui tire vers le bas fait descendre le mini-calendrier lui-même
let gq = null;
document.addEventListener('touchstart', e => {
  gq = null;
  if (view !== 'day' || $('#app').hidden || $('dialog[open]') || e.touches.length !== 1 || scrollY > 1 || texteSelectionne() || clavierOuvert()) return;
  if (e.target.closest('input, textarea, select') || !$('#view #barreQ')) return;
  gq = {y:e.touches[0].clientY, x:e.touches[0].clientX, sens:null, c0:Math.min(entQ.cache, $('#view #barreQ .barreQ-in').offsetHeight)};
}, {passive:true});
document.addEventListener('touchmove', e => {
  const g = gq;
  if (!g || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
  if (!g.sens && Math.hypot(dx, dy) > 10) g.sens = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
  if (g.sens !== 'v') return;
  const H = $('#view #barreQ .barreQ-in').offsetHeight, court = document.documentElement.scrollHeight <= innerHeight + 1;
  if (dy < 0 && !court) { gq = null; return; }   // vers le haut : la page défile, et le défilement replie le mini-calendrier
  if (e.cancelable) e.preventDefault();
  entQ.cache = Math.min(H, Math.max(0, g.c0 - dy));
  g.bouge = true;
  poserQ();
}, {passive:false});
document.addEventListener('touchend', () => {
  const g = gq; gq = null;
  if (!g?.bouge) return;
  avalerClic = Date.now();   // le doigt levé ne touche pas un jour
  const H = $('#view #barreQ .barreQ-in')?.offsetHeight || 0;
  entQ.cache = entQ.cache < H / 2 ? 0 : H;
  poserQ(true);
}, {passive:true});
function replierEntete() {
  entJ.deploye = false;
  const p = $('#view .barreJ-plus'); if (p) p.hidden = true;
  $('#view [data-act=deployerEntete]')?.setAttribute('aria-expanded', 'false');
}
/* bas de ce qui reste collé en haut de l'écran : le mois, et la barre compacte si elle est visible */
function basEntete() {
  const h = $('#view .calhead'), inn = $('#view .barreJ-in');
  return Math.max(h ? h.getBoundingClientRect().bottom : 0, inn && inn.style.visibility === 'visible' ? inn.getBoundingClientRect().bottom : 0);
}
/* Journal : choisir n'importe quel mois passé, en quelques gestes. La fenêtre s'ouvre juste sous le mois, par-dessus le reste
   de l'en-tête. L'année se change avec ‹ › ou en balayant les mois (l'année voisine suit le doigt), puis on touche le mois.
   Sous chaque mois, le nombre de notes : émotions, notes personnelles et synthèses ; les mois à venir sont grisés.
   Quotidien (jour) : la même fenêtre s'ouvre sous la date, sur les jours du mois affiché avec leur couleur ; ‹ › ou un balayage
   changent de mois, et toucher le nom du mois montre les douze mois de l'année, comme dans le Journal. */
const MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
/* Les jours d'un mois, sur six semaines comme le calendrier : la grille garde sa hauteur d'un mois à l'autre.
   act : l'action d'un jour touché (le mini-calendrier du Quotidien) ; sans elle, la fenêtre du choix du mois s'en occupe. */
function grilleJours(y, m, act = '') {
  const t = today(), off = (new Date(y, m, 1).getDay() + 6) % 7, nj = new Date(y, m + 1, 0).getDate();
  let h = ['L','M','M','J','V','S','D'].map(w => `<div class="wd">${w}</div>`).join('') + '<div class="cvide"></div>'.repeat(off);
  for (let i = 1; i <= nj; i++) {
    const k = ymd(new Date(y, m, i)), d = D().days[k];
    h += `<button type="button" class="cday ${d?.color || ''} ${k === t ? 'today' : ''} ${k === cur ? 'on' : ''} ${k > t ? 'future' : ''}" data-k="${k}"${act ? ` data-act="${act}"` : ''} ${k > t ? 'disabled' : ''} aria-label="${fmtLong(k)}">${i}${d?.entries?.length ? '<span class="has"></span>' : ''}${dayNotes(d).length ? '<span class="nt"></span>' : ''}</button>`;
  }
  return h + '<div class="cvide"></div>'.repeat(42 - off - nj);
}
function choisirMois(jour = false) {
  const now = new Date(), ny = now.getFullYear(), nm = now.getMonth(), t = today(), compte = {};
  for (const [k, d] of Object.entries(D().days)) {
    const n = (d.entries?.length || 0) + dayNotes(d).length + (d.synth?.trim() ? 1 : 0);
    if (n) { const c = `${+k.slice(0, 4)}-${+k.slice(5, 7) - 1}`; compte[c] = (compte[c] || 0) + n; }
  }
  const ref = jour ? parse(cur) : new Date(calY, calM, 1), selY = ref.getFullYear(), selM = ref.getMonth();   // le mois affiché
  const cree = !src && data.account?.cree_le ? new Date(data.account.cree_le).getFullYear() : ny;
  const premiere = Math.min(cree, selY, ...Object.keys(compte).map(x => +x.split('-')[0]));   // on ne remonte pas avant le tout premier mois utile
  let an = selY, mo = selM, niveau = jour ? 'jours' : 'mois';
  const boutons = y => MOIS_COURTS.map((n, m) => {
    const c = compte[`${y}-${m}`];
    return `<button type="button" data-m="${m}" class="${y === selY && m === selM ? 'on' : ''}" ${y === ny && m > nm ? 'disabled' : ''} aria-label="${MOIS[m]} ${y}${c ? `, ${c} note${c > 1 ? 's' : ''}` : ''}">${n}<small>${c || ''}</small></button>`;
  }).join('');
  const jours = (y, m) => grilleJours(y, m);
  const contenu = (y, m) => niveau === 'jours' ? jours(y, m) : boutons(y);
  const decaler = pas => { if (niveau === 'mois') return [an + pas, mo]; const m = mo + pas; return m < 0 ? [an - 1, 11] : m > 11 ? [an + 1, 0] : [an, m]; };
  const grille = () => {
    const j = niveau === 'jours';
    $('#anChoix').innerHTML = j ? `<button type="button" class="titre-mois" id="versMois" aria-label="Voir les mois de ${an}"><span class="tm">${MOIS[mo]} ${an}</span>${ico('ch', 'tm-fl')}</button>` : an;
    $('#anMoins').disabled = j ? an <= premiere && mo === 0 : an <= premiere;
    $('#anPlus').disabled = j ? an === ny && mo >= nm : an >= ny;
    $('#anMoins').setAttribute('aria-label', j ? 'Mois précédent' : 'Année précédente');
    $('#anPlus').setAttribute('aria-label', j ? 'Mois suivant' : 'Année suivante');
    $('#moisGrille').className = j ? 'cal jours-grille' : 'mois-grille';
    $('#moisGrille').innerHTML = contenu(an, mo);
    $('#moisAide').textContent = j ? 'Touchez le nom du mois pour voir toute l’année.' : 'Sous chaque mois, le nombre de notes enregistrées : émotions, notes personnelles et synthèses.';
  };
  const dlg = $('#codeDlg'), h = $('#view .calhead, #view .dayhead');
  dlg.innerHTML = `<form method="dialog" id="moisForm">
    <div class="dlg-b">
      <div class="annee-nav"><button type="button" class="icon-btn" id="anMoins">‹</button><b id="anChoix"></b><button type="button" class="icon-btn" id="anPlus">›</button></div>
      <div class="mois-cadre" id="moisCadre"><div id="moisGrille"></div></div>
      <p class="small muted" id="moisAide" style="margin:10px 0 0"></p>
    </div>
    <div class="dlg-f"><button type="button" class="btn" id="moisNon">Annuler</button><button type="button" class="btn primary" id="moisActuel">${jour ? 'Aujourd’hui' : 'Ce mois-ci'}</button></div>
  </form>`;
  dlg.classList.add('en-haut');
  dlg.style.setProperty('--haut', `${Math.round(h ? h.getBoundingClientRect().bottom : 0)}px`);
  dlg.addEventListener('close', () => { dlg.classList.remove('en-haut'); dlg.onclick = null; }, {once:true});
  const aller = (y, m) => { dlg.close(); calY = y; calM = m; listeAPlacer = true; render(true); };
  const allerJour = k => { dlg.close(); cur = k; render(); };
  $('#anMoins').onclick = () => { [an, mo] = decaler(-1); grille(); };
  $('#anPlus').onclick = () => { [an, mo] = decaler(1); grille(); };
  $('#anChoix').onclick = e => { if (e.target.closest('#versMois')) { niveau = 'mois'; grille(); } };
  $('#moisGrille').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.k) allerJour(b.dataset.k);                          // un jour : on y va
    else if (jour) { mo = +b.dataset.m; niveau = 'jours'; grille(); }  // Quotidien : un mois montre ses jours
    else aller(an, +b.dataset.m);
  };
  $('#moisNon').onclick = () => dlg.close();
  $('#moisActuel').onclick = () => jour ? allerJour(t) : aller(ny, nm);
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };   // un appui à côté de la fenêtre la ferme

  /* Balayer la grille change de mois (jours) ou d'année (mois), comme ailleurs dans l'app : la voisine arrive à côté en suivant le doigt */
  const cadre = $('#moisCadre');
  let g = null;
  const possible = dx => !$(dx > 0 ? '#anMoins' : '#anPlus').disabled;
  const placer = (x, transition = 'none') => { for (const e of [$('#moisGrille'), g?.voisine]) if (e) { e.style.transition = transition; e.style.transform = x ? `translateX(${x}px)` : ''; } };
  const finir = () => { g?.voisine?.remove(); const gr = $('#moisGrille'); gr.style.transition = ''; gr.style.transform = ''; g = null; };
  cadre.addEventListener('touchstart', e => { g = e.touches.length === 1 && !texteSelectionne() ? {x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now(), sens:null, cote:0, voisine:null} : null; }, {passive:true});
  cadre.addEventListener('touchmove', e => {
    if (!g || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
    if (!g.sens && Math.hypot(dx, dy) > 12) g.sens = Date.now() - g.t > 450 ? 'selection' : Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    if (g.sens !== 'h') return;
    if (e.cancelable) e.preventDefault();
    const cote = possible(dx) ? Math.sign(dx) : 0;
    if (cote !== g.cote) {
      g.voisine?.remove(); g.voisine = null; g.cote = cote;
      if (cote) {
        const gr = $('#moisGrille'), v = document.createElement('div');
        v.className = gr.className; v.setAttribute('aria-hidden', 'true'); v.innerHTML = contenu(...decaler(-cote));
        Object.assign(v.style, {position:'absolute', top:'0', left:`${-cote * (gr.offsetWidth + 16)}px`, width:`${gr.offsetWidth}px`, pointerEvents:'none'});
        cadre.appendChild(v); g.voisine = v;
      }
    }
    placer(possible(dx) ? dx : dx / 4);
  }, {passive:false});
  cadre.addEventListener('touchend', e => {
    if (!g) return;
    const dx = e.changedTouches[0].clientX - g.x, dy = e.changedTouches[0].clientY - g.y, dt = Date.now() - g.t;
    const va = g.sens === 'h' && possible(dx) && dt < 1250 && Math.abs(dy) <= 1.2 * Math.abs(dx) && (Math.abs(dx) >= 50 || (Math.abs(dx) >= 30 && Math.abs(dx) / dt > .5));
    if (!va) { placer(0, 'transform .2s ease-out'); setTimeout(finir, 220); return; }
    const cote = Math.sign(dx);
    placer(cote * ($('#moisGrille').offsetWidth + 16), 'transform .18s ease-out');
    setTimeout(() => { [an, mo] = decaler(-cote); grille(); finir(); }, 180);
  }, {passive:true});

  /* Elle descend de la date : un geste vers le haut, parti de n'importe où dans la fenêtre, la referme (v42) */
  let gh = null;
  const form = $('#moisForm');
  form.addEventListener('touchstart', e => { gh = e.touches.length === 1 ? {x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now()} : null; }, {passive:true});
  form.addEventListener('touchmove', e => {
    if (!gh || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - gh.x, dy = e.touches[0].clientY - gh.y;
    if (dy < -50 && Math.abs(dy) > Math.abs(dx) && Date.now() - gh.t < 1250) {
      gh = null; dlg.close();
      // le doigt levé ne touche rien sur la page
      avalerClic = Date.now() + 3000; document.addEventListener('touchend', () => avalerClic = Date.now(), {once:true, capture:true});
    }
  }, {passive:true});

  grille();
  dlg.showModal();
}
/* Journal en liste : où se trouve, à l'écran, le nom du mois affiché. Quand on change de mois (balayage ou flèches),
   le nouveau mois prend exactement cette place : seules les notes changent, l'en-tête ne bouge pas. */
function posListe(voisine = false) {
  const s = $(`#view .mois-sep[data-mois="${calY}-${calM}"]`), h = $('#view .calhead'), b = basEntete() + 4;
  if (!s) return null;
  const top = s.getBoundingClientRect().top;
  if (voisine || top <= b + 36) return Math.max(top, b);
  // tout en haut de la liste, le mois en cours est plus bas, sous la recherche et les filtres : le mois voisin vient alors
  // directement sous l'en-tête, à la place qu'il aura une fois collé en haut (sinon il arrivait au milieu de la page
  // et l'en-tête revenait au mois en cours). Pendant le geste, la page voisine reste à la place du mois affiché.
  return (h ? parseFloat(getComputedStyle(h).top) + h.offsetHeight : 0) + 4;
}
let posVoulue = null;   // place à l'écran du nom du mois, notée avant de changer de mois
/* Journal en liste : le mois affiché le plus proche, avant (pas -1) ou après (pas 1) le mois en cours de lecture.
   Avec un filtre, les mois sans rien n'y sont pas : les flèches et le balayage passent directement au suivant qui a des notes. */
function moisListe(pas) {
  const cur = calY * 12 + calM;
  let r = null;
  for (const b of document.querySelectorAll('#view #listeNotes .mois-bloc')) {   // du plus récent au plus ancien
    const [y, m] = b.dataset.mois.split('-').map(Number), v = y * 12 + m;
    if (pas < 0 && v < cur) return [y, m];
    if (pas > 0 && v > cur) r = [y, m];
  }
  return r;
}
function changerMois(pas) {
  if (view === 'cal' && calMode === 'list') {
    const v = moisListe(pas);
    if (!v) return;
    posVoulue = posListe(); [calY, calM] = v;
  } else { calM += pas; if (calM < 0) { calM = 11; calY--; } else if (calM > 11) { calM = 0; calY++; } }
  listeAPlacer = true; render(true);
}
/* Journal en liste : amène le mois calM à la place voulue ; sinon (ouverture, « Revenir au mois en cours »),
   le mois en cours en haut de la page, ou un autre mois juste sous l'en-tête */
function allerAuMois() {
  let s = $(`#view .mois-sep[data-mois="${calY}-${calM}"]`);
  const h = $('#view .calhead'), pos = posVoulue;
  posVoulue = null;
  if (!s && h) {   // filtre : ce mois n'a rien et n'est pas affiché ; on va au plus proche qui a des notes, plus ancien d'abord
    const v = moisListe(-1) || moisListe(1);
    if (v) {
      [calY, calM] = v; s = $(`#view .mois-sep[data-mois="${calY}-${calM}"]`);
      const n = new Date(), tm = h.querySelector('h1 .tm'), nx = h.querySelector('[data-act=nextMonth]');
      if (tm) tm.textContent = `${MOIS[calM]} ${calY}`;
      if (nx) nx.disabled = calY === n.getFullYear() && calM === n.getMonth();
    }
  }
  if (!s || !h) return;
  if (pos != null) window.scrollTo(0, Math.max(0, s.getBoundingClientRect().top + scrollY - pos));   // la barre garde son état
  else if (s === $('#view .mois-sep')) window.scrollTo(0, 0);
  else window.scrollTo(0, Math.max(0, s.getBoundingClientRect().top + scrollY - (basEntete() + 4)));
  entJ.y = Math.max(0, scrollY); entetesJournal();
}
/* … et pendant le défilement, l'en-tête affiche le mois qui est en haut de l'écran */
function majEnteteListe() {
  if (view !== 'cal' || calMode !== 'list' || calQ.trim()) return;
  const h = $('#view .calhead'), seps = [...document.querySelectorAll('#view .mois-sep')];
  if (!h || !seps.length) return;
  // le mois lu est celui dont le nom est passé sous l'en-tête (ou juste en dessous)
  const bas = basEntete() + 40;
  let s = seps[0];
  for (const x of seps) { if (x.getBoundingClientRect().top <= bas) s = x; else break; }
  const [y, m] = s.dataset.mois.split('-').map(Number), now = new Date(), actuel = y === now.getFullYear() && m === now.getMonth();
  if (y !== calY || m !== calM) {
    calY = y; calM = m;
    h.querySelector('h1 .tm').textContent = `${MOIS[m]} ${y}`;
    h.querySelector('[data-act=nextMonth]').disabled = actuel;
  }
  // en haut de la liste : « Ce mois-ci » ; dès qu'on est descendu dans les notes : de quoi revenir à aujourd'hui, tout en haut
  const enHaut = actuel && seps[0].getBoundingClientRect().top > basEntete(), e = h.querySelector('.eyebrow');
  if (e.dataset.etat !== String(enHaut)) {
    e.dataset.etat = enHaut;
    e.innerHTML = enHaut ? 'Ce mois-ci' : '<button class="link" data-act="moisEnCours">Revenir à aujourd’hui</button>';
  }
}
addEventListener('scroll', () => { marquerEntete(); entetesJournal(); majEnteteListe(); barreRepertoire(); barreQuotidien(); }, {passive:true});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (t && ACT[t.dataset.act] && !t.disabled) { e.preventDefault(); ACT[t.dataset.act](t, e); }
});
