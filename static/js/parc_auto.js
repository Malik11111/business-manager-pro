/**
 * parc_auto.js — Module Parc Auto
 * Véhicules, entretiens, carburant, alertes CT/assurance
 */

let _vehicules = [];
let _entretiens = [];
let _carburants = [];
let _vehiculesSort = { col: 'marque', asc: true };
let _autoInited = false;

/* ── Init ────────────────────────────────────────────────── */
async function initParcAuto() {
  if (!_autoInited) {
    _autoInited = true;
  }
  await loadVehicules();
  await loadEntretiens();
  await loadCarburant();
  await loadAlertes();
  buildVehiculeFilterOptions();
}

/* ── Chargement données ──────────────────────────────────── */
async function loadVehicules() {
  try {
    _vehicules = await api('/api/vehicules');
    renderVehicules();
  } catch (e) { showToast('Erreur chargement véhicules', 'error'); }
}

async function loadEntretiens() {
  try {
    const vid = document.getElementById('entretien-vehicule-filter')?.value || '';
    _entretiens = await api('/api/entretiens' + (vid ? `?vehicule_id=${vid}` : ''));
    renderEntretiens();
  } catch (e) {}
}

async function loadCarburant() {
  try {
    const vid = document.getElementById('carburant-vehicule-filter')?.value || '';
    _carburants = await api('/api/carburant' + (vid ? `?vehicule_id=${vid}` : ''));
    renderCarburant();
  } catch (e) {}
}

async function loadAlertes() {
  try {
    const alertes = await api('/api/vehicules/alertes');
    renderAlertes(alertes);
    const badge = document.getElementById('auto-alertes-badge');
    if (badge) {
      badge.style.display = alertes.length ? 'inline' : 'none';
      badge.textContent = alertes.length;
    }
  } catch (e) {}
}

/* ── Rendu tableau véhicules ─────────────────────────────── */
function renderVehicules() {
  const search = (document.getElementById('auto-search')?.value || '').toLowerCase();
  let data = _vehicules.filter(v =>
    !search ||
    v.immatriculation.toLowerCase().includes(search) ||
    v.marque.toLowerCase().includes(search) ||
    (v.modele || '').toLowerCase().includes(search) ||
    (v.conducteur || '').toLowerCase().includes(search)
  );
  data = [...data].sort((a, b) => {
    const va = String(a[_vehiculesSort.col] || '').toLowerCase();
    const vb = String(b[_vehiculesSort.col] || '').toLowerCase();
    return _vehiculesSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const tbody = document.getElementById('auto-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">Aucun véhicule enregistré.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(v => {
    const ctBadge  = moisBadge(v.mois_ct,  v.date_ct);
    const assBadge = moisBadge(v.mois_assurance, v.date_assurance);
    const kmFmt = v.kilometrage ? v.kilometrage.toLocaleString('fr-FR') + ' km' : '—';
    const couleurSwatch = `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${esc(v.couleur || '#808080')};border:1px solid #ccc;vertical-align:middle;" title="${esc(v.couleur || '')}"></span>`;
    return `<tr>
      <td>${couleurSwatch}</td>
      <td><strong>${esc(v.immatriculation)}</strong></td>
      <td>${esc(v.marque)} ${esc(v.modele || '')}</td>
      <td>${v.annee || '—'}</td>
      <td>${kmFmt}</td>
      <td class="auto-col-extra">${esc(v.conducteur || '—')}</td>
      <td class="auto-col-extra">${ctBadge}</td>
      <td class="auto-col-extra">${assBadge}</td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue"   onclick="editVehicule(${v.id})" title="Modifier">✏️</button>
          <button class="btn-sm btn-sm-orange" onclick="updateKmVehicule(${v.id}, ${v.kilometrage})" title="Mettre à jour km">📏</button>
          <button class="btn-sm btn-sm-red"    onclick="deleteVehicule(${v.id})" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function moisBadge(mois, dateStr) {
  if (!dateStr) return '<span style="color:#9CA3AF">—</span>';
  let color, label, bg;
  if (mois === null || mois === undefined) {
    return `<span style="color:#9CA3AF">${esc(dateStr)}</span>`;
  }
  if (mois <= 0) {
    bg = '#FFEBEE'; color = '#C62828'; label = 'Expiré';
  } else if (mois <= 1) {
    bg = '#FFF3E0'; color = '#EF6C00'; label = `${mois} mois`;
  } else if (mois <= 3) {
    bg = '#FFF8E1'; color = '#F57F17'; label = `${mois} mois`;
  } else {
    bg = '#E8F5E9'; color = '#2E7D32'; label = `${mois} mois`;
  }
  return `<span style="background:${bg};color:${color};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;" title="${esc(dateStr)}">${label}</span>`;
}

function sortVehiculesBy(col) {
  if (_vehiculesSort.col === col) _vehiculesSort.asc = !_vehiculesSort.asc;
  else { _vehiculesSort.col = col; _vehiculesSort.asc = true; }
  renderVehicules();
}

function filterVehicules() { renderVehicules(); }

/* ── Rendu entretiens ────────────────────────────────────── */
function renderEntretiens() {
  const tbody = document.getElementById('entretien-tbody');
  if (!tbody) return;
  const total = _entretiens.reduce((s, e) => s + (e.cout || 0), 0);
  const totalEl = document.getElementById('entretien-total');
  if (totalEl) totalEl.textContent = `Total : ${total.toLocaleString('fr-FR', {minimumFractionDigits:2})} €`;

  if (!_entretiens.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun entretien enregistré.</td></tr>';
    return;
  }
  tbody.innerHTML = _entretiens.map(e => `<tr>
    <td>${esc(e.date || '—')}</td>
    <td>${esc(e.immatriculation || '—')}</td>
    <td>${esc(e.type_entretien || '—')}</td>
    <td>${e.kilometrage ? e.kilometrage.toLocaleString('fr-FR') + ' km' : '—'}</td>
    <td>${esc(e.description || '—')}</td>
    <td>${(e.cout || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} €</td>
    <td><button class="btn-sm btn-sm-red" onclick="deleteEntretien(${e.id})">🗑️</button></td>
  </tr>`).join('');
}

/* ── Rendu carburant ─────────────────────────────────────── */
function renderCarburant() {
  const tbody = document.getElementById('carburant-tbody');
  if (!tbody) return;
  const totalL   = _carburants.reduce((s, c) => s + (c.litres || 0), 0);
  const totalEur = _carburants.reduce((s, c) => s + (c.cout || 0), 0);
  const totalEl  = document.getElementById('carburant-total');
  if (totalEl) totalEl.textContent = `${totalL.toFixed(1)} L — ${totalEur.toLocaleString('fr-FR', {minimumFractionDigits:2})} €`;

  if (!_carburants.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun plein enregistré.</td></tr>';
    return;
  }
  tbody.innerHTML = _carburants.map(c => {
    const epl = c.litres > 0 ? (c.cout / c.litres).toFixed(3) : '—';
    return `<tr>
      <td>${esc(c.date || '—')}</td>
      <td>${esc(c.immatriculation || '—')}</td>
      <td>${(c.litres || 0).toFixed(1)} L</td>
      <td>${(c.cout || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} €</td>
      <td>${c.kilometrage ? c.kilometrage.toLocaleString('fr-FR') + ' km' : '—'}</td>
      <td>${epl !== '—' ? epl + ' €/L' : '—'}</td>
      <td><button class="btn-sm btn-sm-red" onclick="deleteCarburantEntry(${c.id})">🗑️</button></td>
    </tr>`;
  }).join('');
}

/* ── Rendu alertes ───────────────────────────────────────── */
function renderAlertes(alertes) {
  const tbody = document.getElementById('alertes-tbody');
  if (!tbody) return;
  if (!alertes.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucune alerte — tous les véhicules sont à jour ✅</td></tr>';
    return;
  }
  tbody.innerHTML = alertes.map(a => `<tr>
    <td><strong>${esc(a.immatriculation)}</strong></td>
    <td>${esc(a.marque)} ${esc(a.modele || '')}</td>
    <td>${esc(a.date_ct || '—')}</td>
    <td>${moisBadge(a.mois_ct, a.date_ct)}</td>
    <td>${esc(a.date_assurance || '—')}</td>
    <td>${moisBadge(a.mois_assurance, a.date_assurance)}</td>
  </tr>`).join('');
}

/* ── Options filtres véhicules ───────────────────────────── */
function buildVehiculeFilterOptions() {
  ['entretien-vehicule-filter', 'carburant-vehicule-filter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Tous les véhicules</option>' +
      _vehicules.map(v => `<option value="${v.id}"${v.id == current ? ' selected' : ''}>${esc(v.immatriculation)} — ${esc(v.marque)}</option>`).join('');
  });
}

/* ── Dialogs ─────────────────────────────────────────────── */
function openAddVehiculeDialog(prefill = {}) {
  const today = new Date().toISOString().slice(0, 10);
  openModal('Ajouter un véhicule', `
    <div class="form-grid">
      <div class="form-group">
        <label>Immatriculation *</label>
        <input id="v-immat" placeholder="AA-123-BB" value="${esc(prefill.immatriculation||'')}">
      </div>
      <div class="form-group">
        <label>Marque</label>
        <input id="v-marque" placeholder="Renault, Peugeot..." value="${esc(prefill.marque||'')}">
      </div>
      <div class="form-group">
        <label>Modèle</label>
        <input id="v-modele" placeholder="Clio, 308..." value="${esc(prefill.modele||'')}">
      </div>
      <div class="form-group">
        <label>Année</label>
        <input id="v-annee" type="number" placeholder="2020" value="${prefill.annee||''}">
      </div>
      <div class="form-group">
        <label>Kilométrage</label>
        <input id="v-km" type="number" placeholder="0" value="${prefill.kilometrage||''}">
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input id="v-couleur" type="color" value="${prefill.couleur||'#808080'}" style="height:38px;padding:2px 4px;border-radius:8px;border:1px solid #D8D5F0;cursor:pointer;">
      </div>
      <div class="form-group">
        <label>Conducteur</label>
        <input id="v-conducteur" placeholder="Nom du conducteur" value="${esc(prefill.conducteur||'')}">
      </div>
      <div class="form-group">
        <label>Date CT (JJ-MM-AAAA)</label>
        <input id="v-ct" placeholder="JJ-MM-AAAA" value="${esc(prefill.date_ct||'')}">
      </div>
      <div class="form-group">
        <label>Date Assurance (JJ-MM-AAAA)</label>
        <input id="v-ass" placeholder="JJ-MM-AAAA" value="${esc(prefill.date_assurance||'')}">
      </div>
      <div class="form-group full-width">
        <label>Notes</label>
        <textarea id="v-notes" placeholder="Remarques...">${esc(prefill.notes||'')}</textarea>
      </div>
    </div>
  `, async () => {
    const immat = document.getElementById('v-immat').value.trim().toUpperCase();
    if (!immat) { showToast('Immatriculation requise', 'error'); return false; }
    try {
      await api('/api/vehicules', 'POST', {
        immatriculation: immat,
        marque:    document.getElementById('v-marque').value.trim(),
        modele:    document.getElementById('v-modele').value.trim(),
        annee:     document.getElementById('v-annee').value,
        kilometrage: document.getElementById('v-km').value,
        couleur:   document.getElementById('v-couleur').value,
        conducteur: document.getElementById('v-conducteur').value.trim(),
        date_ct:   document.getElementById('v-ct').value.trim(),
        date_assurance: document.getElementById('v-ass').value.trim(),
        notes:     document.getElementById('v-notes').value.trim()
      });
      showToast('Véhicule ajouté', 'success');
      await initParcAuto();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

async function editVehicule(id) {
  const v = _vehicules.find(x => x.id === id);
  if (!v) return;
  openModal('Modifier le véhicule', `
    <div class="form-grid">
      <div class="form-group">
        <label>Immatriculation</label>
        <input id="ev-immat" value="${esc(v.immatriculation)}">
      </div>
      <div class="form-group">
        <label>Marque</label>
        <input id="ev-marque" value="${esc(v.marque||'')}">
      </div>
      <div class="form-group">
        <label>Modèle</label>
        <input id="ev-modele" value="${esc(v.modele||'')}">
      </div>
      <div class="form-group">
        <label>Année</label>
        <input id="ev-annee" type="number" value="${v.annee||''}">
      </div>
      <div class="form-group">
        <label>Kilométrage</label>
        <input id="ev-km" type="number" value="${v.kilometrage||''}">
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input id="ev-couleur" type="color" value="${v.couleur||'#808080'}" style="height:38px;padding:2px 4px;border-radius:8px;border:1px solid #D8D5F0;cursor:pointer;">
      </div>
      <div class="form-group">
        <label>Conducteur</label>
        <input id="ev-conducteur" value="${esc(v.conducteur||'')}">
      </div>
      <div class="form-group">
        <label>Date CT (JJ-MM-AAAA)</label>
        <input id="ev-ct" value="${esc(v.date_ct||'')}">
      </div>
      <div class="form-group">
        <label>Date Assurance (JJ-MM-AAAA)</label>
        <input id="ev-ass" value="${esc(v.date_assurance||'')}">
      </div>
      <div class="form-group full-width">
        <label>Notes</label>
        <textarea id="ev-notes">${esc(v.notes||'')}</textarea>
      </div>
    </div>
  `, async () => {
    try {
      await api(`/api/vehicules/${id}`, 'PUT', {
        immatriculation: document.getElementById('ev-immat').value.trim().toUpperCase(),
        marque:    document.getElementById('ev-marque').value.trim(),
        modele:    document.getElementById('ev-modele').value.trim(),
        annee:     document.getElementById('ev-annee').value,
        kilometrage: document.getElementById('ev-km').value,
        couleur:   document.getElementById('ev-couleur').value,
        conducteur: document.getElementById('ev-conducteur').value.trim(),
        date_ct:   document.getElementById('ev-ct').value.trim(),
        date_assurance: document.getElementById('ev-ass').value.trim(),
        notes:     document.getElementById('ev-notes').value.trim()
      });
      showToast('Véhicule modifié', 'success');
      await initParcAuto();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

// Ouvre le formulaire de modification pré-rempli avec les données scannées (fusion)
function openEditVehiculeDialog(v, prefill = {}) {
  // prefill prend priorité sur les données existantes pour les champs non vides
  const merge = (scan, existing) => (scan && scan.trim()) ? scan : (existing || '');
  openModal('Mettre à jour le véhicule', `
    <div class="form-grid">
      <div class="form-group">
        <label>Immatriculation</label>
        <input id="ev-immat" value="${esc(merge(prefill.immatriculation, v.immatriculation))}">
      </div>
      <div class="form-group">
        <label>Marque</label>
        <input id="ev-marque" value="${esc(merge(prefill.marque, v.marque))}">
      </div>
      <div class="form-group">
        <label>Modèle</label>
        <input id="ev-modele" value="${esc(merge(prefill.modele, v.modele))}">
      </div>
      <div class="form-group">
        <label>Année</label>
        <input id="ev-annee" type="number" value="${merge(prefill.annee, v.annee)}">
      </div>
      <div class="form-group">
        <label>Kilométrage</label>
        <input id="ev-km" type="number" value="${v.kilometrage||''}">
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <input id="ev-couleur" type="color" value="${v.couleur||'#808080'}" style="height:38px;padding:2px 4px;border-radius:8px;border:1px solid #D8D5F0;cursor:pointer;">
      </div>
      <div class="form-group">
        <label>Conducteur</label>
        <input id="ev-conducteur" value="${esc(v.conducteur||'')}">
      </div>
      <div class="form-group">
        <label>Date CT (JJ-MM-AAAA)</label>
        <input id="ev-ct" value="${esc(merge(prefill.date_ct, v.date_ct))}">
      </div>
      <div class="form-group">
        <label>Date Assurance (JJ-MM-AAAA)</label>
        <input id="ev-ass" value="${esc(merge(prefill.date_assurance, v.date_assurance))}">
      </div>
      <div class="form-group full-width">
        <label>Notes</label>
        <textarea id="ev-notes">${esc(merge(prefill.notes, v.notes))}</textarea>
      </div>
    </div>
  `, async () => {
    try {
      await api(`/api/vehicules/${v.id}`, 'PUT', {
        immatriculation: document.getElementById('ev-immat').value.trim().toUpperCase(),
        marque:    document.getElementById('ev-marque').value.trim(),
        modele:    document.getElementById('ev-modele').value.trim(),
        annee:     document.getElementById('ev-annee').value,
        kilometrage: document.getElementById('ev-km').value,
        couleur:   document.getElementById('ev-couleur').value,
        conducteur: document.getElementById('ev-conducteur').value.trim(),
        date_ct:   document.getElementById('ev-ct').value.trim(),
        date_assurance: document.getElementById('ev-ass').value.trim(),
        notes:     document.getElementById('ev-notes').value.trim()
      });
      showToast('Véhicule mis à jour', 'success');
      await initParcAuto();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

async function deleteVehicule(id) {
  const v = _vehicules.find(x => x.id === id);
  if (!v) return;
  if (!confirm(`Supprimer ${v.immatriculation} — ${v.marque} ? Tout l'historique sera perdu.`)) return;
  try {
    await api(`/api/vehicules/${id}`, 'DELETE');
    showToast('Véhicule supprimé', 'success');
    await initParcAuto();
  } catch (e) { showToast('Erreur suppression', 'error'); }
}

function updateKmVehicule(id, kmActuel) {
  openModal('Mettre à jour le kilométrage', `
    <div class="form-group">
      <label>Nouveau kilométrage</label>
      <input id="new-km" type="number" value="${kmActuel}" style="font-size:20px;font-weight:700;">
    </div>
  `, async () => {
    const km = parseInt(document.getElementById('new-km').value);
    if (isNaN(km) || km < 0) { showToast('Kilométrage invalide', 'error'); return false; }
    try {
      await api(`/api/vehicules/${id}/km`, 'POST', { kilometrage: km });
      showToast('Kilométrage mis à jour', 'success');
      await loadVehicules();
    } catch (e) { showToast('Erreur', 'error'); return false; }
  });
}

function majRapideKm() {
  if (!_vehicules.length) { showToast('Aucun véhicule', 'info'); return; }
  openModal('MAJ rapide kilométrage', `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${_vehicules.map(v => `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="min-width:110px;font-weight:600;">${esc(v.immatriculation)}</span>
          <span style="color:#6B6B8A;min-width:120px;">${esc(v.marque)} ${esc(v.modele||'')}</span>
          <input data-vid="${v.id}" type="number" value="${v.kilometrage||0}" style="width:120px;padding:6px 10px;border:1px solid #D8D5F0;border-radius:6px;">
        </div>
      `).join('')}
    </div>
  `, async () => {
    const inputs = document.querySelectorAll('[data-vid]');
    for (const inp of inputs) {
      const vid = parseInt(inp.dataset.vid);
      const km  = parseInt(inp.value);
      if (!isNaN(km)) await api(`/api/vehicules/${vid}/km`, 'POST', { kilometrage: km });
    }
    showToast('Kilométrages mis à jour', 'success');
    await loadVehicules();
  });
}

/* ── Entretien dialogs ───────────────────────────────────── */
function openAddEntretienDialog() {
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  const TYPES = ['Vidange', 'Révision', 'Pneus', 'Freins', 'Batterie', 'Climatisation', 'Autre'];
  openModal('Ajouter un entretien', `
    <div class="form-grid">
      <div class="form-group">
        <label>Véhicule *</label>
        <select id="ent-vid">
          ${_vehicules.map(v => `<option value="${v.id}">${esc(v.immatriculation)} — ${esc(v.marque)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="ent-type">
          ${TYPES.map(t => `<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Date (JJ-MM-AAAA)</label>
        <input id="ent-date" value="${today}" placeholder="JJ-MM-AAAA">
      </div>
      <div class="form-group">
        <label>Kilométrage</label>
        <input id="ent-km" type="number" placeholder="0">
      </div>
      <div class="form-group">
        <label>Coût (€)</label>
        <input id="ent-cout" type="number" step="0.01" placeholder="0.00">
      </div>
      <div class="form-group full-width">
        <label>Description</label>
        <textarea id="ent-desc" placeholder="Détails de l'entretien..."></textarea>
      </div>
    </div>
  `, async () => {
    const vid = document.getElementById('ent-vid').value;
    if (!vid) { showToast('Véhicule requis', 'error'); return false; }
    try {
      await api('/api/entretiens', 'POST', {
        vehicule_id:   vid,
        type_entretien: document.getElementById('ent-type').value,
        date:          document.getElementById('ent-date').value.trim(),
        kilometrage:   document.getElementById('ent-km').value,
        cout:          document.getElementById('ent-cout').value,
        description:   document.getElementById('ent-desc').value.trim()
      });
      showToast('Entretien ajouté', 'success');
      await loadEntretiens();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

async function deleteEntretien(id) {
  if (!confirm('Supprimer cet entretien ?')) return;
  try {
    await api(`/api/entretiens/${id}`, 'DELETE');
    showToast('Entretien supprimé', 'success');
    await loadEntretiens();
  } catch (e) { showToast('Erreur', 'error'); }
}

/* ── Carburant dialogs ───────────────────────────────────── */
function openAddCarburantDialog() {
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  openModal('Ajouter un plein', `
    <div class="form-grid">
      <div class="form-group">
        <label>Véhicule *</label>
        <select id="carb-vid">
          ${_vehicules.map(v => `<option value="${v.id}">${esc(v.immatriculation)} — ${esc(v.marque)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Date (JJ-MM-AAAA)</label>
        <input id="carb-date" value="${today}" placeholder="JJ-MM-AAAA">
      </div>
      <div class="form-group">
        <label>Litres</label>
        <input id="carb-litres" type="number" step="0.1" placeholder="0.0">
      </div>
      <div class="form-group">
        <label>Coût total (€)</label>
        <input id="carb-cout" type="number" step="0.01" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>Kilométrage</label>
        <input id="carb-km" type="number" placeholder="0">
      </div>
    </div>
  `, async () => {
    const vid = document.getElementById('carb-vid').value;
    if (!vid) { showToast('Véhicule requis', 'error'); return false; }
    try {
      await api('/api/carburant', 'POST', {
        vehicule_id: vid,
        date:        document.getElementById('carb-date').value.trim(),
        litres:      document.getElementById('carb-litres').value,
        cout:        document.getElementById('carb-cout').value,
        kilometrage: document.getElementById('carb-km').value
      });
      showToast('Plein ajouté', 'success');
      await loadCarburant();
      await loadVehicules();
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

async function deleteCarburantEntry(id) {
  if (!confirm('Supprimer cette entrée carburant ?')) return;
  try {
    await api(`/api/carburant/${id}`, 'DELETE');
    showToast('Supprimé', 'success');
    await loadCarburant();
  } catch (e) { showToast('Erreur', 'error'); }
}

/* ── Export CSV ──────────────────────────────────────────── */
function exportVehicules() {
  if (!_vehicules.length) { showToast('Aucun véhicule à exporter', 'info'); return; }
  const headers = ['Immatriculation','Marque','Modèle','Année','Kilométrage','Couleur','Conducteur','Date CT','Date Assurance','Notes'];
  const rows = _vehicules.map(v => [
    v.immatriculation, v.marque, v.modele||'', v.annee||'', v.kilometrage||'',
    v.couleur||'', v.conducteur||'', v.date_ct||'', v.date_assurance||'', v.notes||''
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'parc_auto.csv';
  a.click();
}

/* ── Scan document véhicule ──────────────────────────────── */
function openScanDocVehicule() {
  // Ouvre directement le sélecteur de fichier (PDF, photo carte grise, CT, assurance)
  const input = document.getElementById('scan-vehicule-input');
  input.value = '';
  input.click();
}

async function onScanVehiculeSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // Afficher l'overlay de chargement
  const overlay = document.getElementById('scan-vehicule-overlay');
  const bar     = document.getElementById('scan-vehicule-bar');
  const lbl     = document.getElementById('scan-vehicule-label');
  overlay.style.display = 'flex';
  bar.style.width = '15%';
  lbl.textContent = 'Envoi du document…';

  try {
    const formData = new FormData();
    formData.append('file', file);
    bar.style.width = '45%';
    lbl.textContent = 'Lecture du document en cours…';

    const res = await fetch('/api/vehicules/scan-document', { method: 'POST', body: formData });
    bar.style.width = '85%';
    lbl.textContent = 'Extraction des informations…';

    const data = await res.json();
    if (!res.ok) {
      overlay.style.display = 'none';
      showToast(data.error || 'Erreur lors du scan', 'error');
      return;
    }

    bar.style.width = '100%';
    lbl.textContent = 'Terminé !';
    await new Promise(r => setTimeout(r, 500));
    overlay.style.display = 'none';

    // Ouvrir le formulaire d'ajout/modification pré-rempli
    const prefill = {
      immatriculation: data.immatriculation || '',
      marque:          data.marque || '',
      modele:          data.modele || '',
      annee:           data.annee || '',
      date_ct:         data.date_ct || '',
      date_assurance:  data.date_assurance || '',
      notes:           data.remarques_ct || ''
    };

    // Si le véhicule existe déjà, proposer de le mettre à jour
    const existing = _vehicules.find(v =>
      data.immatriculation &&
      v.immatriculation.toUpperCase() === data.immatriculation.toUpperCase()
    );
    if (existing) {
      showToast(`Véhicule ${data.immatriculation} trouvé — formulaire pré-rempli pour mise à jour`, 'info');
      openEditVehiculeDialog(existing, prefill);
    } else {
      showToast('Document lu — vérifiez et complétez les informations', 'info');
      openAddVehiculeDialog(prefill);
    }

  } catch (e) {
    overlay.style.display = 'none';
    showToast('Erreur : ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════
   ONGLET COÛTS
══════════════════════════════════════════════════════ */
let _coutsChart = null;

async function renderCouts() {
  // Charger les données si pas encore chargées
  if (!_carburants.length && !_entretiens.length) {
    await Promise.all([loadEntretiens(), loadCarburant()]);
  }

  const totalCarb = _carburants.reduce((s, c) => s + (c.cout || 0), 0);
  const totalEnt  = _entretiens.reduce((s, e) => s + (e.cout || 0), 0);
  const totalGen  = totalCarb + totalEnt;

  const setKpi = (id, val, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.kpi-label').textContent = label;
    el.querySelector('.kpi-value').textContent = formatEUR(val);
  };
  setKpi('couts-kpi-carburant', totalCarb, '⛽ Carburant total');
  setKpi('couts-kpi-entretien', totalEnt,  '🔧 Entretien total');
  setKpi('couts-kpi-total',     totalGen,  '💶 Coût total');

  // Par véhicule
  const byVeh = {};
  _vehicules.forEach(v => {
    byVeh[v.id] = {
      nom: `${v.marque || ''} ${v.modele || ''} (${v.immatriculation})`.trim(),
      carb: 0, ent: 0
    };
  });
  _carburants.forEach(c => { if (byVeh[c.vehicule_id]) byVeh[c.vehicule_id].carb += c.cout || 0; });
  _entretiens.forEach(e => { if (byVeh[e.vehicule_id]) byVeh[e.vehicule_id].ent  += e.cout || 0; });

  const vList = Object.values(byVeh)
    .filter(v => v.carb + v.ent > 0)
    .sort((a, b) => (b.carb + b.ent) - (a.carb + a.ent));

  // Chart Chart.js
  const ctx = document.getElementById('chart-couts')?.getContext('2d');
  if (ctx) {
    if (_coutsChart) _coutsChart.destroy();
    _coutsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: vList.map(v => v.nom.length > 28 ? v.nom.slice(0, 26) + '…' : v.nom),
        datasets: [
          { label: '⛽ Carburant', data: vList.map(v => Math.round(v.carb)), backgroundColor: '#FF6B6B', borderRadius: 4 },
          { label: '🔧 Entretien', data: vList.map(v => Math.round(v.ent)),  backgroundColor: '#4ECDC4', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { callback: v => formatEUR(v) } }
        }
      }
    });
  }

  // Tableau
  const tbody = document.getElementById('couts-tbody');
  if (tbody) {
    if (vList.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aucune donnée de coût — ajoutez des pleins ou des entretiens.</td></tr>';
    } else {
      tbody.innerHTML = vList.map(v => `<tr>
        <td><strong>${esc(v.nom)}</strong></td>
        <td style="text-align:right">${formatEUR(Math.round(v.carb))}</td>
        <td style="text-align:right">${formatEUR(Math.round(v.ent))}</td>
        <td style="text-align:right;font-weight:700">${formatEUR(Math.round(v.carb + v.ent))}</td>
      </tr>`).join('');
    }
  }
}
