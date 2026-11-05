// Motus — Saisie : ville automatique, fenêtre d'une émotion (volets émotions et besoins), note personnelle
'use strict';

/* ───────────── Saisie d'une émotion ───────────── */
let ed = null;
/* Valeurs déjà saisies pour un champ (lieu, ville), les plus récentes d'abord */
function recent(field) {
  const seen = new Map();
  Object.keys(data.days).sort().reverse().forEach(k => [...data.days[k].entries, ...dayNotes(data.days[k])].sort((a,b) => b.time.localeCompare(a.time)).forEach(e => {
    const l = (e[field] || '').trim(); if (l && !seen.has(l.toLowerCase())) seen.set(l.toLowerCase(), l);
  }));
  return [...seen.values()].slice(0, 20);
}

/* ───────────── Ville automatique : GPS + liste des communes intégrée (aucun envoi) ───────────── */
let communes = null;
function loadCommunes() {
  return communes ||= fetch('communes.txt').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => {
    const lines = t.split('\n'), n = new Array(lines.length), la = new Float64Array(lines.length), lo = new Float64Array(lines.length);
    lines.forEach((l, i) => { const [a, b, c] = l.split('\t'); n[i] = a; la[i] = +b; lo[i] = +c; });
    return {n, la, lo};
  }).catch(err => { communes = null; throw err; });
}
async function nearestCity(lat, lon) {
  const C = await loadCommunes(), k = Math.cos(lat * Math.PI / 180);
  let best = -1, bd = Infinity;
  for (let i = 0; i < C.n.length; i++) {
    const dy = C.la[i] - lat, dx = (C.lo[i] - lon) * k, d = dx*dx + dy*dy;
    if (d < bd) { bd = d; best = i; }
  }
  return Math.sqrt(bd) * 111 < 25 ? C.n[best] : null; // à plus de 25 km d'un centre de commune : hors de France
}
/* Le réglage de l'app ne suffit pas : le téléphone et le navigateur doivent aussi donner la position à Motus */
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/* Sur iPhone, Safari et l'app de l'écran d'accueil ont chacun leur stockage : les notes de l'un n'apparaissent pas dans l'autre */
const safariAvis = () => IOS && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches
  ? '<div class="banner safari-avis"><span>Installez Motus avec le bouton Partager › « Sur l’écran d’accueil », puis notez uniquement depuis l’icône : les notes de Safari et celles de l’app ne sont pas partagées.</span></div>' : '';
async function geoRefus() {
  if (IOS) return 'L’iPhone ne donne pas la position à Motus. Dans les Paramètres de l’iPhone, vérifiez : Confidentialité et sécurité › Service de localisation (activé, et autorisé pour les sites Safari), puis Safari › Localisation.';
  let etat = '';
  try { etat = (await navigator.permissions.query({name:'geolocation'})).state; } catch {}
  if (etat === 'denied') return `Le navigateur bloque la position pour Motus. Dans Chrome : Paramètres › Paramètres des sites › Position, puis autorisez ${location.hostname}.`;
  return 'Le téléphone ne donne pas la position à Motus. Vérifiez que la localisation du téléphone est activée et autorisée pour le navigateur.';
}
function trouverVille() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko('Localisation indisponible sur cet appareil.');
    navigator.geolocation.getCurrentPosition(async p => {
      try {
        const v = await nearestCity(p.coords.latitude, p.coords.longitude);
        v ? ok(v) : ko('Ville non trouvée (hors de France ?).');
      } catch { ko('Liste des communes indisponible.'); }
    }, async err => ko(err.code === 1 ? await geoRefus() : 'Position introuvable pour le moment.'),
    {enableHighAccuracy:false, timeout:15000, maximumAge:300000});
  });
}
/* Sur iPhone, l'autorisation de position n'est pas gardée d'une ouverture de Motus à l'autre : chaque recherche refait apparaître
   la question d'iOS. La recherche automatique n'a donc lieu qu'une fois toutes les 2 heures ; entre-temps, la dernière ville sert.
   L'épingle, elle, cherche toujours. Seule l'heure de la dernière recherche est gardée sur l'appareil, jamais la position. */
const GEO_DERNIERE = 'motus.geo.derniere', GEO_PAUSE = 2 * 3600e3;
let villeGeo = '';   // ville trouvée pendant cette ouverture de l'app
const geoRecente = () => { try { return Date.now() - Number(localStorage.getItem(GEO_DERNIERE) || 0) < GEO_PAUSE; } catch { return false; } };
function locate(force) {
  const me = ed, status = msg => { const s = $('#geoSt'); if (s && ed === me) s.textContent = msg; };
  if (!force && IOS && geoRecente()) { if (villeGeo && !me.villeTouched) $('#eVille').value = villeGeo; return; }
  try { localStorage.setItem(GEO_DERNIERE, String(Date.now())); } catch {}
  status('Recherche de la ville…');
  trouverVille().then(v => {
    villeGeo = v;
    if (ed !== me) return;
    if (force || !me.villeTouched) $('#eVille').value = v;
    status('');
  }, msg => status(force ? `${msg} Vous pouvez aussi saisir la ville.` : 'Ville non détectée. Touchez l’épingle pour en savoir plus, ou saisissez-la.'));
}

/* Option désactivée : la case reste vide (les villes déjà saisies restent proposées pendant la frappe) */
const villeParDefaut = () => data.settings.geoloc ? recent('ville')[0] || '' : '';

/* Heure, ville et lieu : communs à la saisie d'une émotion et à celle d'une note personnelle */
function lieuFields(time, ville, lieu) {
  const villes = recent('ville');
  return `
      <div class="row">
        <div style="flex:0 0 116px"><label class="label" for="eTime">Heure</label><input type="time" id="eTime" value="${esc(time)}"></div>
        <div><label class="label" for="eVille">Ville</label>
          <div class="withbtn"><input type="text" id="eVille" list="villesList" value="${esc(ville || '')}" placeholder="Ville" autocomplete="off">
            <button type="button" class="geo-btn" data-act="locate" aria-label="Trouver ma ville"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg></button></div>
          <datalist id="villesList">${villes.map(l => `<option value="${esc(l)}">`).join('')}</datalist></div>
      </div>
      <div class="geo-st small muted" id="geoSt" aria-live="polite"></div>
      <label class="label" for="eLieu" style="margin-top:4px">Lieu (précision)</label>
      <input type="text" id="eLieu" list="lieuxList" value="${esc(lieu)}" placeholder="Maison, travail, voiture…" autocomplete="off">
      <datalist id="lieuxList">${recent('lieu').map(l => `<option value="${esc(l)}">`).join('')}</datalist>`;
}

/* Noter une émotion : l'heure, la ville et le lieu en haut ; dessous, deux volets côte à côte, les émotions puis les besoins.
   Un balayage vers la gauche passe aux besoins, vers la droite revient aux émotions ; « Enregistrer » valide les deux. */
function openEntry(id, volet = 'e') {
  const e = id ? getDay(cur).entries.find(x => x.id === id) : null;
  ed = e ? structuredClone(e) : {id:null, time: cur === today() ? nowTime() : '12:00', ville: villeParDefaut(), lieu:'', emos:[], car:''};
  ed.fam = ed.emos[0]?.f || 'peur';
  ed.int = ed.emos[0]?.i || 'l';
  ed.bes = besoinsDe(ed);
  // le premier besoin choisi, sinon la famille qui répond à la première émotion
  const b0 = ed.bes[0];
  ed.bfam = b0?.b || BES.find(b => b.f === ed.fam)?.k || BES[0].k;
  ed.bgr = b0 ? Math.max(0, BESK[b0.b].g.findIndex(([, ws]) => ws.includes(b0.w))) : 0;
  ed.volet = volet;
  const D = $('#entryDlg');
  D.innerHTML = `
  <form method="dialog" id="entryForm">
    <div class="dlg-h"><h2 id="entryTitle">${e ? 'Modifier' : 'Noter une émotion'}</h2><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      ${lieuFields(ed.time, ed.ville, ed.lieu)}
      <div class="volets" id="volets"><div class="volets-in">
      <div class="volet" data-v="e">
      <div class="volet-h"><p class="label repere">${ico('emotion', '')}Je me sens…</p><button type="button" class="vers-volet" data-act="volet" data-v="b" id="versB">Besoins ›</button></div>
      <div class="famgrid">${FAM.map(f => `<button type="button" class="fam" style="--fc:${f.c}" data-act="pickFam" data-f="${f.k}">${f.n}</button>`).join('')}</div>
      <div id="picker"></div>
      <p class="label">Mes émotions</p>
      <div class="picked chips" id="picked"></div>
      <label class="label" for="eCar">… car</label>
      <textarea id="eCar" rows="3" autocapitalize="none" placeholder="ce qui a déclenché cette émotion">${esc(ed.car)}</textarea>
      </div>
      <div class="volet" data-v="b">
      <div class="volet-h"><p class="label repere">${ico('besoin', '')}J’ai besoin de…</p><button type="button" class="vers-volet" data-act="volet" data-v="e">‹ Émotions</button></div>
      <div class="famgrid">${BES.map(b => `<button type="button" class="fam bfam" style="--fc:${FAMK[b.f].c}" data-act="pickBFam" data-b="${b.k}" aria-label="${esc(b.n)}">${b.c}</button>`).join('')}</div>
      <div id="bPicker"></div>
      <p class="label">Mes besoins</p>
      <div class="picked chips" id="bPicked"></div>
      <label class="label" for="ePiste">Je pourrais…</label>
      <textarea id="ePiste" rows="3" autocapitalize="none" placeholder="une action concrète et saine pour nourrir ce besoin">${esc(ed.piste || '')}</textarea>
      </div>
      </div></div>
      <div class="err" id="eErr"></div>
    </div>
    <div class="dlg-f">
      ${e ? '<button type="button" class="btn danger" data-act="delEntry">Supprimer</button>' : ''}
      <button type="button" class="btn primary" data-act="saveEntry">Enregistrer</button>
    </div>
  </form>`;
  renderPicker(); renderBPicker();
  D.showModal();
  surlignerChamps();
  poserVolet(volet, false);
  D.scrollTop = 0;
  if (!e && cur === today() && data.settings.geoloc) locate(false);
}
/* Le volet affiché ; l'autre attend à côté, hors d'atteinte. Le cadre prend la hauteur du volet affiché, et la suit. */
let voletsObs = null;
function poserVolet(v, anim = true) {
  const V = $('#volets'); if (!V) return;
  // aucun besoin encore choisi : le volet s'ouvre sur la famille qui répond à la première émotion
  if (v === 'b' && ed.volet !== 'b' && !ed.bes.length && ed.emos.length) {
    const k = BES.find(b => b.f === ed.emos[0].f)?.k;
    if (k && k !== ed.bfam) { ed.bfam = k; ed.bgr = 0; renderBPicker(); }
  }
  ed.volet = v;
  const inn = V.firstElementChild, vs = [...inn.children], i = v === 'b' ? 1 : 0;
  inn.style.transition = anim && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'transform .2s ease-out' : 'none';
  inn.style.transform = i ? `translateX(calc(-100% - ${ECART}px))` : '';
  if (vs[1 - i].contains(document.activeElement)) document.activeElement.blur();   // le clavier ne reste pas sur un volet caché
  vs.forEach((x, n) => { x.inert = n !== i; x.setAttribute('aria-hidden', n !== i); });
  hauteurVolets();
  voletsObs?.disconnect();
  voletsObs = new ResizeObserver(hauteurVolets);
  vs.forEach(x => voletsObs.observe(x));
}
function hauteurVolets() {
  const V = $('#volets'); if (!V) return voletsObs?.disconnect();
  const actif = V.querySelector(`.volet[data-v="${ed.volet}"]`);
  V.style.height = `${actif.offsetHeight}px`;
}
/* Note personnelle : texte libre, sur le même dialogue que la saisie d'une émotion */
let noteId = null;
function openNote(id) {
  const n = id ? dayNotes(getDay(cur)).find(x => x.id === id) : null;
  noteId = n?.id || null;
  ed = {};   // suit la ville pendant la recherche GPS, comme pour une émotion
  const dlg = $('#entryDlg');
  dlg.innerHTML = `
  <form method="dialog">
    <div class="dlg-h"><h2 id="entryTitle">${n ? 'Modifier la note' : 'Note personnelle'}</h2><button type="button" class="icon-btn" data-act="closeDlg" aria-label="Fermer">×</button></div>
    <div class="dlg-b">
      ${lieuFields(n?.time || (cur === today() ? nowTime() : '12:00'), n ? n.ville : villeParDefaut(), n?.lieu)}
      <label class="label" for="nText">Ma note</label>
      <textarea id="nText" rows="6" placeholder="Une pensée, un souvenir, quelque chose à ne pas oublier… Tapez @ pour relier vos notes : @travail, @un-ami">${esc(n?.text || '')}</textarea>
      <div class="err" id="nErr"></div>
    </div>
    <div class="dlg-f">
      ${n ? '<button type="button" class="btn danger" data-act="delNote">Supprimer</button>' : ''}
      <button type="button" class="btn primary" data-act="saveNote">Enregistrer</button>
    </div>
  </form>`;
  dlg.showModal();
  surlignerChamps();
  dlg.scrollTop = 0;
  if (!n && cur === today() && data.settings.geoloc) locate(false);
}
function renderPicker() {
  const f = FAMK[ed.fam];
  $('#entryDlg').querySelectorAll('.fam:not(.bfam)').forEach(b => b.classList.toggle('on', b.dataset.f === ed.fam));
  const has = w => ed.emos.some(x => x.f === ed.fam && x.w === w);
  $('#picker').innerHTML = `
    <div class="besoin">${f.b}</div>
    <div class="seg">${INT.map(([k,n]) => `<button type="button" class="${ed.int === k ? 'on' : ''}" data-act="pickInt" data-i="${k}" aria-pressed="${ed.int === k}">${n}</button>`).join('')}</div>
    <div class="chips">${f[ed.int].map(w => `<button type="button" class="chip ${has(w) ? 'on' : ''}" style="--fc:${f.c}" data-act="toggleEmo" data-w="${esc(w)}" aria-pressed="${has(w)}">${esc(w)}</button>`).join('')}</div>`;
  $('#picked').innerHTML = ed.emos.length
    ? ed.emos.map((x, i) => `<button type="button" class="chip on" style="--fc:${FAMK[x.f].c}" data-act="unpick" data-n="${i}" aria-label="Retirer ${esc(x.w)}">${esc(x.w)} ×</button>`).join('')
    : '<span class="small muted">Choisissez une ou plusieurs émotions ci-dessus.</span>';
}
function renderBPicker() {
  const b = BESK[ed.bfam], [, ws] = b.g[ed.bgr];
  $('#entryDlg').querySelectorAll('.bfam').forEach(x => x.classList.toggle('on', x.dataset.b === ed.bfam));
  const has = w => ed.bes.some(x => x.b === ed.bfam && x.w === w);
  $('#bPicker').innerHTML = `
    <div class="besoin">${esc(b.n)} — ${esc(b.m)}</div>
    <div class="seg">${b.g.map(([name], i) => `<button type="button" class="${ed.bgr === i ? 'on' : ''}" data-act="pickBGr" data-g="${i}" aria-pressed="${ed.bgr === i}">${esc(sansArticle(name))}</button>`).join('')}</div>
    <div class="chips">${ws.map(w => `<button type="button" class="chip ${has(w) ? 'on' : ''}" style="--fc:${FAMK[b.f].c}" data-act="toggleBes" data-w="${esc(w)}" aria-pressed="${has(w)}">${esc(w)}</button>`).join('')}</div>`;
  $('#bPicked').innerHTML = ed.bes.length
    ? ed.bes.map((x, i) => `<button type="button" class="chip on" style="--fc:${coulB(x.b)}" data-act="unpickB" data-n="${i}" aria-label="Retirer ${esc(x.w)}">${esc(x.w)} ×</button>`).join('')
    : '<span class="small muted">Choisissez un ou plusieurs besoins ci-dessus (facultatif).</span>';
  // le lien vers les besoins dit combien sont choisis
  $('#versB').textContent = `Besoins${ed.bes.length ? ` (${ed.bes.length})` : ''} ›`;
}

