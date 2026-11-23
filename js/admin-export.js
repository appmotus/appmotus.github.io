// Motus — Export des questionnaires de l'administrateur (v54) : Excel (.xlsx) et texte (.txt)
'use strict';

/* ───────────── Exporter mes questionnaires (Admin › Mes questionnaires) ─────────────
   Pour chaque questionnaire choisi, tous ses bilans :
   - Excel : une feuille de scores (une ligne par bilan : date, commentaire, état, score, niveau, sous-scores) et une feuille de détail
     (fiche hygiène de vie : constats et priorités ; les autres : une ligne par question, une colonne par bilan) ;
   - texte : bilan par bilan, lisible partout.
   Le fichier n'est pas chiffré (comme l'export du journal) : c'est dit sur la page. Réutilise le classeur de export-excel.js. */
const colX = i => i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26);   // A…Z, AA…
// la réponse d'un bilan à une question : « N/A », le libellé d'une réponse oui/non, le nombre, ou rien
const valExport = (q, b, k) => estNA(q, b, k) ? 'N/A' : !valOK(q, b.notes[k]) ? '' : q.echelle.max - q.echelle.min === 1 ? libReponse(q, b.notes[k]) : b.notes[k];
const celVal = (ref, st, v) => typeof v === 'number' ? cN(ref, st, v) : v === '' ? cE(ref, st) : cS(ref, st, v);
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/* Feuille de scores d'un questionnaire */
function feuilleScoresQ(k) {
  const q = QUESTIONNAIRES[k], L = bilansDe(k), D = q.dimensions || [], nac = !!q.na, M = totalMax(q);
  const cols = ['Date', 'Commentaire de période', 'État', 'Score', 'Maximum', ...(nac ? [`Équivalent sur ${M}`] : []), 'Niveau', ...D.map(d => d.c)];
  const larg = [11, 28, 11, 8, 10, ...(nac ? [13] : []), 26, ...D.map(() => 12)], der = colX(cols.length - 1);
  const rows = [xRow(1, [cS('A1', S.sect, q.nom.toUpperCase()), ...cols.slice(1).map((_, i) => cE(colX(i + 1) + 1, S.sect))], 24),
    xRow(2, [cS('A2', S.txt, `Source : ${q.source}.${q.avis ? ' ' + q.avis : ''}`), ...cols.slice(1).map((_, i) => cE(colX(i + 1) + 2, S.txt))], 18),
    xRow(4, cols.map((h, i) => cS(colX(i) + 4, S.head, h)), 36)];
  L.forEach((b, n) => {
    const r = 5 + n, s = scoreBilan(b), p = s.complet ? palierDe(q, s.eq) : null, c = [];
    const add = (st, v) => c.push(celVal(colX(c.length) + r, st, v));
    add(S.cell, fmtFR(b.date)); add(S.cell, b.periode.trim()); add(S.cell, s.complet ? 'Complet' : 'Incomplet');
    add(S.cell, s.n ? s.total : ''); add(S.cell, s.max);
    if (nac) add(S.cell, s.complet ? s.eq : '');
    add(p ? cellStyle(p.c) : S.cell, p ? p.n : '');
    for (const a of D) {
      const x = scoreAxe(q, b, a);
      if (q.type === 'domaines') add(S.cell, valExport(q, b, a.items[0]));
      else add(a.seuil != null && x.complet && x.total > a.seuil ? S.crouge : S.cell, x.complet ? x.total : '');
    }
    rows.push(xRow(r, c, Math.max(18, estLines(b.periode, 28) * 12 + 6)));
  });
  return [nomFeuille(q.court), sheet({cols:larg, rows, merges:[`A1:${der}1`, `A2:${der}2`], landscape:true})];
}
const nomFeuille = s => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

/* Feuille de détail : constats et priorités (fiche hygiène de vie), ou les réponses question par question (dépistages) */
function feuilleDetailQ(k) {
  const q = QUESTIONNAIRES[k], L = bilansDe(k);
  if (q.type === 'domaines') {
    const rows = [xRow(1, ['Date', 'Domaine', 'Note', 'Constat'].map((h, i) => cS(colX(i) + 1, S.head, h)), 24)];
    let r = 2;
    for (const b of L) for (const it of q.items) {
      const cst = (b.constats[it.k] || '').trim(), v = valExport(q, b, it.k);
      if (!cst && v === '') continue;
      rows.push(xRow(r, [cS('A' + r, S.cell, fmtFR(b.date)), cS('B' + r, S.cell, it.n), celVal('C' + r, S.cell, v), cS('D' + r, S.cell, cst)], Math.max(18, estLines(cst, 80) * 12 + 6))); r++;
    }
    r++;
    rows.push(xRow(r, ['Date', 'Priorité', 'Domaine', 'Action concrète'].map((h, i) => cS(colX(i) + r, S.head, h)), 24)); r++;
    for (const b of L) b.priorites.forEach((p, i) => {
      if (!p.dom && !p.action.trim()) return;
      const nom = q.items.find(d => d.k === p.dom)?.n || '';
      rows.push(xRow(r, [cS('A' + r, S.cell, fmtFR(b.date)), cS('B' + r, S.cell, `Priorité ${i + 1}`), cS('C' + r, S.cell, nom), cS('D' + r, S.cell, p.action.trim())], Math.max(18, estLines(p.action, 80) * 12 + 6))); r++;
    });
    return [nomFeuille(`${q.court} — constats`), sheet({cols:[11, 26, 24, 80], rows})];
  }
  const rows = [xRow(1, ['N°', 'Question', ...L.map(b => fmtFR(b.date))].map((h, i) => cS(colX(i) + 1, S.head, h)), 24)];
  q.items.forEach((it, n) => { const r = 2 + n; rows.push(xRow(r, [cN('A' + r, S.cell, n + 1), cS('B' + r, S.cell, it.n), ...L.map((b, i) => celVal(colX(i + 2) + r, S.cell, valExport(q, b, it.k)))], Math.max(18, estLines(it.n, 70) * 12 + 6))); });
  const r = 2 + q.items.length;
  rows.push(xRow(r, [cE('A' + r, S.cell), cS('B' + r, S.lab, 'Score total'), ...L.map((b, i) => { const s = scoreBilan(b); return s.complet ? cN(colX(i + 2) + r, S.cell, s.total) : cE(colX(i + 2) + r, S.cell); })], 20));
  return [nomFeuille(`Réponses ${q.court}`), sheet({cols:[5, 70, ...L.map(() => 12)], rows})];
}
const feuillesQuestionnaires = ks => ks.flatMap(k => [feuilleScoresQ(k), feuilleDetailQ(k)]);

/* Version texte, bilan par bilan */
function texteQuestionnaires(ks) {
  const maintenant = new Date(), trait = '='.repeat(40), out = [];
  for (const k of ks) {
    const q = QUESTIONNAIRES[k], L = bilansDe(k), l = [`${trait}\n${q.nom}\n${trait}`, `Source : ${q.source}.${q.avis ? ' ' + q.avis : ''}`];
    if (!L.length) l.push('Aucun bilan.');
    for (const b of L) {
      const s = scoreBilan(b), p = s.complet ? palierDe(q, s.eq) : null, m = [];
      m.push(`--- Bilan du ${fmtFR(b.date)}${b.periode.trim() ? ' (' + b.periode.trim() + ')' : ''} ---`);
      m.push(`Score : ${s.n ? s.total : '—'} sur ${s.max}${s.na ? ` (${s.na} N/A, soit ${s.complet ? s.eq : '—'} sur ${totalMax(q)})` : ''}${p ? ' — ' + p.n : ''}${s.complet ? '' : ' — incomplet'}`);
      if (q.type === 'domaines') {
        for (const it of q.items) {
          const v = valExport(q, b, it.k), cst = (b.constats[it.k] || '').trim();
          m.push(`  ${it.n} : ${v === '' ? '—' : v}${cst ? '\n    Constat : ' + cst.split('\n').join('\n    ') : ''}`);
        }
        b.priorites.forEach((pr, i) => { if (pr.dom || pr.action.trim()) m.push(`  Priorité ${i + 1} : ${q.items.find(d => d.k === pr.dom)?.n || 'domaine non choisi'}${pr.action.trim() ? ' — ' + pr.action.trim() : ''}`); });
      } else {
        for (const a of q.dimensions || []) { const x = scoreAxe(q, b, a); m.push(`  ${a.n} : ${x.complet ? `${x.total} sur ${x.max}` : '—'}${a.seuil != null && x.complet && x.total > a.seuil ? ' (au-dessus du seuil)' : ''}`); }
        m.push('  Réponses :');
        q.items.forEach((it, n) => { const v = valExport(q, b, it.k); m.push(`    ${n + 1}. ${it.n} — ${v === '' ? '—' : v}`); });
      }
      l.push(m.join('\n'));
    }
    out.push(l.join('\n\n'));
  }
  return [`MOTUS — Export de mes questionnaires`, `exporté le ${fmtLong(today())} à ${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`,
    `Ce fichier n’est pas chiffré : toute personne qui l’ouvre peut le lire.`, '', out.join('\n\n\n')].join('\n') + '\n';
}

/* Le fichier des questionnaires cochés, au format choisi */
function fichierQuestionnaires() {
  const ks = Object.keys(QUESTIONNAIRES).filter(k => $(`#expQ-${k}`)?.checked);
  if (!ks.length) { toast('Choisissez au moins un questionnaire.'); return null; }
  const txt = $('#expQFmt')?.value === 'txt', nom = `Motus_questionnaires_${today()}.${txt ? 'txt' : 'xlsx'}`;
  const file = txt ? new File(['﻿' + texteQuestionnaires(ks)], nom, {type:'text/plain;charset=utf-8'}) : new File([classeur(feuillesQuestionnaires(ks))], nom, {type:MIME_XLSX});
  return {file, name:nom};
}
function pageExportQ() {
  const ls = Object.entries(QUESTIONNAIRES).map(([k, q]) => ({k, q, n:bilansDe(k).length}));
  if (!ls.some(x => x.n)) return '<section class="card"><p class="empty">Aucun bilan à exporter pour le moment.</p></section>';
  return `<section class="card">
    <p class="small muted" style="margin:0">Tous les bilans des questionnaires choisis : date, commentaire, score, niveau, sous-scores, et selon le questionnaire les constats, les priorités ou les réponses question par question.</p>
    ${ls.map(({k, q, n}) => `<div class="setrow"><label for="expQ-${k}">${esc(q.court)} <span class="small muted">· ${n ? `${n} bilan${n > 1 ? 's' : ''}` : 'aucun bilan'}</span></label><input type="checkbox" id="expQ-${k}" ${n ? 'checked' : 'disabled'}></div>`).join('')}
    <div class="setrow"><label for="expQFmt">Format</label><select id="expQFmt"><option value="xlsx">Excel (.xlsx)</option><option value="txt">Texte (.txt)</option></select></div>
    <p class="small muted" style="margin:0">Ce fichier n’est pas chiffré : toute personne qui l’ouvre peut lire vos réponses. Gardez-le en lieu sûr.</p>
    <button class="btn primary block" data-act="exporterQ">Exporter</button>
    ${navigator.canShare ? '<button class="btn block" data-act="partagerQ">Partager…</button>' : ''}
  </section>`;
}
const ACT_EXPORTQ = {
  exporterQ: () => { const x = fichierQuestionnaires(); if (x) withBusy(() => download(x.file, x.name)); },
  partagerQ: async () => {
    const x = fichierQuestionnaires(); if (!x) return;
    if (navigator.canShare?.({files:[x.file]})) { try { await navigator.share({files:[x.file], title:'Motus'}); } catch {} }
    else download(x.file, x.name);
  },
};
