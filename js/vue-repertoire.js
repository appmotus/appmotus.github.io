// Motus — Répertoire : émotions et besoins, avec recherche
'use strict';

/* — Vue Répertoire — avec une recherche, sans tenir compte des accents ni des majuscules */
let repQ = '', repMode = 'emo';   // émotions ou besoins, choisis comme Calendrier / Liste dans le Journal
function vRep() {
  const bes = repMode === 'bes';
  const seg = id => `<div class="seg two"${id ? ` id="${id}"` : ''}>
    <button class="${bes ? '' : 'on'}" data-act="repMode" data-m="emo" aria-pressed="${!bes}">Émotions</button>
    <button class="${bes ? 'on' : ''}" data-act="repMode" data-m="bes" aria-pressed="${bes}">Besoins</button>
  </div>`;
  // la barre compacte (comme dans le Journal) : le choix Émotions / Besoins redescend en haut de l'écran quand on remonte
  return `
  <div style="margin:4px 0 16px"><div class="eyebrow">${bes ? 'Identifier le moteur de mon équilibre' : 'Identifier et nommer mon état intérieur'}</div><h1>${bes ? 'Le répertoire des besoins' : 'Le répertoire des émotions'}</h1></div>
  <div id="barreR"><div class="barreJ-in"><div class="barreJ-ligne">${seg('')}</div></div></div>
  ${seg('repSeg')}
  <section class="card key">${bes ? `
    <h2>Clef d’articulation émotion & besoin</h2>
    <p style="margin:8px 0 0">« Quand je me sens <i>[émotion / adjectif]</i>, c’est parce que j’ai besoin de <i>[besoin fondamental sous-jacent]</i>. Nourrir ce besoin de manière saine est ma priorité. Je pourrais <i>[action concrète saine]</i>. »</p>` : `
    <h2>Clef de communication émotionnelle</h2>
    <p style="margin:8px 0 0">« Je me sens <i>[adjectif précis]</i> parce que <i>[explication rationnelle]</i>. »</p>`}
  </section>
  ${champRecherche('repQ', repQ, bes ? 'Rechercher un besoin' : 'Rechercher une émotion')}
  <div id="repListe">${listeRepertoire()}</div>
  <p class="small muted" style="text-align:center">Source : Liberté pour Aimer — libertepouraimer.com</p>`;
}
function listeRepertoire() {
  const q = sansAccent(repQ.trim());
  // les mots trouvés sont surlignés ; une lettre accentuée compte pour une seule lettre, les positions se correspondent
  const marque = w => { const i = q ? sansAccent(w).indexOf(q) : -1; return i < 0 ? esc(w) : `${esc(w.slice(0, i))}<mark>${esc(w.slice(i, i + q.length))}</mark>${esc(w.slice(i + q.length))}`; };
  if (repMode === 'bes') {
    const blocs = BES.map((b, n) => {
      const trouves = q ? b.g.map(([name, ws]) => [name, sansAccent(name).includes(q) ? ws : ws.filter(w => sansAccent(w).includes(q))]).filter(([, ws]) => ws.length) : b.g;
      if (q && !trouves.length && !sansAccent(b.n).includes(q)) return '';
      return `<section class="card rep" style="--fc:${FAMK[b.f].c}">
      <h3>${n+1}. ${esc(b.n)}</h3>
      <div class="besoin">« J’ai besoin de… » — ${esc(b.m)}</div>
      ${(trouves.length ? trouves : b.g).map(([name, ws]) => `<p class="lvl"><b>${marque(name)}</b>${ws.map(marque).join(', ')}</p>`).join('')}
    </section>`;
    }).join('');
    return blocs || `<section class="card"><p class="empty">Aucun besoin ne correspond à « ${esc(repQ.trim())} ».</p></section>`;
  }
  const blocs = FAM.map((f, n) => {
    const tous = INT.map(([k, name]) => [name, f[k]]);
    const trouves = q ? tous.map(([name, ws]) => [name, ws.filter(w => sansAccent(w).includes(q))]).filter(([, ws]) => ws.length) : tous;
    if (q && !trouves.length && !sansAccent(f.n).includes(q)) return '';
    return `<section class="card rep" style="--fc:${f.c}">
    <h3>${n+1}. ${f.n}</h3>
    <div class="besoin">« Je me sens… » — ${f.b}</div>
    ${(trouves.length ? trouves : tous).map(([name, ws]) => `<p class="lvl"><b>${name}</b>${ws.map(marque).join(', ')}</p>`).join('')}
  </section>`;
  }).join('');
  return blocs || `<section class="card"><p class="empty">Aucune émotion ne correspond à « ${esc(repQ.trim())} ».</p></section>`;
}

