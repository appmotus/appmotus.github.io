// Motus — Quotidien : émotions et besoins du jour, notes, synthèse, frise de la semaine
'use strict';

/* — Vue Journée — */
/* Besoins de la journée, chacun avec son nombre de notes, les plus fréquents d'abord */
function besSummary(entries) {
  const c = new Map();
  entries.forEach(e => besoinsDe(e).forEach(x => { const k = `${x.b}|${x.w}`; c.set(k, {...x, n:(c.get(k)?.n || 0) + 1}); }));
  const rang = k => BES.findIndex(b => b.k === k);
  return [...c.values()].sort((a, b) => b.n - a.n || rang(a.b) - rang(b.b));
}
function famSummary(entries) {
  const c = {};
  entries.forEach(e => new Set(e.emos.map(x => x.f)).forEach(f => c[f] = (c[f]||0) + 1));
  return Object.entries(c).sort((a,b) => b[1]-a[1]);
}
/* Frise de la semaine du jour affiché, avec la couleur de chaque journée */
function weekStrip() {
  const lundi = mondayOf(cur), t = today();
  return `<div class="week" role="group" aria-label="Semaine">${['L','M','M','J','V','S','D'].map((l, i) => {
    const k = addDays(lundi, i), c = D().days[k]?.color || '';
    return `<button class="w ${c} ${k === cur ? 'on' : ''}" data-act="openDay" data-k="${k}" aria-label="${fmtDay(k)}"${k === cur ? ' aria-current="date"' : ''} ${k > t ? 'disabled' : ''}>${l}<b>${parse(k).getDate()}</b><i></i></button>`;
  }).join('')}</div>`;
}
function vDay() {
  const d = getDay(cur), isT = cur === today(), dj = parse(cur);
  const ents = [...d.entries].sort((a,b) => a.time.localeCompare(b.time));
  const ns = [...dayNotes(d)].sort((a,b) => a.time.localeCompare(b.time));
  const fs = famSummary(ents), fb = besSummary(ents), ro = !!src;
  /* Une émotion et ses cartes : l'émotion d'abord, puis la carte Besoin et la carte Action quand elles existent. Un balayage vers la
     gauche (ou un appui sur la pastille d'une carte) passe à la carte suivante, vers la droite revient à la précédente.
     Toucher une carte ouvre la note sur ce même volet. */
  const ligneEmo = e => {
    const cs = cartesDe(e), duo = cs.length > 1, tag = ro ? 'div' : 'button', coul = couleursCartes(e);
    const attrs = v => ro ? '' : ` data-act="editEntry" data-id="${e.id}"${v !== 'e' ? ` data-v="${v}"` : ''}`;
    const quand = `${esc(e.time)}${where(e) ? ' · ' + esc(where(e)) : ''}`;
    const txt = {e:() => sentenceHtml(e), b:() => besoinHtml(e), a:() => actionHtml(e)};
    return `
      <li${duo ? ' class="duo"' : ''}>${cs.map((c, i) => `<${tag} class="entry face face-${c}${i ? '' : ' on'}"${i ? ' inert' : ''} style="--fc:${coul[c]};--i:${i}"${attrs(c)}>
        <span class="edot">${ico(ICO_CARTE[c], '')}</span><span class="etxt">
        <span class="meta">${pastillesCartes(e, c)}${quand}</span>
        <span class="txt">${txt[c]()}</span></span>
      </${tag}>`).join('')}</li>`;
  };
  // synthèse : deux pastilles, émotions traversées et besoins exprimés (grisée sans besoin)
  const pS = on => pastilles([['e', 'Émotions traversées'], ['b', 'Besoins exprimés']].map(([k, nom], i) =>
    ({k, nom, coul:'var(--accent)', etat:k === on ? 'on' : k === 'b' && !fb.length ? 'vide' : 'lien', attrs:`data-act="voirFace" data-k="${i}"`})));
  return `
  ${clientBar()}${ro ? '' : safariAvis() + sauvegardeReminder() + recupReminder() + adminReminder() + sendReminder()}
  <div class="dayhead">
    <div class="dayhead-t">
      <div class="eyebrow">${isT ? 'Aujourd’hui' : cur === addDays(today(), -1) ? 'Hier' : dj.getFullYear()}${isT ? '' : ' · <button class="link" data-act="goToday">Revenir à aujourd’hui</button>'}</div>
      <h1><button class="titre-mois" data-act="choisirJour" aria-label="Choisir un autre jour"><span class="tm">${JOURS[dj.getDay()]} ${dj.getDate()} ${MOIS[dj.getMonth()]}</span>${ico('ch', 'tm-fl')}</button></h1>
    </div>
    <button class="icon-btn" data-act="prevDay" aria-label="Jour précédent">‹</button>
    <button class="icon-btn" data-act="nextDay" aria-label="Jour suivant" ${isT ? 'disabled' : ''}>›</button>
  </div>
  ${weekStrip()}

  <section class="card">
    <div class="card-h"><h2>${ro ? 'Émotions et besoins' : 'Mes émotions et mes besoins'}</h2><span class="count">${ents.length}</span></div>
    ${ents.length ? `<ul class="entries${ro ? '' : ' tenir'}">${ents.map(ligneEmo).join('')}</ul>`
    : ro ? '<p class="empty">Aucune émotion notée ce jour-là.</p>'
    : `<p class="empty">Rien de noté ${isT ? 'pour l’instant' : 'ce jour-là'}. Prenez un instant : où êtes-vous, que ressentez-vous ?</p>`}
    ${ro ? '' : '<button class="btn primary block" data-act="newEntry">+ Noter une émotion</button>'}
  </section>

  ${ro && ns.length ? `<section class="card">
    <div class="card-h"><h2>Notes personnelles</h2><span class="count">${ns.length}</span></div>
    <ul class="entries">${ns.map(n => `
      <li><div class="entry" style="--fc:var(--lav)"><span class="edot"></span><span class="etxt">
        <span class="meta">${esc(n.time)}${where(n) ? ' · ' + esc(where(n)) : ''}</span>
        <span class="txt note-txt">${avecConnecteurs(n.text)}</span></span></div></li>`).join('')}</ul>
  </section>` : ''}

  ${ro ? '' : `<section class="card">
    <div class="card-h"><h2>Mes notes personnelles</h2><span class="count">${ns.length}</span></div>
    ${ns.length ? `<ul class="entries tenir">${ns.map(n => `
      <li><button class="entry" style="--fc:var(--lav)" data-act="editNote" data-id="${n.id}">
        <span class="edot"></span><span class="etxt">
        <span class="meta">${esc(n.time)}${where(n) ? ' · ' + esc(where(n)) : ''}</span>
        <span class="txt note-txt">${avecConnecteurs(n.text)}</span></span>
      </button></li>`).join('')}</ul>` : ''}
    <button class="btn block" data-act="newNote">+ Ajouter une note</button>
  </section>`}

  <section class="card">
    <h2>Synthèse de la journée</h2>
    ${fs.length ? `<div${fb.length ? ' class="duo"' : ''}>
      <div class="face face-e on" style="--i:0"><p class="label">${pS('e')}<span class="repere">${ico('emotion', '')}Émotions traversées</span></p>
        <div class="chips">${fs.map(([f,n]) => `<span class="chip static" style="--fc:${FAMK[f].c}">${FAMK[f].n}${n > 1 ? ' ×' + n : ''}</span>`).join('')}</div></div>
      ${fb.length ? `<div class="face face-b" inert style="--i:1"><p class="label">${pS('b')}<span class="repere">${ico('besoin', '')}Besoins exprimés</span></p>
        <div class="chips">${fb.map(x => `<span class="chip static" style="--fc:${coulB(x.b)}">${esc(x.w)}${x.n > 1 ? ' ×' + x.n : ''}</span>`).join('')}</div></div>` : ''}
    </div>` : ''}
    ${ro ? `
    <p class="label">Couleur de la journée</p>
    ${d.color ? `<div class="colors one"><div class="colbtn ${d.color} on"><span class="dot"></span>${esc(D().labels[d.color])}</div></div>` : '<p class="empty">Pas de couleur choisie.</p>'}
    <p class="label">Synthèse</p>
    <p class="synth-ro">${d.synth?.trim() ? esc(d.synth) : '<span class="muted">Pas de synthèse ce jour-là.</span>'}</p>` : `
    <p class="label">Ma journée était…</p>
    <div class="colors">${COL.map(c => `
      <button class="colbtn ${c} ${d.color === c ? 'on' : ''}" data-act="setColor" data-c="${c}" aria-pressed="${d.color === c}">
        <span class="dot"></span>${esc(D().labels[c])}
      </button>`).join('')}</div>
    <label class="label" for="synth">En quelques mots</label>
    <textarea id="synth" rows="5" placeholder="Ce qui a marqué ma journée, ce que j’ai ressenti, ce que j’ai mis en place…">${esc(d.synth)}</textarea>
    <div class="saved" id="saved" aria-live="polite"></div>`}
  </section>`;
}

