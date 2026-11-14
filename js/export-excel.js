// Motus — Exports Excel (.xlsx) et texte (.txt), créés sur le téléphone
'use strict';

/* ───────────── Export Excel (.xlsx généré sur le téléphone, sans bibliothèque externe) ───────────── */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), body = enc.encode(f.data), crc = crc32(body);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
    h.setUint32(18, body.length, true); h.setUint32(22, body.length, true); h.setUint16(26, name.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true); c.setUint32(24, body.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    parts.push(new Uint8Array(h.buffer), name, body);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = central.reduce((a, u) => a + u.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

const xesc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const colL = i => String.fromCharCode(65 + i);
const cS = (ref, s, t) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(t)}</t></is></c>`;
const cN = (ref, s, n) => `<c r="${ref}" s="${s}"><v>${n}</v></c>`;
const cE = (ref, s) => `<c r="${ref}" s="${s}"/>`;
/* Texte mis en forme dans une cellule (v47) : une liste de segments {t, b, i, u, c, sz}, comme dans l'app. Les émotions et les besoins
   sont en gras, plus gros et dans la couleur de leur famille ; les connecteurs en italique souligné. Excel ne peut pas embarquer la
   police de l'app (Plus Jakarta Sans) : tout est en Arial, comme le reste du tableau. */
const ACCENT_X = 'FF4F4BC9';
const argb = c => /^#[0-9a-f]{6}$/i.test(c) ? 'FF' + c.slice(1).toUpperCase() : ACCENT_X;
const segTexte = segs => segs.map(s => s.t).join('');
const runX = s => `<r><rPr>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.u ? '<u/>' : ''}<sz val="${s.sz || 9}"/><color rgb="${s.c || 'FF333333'}"/><rFont val="Arial"/></rPr><t xml:space="preserve">${xesc(s.t)}</t></r>`;
const cR = (ref, st, segs) => segs.some(s => s.b || s.i || s.u || s.c || s.sz)
  ? `<c r="${ref}" s="${st}" t="inlineStr"><is>${segs.filter(s => s.t).map(runX).join('')}</is></c>` : cS(ref, st, segTexte(segs));
const segsSep = (listes, sep) => listes.flatMap((l, i) => i ? [{t:sep}, ...l] : l);
const segsFr = l => l.length < 2 ? segsSep(l, '') : [...segsSep(l.slice(0, -1), ', '), {t:' et '}, ...l[l.length - 1]];   // comme joinFr
/* Un texte libre : ses connecteurs en italique souligné, sans leur @ (comme sansArobase) */
function segsConn(s, extra = {}) {
  s = String(s ?? ''); const out = []; let i = 0;
  for (const x of s.matchAll(RE_CONN)) {
    const debut = x.index + x[1].length;
    if (debut > i) out.push({...extra, t:s.slice(i, debut)});
    out.push({...extra, t:nomConn(x[2]), i:true, u:true, c:ACCENT_X});
    i = debut + 1 + x[2].length;
  }
  if (i < s.length) out.push({...extra, t:s.slice(i)});
  return out;
}
const motEmo = x => ({t:lc(x.w), b:true, sz:11, c:argb(FAMK[x.f].c)});
const mot = (t, c) => ({t, b:true, sz:11, c:argb(c)});
const segsPhrase = e => { const car = cleanCar(e); return [{t:'Je me sens '}, ...segsFr(e.emos.map(x => [motEmo(x)])), ...(car ? [{t:' car '}, ...segsConn(car)] : []), {t:'.'}]; };   // comme sentence(e)
const segsBesoin = e => {   // comme besoinTexte(e)
  const bs = besoinsDe(e), d = detailDe(e);
  return [...(bs.length ? [{t:'J’ai besoin '}, ...segsFr(bs.map(x => [{t:deMot(x.w)}, mot(lc(x.w), coulB(x.b))])), {t:'.'}] : []),
    ...(d ? [...(bs.length ? [{t:' '}] : []), ...segsConn(finPhrase(d))] : [])];
};
const xRow =(r, cells, ht) => `<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells.join('')}</row>`;
function sheet({cols, rows, merges = [], landscape}) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
  + `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`
  + `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`
  + `<sheetFormatPr defaultRowHeight="15"/>`
  + `<cols>${cols.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
  + `<sheetData>${rows.join('')}</sheetData>`
  + (merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
  + `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>`
  + `<pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>`
  + `</worksheet>`;
}
/* Styles repris du modèle « Tableau d'Observation » (couleurs, polices, bordures) */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="11">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF8C5E3C"/><name val="Arial"/></font>
<font><i/><sz val="10"/><color rgb="FFC27B42"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FF8C5E3C"/><name val="Arial"/></font>
<font><b/><sz val="11"/><color rgb="FF8C5E3C"/><name val="Arial"/></font>
<font><b/><sz val="9.5"/><color rgb="FF155724"/><name val="Arial"/></font>
<font><b/><sz val="9.5"/><color rgb="FF856404"/><name val="Arial"/></font>
<font><b/><sz val="9.5"/><color rgb="FF721C24"/><name val="Arial"/></font>
<font><sz val="9"/><color rgb="FF333333"/><name val="Arial"/></font>
<font><b/><i/><sz val="9"/><color rgb="FF8C5E3C"/><name val="Arial"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
</fonts>
<fills count="9">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF9F6F0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC3B2D6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD4EDDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF8D7DA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC27B42"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="6">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFC27B42"/></left><right style="thin"><color rgb="FFC27B42"/></right><top style="thin"><color rgb="FFC27B42"/></top><bottom style="thin"><color rgb="FFC27B42"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFA0A0A0"/></left><right style="thin"><color rgb="FFA0A0A0"/></right><top style="thin"><color rgb="FFA0A0A0"/></top><bottom style="thin"><color rgb="FFA0A0A0"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFFFFFFF"/></left><right style="thin"><color rgb="FFFFFFFF"/></right><top style="medium"><color rgb="FF8C5E3C"/></top><bottom style="medium"><color rgb="FF8C5E3C"/></bottom><diagonal/></border>
<border><left style="medium"><color rgb="FF8C5E3C"/></left><right style="medium"><color rgb="FF8C5E3C"/></right><top style="thin"><color rgb="FFC27B42"/></top><bottom style="thin"><color rgb="FFC27B42"/></bottom><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFC27B42"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="19">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="5" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="10" fillId="7" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="9" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
const S = {title:1, sub:2, lab:3, val:4, sect:5, vert:6, jaune:7, rouge:8, legend:9, txt:10, head:11, week:12, cell:13, cvert:14, cjaune:15, crouge:16, conf:17, off:18};
const cellStyle = c => c ? S['c' + c] : S.cell;
const estLines = (t, w) => t.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / w)), 0);

/* Ce que contient un export : chez le thérapeute, tout ce qu'il a reçu ; chez l'utilisateur, son choix (Partage et export ›
   Choix des données › Dans mes exports). Les besoins et les actions n'existent qu'avec leur émotion. */
const TOUT = {emotions:true, besoins:true, actions:true, synthese:true, notes:true, lieu:true, couleur:true};
function choixExport() {
  const c = src ? TOUT : {...TOUT, ...data.settings.exportChoix};
  return {...c, besoins:c.emotions && c.besoins, actions:c.emotions && c.actions};
}
function buildXlsx(from, to) {
  const L = D().labels, p = D().profile, ch = choixExport();
  const ou = o => ch.lieu ? where(o) : '', couleur = d => ch.couleur && d?.color || null;
  // les cartes Besoin et Action d'une émotion, mises en forme (segments), séparées par une espace
  const cartesE = e => segsSep([ch.besoins ? segsBesoin(e) : [], ...(ch.actions ? tachesDe(e).map(x => segsConn(`${x.ok ? '☑' : '☐'} ${x.t.trim()}`)) : []),
    ch.actions && pisteDe(e) ? [{t:'Je pourrais '}, ...segsConn(pisteDe(e)), {t:'.'}] : []].filter(l => l.length), ' ');
  const rempli = d => !!d && !!((ch.emotions && d.entries?.length) || (ch.synthese && d.synth?.trim()) || (ch.notes && dayNotes(d).length) || couleur(d));
  const keys = []; for (let k = from; k <= to; k = addDays(k, 1)) keys.push(k);
  const byTime = d => [...d.entries].sort((a,b) => a.time.localeCompare(b.time));

  /* Feuille 1 : tableau d'observation hebdomadaire (mise en page du modèle) */
  const H = 'ABCDEFGH'.split(''), fill = (r, s) => H.slice(1).map(c => cE(c + r, s));
  const r1 = [
    xRow(1, [cS('A1', S.title, 'TABLEAU D\'OBSERVATION'), ...fill(1, S.title)], 28),
    xRow(2, [cS('A2', S.sub, 'Motus — Éclairer ce qui se passe en soi'), ...fill(2, S.sub)], 18),
    xRow(4, [cS('A4', S.lab, 'Nom :'), cS('B4', S.val, p.nom), cE('C4', S.val), cS('D4', S.lab, 'Prénom :'), cS('E4', S.val, p.prenom), cE('F4', S.val),
      cS('G4', S.lab, 'Période :'), cS('H4', S.val, `${fmtFR(from)} – ${fmtFR(to)}`)], 22),
    xRow(6, [cS('A6', S.sect, 'CONSIGNES & CODE COULEUR DE LA JOURNÉE'), ...fill(6, S.sect)], 24),
    xRow(7, [cS('A7', S.vert, 'VERT'), cS('B7', S.legend, L.vert), cS('C7', S.jaune, 'JAUNE'), cS('D7', S.legend, L.jaune), cS('E7', S.rouge, 'ROUGE'), cS('F7', S.legend, L.rouge)], 22),
    xRow(8, [cS('A8', S.txt, '• Au fil de la journée : heure / ville / lieu — « Je me sens [émotion du répertoire] car [ce qui l’a déclenchée]. »'
      + (ch.besoins || ch.actions ? ' Puis : « J’ai besoin de [besoin du répertoire]. Je pourrais [action concrète saine]. »' : ''))], ch.besoins || ch.actions ? 30 : 18),
    xRow(9, [cS('A9', S.txt, '• Chaque soir : une synthèse de la journée et une couleur (vert, jaune ou rouge).')], 18),
    xRow(10, [cS('A10', S.conf, 'Ce tableau est confidentiel et constitue une base de travail essentielle.')], 18),
    xRow(12, [cS('A12', S.head, 'Semaine / Date'), ...['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map((j, i) => cS(H[i+1] + 12, S.head, j))], 28),
  ];
  const debut = D().debutSuivi || p.start;   // fiche client : semaines comptées depuis l'acceptation
  const base = debut && debut <= from ? mondayOf(debut) : mondayOf(from);
  let r = 13;
  for (let mon = mondayOf(from); mon <= to; mon = addDays(mon, 7), r++) {
    const n = Math.round((parse(mon) - parse(base)) / 864e5 / 7) + 1;
    const cells = [cS('A' + r, S.week, `SEMAINE ${n}\n\nLundi :\n${fmtFR(mon)}`)];
    let lines = 4;
    for (let i = 0; i < 7; i++) {
      const k = addDays(mon, i), ref = H[i+1] + r, d = D().days[k];
      if (k < from || k > to) { cells.push(cE(ref, S.off)); continue; }
      if (!rempli(d)) { cells.push(cS(ref, S.cell, fmtFR(k).slice(0, 5))); continue; }
      const sg = [{t:fmtFR(k).slice(0, 5) + (couleur(d) ? ' — ' + L[d.color] : '')}];
      // dans l'ordre de la journée (sa demande, v42) : émotions et notes personnelles mêlées selon leur heure, puis la synthèse du soir
      // (v47 : émotions, besoins et connecteurs mis en forme comme dans l'app)
      const notes = [...(ch.emotions ? d.entries.map(e => { const c = cartesE(e); return [e.time, [{t:`${e.time}${ou(e) ? ' · ' + ou(e) : ''}\n`}, ...segsPhrase(e), ...(c.length ? [{t:'\n'}, ...c] : [])]]; }) : []),
        ...(ch.notes ? dayNotes(d).map(n => [n.time, [{t:`NOTE PERSONNELLE ${n.time}${ou(n) ? ' · ' + ou(n) : ''} :\n`}, ...segsConn(n.text)]]) : [])];
      notes.sort((a, b) => a[0].localeCompare(b[0])).forEach(([, x]) => sg.push({t:'\n\n'}, ...x));
      if (ch.synthese && d.synth?.trim()) sg.push({t:'\n\nSYNTHÈSE : '}, ...segsConn(d.synth.trim()));
      lines = Math.max(lines, estLines(segTexte(sg), 34));
      cells.push(cR(ref, cellStyle(couleur(d)), sg));
    }
    r1.push(xRow(r, cells, Math.min(409, Math.max(60, lines * 12.5 + 8))));   // les mots en gras et plus gros demandent un peu plus de place
  }
  const feuilles = [['Tableau d’observation', sheet({cols:[16,30,30,30,30,30,30,30], rows:r1, merges:['A1:H1','A2:H2','B4:C4','E4:F4','A6:H6','A8:H8','A9:H9','A10:H10'], landscape:true})]];

  /* Feuille 2 : détail de chaque émotion notée, avec ses cartes Besoin et Action (colonnes selon le choix) */
  if (ch.emotions) {
    const C2 = [
      ['Date', 11, (e, k) => fmtFR(k)], ['Jour', 10, (e, k) => JOURS[parse(k).getDay()]], ['Heure', 7, e => e.time],
      ...(ch.lieu ? [['Ville', 16, e => e.ville || ''], ['Lieu', 16, e => e.lieu || '']] : []),
      // 4e élément (v47) : le même texte mis en forme, en segments, comme dans l'app
      ['Émotion', 14, e => [...new Set(e.emos.map(x => FAMK[x.f].n))].join(', '),
        e => segsSep([...new Map(e.emos.map(x => [x.f, x])).values()].map(x => [mot(FAMK[x.f].n, FAMK[x.f].c)]), ', ')],
      ['Intensité', 11, e => [...new Set(e.emos.map(x => INTN[x.i]))].join(', ')],
      ['Je me sens…', 30, e => joinFr(e.emos.map(x => lc(x.w))), e => segsFr(e.emos.map(x => [motEmo(x)]))],
      ['… car', 55, e => sansArobase((e.car || '').trim()), e => segsConn((e.car || '').trim())],
      ...(ch.besoins ? [
        ['Besoin', 18, e => [...new Set(besoinsDe(e).map(x => BESK[x.b].n))].join(', '),
          e => segsSep([...new Map(besoinsDe(e).map(x => [x.b, x])).values()].map(x => [mot(BESK[x.b].n, coulB(x.b))]), ', ')],
        ['J’ai besoin de…', 30, e => joinFr(besoinsDe(e).map(x => lc(x.w))), e => segsFr(besoinsDe(e).map(x => [mot(lc(x.w), coulB(x.b))]))],
        ['Plus précisément', 40, e => sansArobase(detailDe(e)), e => segsConn(detailDe(e))]] : []),
      ...(ch.actions ? [['Actions', 40, e => sansArobase(tachesTexte(e).join('\n')), e => segsConn(tachesTexte(e).join('\n'))], ['Je pourrais…', 40, e => sansArobase(pisteDe(e)), e => segsConn(pisteDe(e))]] : []),
    ];
    const r2 = [xRow(1, [...C2.map(([h], i) => cS(colL(i) + 1, S.head, h)), ...(ch.couleur ? [cS(colL(C2.length) + 1, S.head, 'Couleur du jour')] : [])], 26)];
    let n2 = 2;
    for (const k of keys) {
      const d = D().days[k]; if (!d?.entries?.length) continue;
      for (const e of byTime(d)) {
        const vals = C2.map(([, , f]) => f(e, k, d)), row = vals.map((v, i) => C2[i][3] ? cR(colL(i) + n2, S.cell, C2[i][3](e, k, d)) : cS(colL(i) + n2, S.cell, v)), cc = colL(vals.length) + n2;
        if (ch.couleur) row.push(couleur(d) ? cS(cc, cellStyle(d.color), L[d.color]) : cE(cc, S.cell));
        const haut = Math.max(estLines(e.car || '', 60), estLines(joinFr(e.emos.map(x => x.w)), 34), ...C2.map(([, w], i) => estLines(vals[i], w + 4)));
        r2.push(xRow(n2, row, Math.min(409, Math.max(15, haut * 12 + 4))));
        n2++;
      }
    }
    feuilles.push(['Détail des émotions', sheet({cols:[...C2.map(([, w]) => w), ...(ch.couleur ? [18] : [])], rows:r2, landscape:true})]);
  }

  /* Feuille 3 : synthèses quotidiennes et couleurs */
  if (ch.synthese || ch.couleur) {
    const h3 = ['Date', 'Jour', ...(ch.couleur ? ['Couleur'] : []), ...(ch.emotions ? ['Nb d’émotions notées'] : []), ...(ch.synthese ? ['Synthèse de la journée'] : [])];
    const r3 = [xRow(1, h3.map((h, i) => cS(colL(i) + 1, S.head, h)), 26)];
    let n3 = 2;
    for (const k of keys) {
      const d = D().days[k];
      if (!d || !(couleur(d) || (ch.synthese && d.synth?.trim()) || (ch.emotions && d.entries?.length))) continue;
      const st = cellStyle(couleur(d)), c = [cS('A' + n3, st, fmtFR(k)), cS('B' + n3, st, JOURS[parse(k).getDay()])];
      if (ch.couleur) c.push(couleur(d) ? cS(colL(c.length) + n3, st, L[d.color]) : cE(colL(c.length) + n3, st));
      if (ch.emotions) c.push(cN(colL(c.length) + n3, st, d.entries.length));
      if (ch.synthese) c.push(cR(colL(c.length) + n3, st, segsConn((d.synth || '').trim())));
      r3.push(xRow(n3, c, Math.min(409, Math.max(15, (ch.synthese ? estLines(d.synth || '', 85) : 1) * 12 + 4))));
      n3++;
    }
    feuilles.push(['Synthèses', sheet({cols:[11, 10, ...(ch.couleur ? [18] : []), ...(ch.emotions ? [12] : []), ...(ch.synthese ? [80] : [])], rows:r3})]);
  }

  /* Feuille 4 : les notes personnelles (celles de l'utilisateur, s'il les exporte ; chez le thérapeute, celles reçues) */
  if (ch.notes) {
    const h4 = ['Date', 'Jour', 'Heure', ...(ch.lieu ? ['Ville', 'Lieu'] : []), 'Note personnelle'];
    const r4 = [xRow(1, h4.map((h, i) => cS(colL(i) + 1, S.head, h)), 26)];
    let n4 = 2;
    for (const k of keys) for (const n of [...dayNotes(D().days[k])].sort((a, b) => a.time.localeCompare(b.time))) {
      const vals = [fmtFR(k), JOURS[parse(k).getDay()], n.time, ...(ch.lieu ? [n.ville || '', n.lieu || ''] : []), sansArobase(n.text)];
      r4.push(xRow(n4, vals.map((v, i) => i === vals.length - 1 ? cR(colL(i) + n4, S.cell, segsConn(n.text)) : cS(colL(i) + n4, S.cell, v)), Math.min(409, Math.max(15, estLines(n.text, 85) * 12 + 4))));
      n4++;
    }
    if (n4 > 2) feuilles.push(['Notes personnelles', sheet({cols:[11, 10, 7, ...(ch.lieu ? [16, 16] : []), 80], rows:r4})]);
  }
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', nums = feuilles.map((f, i) => i + 1);
  return zip([
    {name:'[Content_Types].xml', data: X + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${nums.map(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:'_rels/.rels', data: X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml', data: X + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map(([n], i) => `<sheet name="${xesc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels', data: X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nums.map(i => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml', data:STYLES},
    ...feuilles.map(([, data], i) => ({name:`xl/worksheets/sheet${i + 1}.xml`, data})),
  ]);
}

function weekLabel() {
  const end = addDays(xStart, 6);
  return `${end === today() ? '<div class="small muted">Les 7 derniers jours</div>' : ''}Du <b>${fmtDay(xStart)}</b><br>au <b>${fmtDay(end)} ${parse(end).getFullYear()}</b>`;
}
function setWeek(n) {
  xStart = addDays(xStart, 7 * n);
  if (addDays(xStart, 6) > today()) xStart = addDays(today(), -6);
  $('#wkLabel').innerHTML = weekLabel();
  $('#xNext').disabled = addDays(xStart, 6) >= today();
  $('#xFrom').value = xStart; $('#xTo').value = addDays(xStart, 6);
  $('#xFromWd').textContent = weekday(xStart); $('#xToWd').textContent = weekday(addDays(xStart, 6));
  const st = $('#sentSt'); if (st) st.textContent = sentStatus();
}
function exportRange() {
  let from = xStart, to = addDays(xStart, 6);
  if ($('#xCustom').open) { from = $('#xFrom').value; to = $('#xTo').value; }
  if (!from || !to) { toast('Choisissez une période.'); return null; }
  if (from > to) [from, to] = [to, from];
  return {from, to};
}
/* Le fichier d'export de la période, au format choisi (Partage et export › Export) */
function fichierExport() {
  const x = exportRange(); if (!x) return null;
  const format = formatExport(), nom = `Motus_${x.from}_${x.to}.${format}`;
  const file = format === 'txt' ? new File(['﻿' + buildTxt(x.from, x.to)], nom, {type:'text/plain;charset=utf-8'})   // le BOM : accents justes dans le Bloc-notes
    : new File([buildXlsx(x.from, x.to)], nom, {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  return {...x, file, name:nom, format};
}

/* ───────────── Export texte (.txt, v42) ─────────────
   Lisible partout. Chaque note commence par une ligne « Dim. 08/11/2026 - 09:12 - Paris - Bureau - Émotion » (date, heure, ville,
   précision du lieu, type ; un champ vide est omis). Une émotion et ses cartes associées forment un seul bloc (sa demande) :
   l'émotion, puis en retrait, sous elle, sa carte Besoin et sa carte Action (↳). Les connecteurs gardent leur @. */
const RETRAIT = '    ';
function buildTxt(from, to) {
  const ch = choixExport(), L = data.labels, p = data.profile, maintenant = new Date();
  const tete = (k, o, type) => [jourCourt(k), o?.time, ...(ch.lieu && o ? [o.ville, o.lieu] : []), type].filter(Boolean).join(' - ');
  const suite = (s, r) => s.trim().split('\n').join('\n' + r);   // un texte sur plusieurs lignes reste aligné sous son début
  const emotion = (k, e) => {
    const nuances = [...new Set(e.emos.map(x => `${FAMK[x.f].n}, ${INTN[x.i].toLowerCase()}`))].join(' ; ');
    const l = [tete(k, e, 'Émotion'), `${suite(sentence(e), '')} (${nuances})`];
    const b = ch.besoins ? besoinTexte(e) : '', a = ch.actions ? actionLignes(e) : [];
    if (b) l.push(`${RETRAIT}↳ Besoin : ${suite(b, RETRAIT + '  ')}`);
    if (a.length === 1 && !tachesDe(e).length) l.push(`${RETRAIT}↳ Action : ${suite(a[0], RETRAIT + '  ')}`);
    else if (a.length) l.push(`${RETRAIT}↳ Action :`, ...a.map(x => RETRAIT.repeat(2) + suite(x, RETRAIT.repeat(2) + '    ')));
    return l.join('\n');
  };
  const jours = [];
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const d = data.days[k]; if (!d) continue;
    const notes = [...(ch.emotions ? (d.entries || []).map(e => [e.time, emotion(k, e)]) : []),
      ...(ch.notes ? dayNotes(d).map(n => [n.time, `${tete(k, n, 'Note personnelle')}\n${n.text.trim()}`]) : [])].sort((a, b) => a[0].localeCompare(b[0]));
    const synth = ch.synthese && d.synth?.trim(), coul = ch.couleur && d.color;
    if (!notes.length && !synth && !coul) continue;
    const trait = '='.repeat(40);
    jours.push([`${trait}\n${jourCourt(k)}${coul ? ' - ' + L[d.color] : ''}\n${trait}`, ...notes.map(x => x[1]), ...(synth ? [`${jourCourt(k)} - Synthèse de la journée\n${synth}`] : [])].join('\n\n'));
  }
  const qui = `${p.prenom} ${p.nom}`.trim();
  return [`MOTUS — Export de mon journal`,
    `${qui ? qui + ' · ' : ''}exporté le ${jourCourt(ymd(maintenant))} à ${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`,
    `Période : du ${jourCourt(from)} au ${jourCourt(to)}`,
    `Contenu : ${resumeChoix(ch, true).toLowerCase()}`,
    `Ce fichier n’est pas chiffré : toute personne qui l’ouvre peut le lire.`,
    '', ...(jours.length ? [jours.join('\n\n\n')] : ['Aucune note sur cette période.'])].join('\n') + '\n';
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function withBusy(fn) { busy = true; try { await fn(); } finally { setTimeout(() => busy = false, 1500); } }

