// Motus — Fenêtre de saisie d'un mot de passe ou d'un code
'use strict';

/* ───────────── Dialogue de saisie du code ───────────── */
function askCode(title, {confirm = false, hint = '', label = 'Mot de passe', min = 8} = {}) {
  return new Promise(resolve => {
    const D = $('#codeDlg');
    D.innerHTML = `<form method="dialog" id="codeForm">
      <div class="dlg-h"><h2>${esc(title)}</h2></div>
      <div class="dlg-b">
        ${hint ? `<p class="small muted">${esc(hint)}</p>` : ''}
        <label class="label" for="cd1">${confirm ? `Nouveau mot de passe (${min} caractères minimum)` : esc(label)}</label>
        <input type="password" id="cd1" autocomplete="${confirm ? 'new-password' : 'current-password'}">
        ${confirm ? '<label class="label" for="cd2">Confirmez</label><input type="password" id="cd2" autocomplete="new-password">' : ''}
        <div class="err" id="cdErr"></div>
      </div>
      <div class="dlg-f"><button type="button" class="btn" id="cdCancel">Annuler</button><button class="btn primary">Valider</button></div>
    </form>`;
    const done = v => { D.close(); resolve(v); };
    $('#cdCancel').onclick = () => done(null);
    D.oncancel = () => resolve(null);
    $('#codeForm').onsubmit = e => {
      e.preventDefault();
      const v = $('#cd1').value;
      if (confirm) {
        if (v.length < min) return $('#cdErr').textContent = `Au moins ${min} caractères.`;
        if (v !== $('#cd2').value) return $('#cdErr').textContent = 'Les deux mots de passe ne correspondent pas.';
      }
      done(v);
    };
    D.showModal();
  });
}

