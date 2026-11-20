// Motus — Questionnaires de l'administrateur (v49) : fiche « hygiène de vie », bilans, comparaison, lecture à la lumière du journal
'use strict';

/* ───────────── Questionnaires (réservés à l'administrateur) ─────────────
   Les bilans remplis sont gardés dans data.bilans, chiffrés avec le journal sur cet appareil : ils ne quittent jamais le téléphone,
   et font partie des sauvegardes. Un bilan : {id, q (questionnaire), date, periode, notes {domaine: 0 à 10}, constats {domaine: texte},
   priorites [{dom, action}, {dom, action}], cree}. Pour ajouter un questionnaire : une entrée de QUESTIONNAIRES, rien d'autre. */
const QUESTIONNAIRES = {
  hygiene:{
    nom:'Fiche hygiène de vie & accomplissement', court:'Hygiène de vie', source:'Liberté pour Aimer',
    intro:'Auto-évaluation de mon équilibre personnel sur 100 points : 10 domaines de vie, notés chacun sur 10.',
    paliers:[{max:40, n:'Alerte / Épuisement', c:'rouge'}, {max:70, n:'Équilibre à consolider', c:'jaune'}, {max:100, n:'Bel épanouissement', c:'vert'}],
    domaines:[
      {k:'plaisir', n:'Bien-être & Plaisir', c:'Bien-être', r:'Détente, loisirs, moments de joie, ressourcement, gratitude'},
      {k:'physique', n:'Vie physique', c:'Physique', r:'Sport & mouvement, alimentation équilibrée, sommeil, soin du corps'},
      {k:'psychique', n:'Vie psychique', c:'Psychique', r:'Suivi psy / introspection, journal des émotions, communication de soi'},
      {k:'amicale', n:'Vie amicale', c:'Amis', r:'Contacts réguliers, force de proposition, authenticité des liens'},
      {k:'familiale', n:'Vie familiale', c:'Famille', r:'Temps de qualité avec les enfants / la famille, activités partagées, projets'},
      {k:'conjugale', n:'Vie conjugale', c:'Couple', r:'Temps privilégié avec le conjoint, dialogue, activités à deux, projets'},
      {k:'sexuelle', n:'Vie sexuelle', c:'Intimité', r:'Régularité, satisfaction, désir, qualité de la rencontre intime'},
      {k:'interieure', n:'Vie intérieure', c:'Intérieure', r:'Vie de prière, silence, méditation, alignement spirituel'},
      {k:'engagee', n:'Vie engagée & extérieure', c:'Engagement', r:'Don de soi, ouverture à l’autre, décentrement, générosité & service'},
      {k:'pro', n:'Vie professionnelle / Projets', c:'Projets', r:'Sens au travail ou dans les études, organisation, équilibre vie pro/perso'},
    ],
  },
};
let admQ = 'hygiene';       // questionnaire ouvert
let bilanOuvert = null;     // bilan en cours de saisie (id)
const cmp = {a:null, b:null, jours:30};   // comparaison : les deux bilans, et la fenêtre du journal (jours avant chaque bilan)

const noteOK = v => Number.isInteger(v) && v >= 0 && v <= 10;
const bilansDe = q => data.bilans.filter(b => b.q === q).sort((x, y) => x.date.localeCompare(y.date) || (x.cree || '').localeCompare(y.cree || ''));
const bilanPar = id => data.bilans.find(b => b.id === id);
const bilanVide = b => !Object.values(b.notes).some(noteOK) && !b.periode.trim() && !Object.values(b.constats).some(t => t.trim()) && !b.priorites.some(p => p.dom || p.action.trim());
/* Un bilan que l'on a ouvert sans rien remplir ne reste pas dans la liste */
function purgerBilansVides() {
  const n = data.bilans.length;
  data.bilans = data.bilans.filter(b => !bilanVide(b) || (admPage === 'bilan' && b.id === bilanOuvert));
  if (data.bilans.length !== n) save();
}
function scoreBilan(b) {
  const doms = QUESTIONNAIRES[b.q].domaines, vals = doms.map(d => b.notes[d.k]).filter(noteOK);
  return {total:vals.reduce((a, v) => a + v, 0), n:vals.length, nb:doms.length, complet:vals.length === doms.length};
}
const palierDe = (q, total) => QUESTIONNAIRES[q].paliers.find(p => total <= p.max);
const nomDom = (q, k) => QUESTIONNAIRES[q].domaines.find(d => d.k === k)?.n || '';
const courtDate = d => `${d.slice(8)}/${d.slice(5, 7)}`;
const fmtDelta = d => d == null ? '' : d === 0 ? '=' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
const clsDelta = d => d > 0 ? 'plus' : d < 0 ? 'moins' : '';
const deltaNote = (x, y) => noteOK(x) && noteOK(y) ? y - x : null;
const chipPalier = (q, s) => s.complet ? (p => `<span class="palier ${p.c}">${p.n}</span>`)(palierDe(q, s.total)) : `<span class="small muted">Score provisoire : ${s.n} domaine${s.n > 1 ? 's' : ''} sur ${s.nb}</span>`;
const classeNote = v => !noteOK(v) ? '' : v <= 4 ? 'bas' : v <= 7 ? 'moy' : 'haut';

/* ───────────── Graphiques (SVG en ligne, couleurs du thème) ───────────── */
function radar(q, series) {
  const D = QUESTIONNAIRES[q].domaines, n = D.length, cx = 170, cy = 150, R = 88;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * v / 10; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const xy = p => p.map(x => x.toFixed(1)).join(',');
  const anneaux = [2.5, 5, 7.5, 10].map(v => `<polygon points="${D.map((_, i) => xy(pt(i, v))).join(' ')}" fill="none" stroke="var(--border)" stroke-width="1"/>`).join('');
  const axes = D.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${xy(pt(i, 10)).split(',')[0]}" y2="${xy(pt(i, 10)).split(',')[1]}" stroke="var(--border)" stroke-width="1"/>`).join('');
  const noms = D.map((d, i) => {
    const [x, y] = pt(i, 11.6), c = Math.cos(-Math.PI / 2 + i * 2 * Math.PI / n), s = Math.sin(-Math.PI / 2 + i * 2 * Math.PI / n);
    return `<text x="${x.toFixed(1)}" y="${(y + (s > .3 ? 6 : s < -.3 ? 0 : 4)).toFixed(1)}" text-anchor="${c > .3 ? 'start' : c < -.3 ? 'end' : 'middle'}" font-size="11" fill="var(--muted)">${esc(d.c)}</text>`;
  }).join('');
  const formes = series.map(s => `<polygon points="${D.map((d, i) => xy(pt(i, noteOK(s.vals[d.k]) ? s.vals[d.k] : 0))).join(' ')}" fill="${s.plein ? 'var(--accent)' : 'none'}" fill-opacity=".16" stroke="${s.plein ? 'var(--accent)' : 'var(--muted)'}" stroke-width="2"${s.plein ? '' : ' stroke-dasharray="5 4"'} stroke-linejoin="round"/>`).join('');
  const points = series.filter(s => s.plein).map(s => D.map((d, i) => noteOK(s.vals[d.k]) ? `<circle cx="${xy(pt(i, s.vals[d.k])).split(',')[0]}" cy="${xy(pt(i, s.vals[d.k])).split(',')[1]}" r="3" fill="var(--accent)"/>` : '').join('')).join('');
  const lib = series.map(s => `${s.nom} : ${D.map(d => `${d.c} ${noteOK(s.vals[d.k]) ? s.vals[d.k] : 'non noté'}`).join(', ')}`).join(' ; ');
  return `<svg viewBox="0 0 340 300" role="img" aria-label="Graphique en toile d’araignée. ${esc(lib)}" style="width:100%;height:auto;display:block">${anneaux}${axes}${formes}${points}${noms}</svg>`;
}
/* Le score global au fil des bilans complets, sur les trois paliers de la fiche */
function courbe(q, liste) {
  const L = liste.filter(b => scoreBilan(b).complet);
  if (L.length < 2) return '';
  const W = 340, H = 180, gx = 30, dx = 14, hy = 16, by = 28;
  const t = b => parse(b.date).getTime(), t0 = t(L[0]), t1 = t(L[L.length - 1]);
  const X = b => t1 === t0 ? (gx + W - dx) / 2 : gx + (W - gx - dx) * (t(b) - t0) / (t1 - t0);
  const Y = v => hy + (H - hy - by) * (1 - v / 100);
  const bande = (a, b, c) => `<rect x="${gx}" y="${Y(b).toFixed(1)}" width="${W - gx - dx}" height="${(Y(a) - Y(b)).toFixed(1)}" fill="var(--${c})" fill-opacity=".14"/>`;
  const pts = L.map(b => `${X(b).toFixed(1)},${Y(scoreBilan(b).total).toFixed(1)}`).join(' ');
  const lib = L.map(b => `${fmtFR(b.date)} : ${scoreBilan(b).total} sur 100`).join(' ; ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du score global. ${esc(lib)}" style="width:100%;height:auto;display:block">
    ${bande(0, 40, 'rouge')}${bande(40, 70, 'jaune')}${bande(70, 100, 'vert')}
    ${[0, 40, 70, 100].map(v => `<text x="${gx - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${v}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${L.map(b => `<circle cx="${X(b).toFixed(1)}" cy="${Y(scoreBilan(b).total).toFixed(1)}" r="3.5" fill="var(--accent)"/><text x="${X(b).toFixed(1)}" y="${(Y(scoreBilan(b).total) - 8).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">${scoreBilan(b).total}</text>`).join('')}
    <text x="${X(L[0]).toFixed(1)}" y="${H - 8}" text-anchor="${L.length > 1 ? 'start' : 'middle'}" font-size="10" fill="var(--muted)">${courtDate(L[0].date)}/${L[0].date.slice(2, 4)}</text>
    <text x="${X(L[L.length - 1]).toFixed(1)}" y="${H - 8}" text-anchor="end" font-size="10" fill="var(--muted)">${courtDate(L[L.length - 1].date)}/${L[L.length - 1].date.slice(2, 4)}</text>
  </svg>`;
}
/* Les domaines en lignes, les derniers bilans en colonnes : chaque case prend la couleur de sa note */
function matrice(q, liste) {
  const L = liste.slice(-5), D = QUESTIONNAIRES[q].domaines;
  return `<div class="defile-x"><table class="matrice"><thead><tr><th></th>${L.map(b => `<th>${courtDate(b.date)}</th>`).join('')}${L.length > 1 ? '<th>Écart</th>' : ''}</tr></thead><tbody>
    ${D.map(d => { const e = L.length > 1 ? deltaNote(L[L.length - 2].notes[d.k], L[L.length - 1].notes[d.k]) : null;
      return `<tr><th scope="row">${esc(d.c)}</th>${L.map(b => `<td class="cel ${classeNote(b.notes[d.k])}">${noteOK(b.notes[d.k]) ? b.notes[d.k] : '–'}</td>`).join('')}${L.length > 1 ? `<td class="delta ${clsDelta(e)}">${fmtDelta(e)}</td>` : ''}</tr>`; }).join('')}
    <tr class="total"><th scope="row">Total</th>${L.map(b => `<td>${scoreBilan(b).total}</td>`).join('')}${L.length > 1 ? `<td class="delta ${clsDelta(scoreBilan(L[L.length - 1]).total - scoreBilan(L[L.length - 2]).total)}">${fmtDelta(scoreBilan(L[L.length - 1]).total - scoreBilan(L[L.length - 2]).total)}</td>` : ''}</tr>
  </tbody></table></div>`;
}

/* ───────────── Le journal de l'app, avant un bilan ─────────────
   Les jours qui précèdent la date du bilan (cmp.jours), au plus loin du premier jour renseigné : jours remplis, couleurs des
   journées, émotions et besoins les plus fréquents, actions cochées. Ce sont les données de l'administrateur lui-même. */
function journalAvant(fin, jours) {
  const cles = Object.keys(data.days).filter(k => dayFilled(data.days[k])).sort(), premier = cles[0], haut = today();
  const dernier = fin > haut ? haut : fin;
  let debut = addDays(fin, -(jours - 1)); if (premier && debut < premier) debut = premier;
  const r = {jours:0, remplis:0, couleurs:{vert:0, jaune:0, rouge:0}, emotions:0, notes:0, fam:{}, bes:{}, taches:0, faites:0};
  if (!premier || debut > dernier) return {...r, vide:true};
  for (let k = debut; k <= dernier; k = addDays(k, 1)) {
    r.jours++;
    const d = data.days[k]; if (!d) continue;
    if (dayFilled(d)) r.remplis++;
    if (r.couleurs[d.color] != null) r.couleurs[d.color]++;
    r.notes += dayNotes(d).length;
    for (const e of d.entries || []) {
      r.emotions++;
      new Set(e.emos.map(x => x.f)).forEach(f => { r.fam[f] = (r.fam[f] || 0) + 1; });
      besoinsDe(e).forEach(x => { r.bes[x.w] = (r.bes[x.w] || 0) + 1; });
      tachesDe(e).forEach(x => { r.taches++; if (x.ok) r.faites++; });
    }
  }
  return r;
}
const haut3 = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3);
const pct = (n, tot) => tot ? Math.round(100 * n / tot) : null;
const chipsFam = r => haut3(r.fam).map(([f, n]) => `<span class="chip static" style="--fc:${FAMK[f].c}">${esc(FAMK[f].n)} · ${n}</span>`).join(' ') || '<span class="muted">—</span>';
const textBes = r => haut3(r.bes).map(([w, n]) => `${esc(w)} (${n})`).join(', ') || '—';

/* ───────────── Pages ───────────── */
/* Liste des questionnaires */
function pageQuestionnaires() {
  purgerBilansVides();
  return `<p class="small muted" style="margin:0 2px 12px">Questionnaires à remplir régulièrement, pour suivre l’évolution de vos réponses et la lire à la lumière de votre journal. Ils vous sont réservés : chiffrés sur cet appareil avec votre journal, jamais envoyés, et compris dans vos sauvegardes.</p>
  <div class="grp">${Object.entries(QUESTIONNAIRES).map(([k, q]) => {
    const L = bilansDe(k), d = L[L.length - 1], s = d && scoreBilan(d);
    return ligneMenu('questionnaire', q.court, {val:d ? `${L.length} bilan${L.length > 1 ? 's' : ''}${s.complet ? ` · ${s.total}/100` : ''}` : 'Aucun bilan', page:k, act:'admQuest'});
  }).join('')}</div>`;
}
/* Un questionnaire : le dernier bilan, son évolution, les bilans passés */
function pageBilans() {
  purgerBilansVides();
  const q = QUESTIONNAIRES[admQ], L = bilansDe(admQ), dern = L[L.length - 1], prec = L[L.length - 2];
  const nouveau = `<button class="btn primary block" data-act="bilanNouveau"${lectureSeule() ? ' disabled' : ''}>${L.length ? 'Nouveau bilan' : 'Remplir un premier bilan'}</button>`;
  if (!dern) return `<section class="card"><p class="small muted" style="margin:0">${esc(q.intro)}</p><p class="small muted" style="margin:6px 0 0">Source : ${esc(q.source)}.</p>${nouveau}</section>`;
  const s = scoreBilan(dern), sp = prec && scoreBilan(prec), ecart = s.complet && sp?.complet ? s.total - sp.total : null;
  const complets = L.filter(b => scoreBilan(b).complet);
  return `<section class="card">
    <div class="eyebrow">Dernier bilan · ${esc(fmtLong(dern.date))}${dern.periode.trim() ? ` · ${esc(dern.periode.trim())}` : ''}</div>
    <div class="score-l"><div class="score-n"><b>${s.total}</b><span>/ 100</span></div><div>${chipPalier(admQ, s)}${ecart != null ? `<div class="small" style="margin-top:6px"><b class="delta ${clsDelta(ecart)}">${fmtDelta(ecart) || '='} point${Math.abs(ecart) > 1 ? 's' : ''}</b> <span class="muted">depuis le ${fmtFR(prec.date)}</span></div>` : ''}</div></div>
    ${nouveau}
    ${L.length > 1 ? `<button class="btn block" data-act="bilanComparer">Comparer deux bilans</button>` : ''}
  </section>
  <section class="card">
    <h2>Mes 10 domaines</h2>
    ${radar(admQ, [{nom:fmtFR(dern.date), vals:dern.notes, plein:true}, ...(prec ? [{nom:fmtFR(prec.date), vals:prec.notes, plein:false}] : [])])}
    <div class="legende"><span><i class="l-plein"></i>${fmtFR(dern.date)}</span>${prec ? `<span><i class="l-tirets"></i>${fmtFR(prec.date)}</span>` : ''}</div>
  </section>
  ${complets.length > 1 ? `<section class="card"><h2>Évolution du score global</h2>${courbe(admQ, L)}<p class="small muted" style="margin:6px 0 0">Les trois bandes sont les paliers de la fiche : alerte (0 à 40), équilibre à consolider (41 à 70), bel épanouissement (71 à 100).</p></section>` : ''}
  ${L.length > 1 ? `<section class="card"><h2>Domaine par domaine</h2>${matrice(admQ, L)}<p class="small muted" style="margin:6px 0 0">Les ${Math.min(5, L.length)} derniers bilans ; « Écart » : le dernier par rapport à l’avant-dernier.</p></section>` : ''}
  ${journalEtBilans(L)}
  <div class="gl">Mes bilans</div>
  <div class="grp">${[...L].reverse().map(b => { const sb = scoreBilan(b); return ligneMenu('questionnaire', fmtLong(b.date), {val:sb.complet ? `${sb.total}/100` : 'incomplet', page:b.id, act:'bilanOuvrir'}); }).join('')}</div>
  <p class="small muted" style="margin:8px 2px 0">Source : ${esc(q.source)}. Touchez un bilan pour le relire ou le corriger.</p>`;
}
/* Les bilans mis en regard du journal : une ligne par bilan, avec les jours qui le précèdent */
function journalEtBilans(L) {
  if (Object.keys(data.days).length === 0) return '';
  const l = L.slice(-5).reverse();
  return `<section class="card"><h2>À la lumière du journal</h2>
    <p class="small muted" style="margin:4px 0 0">Ce que vous avez noté dans l’app pendant les ${cmp.jours} jours avant chaque bilan.</p>
    <div class="defile-x"><table class="stats mini"><thead><tr><th>Bilan</th><th>Score</th><th>Jours remplis</th><th>Vert</th><th>Rouge</th></tr></thead><tbody>
    ${l.map(b => { const j = journalAvant(b.date, cmp.jours), s = scoreBilan(b);
      return `<tr><th scope="row">${courtDate(b.date)}/${b.date.slice(2, 4)}</th><td>${s.complet ? s.total : '–'}</td>${j.vide ? '<td colspan="3" class="muted">pas de journal</td>' : `<td>${j.remplis}/${j.jours}</td><td>${pct(j.couleurs.vert, j.jours)} %</td><td>${pct(j.couleurs.rouge, j.jours)} %</td>`}</tr>`; }).join('')}
    </tbody></table></div>
    <p class="small muted" style="margin:6px 0 0">Vert et rouge : part des jours dont la couleur de la journée est « ${esc(data.labels.vert)} » ou « ${esc(data.labels.rouge)} ». « Comparer deux bilans » détaille émotions, besoins et actions.</p>
  </section>`;
}

/* La saisie d'un bilan */
const titreBilan = () => { const b = bilanPar(bilanOuvert); return b ? `Bilan du ${fmtFR(b.date)}` : 'Bilan'; };
function carteScore(b) {
  const s = scoreBilan(b);
  return `<div class="score-l"><div class="score-n"><b>${s.total}</b><span>/ 100</span></div><div>${chipPalier(b.q, s)}</div></div>`;
}
function pageBilan() {
  const b = bilanPar(bilanOuvert);
  if (!b) return '<section class="card"><p class="empty">Ce bilan n’existe plus.</p></section>';
  const q = QUESTIONNAIRES[b.q], L = bilansDe(b.q), i = L.indexOf(b), prec = i > 0 ? L[i - 1] : null;
  const ta = (id, attr, val, ph, rows = 2) => `<textarea id="${id}" data-bilan="${attr}" data-auto rows="${rows}" autocapitalize="sentences" placeholder="${ph}">${esc(val)}</textarea>`;
  return `<section class="card">
    <label class="label" for="bDate" style="margin-top:0">Date du bilan</label>
    <input type="date" id="bDate" data-bilan="date" value="${b.date}" max="${today()}">
    <div class="wd-hint" id="bJour">${weekday(b.date)}</div>
    <label class="label" for="bPeriode">Prénom / période (facultatif)</label>
    <input type="text" id="bPeriode" data-bilan="periode" value="${esc(b.periode)}" maxlength="80" autocapitalize="sentences" placeholder="Par exemple : novembre 2026">
    <div class="small muted" id="bEtat" aria-live="polite" style="margin-top:8px;text-align:right">Enregistré au fil de la saisie</div>
  </section>
  <section class="card" id="bScore"><h2>Score global d’équilibre</h2>${carteScore(b)}
    <p class="small muted" style="margin:8px 0 0">0 à 40 : alerte / épuisement · 41 à 70 : équilibre à consolider · 71 à 100 : bel épanouissement.</p></section>
  ${q.domaines.map((d, n) => `<section class="card" data-dom="${d.k}">
    <h2>${n + 1}. ${esc(d.n)}</h2>
    <p class="small muted" style="margin:3px 0 0">${esc(d.r)}</p>
    <div class="note-chips" role="group" aria-label="Note de « ${esc(d.n)} » sur 10">${[...Array(11).keys()].map(v => `<button type="button" class="${b.notes[d.k] === v ? 'on' : ''}" data-act="bilanNote" data-d="${d.k}" data-v="${v}" aria-pressed="${b.notes[d.k] === v}">${v}</button>`).join('')}</div>
    <div class="small muted" data-prec="${d.k}" style="text-align:right">${prec ? `Bilan précédent (${courtDate(prec.date)}) : ${noteOK(prec.notes[d.k]) ? prec.notes[d.k] : '–'}` : ''}</div>
    <label class="label" for="c-${d.k}" style="margin-top:6px">Mon constat</label>
    ${ta('c-' + d.k, 'constat:' + d.k, b.constats[d.k] || '', 'Ce que je constate…')}
  </section>`).join('')}
  <section class="card"><h2>Mes 2 priorités concrètes pour faire monter mon score</h2>
    ${[0, 1].map(n => `<label class="label" for="pd${n}">${n + 1}. Domaine prioritaire</label>
    <select id="pd${n}" data-bilan="pd:${n}"><option value="">—</option>${q.domaines.map(d => `<option value="${d.k}"${b.priorites[n].dom === d.k ? ' selected' : ''}>${esc(d.n)}</option>`).join('')}</select>
    <label class="label" for="pa${n}">Action concrète cette semaine</label>
    ${ta('pa' + n, 'pa:' + n, b.priorites[n].action, 'Mon action…')}`).join('')}
  </section>
  <button class="btn danger block" data-act="bilanSuppr">Supprimer ce bilan</button>`;
}
/* Ce qui se saisit : le texte et la date, sans réafficher la page (le clavier reste ouvert) */
let bilanSave = 0;
function majBilanChamp(t) {
  const b = bilanPar(bilanOuvert); if (!b) return;
  const [k, x] = t.dataset.bilan.split(':');
  if (lectureSeule()) return;
  if (k === 'date') { if (!t.value) return; b.date = t.value; $('#bJour').textContent = weekday(t.value); const h = $('#view .subhead h1'); if (h) h.textContent = titreBilan(); }
  else if (k === 'periode') b.periode = t.value;
  else if (k === 'constat') { b.constats[x] = t.value; ajusterHauteur(t); }
  else if (k === 'pd') b.priorites[+x].dom = t.value;
  else if (k === 'pa') { b.priorites[+x].action = t.value; ajusterHauteur(t); }
  const etat = () => $('#bEtat');
  etat().textContent = '…';
  clearTimeout(bilanSave); bilanSave = setTimeout(() => saveNow().then(() => { const e = etat(); if (e) e.textContent = 'Enregistré ✓'; }), 500);
}
function majScoreBilan(b) {
  const c = $('#bScore .score-l'); if (c) c.outerHTML = carteScore(b);
}

/* La comparaison de deux bilans */
function choixBilan(id, L, valeur) {
  return `<select id="${id}" data-cmp="${id}">${L.map(b => { const s = scoreBilan(b); return `<option value="${b.id}"${b.id === valeur ? ' selected' : ''}>${fmtFR(b.date)}${s.complet ? '' : ' (incomplet)'}</option>`; }).join('')}</select>`;
}
function pageCompare() {
  purgerBilansVides();
  const q = QUESTIONNAIRES[admQ], L = bilansDe(admQ);
  if (L.length < 2) return '<section class="card"><p class="empty">Il faut au moins deux bilans pour les comparer.</p></section>';
  if (!L.some(b => b.id === cmp.a)) cmp.a = L[L.length - 2].id;
  if (!L.some(b => b.id === cmp.b)) cmp.b = L[L.length - 1].id;
  const A = bilanPar(cmp.a), B = bilanPar(cmp.b), sA = scoreBilan(A), sB = scoreBilan(B), D = q.domaines;
  const ecart = sA.complet && sB.complet ? sB.total - sA.total : null;
  const ecarts = D.map(d => ({d, e:deltaNote(A.notes[d.k], B.notes[d.k])})).filter(x => x.e != null);
  const mieux = ecarts.filter(x => x.e > 0).sort((x, y) => y.e - x.e)[0], pire = ecarts.filter(x => x.e < 0).sort((x, y) => x.e - y.e)[0];
  const jA = journalAvant(A.date, cmp.jours), jB = journalAvant(B.date, cmp.jours);
  const part = (n, r) => r.jours ? `${n} <small>${pct(n, r.jours)} %</small>` : '–';
  const pts = (n1, r1, n2, r2) => r1.jours && r2.jours ? pct(n2, r2.jours) - pct(n1, r1.jours) : null;
  const jr = (nom, kA, kB) => `<tr><th scope="row">${nom}</th><td>${part(kA, jA)}</td><td>${part(kB, jB)}</td><td class="delta ${clsDelta(pts(kA, jA, kB, jB))}">${pts(kA, jA, kB, jB) == null ? '' : pts(kA, jA, kB, jB) === 0 ? '=' : `${fmtDelta(pts(kA, jA, kB, jB))} pts`}</td></tr>`;
  const pastille = c => `<span class="pt ${c}" aria-hidden="true"></span>${esc(data.labels[c])}`;
  const priorites = bil => { const l = bil.priorites.filter(p => p.dom || p.action.trim()); return l.length ? l.map(p => {
    const e = p.dom ? deltaNote(A.notes[p.dom], B.notes[p.dom]) : null;
    return `<div class="prio-l"><b>${esc(nomDom(admQ, p.dom) || 'Domaine non choisi')}</b>${p.action.trim() ? ` — ${esc(p.action.trim())}` : ''}${bil === A && e != null ? `<div class="small">Entre les deux bilans : <b class="delta ${clsDelta(e)}">${fmtDelta(e) || '='}</b> <span class="muted">(${A.notes[p.dom]} → ${B.notes[p.dom]})</span></div>` : ''}</div>`; }).join('') : '<p class="small muted" style="margin:4px 0 0">Aucune priorité notée.</p>'; };
  const constats = D.filter(d => (A.constats[d.k] || '').trim() || (B.constats[d.k] || '').trim());
  return `<section class="card">
    <div class="row cmp-choix"><div style="flex:1;min-width:0"><label class="label" for="cmpA" style="margin-top:0">Bilan de départ</label>${choixBilan('cmpA', L, cmp.a)}</div>
    <div style="flex:1;min-width:0"><label class="label" for="cmpB" style="margin-top:0">Bilan comparé</label>${choixBilan('cmpB', L, cmp.b)}</div></div>
    <div class="cmp-score"><div><div class="small muted">${fmtFR(A.date)}</div><b>${sA.total}</b>${sA.complet ? '' : '<span class="small muted"> prov.</span>'}</div>
      <div class="cmp-fl"><b class="delta ${clsDelta(ecart)}">${ecart == null ? '→' : `${fmtDelta(ecart) || '='}`}</b></div>
      <div><div class="small muted">${fmtFR(B.date)}</div><b>${sB.total}</b>${sB.complet ? '' : '<span class="small muted"> prov.</span>'}</div></div>
    <div style="text-align:center">${sA.complet ? chipPalier(admQ, sA) : ''} ${sB.complet ? '→ ' + chipPalier(admQ, sB) : ''}</div>
    ${A.id === B.id ? '<p class="small muted" style="margin:8px 0 0;text-align:center">Choisissez deux bilans différents.</p>' : ''}
  </section>
  <section class="card"><h2>Les 10 domaines</h2>
    ${radar(admQ, [{nom:fmtFR(B.date), vals:B.notes, plein:true}, {nom:fmtFR(A.date), vals:A.notes, plein:false}])}
    <div class="legende"><span><i class="l-plein"></i>${fmtFR(B.date)}</span><span><i class="l-tirets"></i>${fmtFR(A.date)}</span></div>
    ${mieux || pire ? `<p class="small" style="margin:10px 0 0">${mieux ? `Plus forte progression : <b>${esc(mieux.d.n)}</b> (<span class="delta plus">${fmtDelta(mieux.e)}</span>).` : ''} ${pire ? `Plus fort recul : <b>${esc(pire.d.n)}</b> (<span class="delta moins">${fmtDelta(pire.e)}</span>).` : ''}</p>` : ''}
    <div class="cmp-liste">${D.map(d => { const a = A.notes[d.k], b = B.notes[d.k], e = deltaNote(a, b);
      return `<div class="cmp-l"><div class="cmp-h"><span>${esc(d.n)}</span><b class="delta ${clsDelta(e)}">${fmtDelta(e)}</b></div>
        <div class="cmp-b"><span>${courtDate(A.date)}</span><div class="meter" style="--m:var(--muted)"><i style="width:${noteOK(a) ? a * 10 : 0}%"></i></div><b>${noteOK(a) ? a : '–'}</b></div>
        <div class="cmp-b"><span>${courtDate(B.date)}</span><div class="meter"><i style="width:${noteOK(b) ? b * 10 : 0}%"></i></div><b>${noteOK(b) ? b : '–'}</b></div></div>`; }).join('')}</div>
  </section>
  <section class="card"><h2>Priorités</h2>
    <div class="eyebrow" style="margin-top:8px">Fixées le ${fmtFR(A.date)}</div>${priorites(A)}
    <div class="eyebrow" style="margin-top:12px">Fixées le ${fmtFR(B.date)}</div>${priorites(B)}
  </section>
  ${constats.length ? `<section class="card"><h2>Constats</h2>${constats.map(d => `<div class="cst"><b>${esc(d.n)}</b>
    ${(A.constats[d.k] || '').trim() ? `<p><span class="muted">${fmtFR(A.date)} :</span> ${esc(A.constats[d.k].trim())}</p>` : ''}
    ${(B.constats[d.k] || '').trim() ? `<p><span class="muted">${fmtFR(B.date)} :</span> ${esc(B.constats[d.k].trim())}</p>` : ''}</div>`).join('')}</section>` : ''}
  <section class="card"><h2>À la lumière du journal</h2>
    <div class="setrow" style="margin-top:8px"><label for="cmpJ">Jours observés avant chaque bilan</label>
      <select id="cmpJ" data-cmp="jours">${[14, 30, 60, 90].map(n => `<option value="${n}"${cmp.jours === n ? ' selected' : ''}>${n} jours</option>`).join('')}</select></div>
    ${jA.vide && jB.vide ? '<p class="small muted" style="margin:6px 0 0">Aucune note dans l’app avant ces deux dates.</p>' : `
    <table class="stats mini"><thead><tr><th></th><th>${courtDate(A.date)}</th><th>${courtDate(B.date)}</th><th>Écart</th></tr></thead><tbody>
      ${jr('Jours remplis', jA.remplis, jB.remplis)}
      ${jr(pastille('vert'), jA.couleurs.vert, jB.couleurs.vert)}${jr(pastille('jaune'), jA.couleurs.jaune, jB.couleurs.jaune)}${jr(pastille('rouge'), jA.couleurs.rouge, jB.couleurs.rouge)}
      <tr><th scope="row">Notes d’émotion</th><td>${jA.emotions}</td><td>${jB.emotions}</td><td class="delta ${clsDelta(jB.emotions - jA.emotions)}">${jA.jours && jB.jours ? fmtDelta(jB.emotions - jA.emotions) : ''}</td></tr>
      <tr><th scope="row">Actions cochées</th><td>${jA.taches ? `${jA.faites}/${jA.taches}` : '–'}</td><td>${jB.taches ? `${jB.faites}/${jB.taches}` : '–'}</td><td></td></tr>
    </tbody></table>
    <div class="cst"><b>Émotions les plus fréquentes</b><p><span class="muted">${courtDate(A.date)} :</span> ${jA.vide ? '—' : chipsFam(jA)}</p><p><span class="muted">${courtDate(B.date)} :</span> ${jB.vide ? '—' : chipsFam(jB)}</p></div>
    <div class="cst"><b>Besoins les plus exprimés</b><p><span class="muted">${courtDate(A.date)} :</span> ${jA.vide ? '—' : textBes(jA)}</p><p><span class="muted">${courtDate(B.date)} :</span> ${jB.vide ? '—' : textBes(jB)}</p></div>
    <p class="small muted" style="margin:10px 0 0">Les pourcentages comptent les jours observés (jusqu’au premier jour noté dans l’app). Si deux bilans sont plus proches que ${cmp.jours} jours, les périodes se chevauchent.</p>`}
  </section>`;
}

/* ───────────── Actions ───────────── */
function admAller(p) { admPos[admPage || ''] = scrollY; admPage = p; render(); }
const ACT_BILANS = {
  admOuvrir: t => admAller(t.dataset.p),
  admRetour: () => {
    admPage = parentAdm(admPage); purgerBilansVides();
    render(true); window.scrollTo(0, admPos[admPage || ''] || 0);
  },
  admQuest: t => { admQ = t.dataset.p; admAller('bilans'); },
  bilanNouveau: () => {
    if (lectureSeule()) return toast(MSG_LECTURE);
    const b = {id:uid(), q:admQ, date:today(), periode:'', notes:{}, constats:{}, priorites:[{dom:'', action:''}, {dom:'', action:''}], cree:new Date().toISOString()};
    data.bilans.push(b); save(); bilanOuvert = b.id; admAller('bilan');
  },
  bilanOuvrir: t => { bilanOuvert = t.dataset.p; admAller('bilan'); },
  bilanComparer: () => admAller('compare'),
  // une note de 0 à 10 ; la même note touchée une seconde fois la retire
  bilanNote: t => {
    const b = bilanPar(bilanOuvert); if (!b || lectureSeule()) return;
    const k = t.dataset.d, v = +t.dataset.v;
    if (b.notes[k] === v) delete b.notes[k]; else b.notes[k] = v;
    document.querySelectorAll(`#view [data-dom="${k}"] .note-chips button`).forEach(x => { const on = b.notes[k] === +x.dataset.v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    majScoreBilan(b); save();
    const e = $('#bEtat'); if (e) e.textContent = '…';
    clearTimeout(bilanSave); bilanSave = setTimeout(() => saveNow().then(() => { const s = $('#bEtat'); if (s) s.textContent = 'Enregistré ✓'; }), 500);
  },
  bilanSuppr: async () => {
    const b = bilanPar(bilanOuvert); if (!b) return;
    if (lectureSeule()) return toast(MSG_LECTURE);
    if (!await confirmerAction({titre:'Supprimer ce bilan ?', texte:`Le bilan du ${fmtFR(b.date)} sera supprimé, avec ses notes et ses constats. Pensez à faire une sauvegarde avant si vous voulez pouvoir le retrouver.`, bouton:'Supprimer'})) return;
    data.bilans = data.bilans.filter(x => x.id !== b.id); await saveNow();
    admPage = 'bilans'; render(true); window.scrollTo(0, admPos.bilans || 0); toast('Bilan supprimé');
  },
};
