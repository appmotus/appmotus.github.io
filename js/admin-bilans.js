// Motus — Questionnaires de l'administrateur (v49, étendus en v50) : bilans, comparaison, lecture à la lumière du journal
'use strict';

/* ───────────── Questionnaires (réservés à l'administrateur) ─────────────
   Les bilans remplis sont gardés dans data.bilans, chiffrés avec le journal sur cet appareil : ils ne quittent jamais le téléphone,
   et font partie des sauvegardes. Un bilan : {id, q (questionnaire), date, periode, notes {question: valeur}, constats {domaine: texte},
   priorites [{dom, action}, {dom, action}], cree}.
   Un questionnaire du registre QUESTIONNAIRES (pour en ajouter un : une entrée, rien d'autre) :
   - type 'domaines' : chaque question est un domaine de vie noté, avec un constat et des priorités (fiche hygiène de vie) ;
     type 'echelle' : des questions à échelle (une réponse par question), sans constat ;
   - items [{k, n, c?, r?}] : les questions ; dimensions [{k, n, c, items:[k…], seuil?, aide?}] : les sous-scores ;
   - echelle {min, max, libelles?} ; sens 1 : plus haut = mieux ; -1 : plus haut = plus de difficulté (dépistages) ;
   - paliers [{max, n, c (vert, jaune, rouge), d?}] : l'interprétation du score total, du plus bas au plus haut ;
   - na [k…] (v51) : les questions que l'on peut déclarer « N/A » (notes[k] = 'na') : elles sortent du total, et le palier se lit sur le
     score ramené au maximum complet (eq). */
const HYGIENE = [
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
];
const numeroter = textes => textes.map((n, i) => ({k:String(i + 1), n}));
const AVIS_DEPISTAGE = 'Outil de repérage, pas un diagnostic : il ne remplace pas l’avis d’un professionnel.';
const QUESTIONNAIRES = {
  hygiene:{
    type:'domaines', mot:'domaine', nom:'Fiche hygiène de vie & accomplissement', court:'Hygiène de vie', source:'Liberté pour Aimer',
    intro:'Auto-évaluation de mon équilibre personnel sur 100 points : 10 domaines de vie, notés chacun sur 10.',
    periodeLabel:'Commentaire de période (facultatif)', na:['conjugale', 'sexuelle'], sens:1, echelle:{min:0, max:10},
    items:HYGIENE, dimensions:HYGIENE.map(d => ({k:d.k, n:d.n, c:d.c, items:[d.k]})),
    paliers:[{max:40, n:'Alerte / Épuisement', c:'rouge'}, {max:70, n:'Équilibre à consolider', c:'jaune'}, {max:100, n:'Bel épanouissement', c:'vert'}],
  },
  ppcs:{
    type:'echelle', mot:'question', nom:'Échelle PPCS-18 — consommation problématique de pornographie', court:'PPCS-18', source:'Liberté pour Aimer ; Bőthe et al., 2018',
    intro:'Problematic Pornography Consumption Scale : 18 questions sur les 6 derniers mois, notées de 1 (jamais) à 7 (tout le temps).',
    definition:'Dans ce questionnaire, « porno » désigne le fait de regarder ou d’écouter intentionnellement : (1) des images ou vidéos d’individus nus, (2) des images ou vidéos dans lesquelles des personnes pratiquent des activités sexuelles, ou (3) du matériel écrit ou audio décrivant des activités sexuelles.',
    consigne:'Repensez aux 6 derniers mois et choisissez, de 1 (jamais) à 7 (tout le temps), la réponse qui s’applique le plus à votre situation. Pendant les 6 derniers mois…',
    periodeLabel:'Période ou remarque (facultatif)', sens:-1, avis:AVIS_DEPISTAGE,
    echelle:{min:1, max:7, libelles:['Jamais', 'Rarement', 'Occasionnellement', 'Parfois', 'Souvent', 'Très souvent', 'Tout le temps']},
    items:numeroter([
      'J’ai ressenti que le porno était une partie importante de ma vie.',
      'J’ai utilisé le porno pour me sentir mieux.',
      'J’ai senti que le porno causait des problèmes dans ma vie sexuelle.',
      'J’ai senti que je devais regarder de plus en plus de porno pour être satisfait(e).',
      'J’ai essayé en vain de réduire la quantité de porno que je regarde.',
      'J’ai été stressé(e) lorsque quelque chose m’a empêché(e) de regarder du porno.',
      'J’ai pensé à quel point ce serait agréable de regarder du porno.',
      'Regarder du porno m’a débarrassé(e) de mes sentiments négatifs.',
      'Regarder du porno m’a empêché(e) de faire ressortir le meilleur de moi-même.',
      'J’ai senti que j’avais besoin de plus en plus de porno afin de satisfaire mes besoins.',
      'Quand j’ai juré de ne plus regarder du porno, je ne pouvais le faire que pendant une courte période.',
      'J’étais agité(e) quand je ne pouvais pas regarder du porno.',
      'J’ai planifié continuellement quand regarder du porno.',
      'J’ai relâché ma tension en regardant du porno.',
      'J’ai négligé les autres activités de loisirs pour regarder du porno.',
      'Graduellement, j’ai regardé plus de porno « extrême » parce que le porno que je regardais avant était moins satisfaisant.',
      'J’ai résisté à regarder du porno pour un court moment seulement avant de rechuter.',
      'Le porno m’a beaucoup manqué quand je n’en regardais pas pendant un moment.']),
    dimensions:[
      {k:'saillance', n:'Saillance (obsession)', c:'Saillance', items:['1', '7', '13'], aide:'La pornographie occupe une place centrale dans vos pensées et votre planification.'},
      {k:'humeur', n:'Modification de l’humeur (échappatoire)', c:'Humeur', items:['2', '8', '14'], aide:'La pornographie sert de refuge pour anesthésier le stress, la tristesse ou l’ennui.'},
      {k:'conflits', n:'Conflits (impacts)', c:'Conflits', items:['3', '9', '15'], aide:'La consommation perturbe votre vie relationnelle, sexuelle, vos loisirs ou votre potentiel personnel.'},
      {k:'tolerance', n:'Tolérance (escalade)', c:'Tolérance', items:['4', '10', '16'], aide:'Besoin de consommer davantage ou de chercher du contenu plus extrême pour ressentir le même effet.'},
      {k:'rechute', n:'Rechute (incapacité à stopper)', c:'Rechute', items:['5', '11', '17'], aide:'Tentatives répétées et infructueuses pour réduire ou arrêter la consommation.'},
      {k:'sevrage', n:'Sevrage (détresse d’inaccessibilité)', c:'Sevrage', items:['6', '12', '18'], aide:'Agitation, stress ou irritabilité lorsque la consommation est impossible.'},
    ],
    paliers:[
      {max:76, n:'Consommation sous contrôle', c:'vert', d:'Consommation sous contrôle ou occasionnelle : faible impact clinique direct.'},
      {max:126, n:'Usage problématique', c:'rouge', d:'Seuil critique dépassé (score supérieur à 76) : indicateur scientifique d’un usage problématique de la pornographie. Ce score signale une perte de liberté et justifie un travail d’accompagnement spécifique.'},
    ],
  },
  sast:{
    type:'echelle', mot:'question', nom:'Test SAST-FR — Sexual Addiction Screening Test', court:'SAST-FR', source:'Liberté pour Aimer',
    intro:'Sexual Addiction Screening Test : 25 questions d’auto-évaluation, à répondre par oui ou par non.',
    consigne:'Répondez par oui ou par non, le plus sincèrement possible, aux questions suivantes. Chaque « oui » compte un point.',
    periodeLabel:'Période ou remarque (facultatif)', sens:-1, avis:AVIS_DEPISTAGE,
    echelle:{min:0, max:1, libelles:['Non', 'Oui']},
    items:numeroter([
      'Avez-vous été victime d’abus sexuel pendant l’enfance ou l’adolescence ?',
      'Vous êtes-vous abonné ou avez-vous régulièrement acheté des magazines sexuellement explicites ?',
      'Vos parents avaient-ils des troubles des conduites sexuelles ?',
      'Êtes-vous souvent préoccupé par des pensées sexuelles ?',
      'Avez-vous le sentiment que votre comportement sexuel n’est pas normal ?',
      'Est-ce que votre conjoint(e) ou d’autres personnes importantes de votre vie se sont déjà inquiétées ou plaintes de votre comportement sexuel ?',
      'Avez-vous des difficultés à maîtriser votre comportement sexuel quand vous savez qu’il est inapproprié ?',
      'Vous sentez-vous mal à propos de votre comportement sexuel ?',
      'Votre comportement sexuel a-t-il déjà créé des problèmes pour vous ou votre famille ?',
      'Avez-vous déjà recherché de l’aide pour un comportement sexuel que vous n’aimiez pas ?',
      'Avez-vous déjà craint que des personnes ne découvrent vos activités sexuelles ?',
      'Est-ce que quelqu’un a été émotionnellement blessé par vos pratiques sexuelles ?',
      'Certaines de vos activités sont-elles hors-la-loi ?',
      'Vous êtes-vous déjà fait la promesse d’abandonner certains aspects de vos comportements sexuels ?',
      'Avez-vous fait des efforts pour abandonner un certain type d’activité sexuelle et échoué ?',
      'Devez-vous cacher une partie de votre comportement sexuel aux autres ?',
      'Avez-vous essayé d’arrêter certaines de vos activités sexuelles ?',
      'Vous êtes-vous déjà senti dégradé par votre comportement sexuel ?',
      'Le sexe a-t-il été un moyen pour vous d’échapper à vos problèmes ?',
      'Quand vous avez un rapport sexuel, vous sentez-vous déprimé après ?',
      'Avez-vous ressenti le besoin d’interrompre une certaine forme d’activité sexuelle ?',
      'Votre activité sexuelle a-t-elle interféré avec votre vie familiale ?',
      'Avez-vous déjà eu des relations sexuelles avec des mineurs ?',
      'Vous sentez-vous contrôlé par votre désir sexuel ?',
      'Pensez-vous que votre désir sexuel est plus fort que vous ?']),
    paliers:[
      {max:12, n:'Sous le seuil', c:'vert', d:'Score inférieur à 13, le seuil de ce test.'},
      {max:25, n:'Addiction sexuelle suggérée', c:'rouge', d:'Un score de 13 ou plus suggère la présence d’une addiction sexuelle et justifie un accompagnement spécialisé.'},
    ],
  },
  siat:{
    type:'echelle', mot:'question', nom:'Test S-IAT-Sexe — activités sexuelles en ligne', court:'S-IAT-Sexe', source:'Liberté pour Aimer ; Wéry et al., 2016',
    intro:'Short Internet Addiction Test, version « activités sexuelles en ligne » : 12 questions, notées de 1 (jamais) à 5 (toujours).',
    consigne:'Indiquez la fréquence à laquelle chaque situation se produit, de 1 (jamais) à 5 (toujours), en choisissant une seule réponse par question.',
    periodeLabel:'Période ou remarque (facultatif)', sens:-1, avis:AVIS_DEPISTAGE,
    echelle:{min:1, max:5, libelles:['Jamais', 'Rarement', 'Occasionnellement', 'Souvent', 'Toujours']},
    items:numeroter([
      'Vous arrive-t-il de rester sur des sites sexuels en ligne plus longtemps que vous en aviez l’intention au départ ?',
      'Vous arrive-t-il de négliger vos tâches quotidiennes afin de passer plus de temps sur des sites sexuels en ligne ?',
      'Arrive-t-il que vos notes/devoirs scolaires et/ou votre travail souffre(nt) du temps que vous passez sur des sites sexuels en ligne ?',
      'Vous arrive-t-il d’être sur la défensive ou de refuser de répondre si quelqu’un vous demande ce que vous faites sur des sites sexuels en ligne ?',
      'Vous arrive-t-il de répondre sur un ton brusque, de crier ou de vous montrer agacé(e) si quelqu’un vous dérange pendant que vous êtes sur des sites sexuels en ligne ?',
      'Vous arrive-t-il de manquer de sommeil parce que vous êtes resté(e) tard sur des sites sexuels en ligne ?',
      'Lorsque vous n’êtes pas sur des sites sexuels en ligne, vous arrive-t-il d’y penser activement ou de rêver d’y être ?',
      'Vous arrive-t-il de vous dire « juste encore quelques minutes » lorsque vous êtes sur des sites sexuels en ligne ?',
      'Vous arrive-t-il d’essayer de diminuer le temps que vous passez sur des sites sexuels en ligne sans y arriver ?',
      'Vous arrive-t-il de cacher aux autres le temps que vous passez en ligne sur des sites sexuels ?',
      'Vous arrive-t-il de choisir de passer plus de temps sur des sites sexuels en ligne plutôt que de sortir avec vos proches ?',
      'Vous arrive-t-il de vous sentir déprimé(e), de mauvaise humeur, ou énervé(e) lorsque vous n’êtes pas sur des sites sexuels en ligne, puis de vous sentir mieux lorsque vous y êtes ?']),
    dimensions:[
      {k:'controle', n:'Perte de contrôle & temps dédié', c:'Contrôle', items:['1', '2', '3', '6', '8', '9'], seuil:14, aide:'Votre défi principal est la gestion du temps, de l’impulsivité et la capacité à stopper l’activité.'},
      {k:'craving', n:'Craving & problèmes sociaux/émotionnels', c:'Craving', items:['4', '5', '7', '10', '11', '12'], seuil:12, aide:'L’activité sexuelle en ligne sert de régulateur émotionnel (échappatoire au stress ou à la tristesse) et altère vos relations ou votre humeur.'},
    ],
    paliers:[
      {max:24, n:'Usage modéré / faible risque', c:'vert', d:'Comportement sous contrôle, peu d’impacts négatifs sur le quotidien.'},
      {max:35, n:'Usage problématique / vigilance', c:'jaune', d:'Premiers signes de dépendance, temps excessif ou début de souffrance relationnelle ou professionnelle.'},
      {max:60, n:'Risque élevé d’addiction', c:'rouge', d:'Perte de contrôle sévère : cela correspond aux 10 % des scores les plus élevés. Une prise en charge thérapeutique est fortement recommandée.'},
    ],
  },
};
let admQ = 'hygiene';       // questionnaire ouvert
let bilanOuvert = null;     // bilan en cours de saisie (id)
let bilanNeuf = false, bilanSnap = '';   // ce bilan vient-il d'être créé ? son état à l'ouverture (pour « Annuler »)
const cmp = {a:null, b:null, jours:30};   // comparaison : les deux bilans, et la fenêtre du journal (jours avant chaque bilan)

const qDe = b => QUESTIONNAIRES[b.q];
const valOK = (q, v) => Number.isInteger(v) && v >= q.echelle.min && v <= q.echelle.max;
const estNA = (q, b, k) => b.notes[k] === 'na' && !!q.na?.includes(k);
const bilansDe = q => data.bilans.filter(b => b.q === q).sort((x, y) => x.date.localeCompare(y.date) || (x.cree || '').localeCompare(y.cree || ''));
const bilanPar = id => data.bilans.find(b => b.id === id);
const bilanVide = b => !Object.keys(b.notes).length && !b.periode.trim() && !Object.values(b.constats).some(t => t.trim()) && !b.priorites.some(p => p.dom || p.action.trim());
/* Un bilan que l'on a ouvert sans rien remplir ne reste pas dans la liste */
function purgerBilansVides() {
  const n = data.bilans.length;
  data.bilans = data.bilans.filter(b => !bilanVide(b) || (admPage === 'bilan' && b.id === bilanOuvert));
  if (data.bilans.length !== n) save();
}
const totalMax = q => q.items.length * q.echelle.max;
/* eq : le total ramené sur le maximum complet du questionnaire quand des questions sont « N/A » (sinon, le total lui-même) :
   c'est lui qui se lit sur les paliers, et qui se compare d'un bilan à l'autre */
function scoreBilan(b) {
  const q = qDe(b), its = q.items.filter(it => !estNA(q, b, it.k)), vals = its.map(it => b.notes[it.k]).filter(v => valOK(q, v));
  const total = vals.reduce((a, v) => a + v, 0), max = its.length * q.echelle.max;
  return {total, n:vals.length, nb:its.length, max, complet:vals.length === its.length, na:q.items.length - its.length, eq:max ? Math.round(total * totalMax(q) / max) : 0};
}
/* Le sous-score d'une dimension (pour la fiche hygiène de vie : un domaine, soit une seule question) */
function scoreAxe(q, b, a) {
  const its = a.items.filter(k => !estNA(q, b, k)), v = its.map(k => b.notes[k]).filter(x => valOK(q, x));
  return {total:v.reduce((s, x) => s + x, 0), n:v.length, nb:its.length, max:its.length * q.echelle.max, complet:v.length === its.length, na:!its.length};
}
/* Le sous-score ramené entre 0 et 1 (null tant qu'il manque des réponses) */
function normAxe(q, b, a) {
  const s = scoreAxe(q, b, a); if (s.na || !s.complet) return null;
  const min = a.items.length * q.echelle.min;
  return (s.total - min) / (s.max - min);
}
const palierDe = (q, total) => q.paliers.find(p => total <= p.max) || q.paliers[q.paliers.length - 1];
const nomDom = (q, k) => q.items.find(d => d.k === k)?.n || '';
const courtDate = d => `${d.slice(8)}/${d.slice(5, 7)}`;
const fmtDelta = d => d == null ? '' : d === 0 ? '=' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
/* Vert quand cela va mieux : plus haut est mieux (sens 1) ou plus bas est mieux (sens -1) */
const clsDelta = (d, q) => !d ? '' : d * q.sens > 0 ? 'plus' : 'moins';
const deltaAxe = (q, A, B, a) => { const x = scoreAxe(q, A, a), y = scoreAxe(q, B, a); return x.complet && y.complet && !x.na && !y.na ? y.total - x.total : null; };
const chipPalier = (q, s) => (q = typeof q === 'string' ? QUESTIONNAIRES[q] : q, s.complet) ? (p => `<span class="palier ${p.c}">${p.n}</span>`)(palierDe(q, s.eq)) : `<span class="small muted">Score provisoire : ${s.n} ${q.mot}${s.n > 1 ? 's' : ''} sur ${s.nb}</span>`;
const classeP = (q, p) => { if (p == null) return ''; if (q.sens < 0) p = 1 - p; return p <= .4 ? 'bas' : p <= .7 ? 'moy' : 'haut'; };
const noteNA = (q, s) => `${s.na} ${q.mot}${s.na > 1 ? 's' : ''} non applicable${s.na > 1 ? 's' : ''} (N/A) : le niveau se lit sur le score ramené à ${totalMax(q)}${s.complet ? `, soit ${s.eq}` : ''}.`;
const legendePaliers = q => { let min = q.items.length * q.echelle.min; return q.paliers.map(p => { const t = `${min} à ${p.max} : ${p.n.toLowerCase()}`; min = p.max + 1; return t; }).join(' · '); };
const libReponse = (q, v) => !valOK(q, v) ? '–' : q.echelle.libelles ? q.echelle.libelles[v - q.echelle.min] : String(v);
/* Dans le menu de l'onglet Admin : le nombre de bilans et le dernier score */
function resumeQuestionnaire(k) {
  const L = bilansDe(k), d = L[L.length - 1];
  if (!d) return '';
  const s = scoreBilan(d);
  return `${L.length} bilan${L.length > 1 ? 's' : ''}${s.complet ? ` · ${s.total}/${s.max}` : ''}`;
}

/* ───────────── Graphiques (SVG en ligne, couleurs du thème) ───────────── */
/* La toile d'araignée : une branche par dimension, chacune ramenée entre 0 et 10 */
function radar(q, series) {
  if (typeof q === 'string') q = QUESTIONNAIRES[q];
  const D = q.dimensions, n = D.length, cx = 170, cy = 150, R = 88;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const pt = (i, v) => { const r = R * v / 10; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]; };
  const xy = p => p.map(x => x.toFixed(1)).join(',');
  const val = (s, a) => { const p = normAxe(q, s.b, a); return p == null ? null : p * 10; };
  const anneaux = [2.5, 5, 7.5, 10].map(v => `<polygon points="${D.map((_, i) => xy(pt(i, v))).join(' ')}" fill="none" stroke="var(--border)" stroke-width="1"/>`).join('');
  const axes = D.map((_, i) => { const [x, y] = pt(i, 10); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`; }).join('');
  const noms = D.map((d, i) => {
    const [x, y] = pt(i, 11.6), c = Math.cos(ang(i)), s = Math.sin(ang(i));
    return `<text x="${x.toFixed(1)}" y="${(y + (s > .3 ? 6 : s < -.3 ? 0 : 4)).toFixed(1)}" text-anchor="${c > .3 ? 'start' : c < -.3 ? 'end' : 'middle'}" font-size="11" fill="var(--muted)">${esc(d.c)}</text>`;
  }).join('');
  const formes = series.map(s => `<polygon points="${D.map((a, i) => xy(pt(i, val(s, a) ?? 0))).join(' ')}" fill="${s.plein ? 'var(--accent)' : 'none'}" fill-opacity=".16" stroke="${s.plein ? 'var(--accent)' : 'var(--muted)'}" stroke-width="2"${s.plein ? '' : ' stroke-dasharray="5 4"'} stroke-linejoin="round"/>`).join('');
  const points = series.filter(s => s.plein).map(s => D.map((a, i) => { const v = val(s, a); if (v == null) return ''; const [x, y] = pt(i, v); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--accent)"/>`; }).join('')).join('');
  const lib = series.map(s => `${s.nom} : ${D.map(a => { const t = scoreAxe(q, s.b, a); return `${a.c} ${t.complet ? `${t.total} sur ${t.max}` : 'incomplet'}`; }).join(', ')}`).join(' ; ');
  return `<svg viewBox="0 0 340 300" role="img" aria-label="Graphique en toile d’araignée. ${esc(lib)}" style="width:100%;height:auto;display:block">${anneaux}${axes}${formes}${points}${noms}</svg>`;
}
/* Le score total au fil des bilans complets, sur les paliers du questionnaire */
function courbe(q, liste) {
  if (typeof q === 'string') q = QUESTIONNAIRES[q];
  const L = liste.filter(b => scoreBilan(b).complet);
  if (L.length < 2) return '';
  const W = 340, H = 180, gx = 30, dx = 14, hy = 16, by = 28, M = totalMax(q);
  const t = b => parse(b.date).getTime(), t0 = t(L[0]), t1 = t(L[L.length - 1]);
  const X = b => t1 === t0 ? (gx + W - dx) / 2 : gx + (W - gx - dx) * (t(b) - t0) / (t1 - t0);
  const Y = v => hy + (H - hy - by) * (1 - v / M);
  let bas = 0;
  const bandes = q.paliers.map(p => { const r = `<rect x="${gx}" y="${Y(p.max).toFixed(1)}" width="${W - gx - dx}" height="${(Y(bas) - Y(p.max)).toFixed(1)}" fill="var(--${p.c})" fill-opacity=".14"/>`; bas = p.max; return r; }).join('');
  const pts = L.map(b => `${X(b).toFixed(1)},${Y(scoreBilan(b).eq).toFixed(1)}`).join(' ');
  const lib = L.map(b => `${fmtFR(b.date)} : ${scoreBilan(b).eq} sur ${M}`).join(' ; ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du score total. ${esc(lib)}" style="width:100%;height:auto;display:block">
    ${bandes}
    ${[0, ...q.paliers.map(p => p.max)].map(v => `<text x="${gx - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${v}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${L.map(b => `<circle cx="${X(b).toFixed(1)}" cy="${Y(scoreBilan(b).eq).toFixed(1)}" r="3.5" fill="var(--accent)"/><text x="${X(b).toFixed(1)}" y="${(Y(scoreBilan(b).eq) - 8).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">${scoreBilan(b).eq}</text>`).join('')}
    <text x="${X(L[0]).toFixed(1)}" y="${H - 8}" text-anchor="start" font-size="10" fill="var(--muted)">${courtDate(L[0].date)}/${L[0].date.slice(2, 4)}</text>
    <text x="${X(L[L.length - 1]).toFixed(1)}" y="${H - 8}" text-anchor="end" font-size="10" fill="var(--muted)">${courtDate(L[L.length - 1].date)}/${L[L.length - 1].date.slice(2, 4)}</text>
  </svg>`;
}
/* Les dimensions en lignes, les derniers bilans en colonnes : chaque case prend la couleur de son niveau */
function matrice(q, liste) {
  const L = liste.slice(-5), D = q.dimensions, dern = L[L.length - 1], av = L[L.length - 2];
  const cel = (b, a) => { const s = scoreAxe(q, b, a); return `<td class="cel ${classeP(q, normAxe(q, b, a))}">${s.na ? 'N/A' : s.n ? s.total : '–'}</td>`; };
  const dt = av ? scoreBilan(dern).eq - scoreBilan(av).eq : null;
  return `<div class="defile-x"><table class="matrice"><thead><tr><th></th>${L.map(b => `<th>${courtDate(b.date)}</th>`).join('')}${av ? '<th>Écart</th>' : ''}</tr></thead><tbody>
    ${D.map(a => { const e = av ? deltaAxe(q, av, dern, a) : null;
      return `<tr><th scope="row">${esc(a.c)}</th>${L.map(b => cel(b, a)).join('')}${av ? `<td class="delta ${clsDelta(e, q)}">${fmtDelta(e)}</td>` : ''}</tr>`; }).join('')}
    <tr class="total"><th scope="row">Total</th>${L.map(b => `<td>${scoreBilan(b).eq}</td>`).join('')}${av ? `<td class="delta ${clsDelta(dt, q)}">${fmtDelta(dt)}</td>` : ''}</tr>
  </tbody></table></div>`;
}
/* Les sous-scores sous forme de jauges, avec le seuil d'alerte de la dimension quand le questionnaire en donne un */
function barresDim(q, b) {
  return `<div class="dims">${q.dimensions.map(a => {
    const s = scoreAxe(q, b, a), over = a.seuil != null && s.complet && s.total > a.seuil;
    return `<div class="lim"><div class="lim-h"><span>${esc(a.n)}</span><b>${s.total} / ${s.max}</b></div>
      <div class="meter${over ? ' m-crit' : ''}" role="progressbar" aria-label="${esc(a.n)}" aria-valuemin="0" aria-valuemax="${s.max}" aria-valuenow="${s.total}"><i style="width:${(s.total / s.max * 100).toFixed(1)}%"></i></div>
      ${over ? `<div class="small"><b class="lim-alerte">⚠ Au-dessus du seuil (supérieur à ${a.seuil})</b> · ${esc(a.aide)}</div>` : !s.complet ? `<div class="small muted">${s.n} réponse${s.n > 1 ? 's' : ''} sur ${s.nb}</div>` : ''}</div>`;
  }).join('')}</div>`;
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
/* Un questionnaire : le dernier bilan, son évolution, les bilans passés */
function pageBilans() {
  purgerBilansVides();
  const q = QUESTIONNAIRES[admQ], L = bilansDe(admQ), dern = L[L.length - 1], prec = L[L.length - 2];
  const nouveau = `<button class="btn primary block" data-act="bilanNouveau"${lectureSeule() ? ' disabled' : ''}>${L.length ? 'Nouveau bilan' : 'Remplir un premier bilan'}</button>`;
  const source = `<p class="small muted" style="margin:6px 0 0">Source : ${esc(q.source)}.${q.avis ? ` ${esc(q.avis)}` : ''}</p>`;
  if (!dern) return `<section class="card"><p class="small muted" style="margin:0">${esc(q.intro)}</p>${source}${nouveau}</section>`;
  const s = scoreBilan(dern), sp = prec && scoreBilan(prec), ecart = s.complet && sp?.complet ? s.eq - sp.eq : null;
  const complets = L.filter(b => scoreBilan(b).complet), pal = s.complet ? palierDe(q, s.eq) : null;
  const radarOk = q.dimensions.length >= 3;
  return `<section class="card">
    <div class="eyebrow">Dernier bilan · ${esc(fmtLong(dern.date))}${dern.periode.trim() ? ` · ${esc(dern.periode.trim())}` : ''}</div>
    <div class="score-l"><div class="score-n"><b>${s.total}</b><span>/ ${s.max}</span></div><div>${chipPalier(admQ, s)}${ecart != null ? `<div class="small" style="margin-top:6px"><b class="delta ${clsDelta(ecart, q)}">${fmtDelta(ecart) || '='} point${Math.abs(ecart) > 1 ? 's' : ''}</b> <span class="muted">depuis le ${fmtFR(prec.date)}</span></div>` : ''}</div></div>
    ${pal?.d ? `<p class="small" style="margin:10px 0 0">${esc(pal.d)}</p>` : ''}
    ${s.na ? `<p class="small muted" style="margin:8px 0 0">${noteNA(q, s)}</p>` : ''}
    ${nouveau}
    ${L.length > 1 ? `<button class="btn block" data-act="bilanComparer">Comparer deux bilans</button>` : ''}
  </section>
  ${q.type === 'domaines' || radarOk ? `<section class="card">
    <h2>${q.type === 'domaines' ? 'Mes 10 domaines' : 'Mes dimensions'}</h2>
    ${radarOk ? radar(admQ, [{nom:fmtFR(dern.date), b:dern, plein:true}, ...(prec ? [{nom:fmtFR(prec.date), b:prec, plein:false}] : [])]) : ''}
    ${radarOk ? `<div class="legende"><span><i class="l-plein"></i>${fmtFR(dern.date)}</span>${prec ? `<span><i class="l-tirets"></i>${fmtFR(prec.date)}</span>` : ''}</div>` : ''}
    ${q.sens < 0 && radarOk ? '<p class="small muted" style="margin:6px 0 0;text-align:center">Chaque branche est ramenée sur 10 : plus la forme est grande, plus le score est élevé.</p>' : ''}
    ${q.type === 'echelle' ? barresDim(q, dern) : ''}
  </section>` : (q.dimensions ? `<section class="card"><h2>Mes dimensions</h2>${barresDim(q, dern)}</section>` : '')}
  ${complets.length > 1 ? `<section class="card"><h2>Évolution du score total</h2>${courbe(admQ, L)}<p class="small muted" style="margin:6px 0 0">Les bandes de couleur sont les paliers du questionnaire : ${esc(legendePaliers(q))}.</p></section>` : ''}
  ${L.length > 1 && q.dimensions ? `<section class="card"><h2>${q.type === 'domaines' ? 'Domaine par domaine' : 'Dimension par dimension'}</h2>${matrice(q, L)}<p class="small muted" style="margin:6px 0 0">Les ${Math.min(5, L.length)} derniers bilans ; « Écart » : le dernier par rapport à l’avant-dernier.</p></section>` : ''}
  ${journalEtBilans(L)}
  ${q.type === 'echelle' ? `<section class="card"><details><summary class="small"><b>Comprendre les résultats</b></summary>
    <p class="small muted" style="margin:8px 0 0">${esc(legendePaliers(q))}.</p>
    ${q.paliers.map(p => `<p class="small" style="margin:8px 0 0"><span class="palier ${p.c}">${esc(p.n)}</span> ${esc(p.d)}</p>`).join('')}
    ${(q.dimensions || []).map(a => `<p class="small" style="margin:8px 0 0"><b>${esc(a.n)}</b>${a.seuil != null ? ` (seuil : supérieur à ${a.seuil})` : ''} : ${esc(a.aide)}</p>`).join('')}
  </details></section>` : ''}
  <div class="gl">Mes bilans</div>
  <div class="grp">${[...L].reverse().map(b => { const sb = scoreBilan(b); return ligneMenu('questionnaire', fmtLong(b.date), {val:sb.complet ? `${sb.total}/${sb.max}` : 'incomplet', page:b.id, act:'bilanOuvrir'}); }).join('')}</div>
  ${source.replace('margin:6px 0 0', 'margin:8px 2px 0')}`;
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
/* v50 : pendant la saisie, aucun score. Une fois le questionnaire terminé, le score reste masqué : un appui long l'affiche (et le
   masque de nouveau). scoreVu repart à faux à chaque ouverture d'un bilan, et dès qu'une réponse est retirée. */
let scoreVu = false;
function corpsScore(b) {
  const q = qDe(b), s = scoreBilan(b), titre = q.type === 'domaines' ? 'Score global d’équilibre' : 'Résultat';
  if (!s.complet) {
    scoreVu = false;
    return `<h2>${titre}</h2><p class="small muted" style="margin:6px 0 0">Avancement : ${s.n} ${q.mot}${s.n > 1 ? 's' : ''} sur ${s.nb}. Le score ne s’affiche qu’une fois le questionnaire terminé, sur un appui long.</p>
      <div class="meter" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="${s.nb}" aria-valuenow="${s.n}"><i style="width:${(s.n / s.nb * 100).toFixed(0)}%"></i></div>`;
  }
  const p = palierDe(q, s.eq);
  return `<h2>${titre}</h2>
    <div class="score-masque" data-masque role="button" tabindex="0" aria-label="${scoreVu ? 'Score affiché. Maintenir appuyé pour le masquer.' : 'Questionnaire terminé, score masqué. Maintenir appuyé pour l’afficher.'}">
    ${scoreVu ? `<div class="score-l"><div class="score-n"><b>${s.total}</b><span>/ ${s.max}</span></div><div>${chipPalier(b.q, s)}</div></div>
      ${p.d ? `<p class="small" style="margin:8px 0 0">${esc(p.d)}</p>` : ''}
      ${s.na ? `<p class="small muted" style="margin:8px 0 0">${noteNA(q, s)}</p>` : ''}
      ${q.type === 'echelle' && q.dimensions ? barresDim(q, b) : ''}
      <p class="small muted" style="margin:8px 0 0">${esc(legendePaliers(q))}.</p>`
    : `<div class="score-l"><div class="score-n"><b>• • •</b></div><div><span class="palier neutre">Questionnaire terminé ✓</span></div></div>`}
    <p class="small muted" style="margin:10px 0 0">Maintenez appuyé pour ${scoreVu ? 'masquer' : 'afficher'} le score.</p></div>`;
}
let appuiScore = 0;
const finAppuiScore = () => { clearTimeout(appuiScore); appuiScore = 0; };
function basculerScore() {
  const b = bilanPar(bilanOuvert); if (!b || !scoreBilan(b).complet) return;
  scoreVu = !scoreVu; majScoreBilan(b);
  try { navigator.vibrate?.(15); } catch {}
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest?.('[data-masque]')) return;
  finAppuiScore(); appuiScore = setTimeout(() => { appuiScore = 0; basculerScore(); }, 500);
});
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, finAppuiScore, true));
addEventListener('scroll', finAppuiScore, true);
document.addEventListener('contextmenu', e => { if (e.target.closest?.('[data-masque]')) e.preventDefault(); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-masque]')) { e.preventDefault(); basculerScore(); } });   // sans écran tactile
/* Un domaine de la fiche hygiène de vie : repères, note sur 10, constat */
function carteDomaine(b, q, d, n, prec) {
  const peutNA = q.na?.includes(d.k), na = estNA(q, b, d.k);
  return `<section class="card${na ? ' est-na' : ''}" data-dom="${d.k}">
    <h2>${n + 1}. ${esc(d.n)}</h2>
    <p class="small muted" style="margin:3px 0 0">${esc(d.r)}</p>
    <div class="note-chips${peutNA ? ' avec-na' : ''}" role="group" aria-label="Note de « ${esc(d.n)} » sur 10" style="grid-template-columns:repeat(11,1fr)${peutNA ? ' 2.1fr' : ''}">${[...Array(11).keys()].map(v => `<button type="button" class="${b.notes[d.k] === v ? 'on' : ''}" data-act="bilanNote" data-d="${d.k}" data-v="${v}" aria-pressed="${b.notes[d.k] === v}">${v}</button>`).join('')}${peutNA ? `<button type="button" class="na-btn${na ? ' on' : ''}" data-act="bilanNA" data-d="${d.k}" aria-pressed="${na}" aria-label="Domaine non applicable (N/A)">N/A</button>` : ''}</div>
    <div class="small muted" style="text-align:right">${prec ? `Bilan précédent (${courtDate(prec.date)}) : ${valOK(q, prec.notes[d.k]) ? prec.notes[d.k] : estNA(q, prec, d.k) ? 'N/A' : '–'}` : ''}</div>
    <label class="label" for="c-${d.k}" style="margin-top:6px">Mon constat</label>
    <textarea id="c-${d.k}" data-bilan="constat:${d.k}" data-auto rows="2" autocapitalize="sentences" placeholder="Ce que je constate…">${esc(b.constats[d.k] || '')}</textarea>
  </section>`;
}
/* Une question à échelle : son texte, ses réponses, et la réponse choisie en toutes lettres */
function carteQuestion(b, q, it, n) {
  const v = b.notes[it.k], E = q.echelle, vals = [...Array(E.max - E.min + 1).keys()].map(i => i + E.min), bin = vals.length === 2;
  return `<section class="card q-item" data-dom="${it.k}">
    <div class="q-t"><span class="q-n">${n + 1}</span><span>${esc(it.n)}</span></div>
    <div class="note-chips${bin ? ' deux' : ''}" role="group" aria-label="Réponse à la question ${n + 1}" style="grid-template-columns:repeat(${vals.length},1fr)">${vals.map(x => `<button type="button" class="${v === x ? 'on' : ''}" data-act="bilanNote" data-d="${it.k}" data-v="${x}" aria-pressed="${v === x}">${bin ? E.libelles[x - E.min] : x}</button>`).join('')}</div>
    ${bin ? '' : `<div class="small muted" data-lib="${it.k}" style="text-align:right;min-height:1.35em">${valOK(q, v) ? esc(libReponse(q, v)) : ''}</div>`}
  </section>`;
}
function pageBilan() {
  const b = bilanPar(bilanOuvert);
  if (!b) return '<section class="card"><p class="empty">Ce bilan n’existe plus.</p></section>';
  const q = qDe(b), L = bilansDe(b.q), i = L.indexOf(b), prec = i > 0 ? L[i - 1] : null, dom = q.type === 'domaines';
  const ta = (id, attr, val, ph, rows = 2) => `<textarea id="${id}" data-bilan="${attr}" data-auto rows="${rows}" autocapitalize="sentences" placeholder="${ph}">${esc(val)}</textarea>`;
  return `<section class="card">
    <label class="label" for="bDate" style="margin-top:0">Date du bilan</label>
    <input type="date" id="bDate" data-bilan="date" value="${b.date}" max="${today()}">
    <div class="wd-hint" id="bJour">${weekday(b.date)}</div>
    <label class="label" for="bPeriode">${esc(q.periodeLabel)}</label>
    <input type="text" id="bPeriode" data-bilan="periode" value="${esc(b.periode)}" maxlength="80" autocapitalize="sentences" placeholder="Par exemple : novembre 2026, ou une remarque">
    <div class="small muted" id="bEtat" aria-live="polite" style="margin-top:8px;text-align:right">Brouillon conservé au fil de la saisie</div>
  </section>
  ${dom ? '' : `<section class="card"><h2>Consigne</h2><p class="small" style="margin:6px 0 0">${esc(q.consigne)}</p>
    ${q.definition ? `<p class="small muted" style="margin:8px 0 0">${esc(q.definition)}</p>` : ''}
    ${q.echelle.max - q.echelle.min > 1 ? `<p class="small muted" style="margin:8px 0 0">${q.echelle.libelles.map((l, n) => `${n + q.echelle.min} = ${esc(l)}`).join(' · ')}</p>` : ''}</section>`}
  <section class="card" id="bScore">${corpsScore(b)}</section>
  ${dom ? q.items.map((d, n) => carteDomaine(b, q, d, n, prec)).join('') : q.items.map((it, n) => carteQuestion(b, q, it, n)).join('')}
  ${dom ? `<section class="card"><h2>Mes 2 priorités concrètes pour faire monter mon score</h2>
    ${[0, 1].map(n => `<label class="label" for="pd${n}">${n + 1}. Domaine prioritaire</label>
    <select id="pd${n}" data-bilan="pd:${n}"><option value="">—</option>${q.items.filter(d => !estNA(q, b, d.k) || b.priorites[n].dom === d.k).map(d => `<option value="${d.k}"${b.priorites[n].dom === d.k ? ' selected' : ''}>${esc(d.n)}</option>`).join('')}</select>
    <label class="label" for="pa${n}">Action concrète cette semaine</label>
    ${ta('pa' + n, 'pa:' + n, b.priorites[n].action, 'Mon action…')}`).join('')}
  </section>` : ''}
  <div class="row bilan-fin"><button class="btn" data-act="bilanAnnuler">Annuler</button><button class="btn primary" data-act="bilanEnregistrer">Enregistrer</button></div>
  ${bilanNeuf ? '' : '<button class="btn danger block" data-act="bilanSuppr">Supprimer ce bilan</button>'}`;
}
/* Ce qui se saisit : le texte et la date, sans réafficher la page (le clavier reste ouvert) */
let bilanSave = 0;
function etatBilan() {
  const e = $('#bEtat'); if (e) e.textContent = '…';
  clearTimeout(bilanSave); bilanSave = setTimeout(() => saveNow().then(() => { const s = $('#bEtat'); if (s) s.textContent = 'Brouillon conservé ✓'; }), 500);
}
function majBilanChamp(t) {
  const b = bilanPar(bilanOuvert); if (!b || lectureSeule()) return;
  const [k, x] = t.dataset.bilan.split(':');
  if (k === 'date') { if (!t.value) return; b.date = t.value; $('#bJour').textContent = weekday(t.value); const h = $('#view .subhead h1'); if (h) h.textContent = titreBilan(); }
  else if (k === 'periode') b.periode = t.value;
  else if (k === 'constat') { b.constats[x] = t.value; ajusterHauteur(t); }
  else if (k === 'pd') b.priorites[+x].dom = t.value;
  else if (k === 'pa') { b.priorites[+x].action = t.value; ajusterHauteur(t); }
  etatBilan();
}
/* Une réponse changée : les boutons de la question, le libellé, le N/A, le score ; sans réafficher la page */
function majReponse(b, q, k) {
  document.querySelectorAll(`#view [data-dom="${k}"] .note-chips button`).forEach(x => { const on = b.notes[k] === +x.dataset.v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
  const na = estNA(q, b, k), carte = $(`#view [data-dom="${k}"]`), bt = carte?.querySelector('.na-btn');
  carte?.classList.toggle('est-na', na);
  if (bt) { bt.classList.toggle('on', na); bt.setAttribute('aria-pressed', na); }
  const lib = $(`#view [data-lib="${k}"]`); if (lib) lib.textContent = valOK(q, b.notes[k]) ? libReponse(q, b.notes[k]) : '';
  majScoreBilan(b); save(); etatBilan();
}
const majScoreBilan = b => { const c = $('#bScore'); if (c) c.innerHTML = corpsScore(b); };

/* La comparaison de deux bilans */
function choixBilan(id, L, valeur) {
  return `<select id="${id}" data-cmp="${id}">${L.map(b => `<option value="${b.id}"${b.id === valeur ? ' selected' : ''}>${fmtFR(b.date)}${scoreBilan(b).complet ? '' : ' (incomplet)'}</option>`).join('')}</select>`;
}
function pageCompare() {
  purgerBilansVides();
  const q = QUESTIONNAIRES[admQ], L = bilansDe(admQ);
  if (L.length < 2) return '<section class="card"><p class="empty">Il faut au moins deux bilans pour les comparer.</p></section>';
  if (!L.some(b => b.id === cmp.a)) cmp.a = L[L.length - 2].id;
  if (!L.some(b => b.id === cmp.b)) cmp.b = L[L.length - 1].id;
  const A = bilanPar(cmp.a), B = bilanPar(cmp.b), sA = scoreBilan(A), sB = scoreBilan(B), D = q.dimensions || [], dom = q.type === 'domaines';
  const ecart = sA.complet && sB.complet ? sB.eq - sA.eq : null;
  const ecarts = D.map(a => ({a, e:deltaAxe(q, A, B, a)})).filter(x => x.e != null);
  const mieux = ecarts.filter(x => x.e * q.sens > 0).sort((x, y) => y.e * q.sens - x.e * q.sens)[0], pire = ecarts.filter(x => x.e * q.sens < 0).sort((x, y) => x.e * q.sens - y.e * q.sens)[0];
  const jA = journalAvant(A.date, cmp.jours), jB = journalAvant(B.date, cmp.jours);
  const part = (n, r) => r.jours ? `${n} <small>${pct(n, r.jours)} %</small>` : '–';
  const pts = (n1, r1, n2, r2) => r1.jours && r2.jours ? pct(n2, r2.jours) - pct(n1, r1.jours) : null;
  const jr = (nom, kA, kB) => { const p = pts(kA, jA, kB, jB); return `<tr><th scope="row">${nom}</th><td>${part(kA, jA)}</td><td>${part(kB, jB)}</td><td class="delta">${p == null ? '' : p === 0 ? '=' : `${fmtDelta(p)} pts`}</td></tr>`; };
  const pastille = c => `<span class="pt ${c}" aria-hidden="true"></span>${esc(data.labels[c])}`;
  const priorites = bil => { const l = bil.priorites.filter(p => p.dom || p.action.trim()); return l.length ? l.map(p => {
    const a = D.find(x => x.k === p.dom), e = a ? deltaAxe(q, A, B, a) : null;
    return `<div class="prio-l"><b>${esc(nomDom(q, p.dom) || 'Domaine non choisi')}</b>${p.action.trim() ? ` — ${esc(p.action.trim())}` : ''}${bil === A && e != null ? `<div class="small">Entre les deux bilans : <b class="delta ${clsDelta(e, q)}">${fmtDelta(e) || '='}</b> <span class="muted">(${A.notes[p.dom]} → ${B.notes[p.dom]})</span></div>` : ''}</div>`; }).join('') : '<p class="small muted" style="margin:4px 0 0">Aucune priorité notée.</p>'; };
  const constats = dom ? q.items.filter(d => (A.constats[d.k] || '').trim() || (B.constats[d.k] || '').trim()) : [];
  // les réponses qui ont changé d'un bilan à l'autre (questionnaires à échelle)
  const diffs = dom ? [] : q.items.map((it, n) => ({it, n, a:A.notes[it.k], b:B.notes[it.k]})).filter(x => x.a !== x.b && (valOK(q, x.a) || valOK(q, x.b)));
  return `<section class="card">
    <div class="row cmp-choix"><div style="flex:1;min-width:0"><label class="label" for="cmpA" style="margin-top:0">Bilan de départ</label>${choixBilan('cmpA', L, cmp.a)}</div>
    <div style="flex:1;min-width:0"><label class="label" for="cmpB" style="margin-top:0">Bilan comparé</label>${choixBilan('cmpB', L, cmp.b)}</div></div>
    <div class="cmp-score"><div><div class="small muted">${fmtFR(A.date)}</div><b>${sA.eq}</b>${sA.complet ? '' : '<span class="small muted"> prov.</span>'}</div>
      <div class="cmp-fl"><b class="delta ${clsDelta(ecart, q)}">${ecart == null ? '→' : `${fmtDelta(ecart) || '='}`}</b></div>
      <div><div class="small muted">${fmtFR(B.date)}</div><b>${sB.eq}</b>${sB.complet ? '' : '<span class="small muted"> prov.</span>'}</div></div>
    <div style="text-align:center">${sA.complet ? chipPalier(admQ, sA) : ''} ${sB.complet ? '→ ' + chipPalier(admQ, sB) : ''}</div>
    ${A.id === B.id ? '<p class="small muted" style="margin:8px 0 0;text-align:center">Choisissez deux bilans différents.</p>' : ''}
  </section>
  ${D.length ? `<section class="card"><h2>${dom ? 'Les 10 domaines' : 'Les dimensions'}</h2>
    ${D.length >= 3 ? `${radar(admQ, [{nom:fmtFR(B.date), b:B, plein:true}, {nom:fmtFR(A.date), b:A, plein:false}])}
    <div class="legende"><span><i class="l-plein"></i>${fmtFR(B.date)}</span><span><i class="l-tirets"></i>${fmtFR(A.date)}</span></div>` : ''}
    ${mieux || pire ? `<p class="small" style="margin:10px 0 0">${mieux ? `Plus forte amélioration : <b>${esc(mieux.a.n)}</b> (<span class="delta plus">${fmtDelta(mieux.e)}</span>).` : ''} ${pire ? `Plus fort recul : <b>${esc(pire.a.n)}</b> (<span class="delta moins">${fmtDelta(pire.e)}</span>).` : ''}</p>` : ''}
    <div class="cmp-liste">${D.map(a => { const x = scoreAxe(q, A, a), y = scoreAxe(q, B, a), e = deltaAxe(q, A, B, a);
      const pc = (s, v) => s.n ? (s.total - a.items.length * q.echelle.min) / (s.max - a.items.length * q.echelle.min) * 100 : 0;
      return `<div class="cmp-l"><div class="cmp-h"><span>${esc(a.n)}</span><b class="delta ${clsDelta(e, q)}">${fmtDelta(e)}</b></div>
        <div class="cmp-b"><span>${courtDate(A.date)}</span><div class="meter" style="--m:var(--muted)"><i style="width:${pc(x).toFixed(0)}%"></i></div><b>${x.na ? 'N/A' : x.n ? x.total : '–'}</b></div>
        <div class="cmp-b"><span>${courtDate(B.date)}</span><div class="meter"><i style="width:${pc(y).toFixed(0)}%"></i></div><b>${y.na ? 'N/A' : y.n ? y.total : '–'}</b></div></div>`; }).join('')}</div>
  </section>` : ''}
  ${diffs.length ? `<section class="card"><h2>Réponse par réponse</h2><p class="small muted" style="margin:4px 0 0">Les ${diffs.length} réponse${diffs.length > 1 ? 's' : ''} qui ont changé.</p>
    ${diffs.map(({it, n, a, b}) => { const e = valOK(q, a) && valOK(q, b) ? b - a : null;
      return `<div class="prio-l"><b>${n + 1}.</b> ${esc(it.n)}<div class="small"><span class="muted">${esc(libReponse(q, a))}</span> → <b>${esc(libReponse(q, b))}</b> <b class="delta ${clsDelta(e, q)}">${fmtDelta(e)}</b></div></div>`; }).join('')}</section>` : ''}
  ${dom ? `<section class="card"><h2>Priorités</h2>
    <div class="eyebrow" style="margin-top:8px">Fixées le ${fmtFR(A.date)}</div>${priorites(A)}
    <div class="eyebrow" style="margin-top:12px">Fixées le ${fmtFR(B.date)}</div>${priorites(B)}
  </section>` : ''}
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
      <tr><th scope="row">Notes d’émotion</th><td>${jA.emotions}</td><td>${jB.emotions}</td><td class="delta">${jA.jours && jB.jours ? fmtDelta(jB.emotions - jA.emotions) : ''}</td></tr>
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
    data.bilans.push(b); save(); bilanOuvert = b.id; bilanNeuf = true; bilanSnap = ''; scoreVu = false; admAller('bilan');
  },
  // l'état à l'ouverture est gardé : « Annuler » y revient
  bilanOuvrir: t => { bilanOuvert = t.dataset.p; bilanNeuf = false; bilanSnap = JSON.stringify(bilanPar(bilanOuvert)); scoreVu = false; admAller('bilan'); },
  // Enregistrer (à droite) : le bilan est gardé, retour à la page du questionnaire
  bilanEnregistrer: async () => {
    const b = bilanPar(bilanOuvert); if (!b) return;
    if (lectureSeule()) return toast(MSG_LECTURE);
    clearTimeout(bilanSave); await saveNow();
    const incomplet = !scoreBilan(b).complet;
    bilanNeuf = false; admPage = 'bilans'; purgerBilansVides(); render();
    toast(incomplet ? 'Bilan enregistré (incomplet)' : 'Bilan enregistré');
  },
  // Annuler (à gauche), après confirmation : un nouveau bilan disparaît, un bilan déjà enregistré retrouve son état d'avant
  bilanAnnuler: async () => {
    const b = bilanPar(bilanOuvert); if (!b) return;
    const neuf = bilanNeuf || !bilanSnap;
    if (!await confirmerAction({titre:neuf ? 'Annuler ce bilan ?' : 'Annuler les modifications ?', non:'Continuer',
      texte:neuf ? 'Ce bilan et toutes ses réponses seront supprimés.' : `Les modifications faites depuis l’ouverture du bilan du ${fmtFR(b.date)} seront annulées.`, bouton:'Oui, annuler'})) return;
    clearTimeout(bilanSave);
    if (neuf) data.bilans = data.bilans.filter(x => x.id !== b.id); else data.bilans[data.bilans.indexOf(b)] = JSON.parse(bilanSnap);
    await saveNow();
    bilanNeuf = false; admPage = 'bilans'; render(true); window.scrollTo(0, admPos.bilans || 0);
    toast(neuf ? 'Bilan annulé' : 'Modifications annulées');
  },
  bilanComparer: () => admAller('compare'),
  // une réponse ; la même touchée une seconde fois la retire
  bilanNote: t => {
    const b = bilanPar(bilanOuvert); if (!b || lectureSeule()) return;
    const q = qDe(b), k = t.dataset.d, v = +t.dataset.v;
    if (b.notes[k] === v) delete b.notes[k]; else b.notes[k] = v;
    majReponse(b, q, k);
  },
  // v51 : « N/A » (domaine non applicable) ; la même touchée une seconde fois le retire
  bilanNA: t => {
    const b = bilanPar(bilanOuvert); if (!b || lectureSeule()) return;
    const q = qDe(b), k = t.dataset.d;
    if (!q.na?.includes(k)) return;
    if (b.notes[k] === 'na') delete b.notes[k]; else b.notes[k] = 'na';
    majReponse(b, q, k);
  },
  bilanSuppr: async () => {
    const b = bilanPar(bilanOuvert); if (!b) return;
    if (lectureSeule()) return toast(MSG_LECTURE);
    if (!await confirmerAction({titre:'Supprimer ce bilan ?', texte:`Le bilan du ${fmtFR(b.date)} sera supprimé, avec ses réponses. Pensez à faire une sauvegarde avant si vous voulez pouvoir le retrouver.`, bouton:'Supprimer'})) return;
    data.bilans = data.bilans.filter(x => x.id !== b.id); await saveNow();
    admPage = 'bilans'; render(true); window.scrollTo(0, admPos.bilans || 0); toast('Bilan supprimé');
  },
};
