// Motus — Importer des notes depuis un texte (.txt ou texte collé)
'use strict';

/* ───────────── Importer des notes depuis un texte (.txt ou texte collé) ─────────────
   Chaque note commence par une ligne qui donne sa date, souvent avec l'heure et le lieu :
   « Lundi 26 octobre 2026, 8h40 — Lyon », « 26/10/2026 18:15, au bureau », « 2026-10-31 16:00 (Annecy) »,
   « Mardi 27 octobre à 21h » (année déduite), « 1er novembre, 10h ». Une ligne qui ne contient qu'une heure (« 22h10 »,
   « 12h30 Lieu : restaurant ») ouvre une nouvelle note le même jour. Les lignes suivantes forment le texte de la note.
   Le lieu est une ville s'il figure dans la liste des communes, sinon un lieu (« bureau », « chez mes parents »). */
// début de ligne toléré : puces, titres, « Le », jour de la semaine en entier ou abrégé (« jeu. »)
const RE_DEBUT = '[\\s#*•>_-]*(?:le\\s+)?(?:(?:lun|mar|mer|jeu|ven|sam|dim)[a-zé]*\\.?,?\\s+)?(?:le\\s+)?';
const RE_MOIS = '(janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept?(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\\.?';
const MOIS_TXT = [['janv',0],['jan',0],['fev',1],['mars',2],['avr',3],['mai',4],['juin',5],['juil',6],['aou',7],['sep',8],['oct',9],['nov',10],['dec',11]];
const RE_HEURE = '(?:à|a|vers|@)?\\s*(\\d{1,2})\\s*[hH:]\\s*(\\d{2})?(?!\\d)';
const RE_DATES = [
  [new RegExp(`^${RE_DEBUT}(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})(?!\\d)`, 'i'), m => [+m[1], +m[2] - 1, +m[3]]],
  [new RegExp(`^${RE_DEBUT}(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4}|\\d{2})(?!\\d)`, 'i'), m => [m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]]],
  [new RegExp(`^${RE_DEBUT}(\\d{1,2})(?:er)?\\s+${RE_MOIS}(?:\\s+(\\d{4}))?(?![\\p{L}\\d])`, 'iu'), m => [m[3] ? +m[3] : null, MOIS_TXT.find(([p]) => sansAccent(m[2]).startsWith(p))[1], +m[1]]],
  // « 30/10 » sans année : seulement suivi d'une heure, d'un séparateur ou de rien (« 1/2 litre » reste du texte)
  [new RegExp(`^${RE_DEBUT}(\\d{1,2})[/.](\\d{1,2})(?=\\s*$|\\s*[,;:@–—-]|\\s+${RE_HEURE})`, 'i'), m => [null, +m[2] - 1, +m[1]]],
];
const heureTxt = (h, mn = '0') => +h < 24 && +mn < 60 ? `${pad(+h)}:${pad(+mn)}` : '';
/* Ce qui suit la date et l'heure : la ville, un lieu, ou déjà le texte de la note.
   « à Paris », « (Annecy) », « Lieu : bureau », « Paris, au café », « à Lyon : journée difficile », « à Paris Journée difficile » */
function lieuTxt(reste, estVille) {
  const brut = reste.replace(/^[\s,;:–—@-]+/, '').trim();
  let s = brut.replace(/^\((.+)\)$/, '$1').replace(/^lieu\s*:\s*/i, '').trim(), texte = '';
  if (!s) return {};
  const deux = s.match(/^([^:.!?]{1,60}?)\s*:\s+(.+)$/);   // le lieu, puis le texte après deux-points
  if (deux) { s = deux[1].trim(); texte = deux[2].trim(); }
  if (s.length > 60 || /[.!?…]$|[.!?]\s/.test(s)) return {texte:brut};   // une phrase : c'est déjà le texte de la note
  const parties = s.split(/\s*[,;–—]\s*|\s+-\s+/).map(p => p.replace(/^(?:à|a|@)\s+/i, '').trim()).filter(Boolean);
  let iv = parties.findIndex(estVille), ville = iv >= 0 ? parties[iv] : '';
  if (!ville && parties.length === 1 && /^(?:à|a|@)\s/i.test(s)) {   // « à Paris Journée difficile » : la ville, puis le texte
    const mots = parties[0].split(/\s+/);
    for (let n = Math.min(4, mots.length - 1); n >= 1 && !ville; n--) if (estVille(mots.slice(0, n).join(' '))) {
      ville = mots.slice(0, n).join(' '); texte = [mots.slice(n).join(' '), texte].filter(Boolean).join(' '); parties.length = 0;
    }
  }
  const lieu = parties.filter((_, i) => i !== iv).join(', ').replace(/^(?:au|aux|à la|à)\s+/i, '').replace(/^à l['’]\s*/i, '');
  return {ville, lieu, texte};
}
function lireNotesTexte(texte, estVille) {
  const notes = [], t = today();
  let n = null, annee = null, ignore = 0, sansHeure = 0;
  const finir = () => {
    if (!n) return;
    n.text = n.lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim(); delete n.lignes;
    if (n.text) { if (!n.time) { n.time = '12:00'; sansHeure++; } notes.push(n); }
    n = null;
  };
  for (const ligne of String(texte).replace(/\r\n?/g, '\n').split('\n')) {
    let m, ymj = null;
    for (const [re, f] of RE_DATES) if ((m = ligne.match(re))) { ymj = f(m); break; }
    if (ymj) {
      let [y, mo, j] = ymj;
      if (y == null) { y = annee ?? +t.slice(0, 4); if (ymd(new Date(y, mo, j)) > t) y--; }   // année absente : celle des notes précédentes
      const dt = new Date(y, mo, j);
      if (dt.getMonth() === mo && dt.getDate() === j) {
        finir(); annee = y;
        let reste = ligne.slice(m[0].length), time = '';
        const h = reste.match(new RegExp(`^[\\s,;:–—@-]*${RE_HEURE}`, 'i'));
        if (h && (time = heureTxt(h[1], h[2]))) reste = reste.slice(h[0].length);
        const l = lieuTxt(reste, estVille);
        n = {k:ymd(dt), time, ville:l.ville || '', lieu:l.lieu || '', lignes:l.texte ? [l.texte] : []};
        continue;
      }
    }
    // une heure seule (éventuellement suivie du lieu) : nouvelle note le même jour
    const h = n && ligne.match(new RegExp(`^[\\s•*-]*${RE_HEURE}(.*)$`, 'i'));
    if (h && heureTxt(h[1], h[2]) && /^\s*$|^\s*(?:[,;:–—(@-]|lieu\b|à\s|a\s|au\s|chez\s)/i.test(h[3])) {
      const l = lieuTxt(h[3], estVille);
      if (n.time || n.lignes.join('').trim()) { const k = n.k; finir(); n = {k, time:'', ville:'', lieu:'', lignes:[]}; }
      Object.assign(n, {time:heureTxt(h[1], h[2]), ville:l.ville || n.ville, lieu:l.lieu || n.lieu});
      if (l.texte) n.lignes.push(l.texte);
      continue;
    }
    if (n) n.lignes.push(ligne); else if (ligne.trim()) ignore++;
  }
  finir();
  return {notes, ignore, sansHeure};
}
async function analyserTexte(texte) {
  if (!String(texte).trim()) return toast('Le texte est vide.');
  let villes = null;
  try { const C = await loadCommunes(); villes = new Set(C.n.map(x => sansAccent(x))); } catch {}
  // sans la liste des communes (hors connexion) : un nom propre court passe pour une ville
  const estVille = v => villes ? villes.has(sansAccent(v)) : /^\p{Lu}[\p{L}'’ -]{1,40}$/u.test(v) && !/\s\p{Ll}/u.test(v);
  const r = lireNotesTexte(texte, estVille), D = $('#codeDlg');
  if (!r.notes.length) {
    D.innerHTML = `<form method="dialog" id="txForm">
      <div class="dlg-h"><h2>Aucune note reconnue</h2></div>
      <div class="dlg-b"><p class="small">Chaque note doit commencer par une ligne qui donne sa date, par exemple :<br>« Lundi 26 octobre 2026, 8h40 — Lyon »<br>« 26/10/2026 18:15 »</p></div>
      <div class="dlg-f"><button class="btn primary">OK</button></div>
    </form>`;
    $('#txForm').onsubmit = e => { e.preventDefault(); D.close(); };
    return D.showModal();
  }
  const deja = x => dayNotes(data.days[x.k]).some(o => o.time === x.time && o.text.trim() === x.text);
  const nouvelles = r.notes.filter(x => !deja(x)), doublons = r.notes.length - nouvelles.length, ks = r.notes.map(x => x.k).sort();
  const s = k => k > 1 ? 's' : '';
  D.innerHTML = `<form method="dialog" id="txForm">
    <div class="dlg-h"><h2>${r.notes.length} note${s(r.notes.length)} trouvée${s(r.notes.length)}</h2></div>
    <div class="dlg-b">
      <p class="small muted" style="margin-top:0">Du ${fmtFR(ks[0])} au ${fmtFR(lastOf(ks))}. Elles seront ajoutées à vos notes personnelles, à leur date et à leur heure.</p>
      ${r.notes.slice(0, 40).map(x => `<div class="occ"><div class="meta">${fmtLong(x.k)} · ${x.time}${x.ville || x.lieu ? ' · ' + esc([x.ville, x.lieu].filter(Boolean).join(', ')) : ''}${deja(x) ? ' · déjà présente' : ''}</div><div class="txt note-txt">${esc(x.text.length > 140 ? x.text.slice(0, 140) + '…' : x.text)}</div></div>`).join('')}
      ${r.notes.length > 40 ? `<p class="small muted">… et ${r.notes.length - 40} autre${s(r.notes.length - 40)}.</p>` : ''}
      ${r.sansHeure ? `<p class="small muted">${r.sansHeure} note${s(r.sansHeure)} sans heure : placée${s(r.sansHeure)} à 12:00.</p>` : ''}
      ${doublons ? `<p class="small muted">${doublons} note${s(doublons)} déjà dans votre journal : elle${s(doublons)} ne ser${doublons > 1 ? 'ont' : 'a'} pas ajoutée${s(doublons)} une seconde fois.</p>` : ''}
      ${r.ignore ? `<p class="small muted">Le texte placé avant la première date (${r.ignore} ligne${s(r.ignore)}) n’est pas importé.</p>` : ''}
    </div>
    <div class="dlg-f"><button type="button" class="btn" id="txNon">Annuler</button><button class="btn primary" ${nouvelles.length ? '' : 'disabled'}>Importer ${nouvelles.length} note${s(nouvelles.length)}</button></div>
  </form>`;
  $('#txNon').onclick = () => D.close();
  $('#txForm').onsubmit = async e => {
    e.preventDefault(); D.close();
    for (const x of nouvelles) (ensureDay(x.k).notes ||= []).push({id:uid(), time:x.time, ville:x.ville, lieu:x.lieu, text:x.text});
    await saveNow(); render(true);
    toast(`${nouvelles.length} note${s(nouvelles.length)} importée${s(nouvelles.length)}`);
  };
  D.showModal();
}
function pageImporter() {
  return `<section class="card">
    <p class="small muted" style="margin:0">Vous tenez déjà un journal ailleurs (Notes, un fichier texte) ? Importez-le : chaque note devient une note personnelle, à sa date et à son heure.</p>
    <p class="small muted" style="margin:8px 0 0">Chaque note doit commencer par une ligne qui donne sa date, et si possible l’heure et le lieu. La plupart des façons de l’écrire sont reconnues, par exemple :<br>« jeu. 29/10/2026 18:01 à Paris »<br>« Lundi 26 octobre 2026, 8h40 — Lyon »<br>« 30/10 à 9h15, au bureau »<br>Une ligne avec seulement une heure (« 22h10 ») ouvre une nouvelle note le même jour.</p>
    <button class="btn primary block" data-act="choisirTxt">Choisir un fichier .txt</button>
    <input type="file" id="txtFile" accept=".txt,text/plain" hidden>
    <label class="label" for="txtColle">Ou collez votre texte</label>
    <textarea id="txtColle" rows="6" placeholder="Collez ici le texte de vos notes…"></textarea>
    <button class="btn block" data-act="analyserCollage">Analyser le texte</button>
    <p class="small muted" style="margin:8px 0 0">Vous verrez les notes trouvées avant de les importer. Rien ne quitte votre téléphone.</p>
  </section>`;
}
function pageAPropos() {
  return `<section class="card">
    <h2>Motus</h2>
    <p class="small muted" style="margin:4px 0 0">Éclairer ce qui se passe en soi</p>
    <div class="stat" style="margin-top:8px"><span class="muted">Version</span><b>${APP_VERSION}</b></div>
    <div class="stat"><span class="muted">Répertoire des émotions</span><b>Liberté pour Aimer</b></div>
  </section>
  <section class="card">
    <h2>Pourquoi « Motus » ?</h2>
    <p class="small" style="margin:8px 0 0">En latin, <i>motus</i> veut dire « mouvement ». Les Romains parlaient de <i>motus animi</i>, les mouvements de l’âme, pour désigner les émotions. Le mot « émotion » vient de la même famille : <i>emovere</i>, mettre en mouvement.</p>
    <p class="small" style="margin:8px 0 0">En français, « motus ! » veut dire « gardez le secret ». Vos notes restent chiffrées sur votre téléphone, et vous seul(e) décidez de ce que vous partagez.</p>
    <p class="small" style="margin:8px 0 0">D’où sa devise : éclairer ce qui se passe en soi.</p>
  </section>
  <p class="small muted" style="text-align:center"><a href="confidentialite.html" target="_blank" rel="noopener" data-act="voirPolitique">Politique de confidentialité</a></p>`;
}


