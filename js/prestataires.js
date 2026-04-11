/**
 * prestataires.js — Module Prestataires complet
 * Reproduit le ProviderManager de l'application Python
 */

/* ── État local ─────────────────────────────────────────── */
let _presta = [];          // liste active
let _sortCol = null;
let _sortDir = 1;          // 1=asc, -1=desc
let _currentPrestaId = null; // pour le dialog d'évaluation

/* ── Initialisation ─────────────────────────────────────── */
function initPrestataires() {
  const etab = getCurrentEtab();
  _presta = getPrestataires(etab);
  if (_presta.length === 0) {
    loadDemoData(etab);
    _presta = getPrestataires(etab);
  }
  renderTable();
  refreshServiceFilter();
  updateStats();
  renderCharts();
}

/* ── Rendu table ────────────────────────────────────────── */
function renderTable(filtered) {
  const list = filtered ?? _presta;
  const tbody = document.getElementById('presta-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">Aucun prestataire trouvé.</td></tr>';
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

    return `<tr data-id="${esc(p.id)}">
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
      <td>${esc(p.frequence || '—')}</td>
      <td>${avgStr}</td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue" onclick="editPrestataire('${p.id}')" title="Modifier">✏️</button>
          <button class="btn-sm btn-sm-orange" onclick="openEvaluations('${p.id}')" title="Évaluations">⭐</button>
          <button class="btn-sm btn-sm-green" onclick="renouvelerContrat('${p.id}')" title="Renouveler le contrat">🔄</button>
          <button class="btn-sm btn-sm-red" onclick="deletePrestataire('${p.id}')" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Filtre & recherche ─────────────────────────────────── */
function applyFilters() {
  const q = (document.getElementById('presta-search')?.value || '').toLowerCase();
  const service = document.getElementById('presta-service-filter')?.value || '';

  let list = _presta.filter(p => {
    const matchQ = !q || [p.nom, p.service, p.contact, p.email, p.notes, p.prestations]
      .some(v => (v || '').toLowerCase().includes(q));
    const matchS = !service || p.service === service;
    return matchQ && matchS;
  });

  // tri
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
  // update header
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
  const base = ['Tous les services', ...SERVICES];
  const extra = used.filter(s => !SERVICES.includes(s));
  const all = ['Tous les services', ...SERVICES, ...extra];

  sel.innerHTML = all.map(s => {
    const val = s === 'Tous les services' ? '' : s;
    return `<option value="${esc(val)}"${val === current ? ' selected' : ''}>${esc(s)}</option>`;
  }).join('');
}

/* ── Dialog Ajouter / Modifier ──────────────────────────── */
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

function savePrestataire() {
  const id = document.getElementById('presta-form-id').value;
  const nom = document.getElementById('presta-nom').value.trim();
  if (!nom) { showToast('Le nom du prestataire est requis.', 'error'); return; }

  const obj = {
    id: id || uuid(),
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
    evaluations: id ? (_presta.find(p => p.id === id)?.evaluations || []) : []
  };

  if (id) {
    const idx = _presta.findIndex(p => p.id === id);
    if (idx >= 0) _presta[idx] = obj;
  } else {
    _presta.push(obj);
  }

  savePrestataires(getCurrentEtab(), _presta);
  closeModal('modal-presta');
  refreshServiceFilter();
  applyFilters();
  updateStats();
  renderCharts();
  showToast(id ? 'Prestataire modifié.' : 'Prestataire ajouté.', 'success');
}

function deletePrestataire(id) {
  const p = _presta.find(x => x.id === id);
  if (!p) return;
  if (!confirmAction(`Supprimer "${p.nom}" ?\nIl sera déplacé dans la corbeille.`)) return;

  _presta = _presta.filter(x => x.id !== id);
  const etab = getCurrentEtab();
  savePrestataires(etab, _presta);

  const corbeille = getCorbeille(etab);
  corbeille.push({ ...p, _deleted_at: today() });
  saveCorbeille(etab, corbeille);

  refreshServiceFilter();
  applyFilters();
  updateStats();
  renderCharts();
  showToast(`"${p.nom}" déplacé en corbeille.`, 'info');
}

/* ── Renouvellement ─────────────────────────────────────── */
function renouvelerContrat(id) {
  const p = _presta.find(x => x.id === id);
  if (!p) return;

  document.getElementById('renouv-nom').textContent = p.nom;
  document.getElementById('renouv-presta-id').value = p.id;

  // Nouvelle date début = jour suivant la date de fin actuelle
  const finActuelle = new Date(p.date_fin + 'T00:00:00');
  finActuelle.setDate(finActuelle.getDate() + 1);
  const newDebut = finActuelle.toISOString().slice(0, 10);
  const newFin = addYears(newDebut, 1);

  document.getElementById('renouv-date-debut').value = newDebut;
  document.getElementById('renouv-date-fin').value = newFin;
  document.getElementById('renouv-montant').value = p.montant;
  document.getElementById('renouv-notes').value =
    `Renouvellement du contrat précédent. Période précédente: ${formatDateFR(p.date_debut)} au ${formatDateFR(p.date_fin)}.`;

  document.getElementById('modal-renouv').classList.remove('hidden');
}

function saveRenouvellement() {
  const id = document.getElementById('renouv-presta-id').value;
  const p = _presta.find(x => x.id === id);
  if (!p) return;

  p.date_debut = document.getElementById('renouv-date-debut').value;
  p.date_fin   = document.getElementById('renouv-date-fin').value;
  p.montant    = parseInt(document.getElementById('renouv-montant').value) || p.montant;
  p.notes      = document.getElementById('renouv-notes').value;

  savePrestataires(getCurrentEtab(), _presta);
  closeModal('modal-renouv');
  applyFilters();
  updateStats();
  showToast(`Contrat de "${p.nom}" renouvelé.`, 'success');
}

/* ── Évaluations ────────────────────────────────────────── */
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
    container.innerHTML = '<p style="color:#bbb;text-align:center;padding:20px">Aucune évaluation pour l\'instant.</p>';
    return;
  }
  container.innerHTML = [...evals].reverse().map(e => `
    <div class="eval-card">
      <div class="eval-header">
        <span>${renderStars(e.note)}</span>
        <span class="eval-date">${formatDateFR(e.date)}</span>
        <button class="btn-sm btn-sm-red" onclick="deleteEval('${e.id}')">✕</button>
      </div>
      <div class="eval-comment">${esc(e.commentaire) || '<em style="color:#bbb">Sans commentaire</em>'}</div>
    </div>
  `).join('');
}

function addEvaluation() {
  const p = _presta.find(x => x.id === _currentPrestaId);
  if (!p) return;

  const date = document.getElementById('new-eval-date').value || today();
  const note = parseInt(document.getElementById('new-eval-note').value);
  const commentaire = document.getElementById('new-eval-comment').value.trim();

  p.evaluations.push({ id: uuid(), date, note, commentaire });
  savePrestataires(getCurrentEtab(), _presta);
  renderEvalList(p.evaluations);

  document.getElementById('new-eval-date').value = today();
  document.getElementById('new-eval-note').value = '4';
  document.getElementById('new-eval-comment').value = '';
  showToast('Évaluation ajoutée.', 'success');
  applyFilters();
}

function deleteEval(evalId) {
  const p = _presta.find(x => x.id === _currentPrestaId);
  if (!p) return;
  p.evaluations = p.evaluations.filter(e => e.id !== evalId);
  savePrestataires(getCurrentEtab(), _presta);
  renderEvalList(p.evaluations);
  applyFilters();
}

/* ── Corbeille ──────────────────────────────────────────── */
function showCorbeille() {
  const etab = getCurrentEtab();
  const corbeille = getCorbeille(etab);
  const tbody = document.getElementById('corbeille-tbody');

  if (corbeille.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">La corbeille est vide.</td></tr>';
  } else {
    tbody.innerHTML = corbeille.map(p => `
      <tr>
        <td>${esc(p.nom)}</td>
        <td><span class="badge badge-blue">${esc(p.service)}</span></td>
        <td>${formatEUR(p.montant)}</td>
        <td>${formatDateFR(p._deleted_at)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-sm btn-sm-green" onclick="restorePrestataire('${p.id}')">♻️ Restaurer</button>
            <button class="btn-sm btn-sm-red" onclick="deleteForever('${p.id}')">🗑️ Supprimer définitivement</button>
          </div>
        </td>
      </tr>`
    ).join('');
  }

  document.getElementById('modal-corbeille').classList.remove('hidden');
}

function restorePrestataire(id) {
  const etab = getCurrentEtab();
  const corbeille = getCorbeille(etab);
  const idx = corbeille.findIndex(p => p.id === id);
  if (idx < 0) return;
  const p = { ...corbeille[idx] };
  delete p._deleted_at;
  _presta.push(p);
  corbeille.splice(idx, 1);
  savePrestataires(etab, _presta);
  saveCorbeille(etab, corbeille);
  showCorbeille();
  refreshServiceFilter();
  applyFilters();
  updateStats();
  showToast(`"${p.nom}" restauré.`, 'success');
}

function deleteForever(id) {
  const etab = getCurrentEtab();
  const corbeille = getCorbeille(etab);
  const p = corbeille.find(x => x.id === id);
  if (!p) return;
  if (!confirmAction(`Supprimer définitivement "${p.nom}" ? Cette action est irréversible.`)) return;
  saveCorbeille(etab, corbeille.filter(x => x.id !== id));
  showCorbeille();
  showToast(`"${p.nom}" supprimé définitivement.`, 'warning');
}

/* ── Export ─────────────────────────────────────────────── */
function exportPrestataires() {
  const rows = _presta.map(p => [
    p.nom, p.service, p.contact, p.email, p.telephone,
    p.date_debut, p.date_fin, p.montant, p.frequence,
    p.prestations, p.notes
  ]);
  exportCSV(
    rows,
    ['nom', 'service', 'contact', 'email', 'telephone', 'date_debut', 'date_fin', 'montant', 'frequence', 'prestations', 'notes'],
    `prestataires_${today()}.csv`
  );
  showToast('Export CSV téléchargé.', 'success');
}

/* ── Statistiques ───────────────────────────────────────── */
function updateStats() {
  const now = new Date(); now.setHours(0,0,0,0);
  const total = _presta.length;
  const totalBudget = _presta.reduce((s, p) => s + (p.montant || 0), 0);
  const expiring30 = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d >= 0 && d <= 30; }).length;
  const expired    = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d < 0; }).length;
  const active     = _presta.filter(p => { const d = daysRemaining(p.date_fin); return d !== null && d >= 0; }).length;

  // KPIs
  setKpi('kpi-total', total, 'prestataires au total');
  setKpi('kpi-budget', formatEUR(totalBudget), 'budget annuel total');
  setKpi('kpi-actifs', active, 'contrats actifs');
  setKpi('kpi-expiring', expiring30, 'expirent dans 30 jours', expiring30 > 0 ? 'orange' : '');
  setKpi('kpi-expired', expired, 'contrats expirés', expired > 0 ? 'red' : '');

  // Tableau détaillé
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
    ['Budget annuel total', formatEUR(totalBudget), `Moyenne par prestataire : ${formatEUR(Math.round(totalBudget / (total || 1)))}`],
    ['Contrats actifs', active, `${Math.round(active / (total || 1) * 100)}% du parc`],
    ['Contrats expirés', expired, expired > 0 ? '⚠️ À renouveler' : 'Aucun expiré'],
    ['Expiration dans 30j', expiring30, expiring30 > 0 ? '⚠️ Attention requise' : 'RAS'],
    ['Note moyenne globale', globalAvg !== '—' ? `${globalAvg}/5` : '—', `Sur ${_presta.filter(p=>p.evaluations?.length).length} prestataires évalués`],
    ['─ Répartition par service ─', '', ''],
    ...Object.entries(byService).sort((a,b) => b[1].budget - a[1].budget).map(([s, v]) => [
      s, `${v.count} prestataire${v.count > 1 ? 's' : ''}`, formatEUR(v.budget)
    ])
  ];

  tbody.innerHTML = rows.map((r, i) => i === 6
    ? `<tr><td colspan="3" style="background:#EDE7F6;font-weight:700;color:#7B1FA2;padding:8px 14px">${r[0]}</td></tr>`
    : `<tr>
        <td class="stat-label">${esc(r[0])}</td>
        <td class="stat-value">${String(r[1]).replace(/\s/g, '&nbsp;')}</td>
        <td class="stat-detail">${String(r[2]).replace(/\s/g, '&nbsp;')}</td>
       </tr>`
  ).join('');
}

function setKpi(id, value, sub, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.kpi-value').textContent = value;
  el.querySelector('.kpi-sub').textContent = sub;
  el.className = `kpi-card${cls ? ' ' + cls : ''}`;
}

/* ── Graphiques (Chart.js) ──────────────────────────────── */
let _chartPie = null;
let _chartBar = null;

function renderCharts() {
  // Données par service
  const byService = {};
  _presta.forEach(p => {
    if (!byService[p.service]) byService[p.service] = { count: 0, budget: 0 };
    byService[p.service].count++;
    byService[p.service].budget += p.montant || 0;
  });

  const labels = Object.keys(byService);
  const budgets = labels.map(s => byService[s].budget);

  const palette = [
    '#1565C0','#2E7D32','#C62828','#EF6C00','#7B1FA2',
    '#00838F','#AD1457','#558B2F','#4527A0','#37474F',
    '#0277BD','#6A1B9A','#2E7D32','#E65100','#1B5E20'
  ];

  // Camembert
  const pieCtx = document.getElementById('chart-pie')?.getContext('2d');
  if (pieCtx) {
    if (_chartPie) _chartPie.destroy();
    _chartPie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: budgets,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label} : ${formatEUR(ctx.parsed)} (${Math.round(ctx.parsed / (budgets.reduce((a,b)=>a+b,0)||1)*100)}%)`
            }
          }
        }
      }
    });
  }

  // Top 8 barres
  const top8 = [..._presta]
    .sort((a, b) => (b.montant || 0) - (a.montant || 0))
    .slice(0, 8);

  const barCtx = document.getElementById('chart-bar')?.getContext('2d');
  if (barCtx) {
    if (_chartBar) _chartBar.destroy();
    _chartBar = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: top8.map(p => p.nom.length > 18 ? p.nom.slice(0,16)+'…' : p.nom),
        datasets: [{
          label: 'Montant annuel (€)',
          data: top8.map(p => p.montant || 0),
          backgroundColor: top8.map((_, i) => palette[i % palette.length]),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatEUR(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => formatEUR(v)
            }
          },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }
}

/* ── Modal helpers ──────────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function htToTTCBtn() {
  const input = document.getElementById('presta-montant');
  const ht = parseInt(input.value) || 0;
  if (ht > 0) {
    input.value = htToTTC(ht);
    showToast(`Converti : ${formatEUR(ht)} HT → ${formatEUR(htToTTC(ht))} TTC`, 'info');
  }
}
