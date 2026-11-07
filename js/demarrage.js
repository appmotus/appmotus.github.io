// Motus — Écouteurs généraux (saisie, fichiers, glisser-déposer), lien d'invitation, service worker, démarrage
'use strict';

document.addEventListener('input', e => {
  const t = e.target;
  if (!data) return;
  if (CHAMPS_CONN.includes(t.id)) { if (t.dataset.surligne) allonger(t); suggererConn(t); }
  if ((t.id === 'ePiste' || t.id === 'eBdet') && t.dataset.surligne) allonger(t);
  if (t.id === 'synth') {
    ensureDay(cur).synth = t.value; $('#saved').textContent = '…';
    clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow().then(() => { const s = $('#saved'); if (s) s.textContent = 'Enregistré ✓'; }), 500);
  } else if (t.id === 'connGQ') {   // Paramètres › Connecteurs : la liste se filtre, le clavier reste ouvert
    connQ = t.value;
    const q = sansAccent(connQ.trim()), k = cleConn(connQ);
    document.querySelectorAll('#connGestion .conn-ligne').forEach(l => l.hidden = !!q && !l.dataset.k.includes(k) && !l.dataset.t.includes(q));
  } else if (t.id === 'repQ') {
    repQ = t.value; $('#repListe').innerHTML = listeRepertoire();
  } else if (t.dataset.notesAdmin) {
    ajusterHauteur(t);
    const k = t.dataset.notesAdmin, etat = () => $(`[data-etat="${k}"]`);
    data.notesAdmin[k] = t.value; etat().textContent = '…';
    clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow().then(() => { const s = etat(); if (s) s.textContent = 'Enregistré ✓'; }), 500);
  } else if (t.id === 'invCode') {   // un lien d'invitation complet collé dans le champ s'ouvre aussitôt
    const v = t.value.trim();
    if (/#i=[0-9a-f]{30}$|#inv=[A-Za-z0-9_-]{40,}$/i.test(v) && v !== t.dataset.ouvert) { t.dataset.ouvert = v; offerInvite(v); }
  } else if (t.id === 'calQ') {   // seuls les résultats changent : le champ garde le clavier ouvert
    calQ = t.value;
    $('#listeMois').hidden = $('#filtreJ').hidden = !!calQ.trim();
    $('#resRech').innerHTML = calQ.trim() ? resultatsRecherche(calQ) : '';
    entetesJournal();
  }
  else if (t.id === 'eVille') ed.villeTouched = true;
  else if (t.id === 'xFrom' || t.id === 'xTo') $('#' + t.id + 'Wd').textContent = weekday(t.value);
  else if (t.id === 'cliSearch') {
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll('.clientrow').forEach(r => r.hidden = !!q && !r.dataset.name.includes(q));
  }
  else if (t.dataset.prof) { data.profile[t.dataset.prof] = t.value; save(); refreshInvite(); pushProfile(); planifierSynchro(); }
  else if (t.dataset.thera) { data.thera[t.dataset.thera] = t.value; save(); refreshInvite(); pushProfile(); planifierSynchro(); }
  else if (t.id === 'admSearch') {
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll('.urow').forEach(r => r.hidden = !!q && !r.dataset.name.includes(q));
  }
  else if (t.dataset.label) { data.labels[t.dataset.label] = t.value.trim() || DEF_LABELS[t.dataset.label]; save(); }
  else if (t.id === 'autolock') setAutolock(t);
});
document.addEventListener('change', e => {
  if (!data) return;
  if (e.target.id === 'txtFile') {
    const f = e.target.files[0]; busy = false;
    if (f) f.size > 3e6 ? toast('Fichier trop volumineux (3 Mo au plus).') : f.text().then(analyserTexte);
  }
  else if (e.target.id === 'geoloc') { data.settings.geoloc = e.target.checked; save(); }
  else if (e.target.dataset.partage && !e.target.closest('#ptForm')) {
    const choix = {...data.settings.partage, [e.target.dataset.partage]:e.target.checked};
    if (!partageValide(choix)) { e.target.checked = true; return toast('Gardez au moins les émotions, les synthèses ou les notes.'); }
    data.settings.partage = choix; data.settings.partageChoisi = true; save();
  }
});
$('#entryDlg').addEventListener('click', e => { if (e.target === e.currentTarget && !$('#nText')) e.currentTarget.close(); });   // une note en cours ne se perd pas d'un appui à côté

$('#restoreFile').addEventListener('change', async e => {
  const f = e.target.files[0]; busy = false; if (!f) return;
  let v;
  try { v = JSON.parse(await f.text()); if (v.app !== 'journal-emotions' || !v.ct || v.type) throw 0; }
  catch { return toast(v?.type === 'envoi' ? 'Ce fichier est un envoi pour un thérapeute, pas une sauvegarde.' : 'Ce fichier n’est pas une sauvegarde du journal.'); }
  const c = await askCode('Restaurer une sauvegarde', {label:'Mot de passe ou code de la sauvegarde', hint:'Entrez le mot de passe (ou le code, pour une sauvegarde faite avant les comptes) utilisé au moment de la sauvegarde.'});
  if (c == null) return;
  try {
    const r = await openVault(v, c);
    if (!confirm('Remplacer les notes actuelles par celles de la sauvegarde ?')) return;
    const account = data.account, role = data.role, indice = data.recupIndice, consentement = data.consentement;   // le compte, son type, son mail et l'accord donné restent ceux d'aujourd'hui
    data = defaults(r.obj); data.account = account; data.role = role; data.consentement = consentement;
    if (indice) data.recupIndice = indice;
    syncIndice();
    if (role === 'therapeute') await ensureKeys();
    await saveNow(); showApp(); toast('Sauvegarde restaurée');
  } catch { toast('Mot de passe incorrect pour cette sauvegarde.'); }
});
$('#importFile').addEventListener('change', e => { busy = false; const f = [...e.target.files]; if (f.length) importerFichiers(f, importTarget); });
/* Thérapeute sur ordinateur : fichiers glissés dans la zone « Fichiers reçus » */
document.addEventListener('dragover', e => { const z = e.target.closest?.('#depot'); if (z) { e.preventDefault(); z.classList.add('survol'); } });
document.addEventListener('dragleave', e => { e.target.closest?.('#depot')?.classList.remove('survol'); });
document.addEventListener('drop', e => {
  const z = e.target.closest?.('#depot'); if (!z) return;
  e.preventDefault(); z.classList.remove('survol');
  const f = [...e.dataTransfer.files]; if (f.length) importerFichiers(f, null);
});

/* Lien d'invitation ouvert directement : on le garde pour après le déverrouillage et on l'efface de l'adresse */
{
  const m = location.hash.match(/(?:inv|i)=([A-Za-z0-9_-]+)/);
  if (m) { pendingInv = m[1]; history.replaceState(null, '', location.pathname + location.search); }
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // Une nouvelle version vient de s'installer alors que l'app était déjà pilotée par une ancienne : on le propose.
  const dejaActif = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!dejaActif || $('.maj-banner')) return;
    const b = document.createElement('div');
    b.className = 'banner maj-banner'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Nouvelle version disponible. Vos notes sont conservées.</span><button class="btn primary" data-act="majApp">Mettre à jour</button>';
    document.body.appendChild(b);
  });
  navigator.serviceWorker.register('sw.js').then(r => swReg = r).catch(() => {});
}
boot();
