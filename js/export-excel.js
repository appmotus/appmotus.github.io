// Motus — Export Excel (.xlsx créé sur le téléphone)
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
const xRow = (r, cells, ht) => `<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells.join('')}</row>`;
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

function buildXlsx(from, to) {
  const L = D().labels, p = D().profile;
  const avecNotes = !!src;   // l'Excel du client ne contient pas ses notes personnelles ; celui du thérapeute contient celles qu'il a reçues
  // les besoins suivent chaque émotion, si le client les transmet (Paramètres › Données transmises) ; le thérapeute garde ceux reçus
  const avecB = !!src || !!data.settings.partage?.besoins, besE = e => avecB && aBesoins(e) ? sansArobase(besoinsTexte(e)) : '';
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
      + (avecB ? ' Puis : « J’ai besoin de [besoin du répertoire]. Je pourrais [action concrète saine]. »' : ''))], avecB ? 30 : 18),
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
      if (!(avecNotes ? dayFilled(d) : dayUsed(d))) { cells.push(cS(ref, S.cell, fmtFR(k).slice(0, 5))); continue; }
      let t = fmtFR(k).slice(0, 5) + (d.color ? ' — ' + L[d.color] : '');
      byTime(d).forEach(e => t += `\n\n${e.time}${where(e) ? ' · ' + where(e) : ''}\n${sansArobase(sentence(e))}${besE(e) ? '\n' + besE(e) : ''}`);
      if (d.synth?.trim()) t += `\n\nSYNTHÈSE : ${sansArobase(d.synth.trim())}`;
      if (avecNotes) dayNotes(d).forEach(n => t += `\n\nNOTE PERSONNELLE ${n.time}${where(n) ? ' · ' + where(n) : ''} :\n${sansArobase(n.text)}`);
      lines = Math.max(lines, estLines(t, 34));
      cells.push(cS(ref, cellStyle(d.color), t));
    }
    r1.push(xRow(r, cells, Math.min(409, Math.max(60, lines * 11.5 + 8))));
  }
  const s1 = sheet({cols:[16,30,30,30,30,30,30,30], rows:r1, merges:['A1:H1','A2:H2','B4:C4','E4:F4','A6:H6','A8:H8','A9:H9','A10:H10'], landscape:true});

  /* Feuille 2 : détail de chaque émotion notée */
  const h2 = ['Date','Jour','Heure','Ville','Lieu','Émotion','Intensité','Je me sens…','… car', ...(avecB ? ['Besoin','J’ai besoin de…','Plus précisément','Je pourrais…'] : []), 'Couleur du jour'];
  const r2 = [xRow(1, h2.map((h, i) => cS(colL(i) + 1, S.head, h)), 26)];
  let n2 = 2;
  for (const k of keys) {
    const d = D().days[k]; if (!d?.entries?.length) continue;
    for (const e of byTime(d)) {
      const vals = [fmtFR(k), JOURS[parse(k).getDay()], e.time, e.ville || '', e.lieu,
        [...new Set(e.emos.map(x => FAMK[x.f].n))].join(', '),
        [...new Set(e.emos.map(x => INTN[x.i]))].join(', '),
        joinFr(e.emos.map(x => lc(x.w))), sansArobase((e.car || '').trim()),
        ...(avecB ? [[...new Set(besoinsDe(e).map(x => BESK[x.b].n))].join(', '), joinFr(besoinsDe(e).map(x => lc(x.w))), detailDe(e), sansArobase(pisteDe(e))] : [])];
      const row = vals.map((v, i) => cS(colL(i) + n2, S.cell, v)), cc = colL(vals.length) + n2;
      row.push(d.color ? cS(cc, cellStyle(d.color), L[d.color]) : cE(cc, S.cell));
      r2.push(xRow(n2, row, Math.min(409, Math.max(15, Math.max(estLines(e.car || '', 60), estLines(vals[7], 34)) * 12 + 4))));
      n2++;
    }
  }
  const s2 = sheet({cols:[11,10,7,16,16,14,11,30,55, ...(avecB ? [18,30,40,40] : []), 18], rows:r2, landscape:true});

  /* Feuille 3 : synthèses quotidiennes */
  const h3 = ['Date','Jour','Couleur','Nb d’émotions notées','Synthèse de la journée'];
  const r3 = [xRow(1, h3.map((h, i) => cS(colL(i) + 1, S.head, h)), 26)];
  let n3 = 2;
  for (const k of keys) {
    const d = D().days[k]; if (!dayUsed(d)) continue;
    const st = cellStyle(d.color);
    r3.push(xRow(n3, [cS('A' + n3, st, fmtFR(k)), cS('B' + n3, st, JOURS[parse(k).getDay()]), d.color ? cS('C' + n3, st, L[d.color]) : cE('C' + n3, st),
      cN('D' + n3, st, d.entries.length), cS('E' + n3, st, sansArobase((d.synth || '').trim()))], Math.min(409, Math.max(15, estLines(d.synth || '', 85) * 12 + 4))));
    n3++;
  }
  const s3 = sheet({cols:[11,10,18,12,80], rows:r3});
  const feuilles = [['Tableau d’observation', s1], ['Détail des émotions', s2], ['Synthèses', s3]];

  /* Feuille 4, pour le thérapeute : les notes personnelles que le client a choisi de lui transmettre */
  if (avecNotes) {
    const h4 = ['Date','Jour','Heure','Ville','Lieu','Note personnelle'];
    const r4 = [xRow(1, h4.map((h, i) => cS(colL(i) + 1, S.head, h)), 26)];
    let n4 = 2;
    for (const k of keys) for (const n of [...dayNotes(D().days[k])].sort((a, b) => a.time.localeCompare(b.time))) {
      const vals = [fmtFR(k), JOURS[parse(k).getDay()], n.time, n.ville || '', n.lieu || '', sansArobase(n.text)];
      r4.push(xRow(n4, vals.map((v, i) => cS(colL(i) + n4, S.cell, v)), Math.min(409, Math.max(15, estLines(n.text, 85) * 12 + 4))));
      n4++;
    }
    if (n4 > 2) feuilles.push(['Notes personnelles', sheet({cols:[11,10,7,16,16,80], rows:r4})]);
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
  return {from, to, name:`Motus_${from}_${to}.xlsx`};
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function withBusy(fn) { busy = true; try { await fn(); } finally { setTimeout(() => busy = false, 1500); } }

