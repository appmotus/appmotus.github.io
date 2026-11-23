// Motus — Repérer mon émotion par le corps (v52, page de l'onglet Admin, pour son usage personnel)
'use strict';

/* ───────────── Repérer mon émotion ─────────────
   Pour celui qui peine à dire ce qu'il ressent : on part du corps (les sensations que l'on remarque maintenant), pas du mot.
   Chaque sensation penche vers une ou plusieurs familles du répertoire des émotions (poids de 1 à 3). Les sensations touchées
   s'additionnent ; les familles les plus proches (au plus 3, au moins la moitié du meilleur score) sont proposées comme PISTES,
   avec la question qui aide à trancher, puis les mots du répertoire à choisir selon l'intensité. Le choix s'envoie à la fenêtre
   « Noter une émotion », déjà remplie. Rien n'est enregistré par la page elle-même ; ce n'est pas un diagnostic.
   Les liens sensation → famille sont des repères courants (cartes corporelles des émotions), à nuancer : une même sensation
   peut venir de plusieurs émotions, ou de la fatigue, de la faim, du café. Pour changer une sensation : ZONES_SENS ci-dessous. */
const ZONES_SENS = [
  {n:'Tête et visage', s:[
    ['Mâchoires serrées', {colere:3, peur:1}],
    ['Chaleur au visage', {colere:2, degout:1, joie:1}],
    ['Front plissé, sourcils froncés', {colere:2, peur:1, surprise:1}],
    ['Yeux écarquillés', {surprise:3, peur:2}],
    ['Yeux qui piquent, larmes', {tristesse:3, joie:1}],
    ['Sourire qui vient tout seul', {joie:3, surprise:1}],
    ['Nez qui se plisse, lèvres crispées', {degout:3}],
    ['Tête embrouillée, difficile de penser', {surprise:2, peur:1, tristesse:1}],
  ]},
  {n:'Gorge et poitrine', s:[
    ['Boule dans la gorge', {tristesse:3, peur:1}],
    ['Voix qui tremble ou se coince', {peur:2, tristesse:2}],
    ['Poitrine lourde, comme écrasée', {tristesse:3}],
    ['Cœur qui bat vite', {peur:3, colere:2, surprise:2, joie:1}],
    ['Souffle court ou coupé', {peur:3, surprise:2}],
    ['Poitrine qui s’ouvre, respiration ample', {joie:3}],
    ['Envie de soupirer', {tristesse:2, degout:1}],
  ]},
  {n:'Ventre', s:[
    ['Ventre noué, crampe', {peur:3, degout:1}],
    ['Nausée, envie de vomir', {degout:3, peur:1}],
    ['Papillons dans le ventre', {joie:2, surprise:2, peur:1}],
    ['Creux, sensation de vide', {tristesse:3}],
    ['Chaleur dans le ventre', {colere:2, joie:1}],
  ]},
  {n:'Mains, bras et jambes', s:[
    ['Poings serrés, envie de frapper ou de crier', {colere:3}],
    ['Mains moites ou qui tremblent', {peur:3}],
    ['Jambes molles ou qui tremblent', {peur:3, tristesse:1}],
    ['Envie de reculer, de fuir', {peur:3, degout:2}],
    ['Corps figé, immobile', {peur:3, surprise:2}],
    ['Envie de bouger, de sauter', {joie:3, colere:1}],
  ]},
  {n:'Tout le corps, l’énergie', s:[
    ['Épaules et nuque tendues', {peur:2, colere:2}],
    ['Corps lourd, sans énergie', {tristesse:3}],
    ['Corps léger, plein d’énergie', {joie:3}],
    ['Chaleur qui monte dans tout le corps', {colere:3, joie:1}],
    ['Frissons, chair de poule', {peur:2, surprise:1, joie:1}],
    ['Besoin de m’isoler, de me retirer', {tristesse:2, degout:2}],
    ['Envie de m’éloigner de quelque chose', {degout:3, peur:1}],
  ]},
];
/* La question qui aide à trancher, pour chaque famille : ce qui déclenche d'ordinaire cette émotion */
const QUESTION_FAMILLE = {
  peur:'Y a-t-il quelque chose d’incertain ou de menaçant, que je ne maîtrise pas ?',
  colere:'Une limite, une valeur ou une injustice a-t-elle été franchie ?',
  tristesse:'Y a-t-il une perte, une déception ou un manque, quelqu’un ou quelque chose qui me manque ?',
  joie:'Quelque chose me nourrit-il, me comble-t-il, me rend-il fier ou reconnaissant ?',
  degout:'Quelque chose me répugne-t-il, ou va-t-il contre mes valeurs, au point de vouloir m’en éloigner ?',
  surprise:'Est-ce nouveau ou inattendu, quelque chose que je ne comprends pas encore ?',
};
const sens = new Set();   // les sensations touchées : « zone.rang »
let sensInt = 'm';        // l'intensité des mots proposés
let sensMots = [];        // les mots choisis : [{f, i, w}]

/* Les familles les plus proches des sensations touchées : [{f, t (score), qui (sensations), top (meilleur score)}] */
function classementSens() {
  const sc = {};
  ZONES_SENS.forEach((z, zi) => z.s.forEach(([nom, poids], i) => {
    if (!sens.has(`${zi}.${i}`)) return;
    for (const f in poids) { const c = sc[f] ||= {t:0, qui:[]}; c.t += poids[f]; c.qui.push(nom); }
  }));
  const l = Object.entries(sc).sort((a, b) => b[1].t - a[1].t), top = l[0]?.[1].t || 0;
  return l.filter(([, v]) => v.t >= top / 2).slice(0, 3).map(([f, v]) => ({f, ...v, top}));
}
const minuscule1 = s => s.charAt(0).toLowerCase() + s.slice(1);
const motChoisi = (f, w) => sensMots.some(x => x.f === f && x.w === w);
/* La partie qui change à chaque touche : les pistes, l'intensité, les mots et le bouton pour noter */
function resultatSens() {
  const cl = classementSens();
  if (!cl.length) return '<p class="small muted" style="margin:0">Touchez une ou plusieurs sensations ci-dessus : des pistes apparaissent ici.</p>';
  return `<p class="small muted" style="margin:0 0 8px">Des pistes, pas une réponse : plusieurs émotions peuvent être là en même temps.</p>
    <div class="seg" role="group" aria-label="Intensité">${INT.map(([k, n]) => `<button type="button" class="${sensInt === k ? 'on' : ''}" data-act="sensInt" data-i="${k}" aria-pressed="${sensInt === k}">${n}</button>`).join('')}</div>
    ${cl.map((c, n) => { const f = FAMK[c.f]; return `<div class="sens-fam" style="--fc:${f.c}">
      <div class="sens-h"><b>${n + 1}. ${esc(f.n)}</b><span class="small muted">${n ? 'piste suivante' : 'piste la plus proche'}</span></div>
      <div class="meter" style="--m:${f.c}" role="img" aria-label="Proximité avec ${esc(f.n)}"><i style="width:${(c.t / c.top * 100).toFixed(0)}%"></i></div>
      <p class="small" style="margin:6px 0 0"><span class="muted">Vos sensations :</span> ${esc(c.qui.map(minuscule1).join(' · '))}.</p>
      <p class="small" style="margin:6px 0 0"><b>Pour affiner :</b> ${esc(QUESTION_FAMILLE[c.f])}</p>
      <p class="small muted" style="margin:6px 0 0">Cette émotion réclame souvent un ${esc(minuscule1(f.b))}.</p>
      <div class="chips" style="margin-top:8px">${f[sensInt].map(w => `<button type="button" class="chip${motChoisi(c.f, w) ? ' on' : ''}" style="--fc:${f.c}" data-act="sensMot" data-f="${c.f}" data-w="${esc(w)}" aria-pressed="${motChoisi(c.f, w)}">${esc(w)}</button>`).join('')}</div>
    </div>`; }).join('')}
    <button class="btn primary block" data-act="sensNoter"${sensMots.length ? '' : ' disabled'}>${sensMots.length ? `Noter dans mon journal (${sensMots.length} mot${sensMots.length > 1 ? 's' : ''})` : 'Choisissez un ou plusieurs mots pour les noter'}</button>`;
}
function pageSens() {
  return `<section class="card">
    <p class="small" style="margin:0">Quand je ne sais pas ce que je ressens, je pars de mon corps. Je touche les sensations que je remarque <b>maintenant</b>, sans chercher la bonne réponse : l’app propose des pistes, puis les mots du répertoire.</p>
    <p class="small muted" style="margin:8px 0 0">Outil de repérage, pas un diagnostic. Une même sensation peut aussi venir de la fatigue, de la faim ou du café.</p>
    <details style="margin-top:10px"><summary class="small"><b>Un instant pour sentir</b></summary>
      <ol class="small muted" style="margin:8px 0 0;padding-left:20px">
        <li>Je pose les pieds au sol et je prends trois respirations lentes.</li>
        <li>Je balaie mon corps de la tête aux pieds, sans rien changer.</li>
        <li>À chaque endroit, je me demande : est-ce que ça serre, chauffe, pèse, picote, bouge, ou est-ce neutre ?</li>
        <li>Si rien ne vient, c’est une information aussi : je note « rien de précis », et je réessaie plus tard, après un geste simple (boire, marcher, étirer les épaules).</li>
      </ol>
    </details>
  </section>
  ${ZONES_SENS.map((z, zi) => `<section class="card"><h2>${esc(z.n)}</h2>
    <div class="chips" style="margin-top:8px">${z.s.map(([nom], i) => `<button type="button" class="chip neutre${sens.has(`${zi}.${i}`) ? ' on' : ''}" data-act="sensTog" data-s="${zi}.${i}" aria-pressed="${sens.has(`${zi}.${i}`)}">${esc(nom)}</button>`).join('')}</div></section>`).join('')}
  <section class="card" id="sensRes"><h2>Pistes</h2><div id="sensCorps" style="margin-top:8px">${resultatSens()}</div>
    ${sens.size ? '<button class="btn block" data-act="sensVider">Tout effacer</button>' : ''}</section>`;
}
const majSens = () => { const c = $('#sensCorps'); if (c) c.innerHTML = resultatSens(); };
const ACT_SENS = {
  sensTog: t => {
    const k = t.dataset.s, on = !sens.has(k);
    on ? sens.add(k) : sens.delete(k);
    t.classList.toggle('on', on); t.setAttribute('aria-pressed', on);
    // une famille qui n'est plus proposée perd ses mots choisis
    const fams = new Set(classementSens().map(c => c.f));
    sensMots = sensMots.filter(x => fams.has(x.f));
    majSens();
    const v = $('#sensRes [data-act=sensVider]'); if (!v && sens.size) $('#sensRes').insertAdjacentHTML('beforeend', '<button class="btn block" data-act="sensVider">Tout effacer</button>'); else if (v && !sens.size) v.remove();
  },
  sensInt: t => { sensInt = t.dataset.i; majSens(); },   // les mots déjà choisis restent choisis
  sensMot: t => {
    const f = t.dataset.f, w = t.dataset.w, i = sensMots.findIndex(x => x.f === f && x.w === w);
    if (i >= 0) sensMots.splice(i, 1); else sensMots.push({f, i:sensInt, w});
    majSens();
  },
  sensVider: () => { sens.clear(); sensMots = []; render(true); },
  // la fenêtre « Noter une émotion », déjà remplie des mots choisis, pour aujourd'hui
  sensNoter: () => {
    if (!sensMots.length) return;
    cur = today(); openEntry(null);
    if (!ed) return;
    ed.emos = sensMots.map(x => ({...x})); ed.fam = ed.emos[0].f; ed.int = ed.emos[0].i;
    renderPicker();
  },
};
