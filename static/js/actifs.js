/**
 * actifs.js — Module Actifs & Investissements (API)
 * 5 onglets : Personnel, Unites, Investissement, Materiel a Sortir, PPI
 */

/* ── Etat local ────────────────────────────────────── */
let _actifs = { personnel: [], unites: [], materiel: [] };

const TYPES_MATERIEL = [
  'Audiovisuel', 'Climatisation', 'Electromenager', 'Equipement',
  'Informatique', 'Medical', 'Mobilier', 'Outillage',
  'Securite', 'Telephonie', 'Travaux', 'Vehicule', 'Autre'
];
const STATUTS_MATERIEL = ['Disponible', 'En panne', 'Amorti', 'En maintenance', 'Hors service'];
const TYPES_CONTRAT = ['CDI', 'CDD', 'Interim', 'Stage', 'Apprentissage', 'Vacation', 'Autre'];

/* ── Init ───────────────────────────────────────────── */
async function initActifs() {
  try {
    const [pers, unites, mats] = await Promise.all([
      getPersonnelAPI(), getUnitesAPI(), getMaterielsAPI()
    ]);
    _actifs.personnel = pers;
    _actifs.unites = unites;
    _actifs.materiel = mats;
  } catch (e) {
    _actifs = { personnel: [], unites: [], materiel: [] };
    console.error('Erreur chargement actifs:', e);
  }
  renderPersonnelTable();
  renderUnitesTable();
  renderMaterielTable();
  renderSortirTable();
  updatePPI();
}

/* ══════════════════════════════════════════════════════
   PERSONNEL
══════════════════════════════════════════════════════ */
function renderPersonnelTable(filtered) {
  const list = filtered ?? _actifs.personnel;
  const tbody = document.getElementById('personnel-tbody');
  if (!tbody) return;
  document.getElementById('personnel-count').textContent = `${list.length} personne${list.length > 1 ? 's' : ''}`;
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">Aucun personnel — gérez le dans ⚙️ Paramètres.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((p, i) => `<tr>
    <td>${i + 1}</td>
    <td><strong>${esc(p.nom)}</strong></td>
    <td>${esc(p.prenom)}</td>
    <td><span class="badge badge-blue">${esc(p.type_contrat || '—')}</span></td>
    <td>${esc(p.poste || '—')}</td>
    <td>${esc(p.service || '—')}</td>
    <td>${esc(p.telephone || '—')}</td>
    <td>${esc(p.date_arrivee || '—')}</td>
    <td>${esc(p.date_depart || '—')}</td>
    <td><div class="row-actions">
      <button class="btn-sm btn-sm-blue" onclick="editPersonnel(${p.id})" title="Modifier">✏️</button>
      <button class="btn-sm btn-sm-red" onclick="deletePersonnel(${p.id})" title="Supprimer">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function filterPersonnel() {
  const q = (document.getElementById('personnel-search')?.value || '').toLowerCase();
  const list = _actifs.personnel.filter(p =>
    !q || [p.nom, p.prenom, p.poste, p.service, p.type_contrat].some(v => (v || '').toLowerCase().includes(q))
  );
  renderPersonnelTable(list);
}

function openPersonnelDialog(prefill = null) {
  document.getElementById('modal-personnel-title').textContent = prefill ? 'Modifier' : 'Ajouter du personnel';
  document.getElementById('pers-form-id').value = prefill?.id || '';
  document.getElementById('pers-nom').value = prefill?.nom || '';
  document.getElementById('pers-prenom').value = prefill?.prenom || '';
  const contratSel = document.getElementById('pers-type-contrat');
  contratSel.innerHTML = TYPES_CONTRAT.map(t => `<option value="${t}"${prefill?.type_contrat === t ? ' selected' : ''}>${t}</option>`).join('');
  document.getElementById('pers-poste').value = prefill?.poste || '';
  document.getElementById('pers-service').value = prefill?.service || '';
  document.getElementById('pers-telephone').value = prefill?.telephone || '';
  document.getElementById('pers-date-arrivee').value = prefill?.date_arrivee || '';
  document.getElementById('pers-date-depart').value = prefill?.date_depart || '';
  document.getElementById('modal-personnel').classList.remove('hidden');
}

function editPersonnel(id) {
  const p = _actifs.personnel.find(x => x.id === id);
  if (p) openPersonnelDialog(p);
}

async function savePersonnel() {
  const id = document.getElementById('pers-form-id').value;
  const nom = document.getElementById('pers-nom').value.trim();
  const prenom = document.getElementById('pers-prenom').value.trim();
  if (!nom || !prenom) { showToast('Nom et prenom requis.', 'error'); return; }
  const obj = {
    nom, prenom,
    type_contrat: document.getElementById('pers-type-contrat').value,
    poste:     document.getElementById('pers-poste').value.trim(),
    service:   document.getElementById('pers-service').value.trim(),
    telephone: document.getElementById('pers-telephone').value.trim(),
    date_arrivee: document.getElementById('pers-date-arrivee').value,
    date_depart:  document.getElementById('pers-date-depart').value,
  };
  if (id) obj.id = parseInt(id);
  try {
    await savePersonnelAPI(obj);
    closeModal('modal-personnel');
    await initActifs();
    showToast(id ? 'Personnel modifie.' : 'Personnel ajoute.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deletePersonnel(id) {
  const p = _actifs.personnel.find(x => x.id === id);
  if (!p || !confirmAction(`Supprimer ${p.nom} ${p.prenom} ?`)) return;
  try {
    await deletePersonnelAPI(id);
    await initActifs();
    showToast('Personnel supprime.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════
   UNITES
══════════════════════════════════════════════════════ */
function renderUnitesTable(filtered) {
  const list = filtered ?? _actifs.unites;
  const tbody = document.getElementById('unites-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aucune unite.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `<tr>
    <td><strong>${esc(u.nom)}</strong></td>
    <td>${esc(u.description || '—')}</td>
    <td>${esc(u.emplacement || '—')}</td>
    <td><div class="row-actions">
      <button class="btn-sm btn-sm-blue" onclick="editUnite(${u.id})" title="Modifier">✏️</button>
      <button class="btn-sm btn-sm-red" onclick="deleteUnite(${u.id})" title="Supprimer">🗑️</button>
    </div></td>
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
  document.getElementById('modal-unite-title').textContent = prefill ? 'Modifier' : 'Ajouter une unite';
  document.getElementById('unite-form-id').value = prefill?.id || '';
  document.getElementById('unite-nom').value = prefill?.nom || '';
  document.getElementById('unite-description').value = prefill?.description || '';
  document.getElementById('unite-emplacement').value = prefill?.emplacement || '';
  document.getElementById('modal-unite').classList.remove('hidden');
}

function editUnite(id) {
  const u = _actifs.unites.find(x => x.id === id);
  if (u) openUniteDialog(u);
}

async function saveUnite() {
  const id = document.getElementById('unite-form-id').value;
  const nom = document.getElementById('unite-nom').value.trim();
  if (!nom) { showToast('Nom requis.', 'error'); return; }
  const obj = {
    nom,
    description: document.getElementById('unite-description').value.trim(),
    emplacement: document.getElementById('unite-emplacement').value.trim(),
  };
  if (id) obj.id = parseInt(id);
  try {
    await saveUniteAPI(obj);
    closeModal('modal-unite');
    await initActifs();
    showToast(id ? 'Unite modifiee.' : 'Unite ajoutee.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUnite(id) {
  const u = _actifs.unites.find(x => x.id === id);
  if (!u || !confirmAction(`Supprimer "${u.nom}" ?`)) return;
  try {
    await deleteUniteAPI(id);
    await initActifs();
    showToast('Unite supprimee.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════
   INVESTISSEMENT (MATERIEL)
══════════════════════════════════════════════════════ */
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
  return { annuel: Math.round(annuel), cumule: Math.round(cumule), valeurNette: Math.round(valeurNette), dateFin: dateFin.toISOString().slice(0, 10), pctAmorti };
}

function renderMaterielTable(filtered) {
  const list = filtered ?? _actifs.materiel;
  const tbody = document.getElementById('materiel-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Aucun investissement.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(m => {
    const a = calcAmortissement(m);
    const statutCls = m.statut === 'Disponible' ? 'badge-green' : m.statut === 'En panne' ? 'badge-red' : m.statut === 'Amorti' ? 'badge-gray' : m.statut === 'En maintenance' ? 'badge-orange' : 'badge-red';
    const fillCls = a.pctAmorti >= 100 ? 'danger' : a.pctAmorti >= 75 ? 'warning' : '';
    return `<tr>
      <td><strong>${esc(m.nom)}</strong></td>
      <td class="mat-col-extra">${esc(m.reference || '—')}</td>
      <td><span class="badge badge-blue">${esc(m.type_materiel || '—')}</span></td>
      <td class="mat-col-extra">${formatDateFR(m.date_achat)}</td>
      <td style="text-align:right;font-weight:600">${formatEUR(m.cout || 0)}</td>
      <td>${esc(m.attribue_a || '—')}</td>
      <td><div class="progress-bar-wrap"><div class="progress-bar"><div class="progress-bar-fill ${fillCls}" style="width:${a.pctAmorti}%"></div></div><span class="progress-pct">${a.pctAmorti}%</span></div></td>
      <td style="text-align:right">${formatEUR(a.valeurNette)}</td>
      <td><span class="badge ${statutCls}">${esc(m.statut || 'Disponible')}</span></td>
      <td><div class="row-actions">
        <button class="btn-sm btn-sm-blue" onclick="editMateriel(${m.id})" title="Modifier">✏️</button>
        <button class="btn-sm btn-sm-red" onclick="deleteMateriel(${m.id})" title="Supprimer">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function filterMateriel() {
  const q = (document.getElementById('materiel-search')?.value || '').toLowerCase();
  const type = document.getElementById('materiel-type-filter')?.value || '';
  const statut = document.getElementById('materiel-statut-filter')?.value || '';
  const list = _actifs.materiel.filter(m => {
    const matchQ = !q || [m.nom, m.reference, m.type_materiel, m.notes].some(v => (v || '').toLowerCase().includes(q));
    const matchT = !type || m.type_materiel === type;
    const matchS = !statut || m.statut === statut;
    return matchQ && matchT && matchS;
  });
  renderMaterielTable(list);
}

function openMaterielDialog(prefill = null) {
  document.getElementById('modal-materiel-title').textContent = prefill ? 'Modifier' : 'Ajouter un investissement';
  document.getElementById('mat-form-id').value = prefill?.id || '';
  document.getElementById('mat-nom').value = prefill?.nom || '';
  document.getElementById('mat-reference').value = prefill?.reference || '';
  document.getElementById('mat-type').innerHTML = TYPES_MATERIEL.map(t => `<option value="${t}"${prefill?.type_materiel === t ? ' selected' : ''}>${t}</option>`).join('');
  document.getElementById('mat-date-achat').value = prefill?.date_achat || today();
  document.getElementById('mat-cout').value = prefill?.cout || 0;
  document.getElementById('mat-duree-amort').value = prefill?.duree_amortissement || 5;
  document.getElementById('mat-statut').innerHTML = STATUTS_MATERIEL.map(s => `<option value="${s}"${prefill?.statut === s ? ' selected' : ''}>${s}</option>`).join('');
  const persSel = document.getElementById('mat-personnel');
  const curVal = prefill?.attribue_a || '';
  persSel.innerHTML = '<option value="">— Non attribué —</option>' +
    '<optgroup label="👤 Personnel">' +
    _actifs.personnel.map(p => { const v = `${p.nom} ${p.prenom}`; return `<option value="${esc(v)}"${curVal === v ? ' selected' : ''}>${esc(v)}</option>`; }).join('') +
    '</optgroup>' +
    '<optgroup label="📍 Lieux">' +
    _actifs.unites.map(u => `<option value="${esc(u.nom)}"${curVal === u.nom ? ' selected' : ''}>${esc(u.nom)}</option>`).join('') +
    '</optgroup>';
  document.getElementById('mat-notes').value = prefill?.notes || '';
  document.getElementById('modal-materiel').classList.remove('hidden');
}

function editMateriel(id) {
  const m = _actifs.materiel.find(x => x.id === id);
  if (m) openMaterielDialog(m);
}

async function saveMateriel() {
  const id = document.getElementById('mat-form-id').value;
  const nom = document.getElementById('mat-nom').value.trim();
  if (!nom) { showToast('Nom requis.', 'error'); return; }
  const obj = {
    nom,
    reference: document.getElementById('mat-reference').value.trim(),
    type_materiel: document.getElementById('mat-type').value,
    date_achat: document.getElementById('mat-date-achat').value,
    cout: parseFloat(document.getElementById('mat-cout').value) || 0,
    duree_amortissement: parseInt(document.getElementById('mat-duree-amort').value) || 5,
    statut: document.getElementById('mat-statut').value,
    attribue_a: document.getElementById('mat-personnel').value,
    notes: document.getElementById('mat-notes').value.trim(),
  };
  if (id) obj.id = parseInt(id);
  try {
    await saveMaterielAPI(obj);
    closeModal('modal-materiel');
    await initActifs();
    showToast(id ? 'Modifie.' : 'Ajoute.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteMateriel(id) {
  const m = _actifs.materiel.find(x => x.id === id);
  if (!m || !confirmAction(`Supprimer "${m.nom}" ?`)) return;
  try {
    await deleteMaterielAPI(id);
    await initActifs();
    showToast('Supprime.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

function htToTTCMat() {
  const input = document.getElementById('mat-cout');
  const ht = parseFloat(input.value) || 0;
  if (ht > 0) { input.value = Math.round(ht * 1.20); showToast(`HT → TTC: ${formatEUR(Math.round(ht * 1.20))}`, 'info'); }
}

/* ══════════════════════════════════════════════════════
   MATERIEL A SORTIR
══════════════════════════════════════════════════════ */
function renderSortirTable() {
  const tbody = document.getElementById('sortir-tbody');
  if (!tbody) return;
  const sortir = _actifs.materiel.filter(m => {
    const a = calcAmortissement(m);
    return a.valeurNette <= 0 || m.statut === 'Hors service' || m.statut === 'En panne';
  });
  if (sortir.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun materiel a sortir.</td></tr>';
    return;
  }
  tbody.innerHTML = sortir.map(m => {
    const a = calcAmortissement(m);
    const motif = a.valeurNette <= 0 ? 'Amorti' : m.statut === 'Hors service' ? 'Hors service' : 'Defaillant';
    const motifCls = motif === 'Amorti' ? 'badge-gray' : 'badge-red';
    return `<tr>
      <td><strong>${esc(m.nom)}</strong></td><td>${esc(m.reference || '—')}</td>
      <td><span class="badge badge-blue">${esc(m.type_materiel || '—')}</span></td>
      <td style="text-align:right">${formatEUR(m.cout || 0)}</td>
      <td style="text-align:right">${formatEUR(a.valeurNette)}</td>
      <td>${esc(m.attribue_a || '—')}</td>
      <td><span class="badge ${motifCls}">${motif}</span></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   PPI
══════════════════════════════════════════════════════ */
let _ppiChart = null;

function updatePPI() {
  const yearStart = parseInt(document.getElementById('ppi-year')?.value) || new Date().getFullYear();
  const period = document.querySelector('input[name="ppi-period"]:checked')?.value === '5' ? 5 : 10;
  const budget = parseInt(document.getElementById('ppi-budget')?.value) || 0;

  const byYearPPI = {}, byYearNew = {};
  let total = 0, count = 0;
  _actifs.materiel.forEach(m => {
    const a = calcAmortissement(m);
    if (a.dateFin !== '—') {
      const fy = parseInt(a.dateFin.slice(0, 4));
      if (fy >= yearStart && fy < yearStart + period) {
        byYearPPI[fy] = (byYearPPI[fy] || 0) + (m.cout || 0);
        total += m.cout || 0;
        count++;
      }
    }
    if (m.date_achat) {
      const ay = parseInt(m.date_achat.slice(0, 4));
      if (ay >= yearStart && ay < yearStart + period) {
        byYearNew[ay] = (byYearNew[ay] || 0) + (m.cout || 0);
      }
    }
  });

  const labels = [], dataPPI = [], dataNew = [];
  for (let y = yearStart; y < yearStart + period; y++) {
    labels.push(String(y));
    dataPPI.push(byYearPPI[y] || 0);
    dataNew.push(byYearNew[y] || 0);
  }

  const maxYear = Object.keys(byYearPPI).length > 0 ? Object.entries(byYearPPI).sort((a, b) => b[1] - a[1])[0] : null;
  const el = id => document.getElementById(id);
  if (el('ppi-kpi-total')) el('ppi-kpi-total').querySelector('.kpi-value').textContent = formatEUR(total);
  if (el('ppi-kpi-count')) el('ppi-kpi-count').querySelector('.kpi-value').textContent = count;
  if (el('ppi-kpi-avg')) el('ppi-kpi-avg').querySelector('.kpi-value').textContent = formatEUR(Math.round(total / (period || 1)));
  if (el('ppi-kpi-max')) { el('ppi-kpi-max').querySelector('.kpi-value').textContent = maxYear ? maxYear[0] : '—'; el('ppi-kpi-max').querySelector('.kpi-sub').textContent = maxYear ? formatEUR(maxYear[1]) : ''; }

  const ctx = document.getElementById('chart-ppi')?.getContext('2d');
  if (!ctx) return;
  if (_ppiChart) _ppiChart.destroy();

  const datasets = [
    { label: 'Renouvellements (fin amort.)', data: dataPPI, backgroundColor: '#1565C0', borderRadius: 4, stack: 'ppi' },
    { label: 'Nouveaux achats',              data: dataNew, backgroundColor: '#2E7D32', borderRadius: 4, stack: 'ppi' }
  ];
  if (budget > 0) {
    datasets.push({ type: 'line', label: 'Budget annuel', data: labels.map(() => budget),
      borderColor: '#C62828', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false });
  }

  // Stocker les données par année pour le clic
  const _ppiByYear = {};
  for (let i = 0; i < labels.length; i++) {
    _ppiByYear[labels[i]] = { ppi: dataPPI[i], new: dataNew[i] };
  }

  _ppiChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label} : ${formatEUR(ctx.raw)}` } }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { callback: v => formatEUR(v) } }
      },
      onHover: (evt, elements) => { evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'; },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const annee = labels[elements[0].index];
        _showPPIYearDetail(annee);
      }
    }
  });

  const ppiTbody = document.getElementById('ppi-detail-tbody');
  if (ppiTbody) {
    const details = _actifs.materiel.map(m => ({ ...m, amort: calcAmortissement(m) }))
      .filter(m => { if (m.amort.dateFin === '—') return false; const fy = parseInt(m.amort.dateFin.slice(0, 4)); return fy >= yearStart && fy < yearStart + period; })
      .sort((a, b) => a.amort.dateFin.localeCompare(b.amort.dateFin));
    if (details.length === 0) {
      ppiTbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucun renouvellement prevu.</td></tr>';
    } else {
      ppiTbody.innerHTML = details.map(m => `<tr>
        <td>${esc(m.nom)}</td><td><span class="badge badge-blue">${esc(m.type_materiel || '—')}</span></td>
        <td>${formatDateFR(m.date_achat)}</td><td style="text-align:right;font-weight:600">${formatEUR(m.cout || 0)}</td>
        <td>${m.duree_amortissement || 5} ans</td><td><span class="badge badge-orange">${formatDateFR(m.amort.dateFin)}</span></td>
      </tr>`).join('');
    }
  }
}

function _showPPIYearDetail(annee) {
  const yearStart = parseInt(document.getElementById('ppi-year')?.value) || new Date().getFullYear();
  const period    = document.querySelector('input[name="ppi-period"]:checked')?.value === '5' ? 5 : 10;

  const renouvellements = _actifs.materiel
    .map(m => ({ ...m, amort: calcAmortissement(m) }))
    .filter(m => m.amort.dateFin !== '—' && m.amort.dateFin.slice(0,4) === String(annee))
    .sort((a, b) => a.amort.dateFin.localeCompare(b.amort.dateFin));

  const nouveaux = _actifs.materiel
    .filter(m => m.date_achat && m.date_achat.slice(0,4) === String(annee))
    .sort((a, b) => (a.date_achat||'').localeCompare(b.date_achat||''));

  const totalR = renouvellements.reduce((s, m) => s + (m.cout||0), 0);
  const totalN = nouveaux.reduce((s, m) => s + (m.cout||0), 0);
  const grand  = totalR + totalN;

  const rowsR = renouvellements.map((m, i) => `<tr style="background:${i%2===0?'#F5F9FF':'#fff'}">
    <td style="padding:6px 10px">${esc(m.nom)}</td>
    <td style="padding:6px 10px"><span class="badge badge-blue">${esc(m.type_materiel||'—')}</span></td>
    <td style="padding:6px 10px">${formatDateFR(m.date_achat)}</td>
    <td style="padding:6px 10px;text-align:right;font-weight:600">${formatEUR(m.cout||0)}</td>
    <td style="padding:6px 10px"><span class="badge badge-orange">${formatDateFR(m.amort.dateFin)}</span></td>
  </tr>`).join('');

  const rowsN = nouveaux.map((m, i) => `<tr style="background:${i%2===0?'#F5FFF5':'#fff'}">
    <td style="padding:6px 10px">${esc(m.nom)}</td>
    <td style="padding:6px 10px"><span class="badge badge-blue">${esc(m.type_materiel||'—')}</span></td>
    <td style="padding:6px 10px">${formatDateFR(m.date_achat)}</td>
    <td style="padding:6px 10px;text-align:right;font-weight:600">${formatEUR(m.cout||0)}</td>
    <td style="padding:6px 10px">—</td>
  </tr>`).join('');

  const emptyR = `<tr><td colspan="5" style="padding:12px;color:#bbb;text-align:center">Aucun renouvellement cette année</td></tr>`;
  const emptyN = `<tr><td colspan="5" style="padding:12px;color:#bbb;text-align:center">Aucun nouvel achat cette année</td></tr>`;

  const body = `
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:15px;font-weight:700;color:#1F4E78">📅 Investissements <b>${annee}</b></span>
      <span style="font-size:13px;color:#1565C0;font-weight:600">🔵 Renouvellements : ${formatEUR(totalR)}</span>
      <span style="font-size:13px;color:#2E7D32;font-weight:600">🟢 Nouveaux achats : ${formatEUR(totalN)}</span>
      <span style="font-size:13px;font-weight:700">💰 Total : ${formatEUR(grand)}</span>
    </div>
    <div style="font-weight:700;font-size:13px;color:#1565C0;padding:6px 10px;background:#E3F2FD;border-radius:4px;margin-bottom:4px">🔵 Renouvellements fin amortissement (${renouvellements.length})</div>
    <div style="overflow-x:auto;margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#1565C0;color:#fff">
          <th style="padding:7px 10px;text-align:left">Équipement</th><th style="padding:7px 10px;text-align:left">Type</th>
          <th style="padding:7px 10px;text-align:left">Date achat</th><th style="padding:7px 10px;text-align:right">Coût</th>
          <th style="padding:7px 10px;text-align:left">Fin amort.</th>
        </tr></thead>
        <tbody>${rowsR || emptyR}</tbody>
      </table>
    </div>
    <div style="font-weight:700;font-size:13px;color:#2E7D32;padding:6px 10px;background:#E8F5E9;border-radius:4px;margin-bottom:4px">🟢 Nouveaux achats (${nouveaux.length})</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#2E7D32;color:#fff">
          <th style="padding:7px 10px;text-align:left">Équipement</th><th style="padding:7px 10px;text-align:left">Type</th>
          <th style="padding:7px 10px;text-align:left">Date achat</th><th style="padding:7px 10px;text-align:right">Coût</th>
          <th style="padding:7px 10px;text-align:left">Fin amort.</th>
        </tr></thead>
        <tbody>${rowsN || emptyN}</tbody>
      </table>
    </div>`;

  // Réutiliser la modale générique si disponible, sinon créer une alerte
  const modal = document.getElementById('modal-ppi-detail');
  if (modal) {
    document.getElementById('modal-ppi-body').innerHTML = body;
    modal.classList.remove('hidden');
  } else {
    // Afficher dans un div sous le graphe
    let panel = document.getElementById('ppi-year-detail-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ppi-year-detail-panel';
      panel.style.cssText = 'background:#fff;border:1px solid #E0E0E0;border-radius:8px;padding:16px;margin-top:12px;';
      const chartBox = document.getElementById('chart-ppi')?.closest('.chart-box');
      if (chartBox) chartBox.parentNode.insertBefore(panel, chartBox.nextSibling);
    }
    panel.style.display = 'block';
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span></span><button onclick="document.getElementById('ppi-year-detail-panel').style.display='none'" style="border:none;background:#EEE;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px">✕ Fermer</button>
    </div>${body}`;
  }
}

/* ── Export ─────────────────────────────────────────── */
function exportActifsMateriel() {
  const rows = _actifs.materiel.map(m => {
    const a = calcAmortissement(m);
    return [m.nom, m.reference, m.type_materiel, m.date_achat, m.cout, m.attribue_a, m.duree_amortissement, a.valeurNette, m.statut, m.notes];
  });
  exportCSV(rows, ['nom', 'reference', 'type', 'date_achat', 'cout', 'attribue_a', 'duree_amort', 'valeur_nette', 'statut', 'notes'], `investissements_${today()}.csv`);
  showToast('Export CSV telecharge.', 'success');
}
