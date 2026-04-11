/**
 * actifs.js — Module Actifs & Investissements
 * 5 onglets : Personnel, Unités, Investissement, Matériel à Sortir, PPI
 */

/* ── Données ────────────────────────────────────────────── */
const ACTIFS_KEY = 'bm_actifs';

function getActifsData(etab) {
  const raw = localStorage.getItem(ACTIFS_KEY);
  const all = raw ? JSON.parse(raw) : {};
  if (!all[etab]) all[etab] = { personnel: [], unites: [], materiel: [] };
  return all[etab];
}

function saveActifsData(etab, data) {
  const raw = localStorage.getItem(ACTIFS_KEY);
  const all = raw ? JSON.parse(raw) : {};
  all[etab] = data;
  localStorage.setItem(ACTIFS_KEY, JSON.stringify(all));
}

/* ── État local ─────────────────────────────────────────── */
let _actifs = { personnel: [], unites: [], materiel: [] };
let _actifsSortCol = {};
let _actifsSortDir = {};

const TYPES_MATERIEL = [
  'Audiovisuel', 'Climatisation', 'Electroménager', 'Équipement',
  'Informatique', 'Médical', 'Mobilier', 'Outillage',
  'Sécurité', 'Téléphonie', 'Travaux', 'Véhicule', 'Autre'
];

const STATUTS_MATERIEL = ['Disponible', 'En panne', 'Amorti', 'En maintenance', 'Hors service'];

const TYPES_CONTRAT = ['CDI', 'CDD', 'Intérim', 'Stage', 'Apprentissage', 'Vacation', 'Autre'];

/* ── Init ────────────────────────────────────────────────── */
function initActifs() {
  const etab = getCurrentEtab();
  _actifs = getActifsData(etab);
  if (_actifs.personnel.length === 0 && _actifs.materiel.length === 0) {
    loadActifsDemoData(etab);
    _actifs = getActifsData(etab);
  }
  renderPersonnelTable();
  renderUnitesTable();
  renderMaterielTable();
  renderSortirTable();
  updatePPI();
}

function _saveActifs() {
  saveActifsData(getCurrentEtab(), _actifs);
}

/* ══════════════════════════════════════════════════════════
   ONGLET PERSONNEL
══════════════════════════════════════════════════════════ */
function renderPersonnelTable(filtered) {
  const list = filtered ?? _actifs.personnel;
  const tbody = document.getElementById('personnel-tbody');
  if (!tbody) return;
  document.getElementById('personnel-count').textContent = `${list.length} personne${list.length > 1 ? 's' : ''}`;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucun personnel enregistré.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((p, i) => `<tr data-id="${esc(p.id)}">
    <td>${i + 1}</td>
    <td><strong>${esc(p.nom)}</strong></td>
    <td>${esc(p.prenom)}</td>
    <td><span class="badge badge-blue">${esc(p.type_contrat || '—')}</span></td>
    <td>${esc(p.poste || '—')}</td>
    <td>${esc(p.lieu || '—')}</td>
    <td>
      <div class="row-actions">
        <button class="btn-sm btn-sm-blue" onclick="editPersonnel('${p.id}')" title="Modifier">✏️</button>
        <button class="btn-sm btn-sm-red" onclick="deletePersonnel('${p.id}')" title="Supprimer">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterPersonnel() {
  const q = (document.getElementById('personnel-search')?.value || '').toLowerCase();
  const list = _actifs.personnel.filter(p =>
    !q || [p.nom, p.prenom, p.poste, p.type_contrat, p.lieu].some(v => (v || '').toLowerCase().includes(q))
  );
  renderPersonnelTable(list);
}

function openPersonnelDialog(prefill = null) {
  document.getElementById('modal-personnel-title').textContent = prefill ? 'Modifier le personnel' : 'Ajouter du personnel';
  document.getElementById('pers-form-id').value = prefill?.id || '';
  document.getElementById('pers-nom').value = prefill?.nom || '';
  document.getElementById('pers-prenom').value = prefill?.prenom || '';
  const contratSel = document.getElementById('pers-type-contrat');
  contratSel.innerHTML = TYPES_CONTRAT.map(t => `<option value="${t}"${prefill?.type_contrat === t ? ' selected' : ''}>${t}</option>`).join('');
  document.getElementById('pers-poste').value = prefill?.poste || '';
  document.getElementById('pers-lieu').value = prefill?.lieu || '';
  document.getElementById('pers-date-arrivee').value = prefill?.date_arrivee || '';
  document.getElementById('pers-date-depart').value = prefill?.date_depart || '';
  document.getElementById('modal-personnel').classList.remove('hidden');
  document.getElementById('pers-nom').focus();
}

function editPersonnel(id) {
  const p = _actifs.personnel.find(x => x.id === id);
  if (p) openPersonnelDialog(p);
}

function savePersonnel() {
  const id = document.getElementById('pers-form-id').value;
  const nom = document.getElementById('pers-nom').value.trim();
  const prenom = document.getElementById('pers-prenom').value.trim();
  if (!nom || !prenom) { showToast('Nom et prénom requis.', 'error'); return; }

  const obj = {
    id: id || uuid(),
    nom, prenom,
    type_contrat: document.getElementById('pers-type-contrat').value,
    poste: document.getElementById('pers-poste').value.trim(),
    lieu: document.getElementById('pers-lieu').value.trim(),
    date_arrivee: document.getElementById('pers-date-arrivee').value,
    date_depart: document.getElementById('pers-date-depart').value,
  };

  if (id) {
    const idx = _actifs.personnel.findIndex(p => p.id === id);
    if (idx >= 0) _actifs.personnel[idx] = obj;
  } else {
    _actifs.personnel.push(obj);
  }
  _actifs.personnel.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  _saveActifs();
  closeModal('modal-personnel');
  renderPersonnelTable();
  showToast(id ? 'Personnel modifié.' : 'Personnel ajouté.', 'success');
}

function deletePersonnel(id) {
  const p = _actifs.personnel.find(x => x.id === id);
  if (!p || !confirmAction(`Supprimer ${p.nom} ${p.prenom} ?`)) return;
  _actifs.personnel = _actifs.personnel.filter(x => x.id !== id);
  _saveActifs();
  renderPersonnelTable();
  showToast('Personnel supprimé.', 'success');
}

/* ══════════════════════════════════════════════════════════
   ONGLET UNITÉS
══════════════════════════════════════════════════════════ */
function renderUnitesTable(filtered) {
  const list = filtered ?? _actifs.unites;
  const tbody = document.getElementById('unites-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aucune unité enregistrée.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `<tr data-id="${esc(u.id)}">
    <td><strong>${esc(u.nom)}</strong></td>
    <td>${esc(u.description || '—')}</td>
    <td>${esc(u.emplacement || '—')}</td>
    <td>
      <div class="row-actions">
        <button class="btn-sm btn-sm-blue" onclick="editUnite('${u.id}')" title="Modifier">✏️</button>
        <button class="btn-sm btn-sm-red" onclick="deleteUnite('${u.id}')" title="Supprimer">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterUnites() {
  const q = (document.getElementById('unites-search')?.value || '').toLowerCase();
  const list = _actifs.unites.filter(u =>
    !q || [u.nom, u.description, u.emplacement].some(v => (v || '').toLowerCase().includes(q))
  );
  renderUnitesTable(list);
}

function openUniteDialog(prefill = null) {
  document.getElementById('modal-unite-title').textContent = prefill ? 'Modifier l\'unité' : 'Ajouter une unité';
  document.getElementById('unite-form-id').value = prefill?.id || '';
  document.getElementById('unite-nom').value = prefill?.nom || '';
  document.getElementById('unite-description').value = prefill?.description || '';
  document.getElementById('unite-emplacement').value = prefill?.emplacement || '';
  document.getElementById('modal-unite').classList.remove('hidden');
  document.getElementById('unite-nom').focus();
}

function editUnite(id) {
  const u = _actifs.unites.find(x => x.id === id);
  if (u) openUniteDialog(u);
}

function saveUnite() {
  const id = document.getElementById('unite-form-id').value;
  const nom = document.getElementById('unite-nom').value.trim();
  if (!nom) { showToast('Nom de l\'unité requis.', 'error'); return; }

  const obj = {
    id: id || uuid(),
    nom,
    description: document.getElementById('unite-description').value.trim(),
    emplacement: document.getElementById('unite-emplacement').value.trim(),
  };

  if (id) {
    const idx = _actifs.unites.findIndex(u => u.id === id);
    if (idx >= 0) _actifs.unites[idx] = obj;
  } else {
    _actifs.unites.push(obj);
  }
  _saveActifs();
  closeModal('modal-unite');
  renderUnitesTable();
  showToast(id ? 'Unité modifiée.' : 'Unité ajoutée.', 'success');
}

function deleteUnite(id) {
  const u = _actifs.unites.find(x => x.id === id);
  if (!u || !confirmAction(`Supprimer l'unité "${u.nom}" ?`)) return;
  _actifs.unites = _actifs.unites.filter(x => x.id !== id);
  _saveActifs();
  renderUnitesTable();
  showToast('Unité supprimée.', 'success');
}

/* ══════════════════════════════════════════════════════════
   ONGLET INVESTISSEMENT (MATÉRIEL)
══════════════════════════════════════════════════════════ */

function calcAmortissement(m) {
  const cout = m.cout || 0;
  const duree = m.duree_amortissement || 5;
  const annuel = duree > 0 ? cout / duree : 0;
  const dateAchat = m.date_achat ? new Date(m.date_achat + 'T00:00:00') : null;
  if (!dateAchat || isNaN(dateAchat)) return { annuel: 0, cumule: 0, valeurNette: cout, dateFin: '—', pctAmorti: 0 };

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const anneesEcoulees = (now - dateAchat) / (365.25 * 86400000);
  const cumule = Math.min(cout, annuel * Math.max(0, anneesEcoulees));
  const valeurNette = Math.max(0, cout - cumule);
  const dateFin = new Date(dateAchat);
  dateFin.setFullYear(dateFin.getFullYear() + duree);
  const pctAmorti = cout > 0 ? Math.min(100, Math.round(cumule / cout * 100)) : 0;

  return {
    annuel: Math.round(annuel),
    cumule: Math.round(cumule),
    valeurNette: Math.round(valeurNette),
    dateFin: dateFin.toISOString().slice(0, 10),
    pctAmorti
  };
}

function renderMaterielTable(filtered) {
  const list = filtered ?? _actifs.materiel;
  const tbody = document.getElementById('materiel-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Aucun investissement enregistré.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const a = calcAmortissement(m);
    const statutCls = m.statut === 'Disponible' ? 'badge-green' :
                      m.statut === 'En panne' ? 'badge-red' :
                      m.statut === 'Amorti' ? 'badge-gray' :
                      m.statut === 'En maintenance' ? 'badge-orange' : 'badge-red';
    const attribue = m.personnel_nom || '—';
    const fillCls = a.pctAmorti >= 100 ? 'danger' : a.pctAmorti >= 75 ? 'warning' : '';

    return `<tr data-id="${esc(m.id)}">
      <td><strong>${esc(m.nom)}</strong></td>
      <td>${esc(m.reference || '—')}</td>
      <td><span class="badge badge-blue">${esc(m.type || '—')}</span></td>
      <td>${formatDateFR(m.date_achat)}</td>
      <td style="text-align:right;font-weight:600">${formatEUR(m.cout || 0)}</td>
      <td>${esc(attribue)}</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar"><div class="progress-bar-fill ${fillCls}" style="width:${a.pctAmorti}%"></div></div>
          <span class="progress-pct">${a.pctAmorti}%</span>
        </div>
      </td>
      <td style="text-align:right">${formatEUR(a.valeurNette)}</td>
      <td><span class="badge ${statutCls}">${esc(m.statut || 'Disponible')}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue" onclick="editMateriel('${m.id}')" title="Modifier">✏️</button>
          <button class="btn-sm btn-sm-red" onclick="deleteMateriel('${m.id}')" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterMateriel() {
  const q = (document.getElementById('materiel-search')?.value || '').toLowerCase();
  const type = document.getElementById('materiel-type-filter')?.value || '';
  const statut = document.getElementById('materiel-statut-filter')?.value || '';

  const list = _actifs.materiel.filter(m => {
    const matchQ = !q || [m.nom, m.reference, m.type, m.notes].some(v => (v || '').toLowerCase().includes(q));
    const matchT = !type || m.type === type;
    const matchS = !statut || m.statut === statut;
    return matchQ && matchT && matchS;
  });
  renderMaterielTable(list);
}

function openMaterielDialog(prefill = null) {
  document.getElementById('modal-materiel-title').textContent = prefill ? 'Modifier l\'investissement' : 'Ajouter un investissement';
  document.getElementById('mat-form-id').value = prefill?.id || '';
  document.getElementById('mat-nom').value = prefill?.nom || '';
  document.getElementById('mat-reference').value = prefill?.reference || '';

  const typeSel = document.getElementById('mat-type');
  typeSel.innerHTML = TYPES_MATERIEL.map(t => `<option value="${t}"${prefill?.type === t ? ' selected' : ''}>${t}</option>`).join('');

  document.getElementById('mat-date-achat').value = prefill?.date_achat || today();
  document.getElementById('mat-cout').value = prefill?.cout || 0;
  document.getElementById('mat-duree-amort').value = prefill?.duree_amortissement || 5;

  const statutSel = document.getElementById('mat-statut');
  statutSel.innerHTML = STATUTS_MATERIEL.map(s => `<option value="${s}"${prefill?.statut === s ? ' selected' : ''}>${s}</option>`).join('');

  // Combo attribué à
  const persSel = document.getElementById('mat-personnel');
  persSel.innerHTML = '<option value="">— Non attribué —</option>' +
    _actifs.personnel.map(p => `<option value="${esc(p.id)}"${prefill?.personnel_id === p.id ? ' selected' : ''}>${esc(p.nom)} ${esc(p.prenom)}</option>`).join('');

  document.getElementById('mat-notes').value = prefill?.notes || '';
  document.getElementById('modal-materiel').classList.remove('hidden');
  document.getElementById('mat-nom').focus();
}

function editMateriel(id) {
  const m = _actifs.materiel.find(x => x.id === id);
  if (m) openMaterielDialog(m);
}

function saveMateriel() {
  const id = document.getElementById('mat-form-id').value;
  const nom = document.getElementById('mat-nom').value.trim();
  if (!nom) { showToast('Nom de l\'investissement requis.', 'error'); return; }

  const personnelId = document.getElementById('mat-personnel').value;
  const personnel = _actifs.personnel.find(p => p.id === personnelId);

  const obj = {
    id: id || uuid(),
    nom,
    reference: document.getElementById('mat-reference').value.trim(),
    type: document.getElementById('mat-type').value,
    date_achat: document.getElementById('mat-date-achat').value,
    cout: parseFloat(document.getElementById('mat-cout').value) || 0,
    duree_amortissement: parseInt(document.getElementById('mat-duree-amort').value) || 5,
    statut: document.getElementById('mat-statut').value,
    personnel_id: personnelId || null,
    personnel_nom: personnel ? `${personnel.nom} ${personnel.prenom}` : '',
    notes: document.getElementById('mat-notes').value.trim(),
  };

  if (id) {
    const idx = _actifs.materiel.findIndex(m => m.id === id);
    if (idx >= 0) _actifs.materiel[idx] = obj;
  } else {
    _actifs.materiel.push(obj);
  }
  _saveActifs();
  closeModal('modal-materiel');
  renderMaterielTable();
  renderSortirTable();
  updatePPI();
  showToast(id ? 'Investissement modifié.' : 'Investissement ajouté.', 'success');
}

function deleteMateriel(id) {
  const m = _actifs.materiel.find(x => x.id === id);
  if (!m || !confirmAction(`Supprimer "${m.nom}" ?`)) return;
  _actifs.materiel = _actifs.materiel.filter(x => x.id !== id);
  _saveActifs();
  renderMaterielTable();
  renderSortirTable();
  updatePPI();
  showToast('Investissement supprimé.', 'success');
}

function htToTTCMat() {
  const input = document.getElementById('mat-cout');
  const ht = parseFloat(input.value) || 0;
  if (ht > 0) {
    input.value = Math.round(ht * 1.20);
    showToast(`Converti : ${formatEUR(ht)} HT → ${formatEUR(Math.round(ht * 1.20))} TTC`, 'info');
  }
}

/* ══════════════════════════════════════════════════════════
   ONGLET MATÉRIEL À SORTIR
══════════════════════════════════════════════════════════ */
function renderSortirTable() {
  const tbody = document.getElementById('sortir-tbody');
  if (!tbody) return;

  const sortir = _actifs.materiel.filter(m => {
    const a = calcAmortissement(m);
    return a.valeurNette <= 0 || m.statut === 'Hors service' || m.statut === 'En panne';
  });

  if (sortir.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun matériel à sortir du bilan.</td></tr>';
    return;
  }

  tbody.innerHTML = sortir.map(m => {
    const a = calcAmortissement(m);
    const motif = a.valeurNette <= 0 ? 'Amorti' : m.statut === 'Hors service' ? 'Hors service' : 'Défaillant';
    const motifCls = motif === 'Amorti' ? 'badge-gray' : 'badge-red';
    return `<tr>
      <td><strong>${esc(m.nom)}</strong></td>
      <td>${esc(m.reference || '—')}</td>
      <td><span class="badge badge-blue">${esc(m.type || '—')}</span></td>
      <td style="text-align:right">${formatEUR(m.cout || 0)}</td>
      <td style="text-align:right">${formatEUR(a.valeurNette)}</td>
      <td>${esc(m.personnel_nom || '—')}</td>
      <td><span class="badge ${motifCls}">${motif}</span></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   ONGLET PPI (Plan Pluriannuel d'Investissement)
══════════════════════════════════════════════════════════ */
let _ppiChart = null;

function updatePPI() {
  const yearStart = parseInt(document.getElementById('ppi-year')?.value) || new Date().getFullYear();
  const period = document.querySelector('input[name="ppi-period"]:checked')?.value === '5' ? 5 : 10;

  // Calculer les renouvellements par année
  const byYear = {};
  let total = 0;
  let count = 0;

  _actifs.materiel.forEach(m => {
    const a = calcAmortissement(m);
    if (a.dateFin === '—') return;
    const finYear = parseInt(a.dateFin.slice(0, 4));
    if (finYear >= yearStart && finYear < yearStart + period) {
      if (!byYear[finYear]) byYear[finYear] = 0;
      byYear[finYear] += m.cout || 0;
      total += m.cout || 0;
      count++;
    }
  });

  // Remplir toutes les années de la période
  const labels = [];
  const data = [];
  for (let y = yearStart; y < yearStart + period; y++) {
    labels.push(String(y));
    data.push(byYear[y] || 0);
  }

  // KPIs
  const maxYear = Object.keys(byYear).length > 0
    ? Object.entries(byYear).sort((a, b) => b[1] - a[1])[0]
    : null;

  const el = (id) => document.getElementById(id);
  if (el('ppi-kpi-total')) el('ppi-kpi-total').querySelector('.kpi-value').textContent = formatEUR(total);
  if (el('ppi-kpi-count')) el('ppi-kpi-count').querySelector('.kpi-value').textContent = count;
  if (el('ppi-kpi-avg'))   el('ppi-kpi-avg').querySelector('.kpi-value').textContent = formatEUR(Math.round(total / (period || 1)));
  if (el('ppi-kpi-max'))   el('ppi-kpi-max').querySelector('.kpi-value').textContent = maxYear ? `${maxYear[0]}` : '—';
  if (el('ppi-kpi-max'))   el('ppi-kpi-max').querySelector('.kpi-sub').textContent = maxYear ? formatEUR(maxYear[1]) : '';

  // Graphique
  const ctx = document.getElementById('chart-ppi')?.getContext('2d');
  if (!ctx) return;

  const palette = ['#1565C0','#C62828','#2E7D32','#E65100','#6A1B9A',
    '#00838F','#AD1457','#F9A825','#37474F','#558B2F'];

  if (_ppiChart) _ppiChart.destroy();
  _ppiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Renouvellement prévu (€)',
        data,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatEUR(ctx.parsed.y)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => formatEUR(v) } },
        x: { ticks: { font: { size: 12, weight: 'bold' } } }
      }
    }
  });

  // Tableau détail PPI
  const ppiTbody = document.getElementById('ppi-detail-tbody');
  if (ppiTbody) {
    const details = _actifs.materiel
      .map(m => ({ ...m, amort: calcAmortissement(m) }))
      .filter(m => {
        if (m.amort.dateFin === '—') return false;
        const fy = parseInt(m.amort.dateFin.slice(0, 4));
        return fy >= yearStart && fy < yearStart + period;
      })
      .sort((a, b) => a.amort.dateFin.localeCompare(b.amort.dateFin));

    if (details.length === 0) {
      ppiTbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucun renouvellement prévu sur cette période.</td></tr>';
    } else {
      ppiTbody.innerHTML = details.map(m => `<tr>
        <td>${esc(m.nom)}</td>
        <td><span class="badge badge-blue">${esc(m.type || '—')}</span></td>
        <td>${formatDateFR(m.date_achat)}</td>
        <td style="text-align:right;font-weight:600">${formatEUR(m.cout || 0)}</td>
        <td>${m.duree_amortissement || 5} ans</td>
        <td><span class="badge badge-orange">${formatDateFR(m.amort.dateFin)}</span></td>
      </tr>`).join('');
    }
  }
}

/* ── Export CSV matériel ─────────────────────────────────── */
function exportActifsMateriel() {
  const rows = _actifs.materiel.map(m => {
    const a = calcAmortissement(m);
    return [m.nom, m.reference, m.type, m.date_achat, m.cout, m.personnel_nom, m.duree_amortissement, a.valeurNette, m.statut, m.notes];
  });
  exportCSV(rows,
    ['nom', 'reference', 'type', 'date_achat', 'cout', 'attribue_a', 'duree_amort', 'valeur_nette', 'statut', 'notes'],
    `investissements_${today()}.csv`
  );
  showToast('Export CSV téléchargé.', 'success');
}

/* ── Données démo ───────────────────────────────────────── */
function loadActifsDemoData(etab) {
  const data = {
    personnel: [
      { id: uuid(), nom: 'Martin', prenom: 'Sophie', type_contrat: 'CDI', poste: 'Infirmière', lieu: 'Service A', date_arrivee: '2020-03-15', date_depart: '' },
      { id: uuid(), nom: 'Dubois', prenom: 'Pierre', type_contrat: 'CDI', poste: 'Éducateur', lieu: 'Service B', date_arrivee: '2019-09-01', date_depart: '' },
      { id: uuid(), nom: 'Bernard', prenom: 'Julie', type_contrat: 'CDD', poste: 'Aide-soignante', lieu: 'Service A', date_arrivee: '2024-01-10', date_depart: '2026-01-09' },
      { id: uuid(), nom: 'Leroy', prenom: 'Thomas', type_contrat: 'CDI', poste: 'Technicien', lieu: 'Maintenance', date_arrivee: '2021-06-01', date_depart: '' },
    ],
    unites: [
      { id: uuid(), nom: 'Service A — Hébergement', description: 'Unité d\'hébergement principal', emplacement: 'Bâtiment A - RDC' },
      { id: uuid(), nom: 'Service B — Accueil de jour', description: 'Accueil de jour', emplacement: 'Bâtiment B - 1er étage' },
      { id: uuid(), nom: 'Administration', description: 'Bureaux administratifs', emplacement: 'Bâtiment A - 2e étage' },
      { id: uuid(), nom: 'Maintenance', description: 'Atelier et stockage matériel', emplacement: 'Bâtiment C' },
    ],
    materiel: [
      { id: uuid(), nom: 'Ordinateur portable Dell Latitude', reference: 'INV-2021-001', type: 'Informatique', date_achat: '2021-03-15', cout: 1200, duree_amortissement: 3, statut: 'Disponible', personnel_id: '', personnel_nom: 'Martin Sophie', notes: '' },
      { id: uuid(), nom: 'Imprimante multifonction Canon', reference: 'INV-2022-002', type: 'Informatique', date_achat: '2022-06-10', cout: 650, duree_amortissement: 5, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Administration' },
      { id: uuid(), nom: 'Lit médicalisé électrique', reference: 'INV-2020-003', type: 'Médical', date_achat: '2020-01-20', cout: 3500, duree_amortissement: 10, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Service A chambre 12' },
      { id: uuid(), nom: 'Fauteuil roulant', reference: 'INV-2019-004', type: 'Médical', date_achat: '2019-11-05', cout: 800, duree_amortissement: 5, statut: 'Amorti', personnel_id: '', personnel_nom: '', notes: '' },
      { id: uuid(), nom: 'Climatiseur Daikin', reference: 'INV-2023-005', type: 'Climatisation', date_achat: '2023-07-01', cout: 2800, duree_amortissement: 8, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Salle de réunion' },
      { id: uuid(), nom: 'Véhicule Renault Kangoo', reference: 'INV-2022-006', type: 'Véhicule', date_achat: '2022-01-15', cout: 18000, duree_amortissement: 5, statut: 'Disponible', personnel_id: '', personnel_nom: 'Leroy Thomas', notes: 'Transport résidents' },
      { id: uuid(), nom: 'Lave-linge professionnel', reference: 'INV-2021-007', type: 'Electroménager', date_achat: '2021-09-20', cout: 4500, duree_amortissement: 7, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Buanderie' },
      { id: uuid(), nom: 'Serveur NAS Synology', reference: 'INV-2023-008', type: 'Informatique', date_achat: '2023-02-01', cout: 1800, duree_amortissement: 5, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Salle serveur' },
      { id: uuid(), nom: 'Caméra de surveillance (lot 4)', reference: 'INV-2024-009', type: 'Sécurité', date_achat: '2024-05-15', cout: 2200, duree_amortissement: 5, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: 'Entrée + parking' },
      { id: uuid(), nom: 'Mobilier bureau direction', reference: 'INV-2020-010', type: 'Mobilier', date_achat: '2020-02-01', cout: 3200, duree_amortissement: 10, statut: 'Disponible', personnel_id: '', personnel_nom: '', notes: '' },
    ]
  };
  saveActifsData(etab, data);
}
