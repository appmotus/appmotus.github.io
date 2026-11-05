// Motus — Journal : calendrier, liste continue, filtres, bilans du mois, recherche
'use strict';

/* Une émotion dans le Journal (liste, émotion filtrée, recherche). Reliée à des besoins, elle a deux faces comme dans
   Quotidien : un balayage sur la ligne (ou un appui sur « Besoin › ») montre ses besoins, au lieu de changer de mois.
   debut : ce qui précède l'heure (le jour, pour une émotion filtrée) ; txt : la phrase de l'émotion. */
function occEmotion(k, e, txt, debut = '') {
  const quand = `${debut}${esc(e.time)}${where(e) ? ' · ' + esc(where(e)) : ''}`, ouvrir = `data-act="openDay" data-k="${k}"`;
  if (!aBesoins(e)) return `<button class="occ" ${ouvrir}><div class="meta">${quand}</div><div class="txt">${txt}</div></button>`;
  const n = besoinsDe(e).length;
  return `<div class="occ-duo duo">
    <button class="occ face-e" ${ouvrir}><div class="meta"><span class="lien-b" data-act="voirFace">${n > 1 ? 'Besoins' : 'Besoin'} ›</span>${quand}</div><div class="txt">${txt}</div></button>
    <button class="occ face-b" inert ${ouvrir}><div class="meta"><span class="lien-b" data-act="voirFace">‹ Émotion</span>${quand}</div><div class="txt">${besoinsHtml(e)}</div></button>
  </div>`;
}

/* — Vue Calendrier — */
function vCal() {
  const first = new Date(calY, calM, 1), nDays = new Date(calY, calM + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7, t = today();
  const now = new Date(), atCurrent = calY === now.getFullYear() && calM === now.getMonth();
  let cells = ['L','M','M','J','V','S','D'].map(w => `<div class="wd">${w}</div>`).join('');
  cells += '<div class="cvide"></div>'.repeat(off);
  const cnt = {vert:0, jaune:0, rouge:0}, words = {}, fams = {}, bWords = {}, bFams = {};
  let nEntries = 0, pastDays = 0;
  const fam = calF && FAMK[calF], notesOnly = calF === 'notes', synthOnly = calF === 'synth', filtre = fam || notesOnly || synthOnly, occ = [], occN = [], occS = [], fWords = {};
  const cadre = fam ? fam.c : 'var(--accent)';
  let fDays = 0, nNotes = 0;
  for (let i = 1; i <= nDays; i++) {
    const k = ymd(new Date(calY, calM, i)), d = D().days[k], fut = k > t, ns = dayNotes(d);
    if (!fut) pastDays++;
    nNotes += ns.length;
    if (notesOnly) ns.forEach(n => occN.push({k, n}));
    if (synthOnly && d?.synth?.trim()) occS.push(k);
    if (d?.color) cnt[d.color]++;
    let maxI = -1; // intensité la plus forte de l'émotion filtrée ce jour-là
    (d?.entries || []).forEach(e => {
      nEntries++;
      e.emos.forEach(x => { words[x.w] = (words[x.w]||0) + 1; fams[x.f] = (fams[x.f]||0) + 1; if (x.f === calF) fWords[x.w] = (fWords[x.w]||0) + 1; });
      besoinsDe(e).forEach(x => { const k = `${x.b}|${x.w}`; bWords[k] = (bWords[k]||0) + 1; bFams[x.b] = (bFams[x.b]||0) + 1; });
      const hit = fam ? e.emos.filter(x => x.f === calF && (!calW || x.w === calW)) : [];
      if (hit.length) { occ.push({k, e}); maxI = Math.max(maxI, ...hit.map(x => INT.findIndex(([c]) => c === x.i))); }
    });
    const hit = fam ? maxI >= 0 : notesOnly ? ns.length > 0 : synthOnly && !!d?.synth?.trim();
    if (hit) fDays++;
    const lab = (d?.color ? ', ' + esc(D().labels[d.color]) : '') + (maxI >= 0 ? `, ${fam.n} ${INT[maxI][1].toLowerCase()}` : '') + (ns.length ? ', note personnelle' : '');
    cells += `<button class="cday ${d?.color || ''} ${hit ? 'hit' : ''} ${k === t ? 'today' : ''} ${fut ? 'future' : ''}"${hit ? ` style="--fc:${cadre}"` : ''} data-act="openDay" data-k="${k}" ${fut ? 'disabled' : ''}
      aria-label="${fmtLong(k)}${lab}">${i}${!filtre && d?.entries?.length ? '<span class="has"></span>' : ''}${!filtre && ns.length ? '<span class="nt"></span>' : ''}</button>`;
  }
  cells += '<div class="cvide"></div>'.repeat(42 - off - nDays);   // toujours six semaines : la page ne bouge pas d'un mois à l'autre
  occ.sort((a, b) => (a.k + a.e.time).localeCompare(b.k + b.e.time));
  occN.sort((a, b) => (a.k + a.n.time).localeCompare(b.k + b.n.time));
  const dayName = k => `${JOURS[parse(k).getDay()]} ${parse(k).getDate()} ${MOIS[parse(k).getMonth()]}`;
  // liste continue : les émotions précises proposées par le filtre viennent de tous les mois
  if (calMode === 'list' && fam) {
    for (const w in fWords) delete fWords[w];
    for (const d of Object.values(D().days)) for (const e of d.entries || []) for (const x of e.emos) if (x.f === calF) fWords[x.w] = (fWords[x.w] || 0) + 1;
  }

  const filterCard = `
  <section class="card">
    <div class="card-h" style="margin-bottom:0"><h2>Afficher</h2>
      ${calMode === 'list' ? `<button class="btn-conn ${calC.length ? 'on' : ''}" data-act="choisirConn" aria-label="Connecteurs${calC.length ? `, ${calC.length} choisi${calC.length > 1 ? 's' : ''}` : ''}"><span class="a" aria-hidden="true">@</span>Connecteurs${calC.length ? `<span class="nb">${calC.length}</span>` : ''}</button>` : ''}</div>
    <div class="chips" style="margin-top:10px">
      <button class="chip neutre ${!filtre ? 'on' : ''}" data-act="calFilter" data-f="" aria-pressed="${!filtre}">Tout</button>
      <button class="chip neutre ${notesOnly ? 'on' : ''}" data-act="calFilter" data-f="notes" aria-pressed="${notesOnly}">Notes personnelles</button>
      <button class="chip neutre ${synthOnly ? 'on' : ''}" data-act="calFilter" data-f="synth" aria-pressed="${synthOnly}">Synthèses</button>
      ${FAM.map(f => `<button class="chip ${calF === f.k ? 'on' : ''}" style="--fc:${f.c}" data-act="calFilter" data-f="${f.k}" aria-pressed="${calF === f.k}">${f.n}</button>`).join('')}
    </div>
    ${fam ? `<p class="label">Émotion précise</p><div class="chips">
      <button class="chip ${!calW ? 'on' : ''}" style="--fc:${fam.c}" data-act="calWord" data-w="" aria-pressed="${!calW}">Toutes</button>
      ${[...new Set([...Object.keys(fWords), ...(calW ? [calW] : [])])].map(w => `<button class="chip ${calW === w ? 'on' : ''}" style="--fc:${fam.c}" data-act="calWord" data-w="${esc(w)}" aria-pressed="${calW === w}">${esc(w)}${fWords[w] ? ' · ' + fWords[w] : ''}</button>`).join('')}
    </div>` : ''}
  </section>`;
  const legend = COL.map(c => `<span><i style="background:var(--${c})"></i>${esc(D().labels[c])}</span>`).join('')
    + (filtre ? `<span><i style="border:3px solid ${cadre}"></i>${esc(fam ? calW || fam.n : notesOnly ? 'Note personnelle' : 'Synthèse')}</span>`
      : '<span><i style="background:currentColor;width:4px;height:4px"></i>émotions notées</span>'
        + '<span><i style="width:0;height:0;border-radius:0;border-style:solid;border-width:0 11px 11px 0;border-color:transparent var(--accent) transparent transparent"></i>note personnelle</span>');
  const occCard = fam ? `
  <section class="card">
    <h2>${esc(calW || fam.n)} · ${MOIS[calM]}</h2>
    <p class="small muted" style="margin:6px 0 4px">${occ.length ? `${fDays} jour${fDays > 1 ? 's' : ''} concerné${fDays > 1 ? 's' : ''} · ${occ.length} note${occ.length > 1 ? 's' : ''}` : 'Aucune note avec cette émotion ce mois-ci.'}</p>
    ${occ.map(({k, e}) => occEmotion(k, e, sentenceHtml(e, true), `${dayName(k)} · `)).join('')}
  </section>` : synthOnly ? `
  <section class="card">
    <h2>Synthèses · ${MOIS[calM]}</h2>
    <p class="small muted" style="margin:6px 0 4px">${occS.length ? `${occS.length} synthèse${occS.length > 1 ? 's' : ''}` : 'Aucune synthèse ce mois-ci.'}</p>
    ${occS.map(k => `<button class="occ" data-act="openDay" data-k="${k}">
      <div class="meta">${dayName(k)}</div>
      <div class="txt note-txt">${avecConnecteurs(D().days[k].synth.trim(), true)}</div>
    </button>`).join('')}
  </section>` : `
  <section class="card">
    <h2>Notes personnelles · ${MOIS[calM]}</h2>
    <p class="small muted" style="margin:6px 0 4px">${occN.length ? `${fDays} jour${fDays > 1 ? 's' : ''} concerné${fDays > 1 ? 's' : ''} · ${occN.length} note${occN.length > 1 ? 's' : ''}` : 'Aucune note personnelle ce mois-ci.'}</p>
    ${occN.map(({k, n}) => `<button class="occ" data-act="openDay" data-k="${k}">
      <div class="meta">${dayName(k)} · ${esc(n.time)}${where(n) ? ' · ' + esc(where(n)) : ''}</div>
      <div class="txt note-txt">${avecConnecteurs(n.text, true)}</div>
    </button>`).join('')}
  </section>`;
  /* Vue liste : une seule liste continue, du mois en cours au plus ancien, chaque mois séparé par son nom.
     L'en-tête suit le mois affiché pendant le défilement (majEnteteListe) ; flèches et balayage mènent au mois voulu (allerAuMois). */
  function listeContinue() {
    const now = new Date(), ks = Object.keys(D().days).sort(), cree = !src && data.account?.cree_le ? ymd(new Date(data.account.cree_le)) : '';
    let premier = [ks[0], cree, ymd(new Date(calY, calM, 1))].filter(Boolean).sort()[0];
    const fin = parse(premier), mois = [];
    for (let y = now.getFullYear(), m = now.getMonth(); y > fin.getFullYear() || (y === fin.getFullYear() && m >= fin.getMonth()); m === 0 ? (m = 11, y--) : m--) mois.push([y, m]);
    // avec un filtre (pastilles ou connecteurs), les mois où rien ne correspond ne sont pas affichés
    const tri = filtre || calC.length, blocs = mois.map(([y, m]) => [y, m, listCards(y, m)]).filter(b => b[2] || !tri);
    return `<div id="listeNotes">${blocs.map(([y, m, c]) => `<div class="mois-bloc" data-mois="${y}-${m}"><div class="mois-sep" data-mois="${y}-${m}"><span>${MOIS[m]} ${y}</span></div>
      ${c || `<p class="small muted mois-vide">Rien de noté en ${MOIS[m]}.</p>`}</div>`).join('')
      || '<section class="card"><p class="empty">Aucune note ne correspond à ce filtre.</p></section>'}</div>`
      + '<div class="fin-liste"></div>';   // de la place en bas : le mois le plus ancien peut lui aussi remonter sous l'en-tête
  }
  function listCards(y, m) {
    const out = [];
    for (let i = new Date(y, m + 1, 0).getDate(); i >= 1; i--) {
      const k = ymd(new Date(y, m, i)), d = D().days[k];
      if (!d || k > t) continue;
      const ents = (d.entries || []).filter(e => (!fam || e.emos.some(x => x.f === calF && (!calW || x.w === calW))) && connOk(clesDe(e.car, e.ville, e.lieu)));
      const lignes = [
        ...(notesOnly || synthOnly ? [] : ents.map(e => ({time:e.time, ligne:occEmotion(k, e, sentenceHtml(e, true))}))),
        ...(fam || synthOnly ? [] : dayNotes(d).filter(n => connOk(clesDe(n.text, n.ville, n.lieu))).map(n => ({time:n.time, html:`<div class="meta">${esc(n.time)}${where(n) ? ' · ' + esc(where(n)) : ''} · Note personnelle</div><div class="txt note-txt">${avecConnecteurs(n.text, true)}</div>`}))),
      ].sort((a, b) => a.time.localeCompare(b.time));
      const synth = (!filtre || synthOnly) && d.synth?.trim() && connOk(clesDe(d.synth));
      if (!lignes.length && !synth && (filtre || calC.length || !d.color)) continue;
      out.push(`<section class="card lday">
        <button class="lhead" data-act="openDay" data-k="${k}"><span>${dayName(k)}</span><span class="colpill ${d.color || ''}">${d.color ? esc(D().labels[d.color]) : 'Sans couleur'}</span></button>
        ${lignes.map(l => l.ligne || `<button class="occ" data-act="openDay" data-k="${k}">${l.html}</button>`).join('')}
        ${synth ? `<button class="occ" data-act="openDay" data-k="${k}"><div class="meta">Synthèse</div><div class="txt note-txt">${avecConnecteurs(d.synth, true)}</div></button>` : ''}
      </section>`);
    }
    return out.join('');
  }
  const noted = cnt.vert + cnt.jaune + cnt.rouge;
  const topW = Object.entries(words).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const famTot = Object.values(fams).reduce((a,b) => a+b, 0);
  const famS = Object.entries(fams).sort((a,b) => b[1]-a[1]);
  // les besoins du mois, présentés comme les émotions : part de chaque famille, puis les plus fréquents
  const bTot = Object.values(bFams).reduce((a,b) => a+b, 0);
  const bFamS = Object.entries(bFams).sort((a,b) => b[1]-a[1]);
  const topB = Object.entries(bWords).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([k, n]) => [...k.split('|'), n]);
  const segJ = `<div class="seg two">
    <button class="${calMode === 'grid' ? 'on' : ''}" data-act="calMode" data-m="grid" aria-pressed="${calMode === 'grid'}">Calendrier</button>
    <button class="${calMode === 'list' ? 'on' : ''}" data-act="calMode" data-m="list" aria-pressed="${calMode === 'list'}">Liste</button>
  </div>`;
  return `
  ${clientBar()}${srcImportCard()}
  <div class="calhead">
    <div class="dayhead-t">
      <div class="eyebrow">${atCurrent ? 'Ce mois-ci' : `<button class="link" data-act="moisEnCours">${calMode === 'list' ? 'Revenir à aujourd’hui' : 'Revenir au mois en cours'}</button>`}</div>
      <h1><button class="titre-mois" data-act="choisirMois" aria-label="Choisir un autre mois"><span class="tm">${MOIS[calM]} ${calY}</span>${ico('ch', 'tm-fl')}</button></h1>
    </div>
    <button class="icon-btn" data-act="prevMonth" aria-label="Mois précédent">‹</button>
    <button class="icon-btn" data-act="nextMonth" aria-label="Mois suivant" ${atCurrent ? 'disabled' : ''}>›</button>
  </div>
  <div id="barreJ"><div class="barreJ-in">
    <div class="barreJ-ligne">${segJ}${calMode === 'list' ? `<button class="icon-btn" data-act="deployerEntete" aria-label="Rechercher et filtrer" aria-expanded="${entJ.deploye}">${ico('filtre', '')}</button>` : ''}</div>
    ${calMode === 'list' ? `<div class="barreJ-plus" ${entJ.deploye ? '' : 'hidden'}>
      <button class="champ-recherche faux-champ" data-act="chercherJ">${ico('loupe', '')}<span>${calQ.trim() ? esc(calQ) : 'Rechercher dans toutes les notes'}</span></button>
      ${filterCard}
    </div>` : ''}
  </div></div>
  <div id="enteteJ">
  ${segJ}
  ${calMode === 'list' ? champRecherche('calQ', calQ, 'Rechercher dans toutes les notes') : ''}
  <div id="filtreJ" ${calMode === 'list' && calQ.trim() ? 'hidden' : ''}>${filterCard}</div>
  </div>
  <div id="listeMois" ${calMode === 'list' && calQ.trim() ? 'hidden' : ''}>
  ${calMode === 'list' ? listeContinue() : `<section class="card" id="carteCal">
    <div class="cal ${filtre ? 'filtre' : ''}">${cells}</div>
    <div class="legend">${legend}</div>
  </section>
  ${filtre ? occCard : `<section class="card">
    <h2>Bilan du mois</h2>
    ${noted ? `<div class="bar">${COL.map(c => cnt[c] ? `<div style="width:${cnt[c]/noted*100}%;background:var(--${c})"></div>` : '').join('')}</div>` : ''}
    ${COL.map(c => `<div class="stat"><span>${esc(D().labels[c])}</span><b>${cnt[c]}</b></div>`).join('')}
    <div class="stat"><span class="muted">Jours sans couleur</span><b class="muted">${pastDays - noted}</b></div>
    <div class="stat"><span class="muted">Émotions notées</span><b class="muted">${nEntries}</b></div>
    <div class="stat"><span class="muted">Notes personnelles</span><b class="muted">${nNotes}</b></div>
  </section>
  ${famS.length ? `<section class="card">
    <h2>Émotions du mois</h2>
    <div class="bar">${famS.map(([f,n]) => `<div title="${FAMK[f].n}" style="width:${n/famTot*100}%;background:${FAMK[f].c}"></div>`).join('')}</div>
    <div class="chips">${famS.map(([f,n]) => `<span class="chip static" style="--fc:${FAMK[f].c}">${FAMK[f].n} · ${Math.round(n/famTot*100)} %</span>`).join('')}</div>
    <p class="label">Les plus fréquentes</p>
    ${topW.map(([w,n]) => `<div class="stat"><span>${esc(w)}</span><b>${n}</b></div>`).join('')}
  </section>` : ''}
  ${bFamS.length ? `<section class="card">
    <h2>Besoins du mois</h2>
    <div class="bar">${bFamS.map(([b,n]) => `<div title="${esc(BESK[b].n)}" style="width:${n/bTot*100}%;background:${coulB(b)}"></div>`).join('')}</div>
    <div class="chips">${bFamS.map(([b,n]) => `<span class="chip static" style="--fc:${coulB(b)}">${esc(BESK[b].n)} · ${Math.round(n/bTot*100)} %</span>`).join('')}</div>
    <p class="label">Les plus fréquents</p>
    ${topB.map(([b,w,n]) => `<div class="stat"><span>${esc(w)}</span><b>${n}</b></div>`).join('')}
  </section>` : ''}`}`}</div>
  ${calMode === 'list' ? `<div id="resRech">${calQ.trim() ? resultatsRecherche(calQ) : ''}</div>` : ''}
  ${srcCard()}`;
}

/* Recherche par mot, dans tous les mois : émotions, raisons, lieux, notes personnelles et synthèses, sans tenir compte des accents ni des majuscules */
const sansAccent = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function resultatsRecherche(q) {
  const m = sansAccent(q.trim()), contient = s => sansAccent(s).includes(m), t = today();
  let n = 0;
  const cartes = Object.keys(D().days).filter(k => k <= t).sort().reverse().map(k => {
    const d = D().days[k];
    // seul le texte compte : les émotions choisies et ce qu'on a écrit, jamais l'heure, le lieu ou les mentions de l'app
    // (« Je me sens », « Note personnelle »). Le texte tel qu'il est écrit (« @un-ami ») et tel qu'il s'affiche (« un ami »).
    const lignes = [
      ...(d.entries || []).filter(e => e.emos.some(x => contient(lc(x.w))) || contient(cleanCar(e)) || contient(sansArobase(cleanCar(e))))
        .map(e => ({time:e.time, ligne:occEmotion(k, e, phraseRecherche(e))})),
      ...(src ? [] : dayNotes(d).filter(x => contient(x.text) || contient(sansArobase(x.text)))
        .map(x => ({time:x.time, html:`<div class="meta">${esc(x.time)}${where(x) ? ' · ' + esc(where(x)) : ''} · Note personnelle</div><div class="txt note-txt rq">${avecConnecteurs(x.text, true)}</div>`}))),
    ].sort((a, b) => a.time.localeCompare(b.time));
    const synth = d.synth?.trim() && contient(`${d.synth} ${sansArobase(d.synth)}`);
    if (!lignes.length && !synth) return '';
    n += lignes.length + (synth ? 1 : 0);
    return `<section class="card lday">
      <button class="lhead" data-act="openDay" data-k="${k}"><span>${JOURS[parse(k).getDay()]} ${fmtLong(k)}</span><span class="colpill ${d.color || ''}">${d.color ? esc(D().labels[d.color]) : 'Sans couleur'}</span></button>
      ${lignes.map(l => l.ligne || `<button class="occ" data-act="openDay" data-k="${k}">${l.html}</button>`).join('')}
      ${synth ? `<button class="occ" data-act="openDay" data-k="${k}"><div class="meta">Synthèse</div><div class="txt note-txt rq">${avecConnecteurs(d.synth, true)}</div></button>` : ''}
    </section>`;
  }).join('');
  if (!cartes) return `<section class="card"><p class="empty">Aucun résultat pour « ${esc(q.trim())} ».</p></section>`;
  // ce qui a été trouvé est surligné dans le texte des notes (pas dans l'heure ni les mentions), comme dans le Répertoire
  const tpl = document.createElement('template');
  tpl.innerHTML = cartes;
  tpl.content.querySelectorAll('.occ .rq, .occ .txt b').forEach(el => marquerTexte(el, m));
  return `<p class="small muted" style="margin:0 2px 10px">${n} résultat${n > 1 ? 's' : ''} pour « ${esc(q.trim())} »</p>${tpl.innerHTML}`;
}
/* La phrase d'une émotion dans les résultats : le texte écrit (après « car ») est marqué .rq, seul endroit où surligner avec les émotions */
function phraseRecherche(e) {
  const car = cleanCar(e);
  return 'Je me sens ' + joinFr(e.emos.map(x => `<b style="--fc:${FAMK[x.f].c}">${esc(lc(x.w))}</b>`)) + (car ? ` car <span class="rq">${avecConnecteurs(car, true)}</span>` : '') + '.';
}
/* Entoure de <mark> chaque passage de q (déjà sans accents ni majuscules) dans les textes de el. Chaque lettre est comparée
   sans son accent, une par une : les positions trouvées sont donc exactement celles du texte affiché. */
function marquerTexte(el, q) {
  if (!q) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), noeuds = [];
  while (w.nextNode()) noeuds.push(w.currentNode);
  for (const nd of noeuds) {
    const s = nd.data, pos = [];
    let plat = '';
    for (let i = 0; i < s.length; i++) { const c = sansAccent(s[i]); plat += c; for (let j = 0; j < c.length; j++) pos.push(i); }
    let i = plat.indexOf(q);
    if (i < 0) continue;
    const f = document.createDocumentFragment();
    let fin = 0;
    for (; i >= 0; i = plat.indexOf(q, i + q.length)) {
      const a = pos[i], b = pos[i + q.length - 1] + 1;
      if (a < fin) continue;
      const mk = document.createElement('mark'); mk.textContent = s.slice(a, b);
      f.append(s.slice(fin, a), mk); fin = b;
    }
    f.append(s.slice(fin));
    nd.replaceWith(f);
  }
}

