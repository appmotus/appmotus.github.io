// Motus — Actions des boutons (data-act), registre des pages des Paramètres, œil des mots de passe
'use strict';

/* ───────────── Actions ───────────── */
/* Pages des Paramètres. Ce registre nomme des pages définies dans plusieurs fichiers (vue-parametres, page-connecteurs, therapeute-canal) : il vient après eux. */
const PAGES_REGLAGES = {
  infos:['Informations personnelles', pageInfos], secu:['Mot de passe et verrouillage', pageSecu],
  thera:['Mon thérapeute', therapistCard], partage:['Partage et export', pagePartage], donnees:['Données transmises', pageDonnees], couleurs:['Code couleur', pageCouleurs], geo:['Localisation', pageGeo],
  invite:['Mon lien d’invitation', pageInvite], pro:['Mon profil professionnel', pagePro],
  sauvegarde:['Sauvegarde', pageSauvegarde], effacer:['Effacer mes données', pageEffacer], supprimer:['Supprimer mon compte', pageSupprimer],
  apparence:['Apparence', pageApparence], installer:['Installer sur l’écran d’accueil', pageInstaller], apropos:['À propos', pageAPropos], contact:['Nous contacter', pageContact], importer:['Importer des notes', pageImporter],
  connecteurs:['Connecteurs', pageConnecteurs],
};

let installEvt = null;
/* Le navigateur propose l'installation en un appui (Android) : la page affichée se met à jour */
function majPageInstall() { if (doitInstaller() && !$('#lock').hidden) { if (key) showTransfert(); else if (!recupNotes) showInstall(); } }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; majPageInstall(); });
window.addEventListener('appinstalled', () => toast('Motus est installé : ouvrez-le depuis son icône.'));

const ACT = {
  tab: t => {
    view = t.dataset.v; src = null; setPage = null; admPage = null;
    if (view === 'clients') synchroCanaux();
    if (view === 'day') cur = today();
    render();
    if (view === 'set' && (data.account?.recup === 'attente' || data.account?.recupChange)) ensureSecours();
  },
  /* lien client ↔ thérapeute */
  addTherapist: () => offerInvite($('#invCode').value),
  removeTherapist: async () => {
    const th = data.therapist, nom = nomDe(th) || 'ce thérapeute';
    if (!await confirmerCode({titre:`Retirer ${nom} ?`, bouton:'Retirer',
      texte:`Vous ne pourrez plus lui envoyer vos données, et il sera prévenu à sa prochaine ouverture de Motus. Vos notes restent sur votre téléphone, et les fichiers déjà envoyés restent chez lui. Pour le rajouter, il faudra de nouveau son invitation.`})) return;
    if (th.canal && !await rompreCanal(th.canal, 'client')) data.ruptureAEnvoyer = th.canal;
    retraitFait = nomDe(th) || 'Votre thérapeute';
    data.therapist = null; await saveNow(); render();
  },
  activerLien: async () => {
    const th = data.therapist;
    if (!await consentirLien(th, null)) return;
    th.canal = hexDe(crypto.getRandomValues(new Uint8Array(32))); delete th.arrivee; th.enAttente = true;
    await saveNow(); await synchroCanaux(true); render();
  },
  avisLu: () => { delete data.ruptureRecue; delete data.rupturesRecues; delete data.accepteRecue; save(); render(true); },
  accepterClient: t => {
    const c = data.clients[t.dataset.id]; if (!c) return;
    c.statut = 'actuel'; delete c.demande; delete c.ficheEnvoyee; c.nouveauClient = true;
    c.debutSuivi = today();   // fixée par l'acceptation, non modifiable
    save(); render(true); renderNav(); synchroCanaux(true);
    toast(`${fullName(c)} est maintenant votre client`);
  },
  refuserClient: async t => {
    const c = data.clients[t.dataset.id]; if (!c || !confirm(`Refuser la demande de ${fullName(c)} ?\n\nIl ou elle en sera prévenu(e) et ne pourra pas vous envoyer de données.`)) return;
    await rompreOuPlusTard(c.canal);
    finDemande(c); await saveNow(); render(true); renderNav();
  },
  effacerRecu: async () => {
    const c = src;
    if (!await confirmerCode({titre:`Effacer les données reçues de ${fullName(c)} ?`, bouton:'Effacer',
      texte:`Les journées et l’historique des envois reçus de ${esc(c.profile.prenom || 'ce client')} sont effacés de cet appareil. Sa fiche, vos notes et le suivi sont conservés : il ou elle pourra vous renvoyer ses données.`})) return;
    c.days = {}; c.envois = []; c.labels = {...DEF_LABELS}; delete c.nouveau;
    await saveNow(); render(); toast('Données reçues effacées');
  },
  finSuivi: async () => {
    const c = src;
    if (!await confirmerCode({titre:`Mettre fin au suivi de ${fullName(c)} ?`, bouton:'Mettre fin au suivi',
      texte:`${esc(c.profile.prenom || 'Votre client')} ne pourra plus vous envoyer de données, et en sera prévenu(e) à sa prochaine ouverture de Motus. Sa fiche et ses données reçues restent consultables dans « Anciens clients ».`})) return;
    await rompreOuPlusTard(c.canal);
    delete c.canal; c.statut = 'ancien'; c.rupture = {par:'therapeute', at:new Date().toISOString()};
    await saveNow(); render(); toast(`${fullName(c)} est maintenant dans « Anciens clients »`);
  },
  importerLot: () => { importTarget = null; busy = true; $('#importFile').value = ''; $('#importFile').click(); setTimeout(() => busy = false, 60000); },
  sendWeek: () => sendWeek(),
  partagerApp: async () => {
    const url = location.origin + location.pathname;
    const text = 'Je vous recommande Motus, une app pour noter vos émotions et vos notes personnelles au fil de la journée, et les partager si vous le souhaitez avec votre thérapeute. Tout reste chiffré sur votre téléphone.';
    busy = true;
    try {
      if (navigator.share) await navigator.share({title:'Motus', text, url});
      else { await navigator.clipboard.writeText(url); toast('Lien de Motus copié'); }
    } catch (err) {
      if (err.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); toast('Lien de Motus copié'); } catch { window.prompt('Copiez ce lien :', url); } }
    } finally { setTimeout(() => busy = false, 1500); }
  },
  mailXlsx: () => {
    const x = exportRange(); if (!x) return;
    envoyerParMail({file:new File([buildXlsx(x.from, x.to)], x.name, {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), from:x.from, to:x.to, chiffre:false});
  },
  goSend: () => { xStart = addDays(today(), -6); view = 'set'; setPage = 'partage'; render(); },
  voirThera: () => { view = 'set'; setPage = 'thera'; render(); synchroCanaux(true); },
  // Journal en liste : la barre compacte déploie (ou replie) la recherche et les filtres, sans quitter la lecture
  deployerEntete: () => {
    if (entJ.deploye) return replierEntete();
    entJ.deploye = true; entJ.cache = 0;
    const p = $('#view .barreJ-plus'); if (p) p.hidden = false;
    $('#view [data-act=deployerEntete]')?.setAttribute('aria-expanded', 'true');
    entetesJournal();
  },
  // la recherche porte sur tous les mois : elle s'ouvre en haut de page, à la place de la liste
  chercherJ: () => { replierEntete(); window.scrollTo(0, 0); $('#calQ')?.focus(); },
  choisirTxt: () => { busy = true; $('#txtFile').value = ''; $('#txtFile').click(); setTimeout(() => busy = false, 60000); },   // le temps de choisir le fichier, l'app ne se verrouille pas
  analyserCollage: () => analyserTexte($('#txtColle').value),
  envoyerContact: () => {
    const msg = $('#ctMsg').value.trim();
    if (!msg) return toast('Écrivez votre message.');
    const a = data.account || {};
    location.href = lienMail(CONTACT_MAIL, {objet:`Motus — ${$('#ctSujet').value}`, corps:`${msg}\n\n—\n${ROLE_N[data.role]} ${a.numero || ''} · Motus version ${APP_VERSION}`});
  },
  admNotes: () => { admScroll = scrollY; admPage = 'notes'; render(); },
  admRetour: () => { admPage = null; render(true); window.scrollTo(0, admScroll); },
  // le mot de passe confirme la modification ; un nouvel identifiant est en plus vérifié et enregistré par le serveur
  modifierIdentite: async () => {
    const a = data.account;
    const v = await formIdentite(); if (!v) return;
    const ancien = a.identifiant, nouveau = v.identifiant !== ancien ? v.identifiant : '';
    if (nouveau && !session) return toast('Une connexion internet est nécessaire pour changer d’identifiant.');
    const pw = await askCode('Confirmer la modification', {label:'Mot de passe', hint:'Entrez votre mot de passe pour confirmer.'});
    if (pw == null) return;
    try { await saveNow(); await openVault(JSON.parse(localStorage.getItem(VKEY)), pw); }
    catch { return toast('Mot de passe incorrect : rien n’a été modifié.'); }
    if (nouveau) {
      try { await API.recup({action:'identite_mdp', mot_de_passe:pw, identifiant:nouveau}); }
      catch (x) { return toast(EFFACER_ERR[x.code] ? EFFACER_ERR[x.code].replace(' : annulez et', ' :') : x.code === 'mot_de_passe' ? 'Mot de passe incorrect : rien n’a été modifié.' : 'Modification impossible pour le moment.'); }
    }
    Object.assign(data.profile, {prenom:v.prenom, nom:v.nom});
    if (nouveau) await renommerStockage(ancien, nouveau);
    await saveNow(); pushProfile(); planifierSynchro(); render(true);
    toast(nouveau ? `C’est fait : connectez-vous désormais avec « ${nouveau} ».` : 'Vos informations sont modifiées');
  },
  // le retour au menu reprend la position où l'on était avant d'ouvrir la page
  // une page ouverte depuis une autre (Données transmises depuis Partage et export) y ramène au retour
  setPage: t => { if (!setPage) menuScroll = scrollY; else pagePrec = {de:setPage, vers:t.dataset.p, y:scrollY}; setPage = t.dataset.p; if (setPage === 'connecteurs') connAide = false; render(); if (setPage === 'thera') synchroCanaux(true); },
  setBack: () => {
    const prec = pageRetour(); pagePrec = null;
    if (prec) { setPage = prec.de; render(true); return window.scrollTo(0, prec.y); }
    setPage = null; render(true); window.scrollTo(0, menuScroll); menuScroll = 0;
  },
  setTheme: t => { try { localStorage.setItem(THEME_KEY, t.dataset.t); } catch {} appliquerTheme(); render(true); },
  toggleTheme: () => { try { localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme === 'dark' ? 'clair' : 'sombre'); } catch {} appliquerTheme(); render(true); },
  deleteAccount: () => supprimerCompte(),
  shareInvite: () => shareInvite(),
  copyInvite: async () => {
    try { await navigator.clipboard.writeText(inviteLink()); toast('Lien copié'); }
    catch { const f = $('#invField'); if (f) { f.focus(); f.select(); } toast('Sélectionnez le lien pour le copier'); }
  },
  importEnvoi: () => { importTarget = src.id; busy = true; $('#importFile').value = ''; $('#importFile').click(); setTimeout(() => busy = false, 60000); },
  openClient: t => openClient(t.dataset.id),
  newClient: () => openClientForm(null),
  editClient: () => openClientForm(src.id),
  saveClient: t => {
    const prenom = $('#cfPrenom').value.trim(), nom = $('#cfNom').value.trim(), numero = codeU($('#cfNumero').value.trim());
    if (!prenom && !nom) return $('#cfErr').textContent = 'Indiquez au moins un prénom ou un nom.';
    if (numero && !/^[UC]-\d{4,}$/.test(numero)) return $('#cfErr').textContent = 'Code utilisateur au format U-0012.';
    if (numero && Object.values(data.clients).some(x => x.id !== t.dataset.id && memeCode(x.numero, numero))) return $('#cfErr').textContent = 'Ce code est déjà celui d’un autre client.';
    let c = data.clients[t.dataset.id];
    if (!c) { const id = 'c' + rid(6); c = data.clients[id] = {id, uid:null, profile:{nom:'', prenom:'', start:''}, contact:{}, note:'', labels:{...DEF_LABELS}, days:{}, envois:[]}; }
    Object.assign(c.profile, {prenom, nom});
    if (!c.canal) { if (numero) c.numero = numero; else delete c.numero; }
    c.contact = {tel:$('#cfTel').value.trim(), email:$('#cfEmail').value.trim()};
    c.note = $('#cfNote').value.trim();
    save(); $('#clientDlg').close(); openClient(c.id);
  },
  backClients: () => { src = null; view = 'clients'; render(); },
  clientCal: () => { view = 'cal'; render(); },
  exportClient: () => {
    const ks = Object.keys(src.days).sort(); if (!ks.length) return toast('Aucune donnée à exporter.');
    const from = src.envois[0]?.from || ks[0], to = lastOf(src.envois)?.to || lastOf(ks);
    const who = `${src.profile.prenom}-${src.profile.nom}`.replace(/[^\p{L}\p{N}-]+/gu, '');
    withBusy(() => download(buildXlsx(from, to), `Motus_${who}_${from}_${to}.xlsx`));
  },
  removeClient: async () => {
    const c = src, lie = c.canal && c.statut !== 'ancien';
    if (!confirm(`Supprimer la fiche de ${fullName(c)} et toutes les données reçues ?${lie ? `\n\n${c.statut === 'attente' ? 'Sa demande sera refusée' : 'Le suivi prendra fin'} : ${c.profile.prenom || 'votre client'} en sera prévenu(e) et ne pourra plus vous envoyer de données.` : ''}`)) return;
    if (lie) await rompreOuPlusTard(c.canal);
    delete data.clients[c.id]; src = null; view = 'clients'; await saveNow(); render(); renderNav();
    toast(`Fiche de ${fullName(c)} supprimée`);
  },
  prevDay: () => { cur = addDays(cur, -1); render(); },
  nextDay: () => { if (cur < today()) { cur = addDays(cur, 1); render(); } },
  goToday: () => { cur = today(); render(); },
  openDay: t => { cur = t.dataset.k; view = 'day'; render(); },
  calFilter: t => { calF = t.dataset.f || null; calW = null; listeAPlacer = true; render(); },
  calWord: t => { calW = t.dataset.w || null; listeAPlacer = true; render(); },
  choisirConn: () => ouvrirConnecteurs(),
  // Mes notes (administrateur) : copie tout le texte d'une catégorie
  copierNoteAdmin: async t => {
    const txt = data.notesAdmin[t.dataset.k] || '';
    if (!txt.trim()) return toast('Rien à copier : la note est vide.');
    try { await navigator.clipboard.writeText(txt); }
    catch {   // sans accès au presse-papiers : la sélection du champ, copiée à l'ancienne
      const ta = $(`[data-notes-admin="${t.dataset.k}"]`); ta.focus(); ta.select(); document.execCommand('copy'); ta.setSelectionRange(0, 0); ta.blur();
    }
    toast('Texte copié');
  },
  voirConnecteurs: t => { t.closest('dialog')?.close(); if (!setPage) menuScroll = 0; view = 'set'; setPage = 'connecteurs'; connQ = ''; connAide = false; render(); window.scrollTo(0, 0); },
  plierAide: t => plierAide(t),
  renommerConn: t => ouvrirRenommer(t.dataset.k),
  // toucher un connecteur dans une note : une bulle propose de voir toutes les notes qui le contiennent (Journal, en liste)
  voirConn: t => bulleConn(t),
  // depuis Quotidien, la liste s'ouvre sur le mois du jour affiché
  connecteur: t => {
    fermerBulle();
    const deQuotidien = view === 'day';
    if (deQuotidien) { const d = parse(cur); calY = d.getFullYear(); calM = d.getMonth(); }
    calC = [t.dataset.c]; calF = calW = null; calQ = ''; view = 'cal'; calMode = 'list'; listeAPlacer = true; render(!deQuotidien);
  },
  calMode: t => { calMode = t.dataset.m; listeAPlacer = true; render(); },
  repMode: t => { repMode = t.dataset.m; render(!t.closest('#barreR')); },   // depuis la barre compacte : le nouveau répertoire depuis son début
  // une semaine de la liste devient la période à envoyer ; la semaine en cours va du lundi à aujourd'hui
  choisirSemaine: t => {
    const lun = t.dataset.k, fin = addDays(lun, 6) > today() ? today() : addDays(lun, 6), d = $('#xCustom');
    if (fin === addDays(lun, 6)) { xStart = lun; d.open = false; setWeek(0); }
    else { d.open = true; $('#xFrom').value = lun; $('#xTo').value = fin; $('#xFromWd').textContent = weekday(lun); $('#xToWd').textContent = weekday(fin); }
    window.scrollTo({top:0, behavior:'smooth'});
    toast(`Période choisie : du ${fmtFR(lun).slice(0, 5)} au ${fmtFR(fin).slice(0, 5)}`);
  },
  xPrevWeek: () => setWeek(-1),
  xNextWeek: () => setWeek(1),
  // changer de mois garde la page au même niveau : la grille fait toujours six semaines
  // en liste, la page va au mois voulu (listeAPlacer) ; en calendrier, elle reste au même niveau
  prevMonth: () => changerMois(-1),
  nextMonth: () => changerMois(1),
  choisirMois: () => choisirMois(),
  moisEnCours: () => { const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); listeAPlacer = true; render(true); },
  setColor: t => {
    const d = ensureDay(cur), c = t.dataset.c;
    d.color = d.color === c ? null : c;
    document.querySelectorAll('.colbtn').forEach(b => { const on = b.dataset.c === d.color; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const w = $(`#view .week .w[data-k="${cur}"]`);   // la frise de la semaine prend aussitôt la nouvelle couleur
    if (w) { w.classList.remove(...COL); if (d.color) w.classList.add(d.color); }
    save();
  },
  choisirJour: () => choisirMois(true),
  effacerRecherche: t => { const i = t.parentNode.querySelector('input'); i.value = ''; i.dispatchEvent(new Event('input', {bubbles:true})); i.blur(); },
  voirEngagements: () => {
    const D = $('#codeDlg'), e = data?.essai;
    D.innerHTML = `<form method="dialog" class="essai">
      <div class="dlg-h"><h2>${ico('info', '')}Version d’essai</h2></div>
      <div class="dlg-b">
        <p class="essai-intro">${ESSAI_INTRO}</p>
        <ul class="engagements">${ENGAGEMENTS.map(t => `<li>${ico('coche', '')}<span>${t}</span></li>`).join('')}</ul>
        ${e?.date ? `<p class="small muted" style="margin:12px 0 0">Engagements acceptés le ${fmtFR(ymd(new Date(e.date)))}.</p>` : ''}
      </div>
      <div class="dlg-f"><button class="btn primary">Fermer</button></div>
    </form>`;
    D.onclose = null;
    D.showModal();
  },
  newEntry: () => openEntry(null),
  editEntry: t => openEntry(t.dataset.id, t.dataset.v),
  closeDlg: t => t.closest('dialog').close(),
  voirPolitique: () => { $('#polCadre').src = 'confidentialite.html'; $('#polDlg').showModal(); },
  newNote: () => openNote(null),
  editNote: t => openNote(t.dataset.id),
  saveNote: () => {
    const text = $('#nText').value.trim(), champs = {text, time:$('#eTime').value || nowTime(), ville:$('#eVille').value.trim(), lieu:$('#eLieu').value.trim()};
    if (!text) return $('#nErr').textContent = 'Écrivez quelque chose avant d’enregistrer.';
    const d = ensureDay(cur); d.notes ||= [];
    const n = d.notes.find(x => x.id === noteId);
    if (n) Object.assign(n, champs); else d.notes.push({id:uid(), ...champs});
    save(); $('#entryDlg').close(); render(); toast('Note enregistrée');
  },
  delNote: () => {
    if (!confirm('Supprimer cette note personnelle ?')) return;
    const d = ensureDay(cur); d.notes = dayNotes(d).filter(x => x.id !== noteId);
    save(); $('#entryDlg').close(); render();
  },
  geoTest: async () => {
    const s = $('#geoTest'); s.textContent = 'Recherche de la ville…';
    try { s.textContent = `Ça fonctionne : ${await trouverVille()}.`; } catch (msg) { s.textContent = msg; }
  },
  pickFam: t => { ed.fam = t.dataset.f; renderPicker(); },
  pickInt: t => { ed.int = t.dataset.i; renderPicker(); },
  toggleEmo: t => {
    const w = t.dataset.w, i = ed.emos.findIndex(x => x.f === ed.fam && x.w === w);
    if (i >= 0) ed.emos.splice(i, 1); else ed.emos.push({f:ed.fam, i:ed.int, w});
    renderPicker();
  },
  unpick: t => { ed.emos.splice(+t.dataset.n, 1); renderPicker(); },
  pickBFam: t => { if (ed.bfam !== t.dataset.b) { ed.bfam = t.dataset.b; ed.bgr = 0; } renderBPicker(); },
  pickBGr: t => { ed.bgr = +t.dataset.g; renderBPicker(); },
  toggleBes: t => {
    const w = t.dataset.w, i = ed.bes.findIndex(x => x.b === ed.bfam && x.w === w);
    if (i >= 0) ed.bes.splice(i, 1); else ed.bes.push({b:ed.bfam, w});
    renderBPicker();
  },
  unpickB: t => { ed.bes.splice(+t.dataset.n, 1); renderBPicker(); },
  volet: t => { document.activeElement?.blur?.(); poserVolet(t.dataset.v); },
  // « Besoin › », « Action › », « ‹ Émotion » : la ligne passe à cette carte, sans ouvrir la note
  voirFace: t => { const c = t.closest('.duo'); if (c) poserFace(c, +t.dataset.k); },
  // carte Action : cocher une action dans la fenêtre de saisie (enregistré avec la note)
  cocherLigne: t => { const ok = !t.classList.contains('ok'); t.classList.toggle('ok', ok); t.setAttribute('aria-checked', ok); },
  // … ou sur la carte affichée et dans la synthèse du jour : enregistré aussitôt ; l'action reste là, cochée, partout où elle s'affiche
  cocher: t => {
    if (src) return;
    const [id, ti] = t.dataset.tache.split(':'), x = data.days[t.dataset.k]?.entries?.find(y => y.id === id)?.taches?.find(y => y.id === ti);
    if (!x) return;
    x.ok = !x.ok; save();
    document.querySelectorAll(`[data-tache="${t.dataset.tache}"]`).forEach(c => { c.classList.toggle('ok', x.ok); c.setAttribute('aria-checked', x.ok); });
  },
  locate: () => locate(true),
  saveEntry: () => {
    ed.time = $('#eTime').value || nowTime();
    ed.ville = $('#eVille').value.trim();
    ed.lieu = $('#eLieu').value.trim();
    ed.car = $('#eCar').value.trim();
    ed.bdet = $('#eBdet').value.trim();
    ed.piste = $('#ePiste').value.trim();
    ed.taches = tachesSaisies();
    if (!ed.emos.length) { if (ed.volet !== 'e') poserVolet('e'); return $('#eErr').textContent = 'Choisissez au moins une émotion.'; }
    // les trois cartes sont enregistrées ensemble ; sans besoin ni action, la note garde sa forme d'avant
    const d = ensureDay(cur), {fam, int, villeTouched, bfam, bgr, volet, ...entry} = ed;
    if (!entry.bes.length) delete entry.bes;
    if (!entry.bdet) delete entry.bdet;
    if (!entry.piste) delete entry.piste;
    if (!entry.taches.length) delete entry.taches;
    if (entry.id) d.entries[d.entries.findIndex(x => x.id === entry.id)] = entry;
    else { entry.id = uid(); d.entries.push(entry); countStat('notes'); }
    save(); $('#entryDlg').close(); render(); toast('Émotion enregistrée');
  },
  delEntry: () => {
    if (!confirm('Supprimer cette note ?')) return;
    const d = ensureDay(cur); d.entries = d.entries.filter(x => x.id !== ed.id);
    save(); $('#entryDlg').close(); render();
  },
  exportXlsx: () => { const x = exportRange(); if (x) withBusy(() => download(buildXlsx(x.from, x.to), x.name)); },
  shareXlsx: () => {
    const x = exportRange(); if (!x) return;
    const file = new File([buildXlsx(x.from, x.to)], x.name, {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    withBusy(async () => {
      if (navigator.canShare?.({files:[file]})) { try { await navigator.share({files:[file], title:'Motus'}); } catch {} }
      else download(file, x.name);
    });
  },
  changeCode: async () => {
    if (!session) return toast('Connexion internet nécessaire pour changer de mot de passe.');
    if (!await verifierAvantMdp()) return;   // mot de passe actuel, ou code reçu par e-mail
    const c = await askCode('Nouveau mot de passe', {confirm:true});
    if (!c) return;
    try { await API.setPassword(c); }
    catch (x) { return toast(x.code === 'faible' ? 'Mot de passe trop simple.' : x.code === 'reseau' ? 'Pas de connexion internet.' : 'Changement impossible pour le moment.'); }
    salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveKey(c, salt);
    if (data.settings.autolock === -1) await rememberKey().catch(() => {});
    await saveNow(); await ensureSecours(c); toast('Mot de passe modifié');
  },
  lockNow: () => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="decoForm">
      <div class="dlg-h"><h2>Se déconnecter ?</h2></div>
      <div class="dlg-f"><button type="button" class="btn" id="decoNon">Non</button><button class="btn primary">Oui</button></div>
    </form>`;
    $('#decoNon').onclick = () => D.close();
    $('#decoForm').onsubmit = e => { e.preventDefault(); D.close(); lock(); };
    D.showModal();
  },
  backup: () => sauvegarder(),
  backupLater: () => { data.backupPlusTard = today(); save(); $('.sauvegarde-rappel')?.remove(); },
  majApp: async () => { if (key) await saveNow(); location.reload(); },
  restore: () => { busy = true; $('#restoreFile').value = ''; $('#restoreFile').click(); setTimeout(() => busy = false, 60000); },
  install: async () => {
    if (!installEvt) return;
    const e = installEvt; e.prompt(); await e.userChoice?.catch(() => {}); installEvt = null; majPageInstall();
  },
  copierLien: async () => {
    const l = lienInvitation();
    try { await navigator.clipboard.writeText(l); toast(pendingInv ? 'Invitation copiée' : 'Lien copié'); }
    catch { window.prompt('Copiez ce lien :', l); }
  },
  recupNotes: () => { recupNotes = true; showLock('login'); },
  retourInstall: () => { recupNotes = false; showLock(); },
  navQuandMeme: () => {
    if (!confirm('Continuer dans ce navigateur ?\n\nVos notes y seront séparées de celles de l’app installée, et le navigateur peut les effacer après quelques jours sans visite. Faites des sauvegardes régulières.')) return;
    localStorage.setItem(NAV_OK, '1'); recupNotes = false;
    if (key) showApp(); else showLock('login');
  },
  wipe: async () => {
    const th = data.role === 'therapeute';
    if (!confirm(`Effacer définitivement ${th ? 'toutes les données reçues de vos clients' : 'toutes vos notes'} de ce téléphone ?\n\nVotre compte et vos réglages${th ? ', ainsi que vos fiches clients,' : ''} sont conservés. Les sauvegardes, fichiers Excel et envois déjà créés ne sont pas concernés.`)) return;
    if (!await confirmerEffacement()) return;
    viderJournal(); await saveNow();
    src = null; setPage = null; view = th ? 'clients' : 'day'; cur = today(); calF = calW = null; calC = []; calMode = 'grid'; render();
    toast(th ? 'Les données reçues ont été effacées de ce téléphone' : 'Vos notes ont été effacées de ce téléphone');
  },
  addRecovery: async () => {
    if (!session) return toast('Connexion internet nécessaire.');
    const r = await askRecovery();
    if (r) await setRecovery(r.email, r.pw);
  },
  confirmRecovery: () => openRecupCode(),
  /* connexion, inscription */
  goSignup: () => showLock('signup'),
  goLogin: () => showLock('login'),
  forgot: () => showLock('forgot'),
  /* administration */
  goAdmin: () => { src = null; view = 'admin'; render(); },
  admReload: () => { adm = admInit(); render(true); },
  admFiltre: t => { adm.filtre = t.dataset.f; render(true); },
  admOpen: t => { adm.ouvert = adm.ouvert === t.dataset.id ? null : t.dataset.id; render(true); },
  admActif: t => admAction(t.dataset.id,
    u => u.actif ? {titre:`Désactiver le compte de ${who(u)} ?`, texte:'Cette personne ne pourra plus se connecter, jusqu’à ce que vous réactiviez son compte.', bouton:'Désactiver'}
      : {titre:`Réactiver le compte de ${who(u)} ?`, texte:'Cette personne pourra de nouveau se connecter.', bouton:'Réactiver'},
    u => API.rpc('admin_activer', {p_id:u.id, p_actif:!u.actif})),
  admType: t => admAction(t.dataset.id,
    u => ({titre:`Passer ${who(u)} en ${u.role === 'client' ? 'thérapeute' : 'utilisateur'} ?`, texte:'Un nouveau code utilisateur lui sera attribué ; l’ancien ne sera pas réutilisé.', bouton:'Changer le type'}),
    u => API.rpc('admin_type', {p_id:u.id, p_role:u.role === 'client' ? 'therapeute' : 'client'})),
  admSuppr: t => admAction(t.dataset.id,
    u => ({titre:`Supprimer le compte de ${who(u)} ?`, texte:'La suppression est définitive. Son journal reste sur son téléphone, mais cette personne ne pourra plus se connecter.', bouton:'Supprimer'}),
    u => API.rpc('admin_supprimer', {p_id:u.id})),
};

document.addEventListener('gesturestart', e => e.preventDefault());   // iPhone : ignore le zoom à deux doigts
/* Un œil dans chaque champ de mot de passe, où qu'il apparaisse (connexion, inscription, fenêtres), pour voir ce qu'on tape */
function ajouterOeil() {
  document.querySelectorAll('input[type=password]:not([data-oeil])').forEach(i => {
    i.dataset.oeil = '1';
    const w = document.createElement('span'), b = document.createElement('button');
    w.className = 'mdp-champ'; i.replaceWith(w); w.append(i, b);
    b.type = 'button'; b.className = 'oeil'; b.tabIndex = -1;
    const maj = () => { const vu = i.type === 'text'; b.innerHTML = ico(vu ? 'oeilBarre' : 'oeil', ''); b.setAttribute('aria-label', vu ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); };
    b.onclick = () => { i.type = i.type === 'password' ? 'text' : 'password'; maj(); i.focus(); };
    maj();
  });
}
new MutationObserver(ajouterOeil).observe(document.body, {childList:true, subtree:true});
