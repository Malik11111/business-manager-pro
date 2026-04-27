/**
 * formation.js — Module Formation
 * Matrice personnel × types de formation, alertes, attestations PDF
 */

let _formationPersonnel = [];
let _formationTypes = [];
let _formationRecords = {};
let _formationInited = false;

/* ── Init ─────────────────────────────────────────────── */
async function initFormation() {
  await loadFormationMatrice();
  loadFormationAlerteBadge();
}

async function loadFormationMatrice() {
  try {
    const data = await api('/api/formations/matrice');
    _formationPersonnel = data.personnel || [];
    _formationTypes = data.types || [];
    _formationRecords = data.records || {};
    renderFormationMatrice();
  } catch (e) {
    showToast('Erreur chargement formations', 'error');
  }
}

async function loadFormationAlerteBadge() {
  try {
    const alertes = await api('/api/formations/alertes');
    const badge = document.getElementById('formation-alertes-badge');
    if (badge) {
      badge.textContent = alertes.length;
      badge.style.display = alertes.length ? 'inline' : 'none';
    }
  } catch (e) {}
}

/* ── Rendu matrice ────────────────────────────────────── */
function filterFormationMatrice() {
  renderFormationMatrice();
}

function renderFormationMatrice() {
  const search = (document.getElementById('formation-search')?.value || '').toLowerCase();
  const thead = document.getElementById('formation-matrice-thead');
  const tbody = document.getElementById('formation-matrice-tbody');
  if (!thead || !tbody) return;

  const cols = ['NOM', 'PRÉNOM', 'POSTE', 'CONTRAT'];
  const typeHeaders = _formationTypes.map(t =>
    `<th style="min-width:120px;padding:8px 6px;font-size:11px;text-align:center;background:#1E3A8A;color:#fff;white-space:nowrap;border-right:1px solid #2D4FA0;" title="${esc(t.nom)}">${esc(t.nom.length > 14 ? t.nom.slice(0, 13) + '…' : t.nom)}<br><span style="font-weight:400;font-size:10px;color:#93C5FD">${t.periodicite_mois ? _moisToAns(t.periodicite_mois) : '—'}</span></th>`
  ).join('');

  thead.innerHTML = `<tr>
    ${cols.map(c => `<th style="padding:8px;font-size:11px;background:#1E3A8A;color:#fff;white-space:nowrap;">${c}</th>`).join('')}
    ${typeHeaders}
  </tr>`;

  const filtered = _formationPersonnel.filter(p => {
    if (!search) return true;
    return [p.nom, p.prenom, p.poste, p.type_contrat].some(v => (v || '').toLowerCase().includes(search));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols.length + _formationTypes.length}">Aucun salarié trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const contratStyle = _formationContratStyle(p.type_contrat);
    const cells = _formationTypes.map(t => {
      const key = `${p.id},${t.id}`;
      const rec = _formationRecords[key];
      return `<td style="text-align:center;padding:4px;border-right:1px solid #F3F4F6;border-bottom:1px solid #F3F4F6;">
        <div onclick="openFormationCell(${p.id},${t.id})" style="cursor:pointer;display:inline-block;">
          ${_formationCellBadge(rec)}
        </div>
      </td>`;
    }).join('');

    return `<tr style="border-bottom:1px solid #F3F4F6;">
      <td style="padding:6px 8px;font-weight:700;white-space:nowrap;">${esc(p.nom)}</td>
      <td style="padding:6px 8px;white-space:nowrap;">${esc(p.prenom || '—')}</td>
      <td style="padding:6px 8px;font-size:12px;color:#5C52CC;white-space:nowrap;">${esc(p.poste || '—')}</td>
      <td style="padding:6px 8px;"><span style="${contratStyle};padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700;">${esc(p.type_contrat || '—')}</span></td>
      ${cells}
    </tr>`;
  }).join('');
}

function _formationContratStyle(c) {
  const map = { 'CDI': 'background:#EDE9FE;color:#5B21B6', 'CDD': 'background:#FCE7F3;color:#9D174D', 'Stage': 'background:#D1FAE5;color:#065F46', 'Intervenant ext': 'background:#ECFEFF;color:#155E75' };
  return map[c] || 'background:#F1F5F9;color:#374151';
}

function _formationCellBadge(rec) {
  if (!rec || !rec.date_realise) {
    return `<span style="font-size:18px;" title="Non renseigné">—</span>`;
  }
  const today = new Date();
  let status = 'ok', label = '', title = '';
  const annee = rec.date_realise.slice(0, 4);

  if (rec.date_prochaine) {
    const dp = new Date(rec.date_prochaine);
    const jours = Math.round((dp - today) / 86400000);
    if (jours < 0) {
      status = 'expire';
      label = `⚠️ ${annee}`;
      title = `Dépassé depuis ${Math.abs(jours)}j — Refaire avant le ${rec.date_prochaine}`;
    } else if (jours <= 60) {
      status = 'bientot';
      label = `⏰ ${annee}`;
      title = `À renouveler dans ${jours}j`;
    } else {
      status = 'ok';
      label = `✅ ${annee}`;
      title = `Valide jusqu'au ${rec.date_prochaine}`;
    }
  } else {
    label = `✅ ${annee}`;
    title = `Réalisé le ${rec.date_realise}`;
  }

  const colors = {
    ok: 'background:#D1FAE5;color:#065F46',
    bientot: 'background:#FEF3C7;color:#92400E',
    expire: 'background:#FEE2E2;color:#991B1B'
  };

  const attestBadge = rec.has_attestation
    ? `<span style="font-size:9px;background:#EDE9FE;color:#5B21B6;border-radius:4px;padding:1px 4px;display:block;margin-top:2px;">📎 attest.</span>`
    : '';

  return `<span style="${colors[status]};padding:3px 7px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;" title="${title}">${label}</span>${attestBadge}`;
}

/* ── Dialog saisie cellule ───────────────────────────── */
function openFormationCell(pid, tid) {
  const p = _formationPersonnel.find(x => x.id === pid);
  const t = _formationTypes.find(x => x.id === tid);
  if (!p || !t) return;

  const key = `${pid},${tid}`;
  const rec = _formationRecords[key] || {};
  const hasAttest = rec.has_attestation;
  const attestLine = hasAttest
    ? `<div style="font-size:12px;color:#5B21B6;margin-top:4px;">📎 Attestation présente — <a href="/api/formations/attestation/${rec.id}" target="_blank" style="color:#5B21B6;text-decoration:underline;">Voir</a></div>`
    : '';

  openModal(`🎓 ${esc(p.nom)} ${esc(p.prenom || '')} — ${esc(t.nom)}`, `
    <div style="display:grid;gap:12px;padding:4px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="modal-label">Date de réalisation</label>
          <input id="form-date-realise" class="modal-input" type="date" value="${rec.date_realise || ''}">
        </div>
        <div>
          <label class="modal-label">Prochaine date</label>
          <input id="form-date-prochaine" class="modal-input" type="date" value="${rec.date_prochaine || ''}">
          ${t.periodicite_mois ? `<div style="font-size:11px;color:#9CA3AF;margin-top:3px;">Périodicité : ${_moisToAns(t.periodicite_mois)} — <a href="#" onclick="autoCalcDate(${t.periodicite_mois});return false;" style="color:#5B21B6;">Calculer auto</a></div>` : ''}
        </div>
      </div>
      <div>
        <label class="modal-label">Attestation PDF / JPG</label>
        <input id="form-attestation" type="file" accept=".pdf,.jpg,.jpeg,.png" class="modal-input">
        ${attestLine}
      </div>
    </div>
  `, async () => {
    const dateRealise = document.getElementById('form-date-realise')?.value || '';
    const dateProchaine = document.getElementById('form-date-prochaine')?.value || '';
    const fileInput = document.getElementById('form-attestation');
    const file = fileInput?.files[0];

    const fd = new FormData();
    fd.append('personnel_id', pid);
    fd.append('type_formation_id', tid);
    fd.append('date_realise', dateRealise);
    fd.append('date_prochaine', dateProchaine);
    if (file) fd.append('attestation', file);

    try {
      const res = await fetch('/api/formations/record', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return false; }
      showToast('Formation enregistrée ✅', 'success');
      await loadFormationMatrice();
      loadFormationAlerteBadge();
    } catch (e) { showToast('Erreur', 'error'); return false; }
  });
}

function autoCalcDate(mois) {
  const dateRealise = document.getElementById('form-date-realise')?.value;
  if (!dateRealise) { showToast('Renseignez d\'abord la date de réalisation', 'error'); return; }
  const d = new Date(dateRealise);
  d.setMonth(d.getMonth() + parseInt(mois));
  document.getElementById('form-date-prochaine').value = d.toISOString().slice(0, 10);
}

/* ── Onglet Alertes ──────────────────────────────────── */
async function loadFormationAlertes() {
  const tbody = document.getElementById('formation-alertes-tbody');
  if (!tbody) return;
  try {
    const alertes = await api('/api/formations/alertes');
    const badge = document.getElementById('formation-alertes-badge');
    if (badge) { badge.textContent = alertes.length; badge.style.display = alertes.length ? 'inline' : 'none'; }

    if (!alertes.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">✅ Aucune alerte — toutes les formations sont à jour.</td></tr>';
      return;
    }
    tbody.innerHTML = alertes.map(a => {
      const expire = a.expire;
      const jours = a.jours;
      let badge, bg;
      if (expire) {
        badge = `<span style="background:#FEE2E2;color:#991B1B;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;">🔴 Dépassé de ${Math.abs(jours)}j</span>`;
      } else {
        badge = `<span style="background:#FEF3C7;color:#92400E;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;">⚠️ Dans ${jours}j</span>`;
      }
      return `<tr>
        <td style="font-weight:700;">${esc(a.nom)}</td>
        <td>${esc(a.prenom)}</td>
        <td style="font-size:12px;color:#5C52CC;">${esc(a.poste || '—')}</td>
        <td style="font-weight:600;">${esc(a.formation)}</td>
        <td style="font-size:12px;">${esc(a.date_prochaine)}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
  } catch (e) {}
}

/* ── Gérer les types de formation ────────────────────── */
async function openGererTypesFormation() {
  await _renderTypesFormationModal();
}

async function _renderTypesFormationModal() {
  const types = await api('/api/formations/types');
  _formationTypes = types;

  const liste = types.length
    ? types.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F3F4F6;">
          <span style="flex:1;font-size:13px;font-weight:600;">${esc(t.nom)}</span>
          <input type="number" value="${Math.round(t.periodicite_mois / 12) || ''}" min="0" step="1"
            onchange="updateFormationType(${t.id}, this.value * 12)"
            style="width:60px;padding:4px;border:1px solid #D1D5DB;border-radius:6px;font-size:12px;text-align:center;"
            title="Périodicité en années (0 = pas de limite)">
          <span style="font-size:11px;color:#9CA3AF;width:30px;">ans</span>
          <button class="btn-sm btn-sm-red" onclick="deleteFormationType(${t.id})">🗑️</button>
        </div>`).join('')
    : '<div style="color:#9CA3AF;font-size:13px;padding:10px 0;">Aucun type défini.</div>';

  openModal('⚙️ Types de formation', `
    <div style="display:grid;gap:12px;padding:4px;">
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end;">
        <div>
          <label class="modal-label">Nouveau type de formation</label>
          <input id="type-form-nom" class="modal-input" placeholder="Ex: Premiers secours, CACES...">
        </div>
        <div>
          <label class="modal-label">Périodicité (ans)</label>
          <input id="type-form-mois" class="modal-input" type="number" value="1" min="0" step="1" style="width:80px;">
        </div>
        <button class="btn btn-green" style="height:38px;align-self:end;" onclick="addFormationType()">➕ Ajouter</button>
      </div>
      <div style="font-size:11px;color:#9CA3AF;">0 ans = pas de date de renouvellement obligatoire</div>
      <div style="max-height:300px;overflow-y:auto;">${liste}</div>
    </div>
  `, async () => { await loadFormationMatrice(); });
}

async function addFormationType() {
  const nom = document.getElementById('type-form-nom')?.value.trim();
  const mois = (parseInt(document.getElementById('type-form-mois')?.value) || 0) * 12;
  if (!nom) { showToast('Nom requis', 'error'); return; }
  try {
    await api('/api/formations/types', 'POST', { nom, periodicite_mois: mois });
    showToast(`"${nom}" ajouté`, 'success');
    document.getElementById('type-form-nom').value = '';
    await _renderTypesFormationModal();
  } catch (e) { showToast('Erreur ajout', 'error'); }
}

async function updateFormationType(id, mois) {
  try {
    await api(`/api/formations/types/${id}`, 'PUT', { periodicite_mois: parseInt(mois) || 0 });
  } catch (e) {}
}

async function deleteFormationType(id) {
  if (!confirm('Supprimer ce type ? Toutes les données de formation associées seront supprimées.')) return;
  try {
    await api(`/api/formations/types/${id}`, 'DELETE');
    showToast('Type supprimé', 'success');
    await _renderTypesFormationModal();
    await loadFormationMatrice();
  } catch (e) { showToast('Erreur', 'error'); }
}

function _moisToAns(mois) {
  if (!mois) return '—';
  const ans = mois / 12;
  if (Number.isInteger(ans)) return ans === 1 ? '1 an' : `${ans} ans`;
  return `${ans.toFixed(1)} ans`;
}
