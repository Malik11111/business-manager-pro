/**
 * prestataires.js — Module Prestataires (API)
 */

let _presta = [];
let _sortCol = null;
let _sortDir = 1;
let _currentPrestaId = null;

/* ── Init ──────────────────────────────────────────── */
async function initPrestataires() {
  try {
    _presta = await getPrestatairesAPI();
  } catch (e) {
    _presta = [];
    console.error('Erreur chargement prestataires:', e);
  }
  renderTable();
  refreshServiceFilter();
  updateStats();
  renderCharts();
}

/* ── Rendu table ───────────────────────────────────── */
function renderTable(filtered) {
  const list = filtered ?? _presta;
  const tbody = document.getElementById('presta-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Aucun prestataire trouve.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => {
    const days = daysRemaining(p.date_fin);
    const status = contractStatus(p.date_fin);
    const pct = contractProgress(p.date_debut, p.date_fin);
    const fillCls = pct > 90 ? 'danger' : pct > 70 ? 'warning' : '';
    const avg = avgNote(p.evaluations);
    const avgStr = avg !== null ? renderStars(Math.round(avg)) : '<span style="color:#bbb">—</span>';
    const daysStr = days !== null ? (days < 0 ? `<span style="color:#C62828;font-weight:700">${days}j</span>` : `${days}j`) : '—';

    return `<tr data-id="${p.id}">
      <td><strong>${esc(p.nom)}</strong></td>
      <td><span class="badge badge-blue">${esc(p.service)}</span></td>
      <td>${formatEUR(p.montant)}</td>
      <td>${formatDateFR(p.date_fin)}</td>
      <td style="text-align:center">${daysStr}</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar"><div class="progress-bar-fill ${fillCls}" style="width:${pct}%"></div></div>
          <span class="progress-pct">${pct}%</span>
        </div>
      </td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td class="presta-col-extra">${esc(p.frequence || '—')}</td>
      <td class="presta-col-extra">${avgStr}</td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue" onclick="editPrestataire(${p.id})" title="Modifier">✏️</button>
          <button class="btn-sm btn-sm-orange" onclick="openEvaluations(${p.id})" title="Evaluations">⭐</button>
          <button class="btn-sm btn-sm-green" onclick="renouvelerContrat(${p.id})" title="Renouveler">🔄</button>
          <button class="btn-sm btn-sm-red" onclick="deletePrestataire(${p.id})" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Filtres ────────────────────────────────────────── */
function applyFilters() {
  const q = (document.getElementById('presta-search')?.value || '').toLowerCase();
  const service = document.getElementById('presta-service-filter')?.value || '';

  let list = _presta.filter(p => {
    const matchQ = !q || [p.nom, p.service, p.contact, p.email, p.notes, p.prestations]
      .some(v => (v || '').toLowerCase().includes(q));
    const matchS = !service || p.service === service;
    return matchQ && matchS;
  });

  if (_sortCol !== null) {
    list = [...list].sort((a, b) => {
      const va = sortVal(a, _sortCol);
      const vb = sortVal(b, _sortCol);
      if (va < vb) return -_sortDir;
      if (va > vb) return _sortDir;
      return 0;
    });
  }
  renderTable(list);
}

function sortVal(p, col) {
  switch (col) {
    case 0: return (p.nom || '').toLowerCase();
    case 1: return (p.service || '').toLowerCase();
    case 2: return p.montant || 0;
    case 3: return p.date_fin || '';
    case 4: return daysRemaining(p.date_fin) ?? 99999;
    case 5: return contractProgress(p.date_debut, p.date_fin);
    default: return '';
  }
}

function setSortCol(col) {
  if (_sortCol === col) _sortDir *= -1;
  else { _sortCol = col; _sortDir = 1; }
  document.querySelectorAll('#presta-table thead th').forEach((th, i) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (i === col) th.classList.add(_sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
  });
  applyFilters();
}

function refreshServiceFilter() {
  const sel = document.getElementById('presta-service-filter');
  if (!sel) return;
  const current = sel.value;
  const used = [...new Set(_presta.map(p => p.service))].filter(Boolean).sort();
  const extra = used.filter(s => !SERVICES.includes(s));
  const all = ['Tous les services', ...SERVICES, ...extra];
  sel.innerHTML = all.map(s => {
    const val = s === 'Tous les services' ? '' : s;
    return `<option value="${esc(val)}"${val === current ? ' selected' : ''}>${esc(s)}</option>`;
  }).join('');
}

/* ── Dialog Ajouter / Modifier ─────────────────────── */
function openAddDialog(prefill = null) {
  document.getElementById('modal-presta-title').textContent = prefill?.id ? 'Modifier le prestataire' : 'Ajouter un prestataire';
  document.getElementById('presta-form-id').value = prefill?.id || '';
  document.getElementById('presta-nom').value = prefill?.nom || '';

  const svcSel = document.getElementById('presta-service');
  svcSel.innerHTML = SERVICES.map(s => `<option value="${esc(s)}"${prefill?.service === s ? ' selected' : ''}>${esc(s)}</option>`).join('');

  document.getElementById('presta-contact').value = prefill?.contact || '';
  document.getElementById('presta-email').value = prefill?.email || '';
  document.getElementById('presta-telephone').value = prefill?.telephone || '';
  document.getElementById('presta-date-debut').value = prefill?.date_debut || today();
  document.getElementById('presta-date-fin').value = prefill?.date_fin || addYears(today(), 1);
  document.getElementById('presta-montant').value = prefill?.montant || 0;

  const frqSel = document.getElementById('presta-frequence');
  frqSel.innerHTML = FREQUENCES.map(f => `<option value="${esc(f)}"${prefill?.frequence === f ? ' selected' : ''}>${esc(f) || '—'}</option>`).join('');

  document.getElementById('presta-prestations').value = prefill?.prestations || '';
  document.getElementById('presta-notes').value = prefill?.notes || '';

  document.getElementById('modal-presta').classList.remove('hidden');
  document.getElementById('presta-nom').focus();
}

function editPrestataire(id) {
  const p = _presta.find(x => x.id === id);
  if (p) openAddDialog(p);
}

async function savePrestataire() {
  const id = document.getElementById('presta-form-id').value;
  const nom = document.getElementById('presta-nom').value.trim();
  if (!nom) { showToast('Le nom du prestataire est requis.', 'error'); return; }

  const obj = {
    nom,
    service: document.getElementById('presta-service').value,
    contact: document.getElementById('presta-contact').value.trim(),
    email: document.getElementById('presta-email').value.trim(),
    telephone: document.getElementById('presta-telephone').value.trim(),
    date_debut: document.getElementById('presta-date-debut').value,
    date_fin: document.getElementById('presta-date-fin').value,
    montant: parseInt(document.getElementById('presta-montant').value) || 0,
    frequence: document.getElementById('presta-frequence').value,
    prestations: document.getElementById('presta-prestations').value.trim(),
    notes: document.getElementById('presta-notes').value.trim(),
  };
  if (id) obj.id = parseInt(id);

  try {
    await savePrestaAPI(obj);
    closeModal('modal-presta');
    await initPrestataires();
    showToast(id ? 'Prestataire modifie.' : 'Prestataire ajoute.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deletePrestataire(id) {
  const p = _presta.find(x => x.id === id);
  if (!p) return;
  if (!confirmAction(`Supprimer "${p.nom}" ?`)) return;
  try {
    await deletePrestaAPI(id);
    await initPrestataires();
    showToast(`"${p.nom}" deplace en corbeille.`, 'info');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Renouvellement ────────────────────────────────── */
function renouvelerContrat(id) {
  const p = _presta.find(x => x.id === id);
  if (!p) return;
  document.getElementById('renouv-nom').textContent = p.nom;
  document.getElementById('renouv-presta-id').value = p.id;
  const finActuelle = new Date(p.date_fin + 'T00:00:00');
  finActuelle.setDate(finActuelle.getDate() + 1);
  const newDebut = finActuelle.toISOString().slice(0, 10);
  document.getElementById('renouv-date-debut').value = newDebut;
  document.getElementById('renouv-date-fin').value = addYears(newDebut, 1);
  document.getElementById('renouv-montant').value = p.montant;
  document.getElementById('renouv-notes').value = `Renouvellement. Periode precedente: ${formatDateFR(p.date_debut)} au ${formatDateFR(p.date_fin)}.`;
  document.getElementById('modal-renouv').classList.remove('hidden');
}

async function saveRenouvellement() {
  const id = parseInt(document.getElementById('renouv-presta-id').value);
  try {
    await savePrestaAPI({
      id,
      date_debut: document.getElementById('renouv-date-debut').value,
      date_fin: document.getElementById('renouv-date-fin').value,
      montant: parseInt(document.getElementById('renouv-montant').value) || 0,
      notes: document.getElementById('renouv-notes').value,
    });
    closeModal('modal-renouv');
    await initPrestataires();
    showToast('Contrat renouvele.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Evaluations ───────────────────────────────────── */
function openEvaluations(id) {
  _currentPrestaId = id;
  const p = _presta.find(x => x.id === id);
  if (!p) return;
  document.getElementById('eval-presta-nom').textContent = p.nom;
  renderEvalList(p.evaluations);
  document.getElementById('modal-evals').classList.remove('hidden');
}

function renderEvalList(evals) {
  const container = document.getElementById('eval-list');
  if (!evals || evals.length === 0) {
    container.innerHTML = '<p style="color:#bbb;text-align:center;padding:20px">Aucune evaluation.</p>';
    return;
  }
  container.innerHTML = [...evals].reverse().map(e => `
    <div class="eval-card">
      <div class="eval-header">
        <span>${renderStars(e.note)}</span>
        <span class="eval-date">${formatDateFR(e.date)}</span>
        <button class="btn-sm btn-sm-red" onclick="deleteEval(${e.id})">✕</button>
      </div>
      <div class="eval-comment">${esc(e.commentaire) || '<em style="color:#bbb">Sans commentaire</em>'}</div>
    </div>
  `).join('');
}

async function addEvaluation() {
  const date = document.getElementById('new-eval-date').value || today();
  const note = parseInt(document.getElementById('new-eval-note').value);
  const commentaire = document.getElementById('new-eval-comment').value.trim();
  try {
    await addEvaluationAPI(_currentPrestaId, { date, note, commentaire });
    await initPrestataires();
    const p = _presta.find(x => x.id === _currentPrestaId);
    if (p) renderEvalList(p.evaluations);
    document.getElementById('new-eval-date').value = today();
    document.getElementById('new-eval-note').value = '4';
    document.getElementById('new-eval-comment').value = '';
    showToast('Evaluation ajoutee.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteEval(evalId) {
  try {
    await deleteEvaluationAPI(evalId);
    await initPrestataires();
    const p = _presta.find(x => x.id === _currentPrestaId);
    if (p) renderEvalList(p.evaluations);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Corbeille ─────────────────────────────────────── */
async function showCorbeille() {
  const tbody = document.getElementById('corbeille-tbody');
  try {
    const corbeille = await getCorbeillePrestas();
    if (corbeille.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">La corbeille est vide.</td></tr>';
    } else {
      tbody.innerHTML = corbeille.map(p => `
        <tr>
          <td>${esc(p.nom)}</td>
          <td><span class="badge badge-blue">${esc(p.service)}</span></td>
          <td>${formatEUR(p.montant)}</td>
          <td>${p.deleted_at ? formatDateFR(p.deleted_at.slice(0,10)) : '—'}</td>
          <td><button class="btn-sm btn-sm-green" onclick="restorePrestataire(${p.id})">♻️ Restaurer</button></td>
        </tr>`).join('');
    }
  } catch (e) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Erreur chargement.</td></tr>';
  }
  document.getElementById('modal-corbeille').classList.remove('hidden');
}

async function restorePrestataire(corbeilleId) {
  try {
    await restorePrestaAPI(corbeilleId);
    await showCorbeille();
    await initPrestataires();
    showToast('Prestataire restaure.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Export ─────────────────────────────────────────── */
function exportPrestataires() {
  const rows = _presta.map(p => [
    p.nom, p.service, p.contact, p.email, p.telephone,
    p.date_debut, p.date_fin, p.montant, p.frequence, p.prestations, p.notes
  ]);
  exportCSV(rows,
    ['nom', 'service', 'contact', 'email', 'telephone', 'date_debut', 'date_fin', 'montant', 'frequence', 'prestations', 'notes'],
    `prestataires_${today()}.csv`
  );
  showToast('Export CSV telecharge.', 'success');
}

/* ── Statistiques ──────────────────────────────────── */
function updateStats() {
  const total = _presta.length;
  const totalBudget = _presta.reduce((s, p) => s + (p.montant || 0), 0);
  const expiring30 = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d >= 0 && d <= 30; }).length;
  const expired = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d < 0; }).length;
  const active = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d >= 0; }).length;

  setKpi('kpi-total', total, 'prestataires au total');
  setKpi('kpi-budget', formatEUR(totalBudget), 'budget annuel total');
  setKpi('kpi-actifs', active, 'contrats actifs');
  setKpi('kpi-expiring', expiring30, 'expirent dans 30 jours', expiring30 > 0 ? 'orange' : '');
  setKpi('kpi-expired', expired, 'contrats expires', expired > 0 ? 'red' : '');

  const byService = {};
  _presta.forEach(p => {
    if (!byService[p.service]) byService[p.service] = { count: 0, budget: 0 };
    byService[p.service].count++;
    byService[p.service].budget += p.montant || 0;
  });

  const avgEvalAll = _presta.filter(p => p.evaluations?.length).map(p => avgNote(p.evaluations));
  const globalAvg = avgEvalAll.length ? (avgEvalAll.reduce((a,b) => a+b, 0) / avgEvalAll.length).toFixed(1) : '—';

  const tbody = document.getElementById('stats-detail-tbody');
  if (!tbody) return;

  const rows = [
    ['Total prestataires', total, ''],
    ['Budget annuel total', formatEUR(totalBudget), `Moyenne : ${formatEUR(Math.round(totalBudget / (total || 1)))}`],
    ['Contrats actifs', active, `${Math.round(active / (total || 1) * 100)}%`],
    ['Contrats expires', expired, expired > 0 ? '⚠️ A renouveler' : 'Aucun'],
    ['Expiration 30j', expiring30, expiring30 > 0 ? '⚠️ Attention' : 'RAS'],
    ['Note moyenne', globalAvg !== '—' ? `${globalAvg}/5` : '—', `${_presta.filter(p=>p.evaluations?.length).length} evalues`],
    ['─ Par service ─', '', ''],
    ...Object.entries(byService).sort((a,b) => b[1].budget - a[1].budget).map(([s, v]) => [
      s, `${v.count} presta.`, formatEUR(v.budget)
    ])
  ];

  tbody.innerHTML = rows.map((r, i) => i === 6
    ? `<tr><td colspan="3" style="background:#EDE7F6;font-weight:700;color:#7B1FA2;padding:8px 14px">${r[0]}</td></tr>`
    : `<tr><td class="stat-label">${esc(r[0])}</td><td class="stat-value">${String(r[1]).replace(/\s/g, '&nbsp;')}</td><td class="stat-detail">${String(r[2]).replace(/\s/g, '&nbsp;')}</td></tr>`
  ).join('');
}

function setKpi(id, value, sub, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.kpi-value').textContent = value;
  el.querySelector('.kpi-sub').textContent = sub;
  el.className = `kpi-card${cls ? ' ' + cls : ''}`;
}

/* ── Charts ────────────────────────────────────────── */
let _chartPie = null;
let _chartBar = null;
const _palette = ['#1565C0','#2E7D32','#C62828','#EF6C00','#7B1FA2','#00838F','#AD1457','#558B2F','#4527A0','#37474F'];

function renderCharts() {
  const byService = {};
  _presta.forEach(p => {
    if (!byService[p.service]) byService[p.service] = { count: 0, budget: 0 };
    byService[p.service].count++;
    byService[p.service].budget += p.montant || 0;
  });
  const labels = Object.keys(byService).sort((a, b) => byService[b].budget - byService[a].budget);
  const budgets = labels.map(s => byService[s].budget);

  // Réinitialiser le titre et le bouton retour
  const titleEl = document.getElementById('chart-pie-title');
  const backBtn = document.getElementById('chart-pie-back');
  if (titleEl) titleEl.textContent = '💼 Budget par type de service — clic pour détail';
  if (backBtn) backBtn.style.display = 'none';

  const pieCtx = document.getElementById('chart-pie')?.getContext('2d');
  if (pieCtx) {
    if (_chartPie) _chartPie.destroy();
    _chartPie = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: budgets, backgroundColor: labels.map((_, i) => _palette[i % _palette.length]), borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label} : ${formatEUR(ctx.raw)}` } }
        },
        onClick: (evt, elements) => {
          if (elements.length > 0) {
            const svc = labels[elements[0].index];
            _showServiceDetail(svc);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      }
    });
  }

  const top8 = [..._presta].sort((a, b) => (b.montant || 0) - (a.montant || 0)).slice(0, 8);
  const barCtx = document.getElementById('chart-bar')?.getContext('2d');
  if (barCtx) {
    if (_chartBar) _chartBar.destroy();
    _chartBar = new Chart(barCtx, {
      type: 'bar',
      data: { labels: top8.map(p => p.nom.length > 18 ? p.nom.slice(0,16)+'…' : p.nom), datasets: [{ data: top8.map(p => p.montant || 0), backgroundColor: top8.map((_, i) => _palette[i % _palette.length]), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => formatEUR(v) } } } }
    });
  }
}

function _showServiceDetail(service) {
  const items = _presta
    .filter(p => p.service === service && (p.montant || 0) > 0)
    .sort((a, b) => (b.montant || 0) - (a.montant || 0));

  const titleEl = document.getElementById('chart-pie-title');
  const backBtn = document.getElementById('chart-pie-back');
  if (titleEl) titleEl.textContent = `🏢 ${service} — prestataires`;
  if (backBtn) backBtn.style.display = 'inline-flex';

  const pieCtx = document.getElementById('chart-pie')?.getContext('2d');
  if (!pieCtx) return;
  if (_chartPie) _chartPie.destroy();

  const total = items.reduce((s, p) => s + (p.montant || 0), 0);

  if (!items.length) {
    _chartPie = new Chart(pieCtx, {
      type: 'bar', data: { labels: ['Aucun prestataire'], datasets: [{ data: [0] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  _chartPie = new Chart(pieCtx, {
    type: 'bar',
    data: {
      labels: items.map(p => p.nom.length > 22 ? p.nom.slice(0, 20) + '…' : p.nom),
      datasets: [{
        data: items.map(p => p.montant || 0),
        backgroundColor: items.map((_, i) => _palette[i % _palette.length]),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${formatEUR(ctx.raw)} — ${(ctx.raw / total * 100).toFixed(1)}%` } }
      },
      scales: { x: { beginAtZero: true, ticks: { callback: v => formatEUR(v) } } }
    }
  });
}

function backToPieChart() {
  renderCharts();
}

/* ══════════════════════════════════════════════════════
   CONTRATS PDF
══════════════════════════════════════════════════════ */
let _contrats = [];

async function loadContrats() {
  try {
    _contrats = await api('/api/prestataires/contrats');
  } catch (e) {
    _contrats = [];
  }
  renderContrats(_contrats);
}

function filterContrats() {
  const q = (document.getElementById('contrat-search')?.value || '').toLowerCase();
  const filtered = !q ? _contrats : _contrats.filter(c =>
    [c.presta_nom, c.presta_service, c.nom_fichier].some(v => (v || '').toLowerCase().includes(q))
  );
  renderContrats(filtered);
}

function renderContrats(list) {
  const tbody = document.getElementById('contrats-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Aucun contrat PDF. Cliquez sur "Ajouter un contrat PDF" pour importer.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => `<tr>
    <td><strong>${esc(c.presta_nom)}</strong></td>
    <td><span class="badge badge-blue">${esc(c.presta_service || '—')}</span></td>
    <td>📄 ${esc(c.nom_fichier)}</td>
    <td>${c.date_ajout || '—'}</td>
    <td><div class="row-actions">
      <button class="btn-sm btn-sm-blue" onclick="downloadContrat(${c.id},'${esc(c.nom_fichier)}')" title="Télécharger">⬇️</button>
      <button class="btn-sm btn-sm-red" onclick="deleteContrat(${c.id})" title="Supprimer">🗑️</button>
    </div></td>
  </tr>`).join('');
}

async function uploadContrat(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // Trouver le prestataire sélectionné (ligne active dans la table)
  const selRow = document.querySelector('#presta-table tbody tr.selected-row');
  let prestaId = null;
  if (selRow) prestaId = parseInt(selRow.dataset.id);

  if (!prestaId) {
    // Demander à l'utilisateur de sélectionner un prestataire
    const ids = _presta.map(p => p.id);
    if (ids.length === 0) { showToast('Ajoutez d\'abord un prestataire.', 'error'); return; }
    // Utiliser le premier si un seul, sinon demander
    const nom = prompt(`Entrez l'ID du prestataire (${_presta.map(p => `${p.id}:${p.nom}`).join(', ')}) :`);
    prestaId = parseInt(nom);
    if (!prestaId || !_presta.find(p => p.id === prestaId)) {
      showToast('ID prestataire invalide.', 'error'); return;
    }
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/prestataires/${prestaId}/contrats`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur upload', 'error'); return; }
    showToast(`Contrat "${file.name}" ajouté.`, 'success');
    await loadContrats();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

function downloadContrat(id, nom) {
  const a = document.createElement('a');
  a.href = `/api/prestataires/contrats/${id}`;
  a.download = nom;
  a.click();
}

async function deleteContrat(id) {
  const c = _contrats.find(x => x.id === id);
  if (!c || !confirmAction(`Supprimer "${c.nom_fichier}" ?`)) return;
  try {
    await api(`/api/prestataires/contrats/${id}`, 'DELETE');
    showToast('Contrat supprimé.', 'success');
    await loadContrats();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Modal helpers ─────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function htToTTCBtn() {
  const input = document.getElementById('presta-montant');
  const ht = parseInt(input.value) || 0;
  if (ht > 0) {
    input.value = htToTTC(ht);
    showToast(`HT ${formatEUR(ht)} → TTC ${formatEUR(htToTTC(ht))}`, 'info');
  }
}
