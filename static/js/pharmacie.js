/**
 * pharmacie.js — Module Pharmacie (API)
 */

const SEUIL_ROUGE  = 30;
const SEUIL_ORANGE = 90;

let _pharmaStock     = [];
let _pharmaMouvs     = [];
let _pharmaArchive   = [];
let _pharmaFilter    = 'tous';
let _pharmaSearch    = '';
let _pharmaSortCol   = 0;
let _pharmaSortAsc   = true;
let _pharmaSimple    = true;
let _pharmaStatsChart1 = null;
let _pharmaStatsChart2 = null;

/* ── Jours restants ─────────────────────────────────── */
function pharmaJoursRestants(datePer) {
  if (!datePer) return null;
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePer)) {
    d = new Date(datePer + 'T00:00:00');
  } else if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(datePer)) {
    const p = datePer.split(/[-\/]/);
    d = new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`);
  } else if (/^\d{2}[-\/]\d{4}$/.test(datePer)) {
    const p = datePer.split(/[-\/]/);
    d = new Date(parseInt(p[1]), parseInt(p[0]), 0);
  } else return null;
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

function pharmaStatut(jours) {
  if (jours === null) return { label: '⚠️', cls: 'badge-gray', color: '#9E9E9E', key: 'unknown' };
  if (jours < 0)            return { label: '🔴 PERIME',    cls: 'badge-red',    color: '#C62828', key: 'perime' };
  if (jours < SEUIL_ROUGE)  return { label: '🟠 URGENT',    cls: 'badge-orange', color: '#EF6C00', key: 'urgent' };
  if (jours < SEUIL_ORANGE) return { label: '🟡 ATTENTION', cls: 'badge-orange', color: '#F9A825', key: 'attention' };
  return { label: '🟢 OK', cls: 'badge-green', color: '#2E7D32', key: 'ok' };
}

/* ── Init ───────────────────────────────────────────── */
async function initPharmacie() {
  try {
    [_pharmaStock, _pharmaMouvs, _pharmaArchive] = await Promise.all([
      getPharmaStockAPI(), getPharmaMouvementsAPI(), getPharmaArchiveAPI()
    ]);
  } catch (e) {
    _pharmaStock = []; _pharmaMouvs = []; _pharmaArchive = [];
    console.error('Erreur chargement pharmacie:', e);
  }
  renderPharmaTable();
  _updatePharmaBadges();
  checkBdpmStatus();

  const s = document.getElementById('pharma-search');
  if (s) s.oninput = debounce(() => { _pharmaSearch = s.value; renderPharmaTable(); }, 200);
}

/* ── Badges ─────────────────────────────────────────── */
function _updatePharmaBadges() {
  let alertes = 0, ok = 0;
  _pharmaStock.forEach(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    pharmaStatut(j).key === 'ok' ? ok++ : alertes++;
  });
  const total = _pharmaStock.length;
  const bT = document.getElementById('pharma-badge-total');
  const bA = document.getElementById('pharma-badge-alertes');
  const bO = document.getElementById('pharma-badge-ok');
  if (bT) bT.textContent = `${total} produit${total > 1 ? 's' : ''}`;
  if (bA) bA.textContent = `${alertes} alerte${alertes > 1 ? 's' : ''}`;
  if (bO) bO.textContent = `${ok} OK`;
}

/* ── Filtres rapides ────────────────────────────────── */
function setPharmaFilter(f) {
  _pharmaFilter = f;
  document.querySelectorAll('.pharma-filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === f)
  );
  renderPharmaTable();
}

function togglePharmaView() {
  _pharmaSimple = !_pharmaSimple;
  const btn = document.getElementById('pharma-view-toggle');
  if (btn) btn.textContent = _pharmaSimple ? '☰ Vue complete' : '☰ Vue simple';
  document.querySelectorAll('.pharma-col-extra').forEach(el => {
    el.style.display = _pharmaSimple ? 'none' : '';
  });
}

function setPharmaSortCol(col) {
  if (_pharmaSortCol === col) _pharmaSortAsc = !_pharmaSortAsc;
  else { _pharmaSortCol = col; _pharmaSortAsc = true; }
  renderPharmaTable();
}

/* ── Render table ───────────────────────────────────── */
function renderPharmaTable() {
  const tbody = document.getElementById('pharma-tbody');
  if (!tbody) return;

  let list = [..._pharmaStock].map(m => ({ ...m, _jours: pharmaJoursRestants(m.date_peremption) }));

  if (_pharmaSearch) {
    const q = _pharmaSearch.toLowerCase();
    list = list.filter(m =>
      (m.nom_medicament||'').toLowerCase().includes(q) ||
      (m.lot||'').toLowerCase().includes(q) ||
      (m.emplacement||'').toLowerCase().includes(q)
    );
  }
  if (_pharmaFilter === 'alertes') list = list.filter(m => m._jours !== null && m._jours < SEUIL_ORANGE);
  if (_pharmaFilter === 'perimes') list = list.filter(m => m._jours !== null && m._jours < 0);

  const cols = ['nom_medicament','lot','date_peremption','_jours','quantite','stock_minimum','emplacement'];
  const key = cols[_pharmaSortCol] || 'nom_medicament';
  list.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (typeof va === 'string') va = (va||'').toLowerCase();
    if (typeof vb === 'string') vb = (vb||'').toLowerCase();
    if (va == null) va = ''; if (vb == null) vb = '';
    if (va < vb) return _pharmaSortAsc ? -1 : 1;
    if (va > vb) return _pharmaSortAsc ? 1 : -1;
    return 0;
  });

  document.querySelectorAll('#pharma-stock-table thead th').forEach((th, i) => {
    th.classList.remove('sorted-asc','sorted-desc');
    if (i === _pharmaSortCol) th.classList.add(_pharmaSortAsc ? 'sorted-asc' : 'sorted-desc');
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="12">Aucun medicament.</td></tr>';
    return;
  }

  const extra = _pharmaSimple ? 'style="display:none"' : '';
  tbody.innerHTML = list.map((m, idx) => {
    const st = pharmaStatut(m._jours);
    const rowBg = st.key === 'perime' ? 'background:#FFEBEE;' : (idx % 2 ? 'background:#FAFCFF;' : '');
    const stockBas = m.stock_minimum > 0 && m.quantite <= m.stock_minimum;
    return `<tr style="${rowBg}">
      <td><span style="color:${st.color};font-size:16px">●</span> ${esc(m.nom_medicament)}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.lot)}</td>
      <td>${formatDateFR(m.date_peremption)}</td>
      <td style="font-weight:700;color:${st.color}">${m._jours !== null ? m._jours : '—'}</td>
      <td style="${stockBas?'color:#C62828;font-weight:700':''}">${m.quantite}${stockBas?' ⚠️':''}</td>
      <td class="pharma-col-extra" ${extra}>${m.stock_minimum||0}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.emplacement)}</td>
      <td class="pharma-col-extra" ${extra}>${formatDateFR(m.date_ajout)}</td>
      <td class="pharma-col-extra" ${extra}>${m.derniere_sortie ? formatDateFR(m.derniere_sortie) : '—'}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.personne_entree||'—')}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td><div class="row-actions">
        <button class="btn-sm btn-sm-blue" onclick="openPharmaDetails(${m.id})" title="Details">👁</button>
        <button class="btn-sm btn-sm-green" onclick="openPharmaEdit(${m.id})" title="Modifier">✏</button>
        <button class="btn-sm btn-sm-red" onclick="deletePharmaItem(${m.id})" title="Supprimer">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Ajouter ────────────────────────────────────────── */
function openPharmaAddDialog() {
  document.getElementById('modal-pharma-title').textContent = '➕ Ajouter un medicament';
  document.getElementById('pharma-form-id').value = '';
  ['pharma-med-nom','pharma-med-lot'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pharma-med-peremption').value = '';
  document.getElementById('pharma-med-quantite').value = '1';
  document.getElementById('pharma-med-minimum').value = '0';
  document.getElementById('pharma-med-emplacement').value = '';
  document.getElementById('pharma-med-personne').value = '';
  document.getElementById('pharma-med-date-entree').value = today();
  document.getElementById('modal-pharma').classList.remove('hidden');
}

function openPharmaEdit(id) {
  const m = _pharmaStock.find(x => x.id === id);
  if (!m) return;
  document.getElementById('modal-pharma-title').textContent = '✏️ Modifier';
  document.getElementById('pharma-form-id').value = m.id;
  document.getElementById('pharma-med-nom').value = m.nom_medicament || '';
  document.getElementById('pharma-med-lot').value = m.lot || '';
  document.getElementById('pharma-med-peremption').value = m.date_peremption || '';
  document.getElementById('pharma-med-quantite').value = m.quantite || 1;
  document.getElementById('pharma-med-minimum').value = m.stock_minimum || 0;
  document.getElementById('pharma-med-emplacement').value = m.emplacement || '';
  document.getElementById('pharma-med-personne').value = m.personne_entree || '';
  document.getElementById('pharma-med-date-entree').value = m.date_ajout || today();
  document.getElementById('modal-pharma').classList.remove('hidden');
}

async function savePharmaItem() {
  const id   = document.getElementById('pharma-form-id').value;
  const nom  = document.getElementById('pharma-med-nom').value.trim();
  const per  = document.getElementById('pharma-med-peremption').value.trim();
  if (!nom) { showToast('Nom requis.', 'error'); return; }
  if (!per) { showToast('Date de peremption requise.', 'error'); return; }

  const obj = {
    nom_medicament: nom,
    lot: document.getElementById('pharma-med-lot').value.trim(),
    date_peremption: per,
    quantite: parseInt(document.getElementById('pharma-med-quantite').value) || 1,
    stock_minimum: parseInt(document.getElementById('pharma-med-minimum').value) || 0,
    emplacement: document.getElementById('pharma-med-emplacement').value,
    personne_entree: document.getElementById('pharma-med-personne').value,
    date_ajout: document.getElementById('pharma-med-date-entree').value || today(),
    heure: new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  };
  if (id) obj.id = parseInt(id);

  try {
    await savePharmaStockAPI(obj);
    closeModal('modal-pharma');
    await _reloadPharma();
    showToast(id ? 'Modifie.' : 'Ajoute.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Détails ────────────────────────────────────────── */
function openPharmaDetails(id) {
  const m = _pharmaStock.find(x => x.id === id);
  if (!m) return;
  const j = pharmaJoursRestants(m.date_peremption);
  const st = pharmaStatut(j);
  const stockBas = m.stock_minimum > 0 && m.quantite <= m.stock_minimum;
  document.getElementById('pharma-detail-body').innerHTML = `
    <div class="provider-detail-card">
      <h3 style="color:${st.color}">💊 ${esc(m.nom_medicament)}</h3>
      <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value"><span class="badge ${st.cls}">${st.label}</span></span></div>
      <div class="detail-row"><span class="detail-label">N° de lot</span><span class="detail-value">${esc(m.lot)||'—'}</span></div>
      <div class="detail-row"><span class="detail-label">Date peremption</span><span class="detail-value">${formatDateFR(m.date_peremption)}</span></div>
      <div class="detail-row"><span class="detail-label">Jours restants</span><span class="detail-value" style="font-weight:700;color:${st.color}">${j !== null ? j+' jours' : '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Quantite</span><span class="detail-value">${m.quantite}${stockBas?' <span style="color:#C62828">⚠️ Stock bas</span>':''}</span></div>
      <div class="detail-row"><span class="detail-label">Stock minimum</span><span class="detail-value">${m.stock_minimum||0}</span></div>
      <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${esc(m.emplacement)||'—'}</span></div>
      <div class="detail-row"><span class="detail-label">Date entree</span><span class="detail-value">${formatDateFR(m.date_ajout)}</span></div>
      <div class="detail-row"><span class="detail-label">Receptionne par</span><span class="detail-value">${esc(m.personne_entree)||'—'}</span></div>
      <div class="detail-row"><span class="detail-label">Derniere sortie</span><span class="detail-value">${m.derniere_sortie ? formatDateFR(m.derniere_sortie) : '—'}</span></div>
    </div>`;
  document.getElementById('modal-pharma-detail').classList.remove('hidden');
}

/* ── Supprimer ──────────────────────────────────────── */
async function deletePharmaItem(id) {
  const m = _pharmaStock.find(x => x.id === id);
  if (!m || !confirmAction(`Supprimer "${m.nom_medicament}" ?`)) return;
  try {
    await deletePharmaStockAPI(id);
    await _reloadPharma();
    showToast('Deplace en corbeille.', 'warning');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Sortie ─────────────────────────────────────────── */
function openPharmaSortie() {
  const sel = document.getElementById('pharma-sortie-med');
  const meds = [...new Set(_pharmaStock.map(m => m.nom_medicament))].sort();
  sel.innerHTML = meds.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  document.getElementById('pharma-sortie-qte').value = '1';
  document.getElementById('pharma-sortie-personne').value = '';
  document.getElementById('modal-pharma-sortie').classList.remove('hidden');
}

async function savePharmaSortie() {
  const nom  = document.getElementById('pharma-sortie-med').value;
  const qte  = parseInt(document.getElementById('pharma-sortie-qte').value) || 0;
  const pers = document.getElementById('pharma-sortie-personne').value;
  if (!nom || qte <= 0) { showToast('Donnees invalides.', 'error'); return; }
  try {
    await pharmaSortieAPI({
      nom_medicament: nom, quantite: qte, personne: pers,
      heure: new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
    });
    closeModal('modal-pharma-sortie');
    await _reloadPharma();
    showToast(`Sortie de ${qte} unite(s) enregistree.`, 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Retirer perimés ────────────────────────────────── */
async function removePharmaPerimes() {
  const perimes = _pharmaStock.filter(m => { const j = pharmaJoursRestants(m.date_peremption); return j !== null && j < 0; });
  if (perimes.length === 0) { showToast('Aucun perime.', 'info'); return; }
  if (!confirmAction(`Retirer ${perimes.length} medicament(s) perime(s) ?`)) return;
  try {
    await retirerPerimesAPI();
    await _reloadPharma();
    showToast(`${perimes.length} perime(s) retire(s).`, 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Corbeille ──────────────────────────────────────── */
async function showPharmaCorbeille() {
  const tbody = document.getElementById('pharma-corbeille-tbody');
  try {
    _pharmaArchive = await getPharmaArchiveAPI();
    if (_pharmaArchive.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Corbeille vide.</td></tr>';
    } else {
      tbody.innerHTML = _pharmaArchive.map(m => `<tr>
        <td>${esc(m.nom_medicament)}</td><td>${esc(m.lot)}</td>
        <td>${formatDateFR(m.date_peremption)}</td><td>${m.quantite}</td>
        <td>${esc(m.emplacement)}</td><td>${formatDateFR(m.date_suppression)}</td>
        <td><button class="btn-sm btn-sm-green" onclick="restorePharmaItem(${m.id})">↩️ Restaurer</button></td>
      </tr>`).join('');
    }
  } catch (e) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Erreur.</td></tr>';
  }
  document.getElementById('modal-pharma-corbeille').classList.remove('hidden');
}

async function restorePharmaItem(id) {
  try {
    await restorePharmaAPI(id);
    await _reloadPharma();
    showPharmaCorbeille();
    showToast('Restaure.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function viderPharmaCorbeille() {
  if (!_pharmaArchive.length) return;
  if (!confirmAction('Vider definitivement la corbeille ?')) return;
  try {
    await Promise.all(_pharmaArchive.map(a => api(`/api/pharmacie/archive/${a.id}`, 'DELETE').catch(()=>{})));
    await _reloadPharma();
    showPharmaCorbeille();
    showToast('Corbeille videe.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Historique ─────────────────────────────────────── */
async function showPharmaHistorique() {
  _pharmaMouvs = await getPharmaMouvementsAPI().catch(() => []);
  _renderPharmaHistorique();
  document.getElementById('modal-pharma-historique').classList.remove('hidden');
}

function _renderPharmaHistorique() {
  const periodeSel = document.getElementById('pharma-hist-periode');
  const jours = parseInt(periodeSel?.value) || 0;
  let list = [..._pharmaMouvs];
  if (jours > 0) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - jours);
    const cutStr = cutoff.toISOString().slice(0,10);
    list = list.filter(m => m.date_mouvement >= cutStr);
  }
  const sorties    = list.filter(m => m.type==='sortie').reduce((s,m)=>s+m.quantite,0);
  const receptions = list.filter(m => m.type==='reception').reduce((s,m)=>s+m.quantite,0);
  const bS = document.getElementById('pharma-hist-sorties');
  const bR = document.getElementById('pharma-hist-receptions');
  if (bS) bS.textContent = `${sorties} sortie${sorties>1?'s':''}`;
  if (bR) bR.textContent = `${receptions} reception${receptions>1?'s':''}`;
  const tbody = document.getElementById('pharma-hist-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun mouvement.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(m => {
    const typeLabel = m.type==='sortie'
      ? '<span style="color:#EF6C00;font-weight:700">📤 Sortie</span>'
      : '<span style="color:#2E7D32;font-weight:700">📥 Reception</span>';
    return `<tr>
      <td>${formatDateFR(m.date_mouvement)}</td><td>${esc(m.heure)}</td>
      <td>${typeLabel}</td><td>${esc(m.nom_medicament)}</td>
      <td style="font-weight:700">${m.quantite}</td>
      <td>${esc(m.personne)}</td><td>${esc(m.role)}</td>
    </tr>`;
  }).join('');
}

/* ── Export ─────────────────────────────────────────── */
function exportPharmaCSV() {
  const rows = _pharmaStock.map(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    const st = pharmaStatut(j);
    return [m.nom_medicament, m.lot, m.date_peremption, j??'', st.label.replace(/[🔴🟠🟡🟢⚠️]/g,'').trim(), m.quantite, m.stock_minimum, m.emplacement, m.date_ajout];
  });
  exportCSV(rows, ['Medicament','Lot','Peremption','Jours','Statut','Qte','Stock min','Emplacement','Date ajout'], `pharmacie_${today()}.csv`);
  showToast('Export CSV telecharge.', 'success');
}

/* ── Stats ──────────────────────────────────────────── */
async function initPharmaStats() {
  _pharmaMouvs = await getPharmaMouvementsAPI().catch(() => []);
  _renderPharmaStats();
}

function _renderPharmaStats() {
  const jours = parseInt(document.getElementById('pharma-stats-periode')?.value) || 0;
  let cutStr = '2000-01-01';
  if (jours > 0) { const c = new Date(); c.setDate(c.getDate()-jours); cutStr = c.toISOString().slice(0,10); }
  const mouvs = _pharmaMouvs.filter(m => jours===0 || m.date_mouvement >= cutStr);
  const sorties    = mouvs.filter(m=>m.type==='sortie').reduce((s,m)=>s+m.quantite,0);
  const receptions = mouvs.filter(m=>m.type==='reception').reduce((s,m)=>s+m.quantite,0);
  let stockBas=0, perimes30=0, okCount=0;
  _pharmaStock.forEach(m => {
    if (m.stock_minimum>0 && m.quantite<=m.stock_minimum) stockBas++;
    const j = pharmaJoursRestants(m.date_peremption);
    if (j!==null && j<SEUIL_ROUGE) perimes30++;
    if (j!==null && j>=SEUIL_ORANGE) okCount++;
  });
  _setPharmaKPI('pharma-kpi-sorties',    sorties,    `unites sur ${jours||'toute la'} ${jours?'jours':'periode'}`);
  _setPharmaKPI('pharma-kpi-receptions', receptions, 'unites recues');
  _setPharmaKPI('pharma-kpi-stockbas',   stockBas,   `produit${stockBas>1?'s':''} sous le seuil`);
  _setPharmaKPI('pharma-kpi-perimes',    perimes30,  `perime${perimes30>1?'s':''} ou < 30j`);
  _setPharmaKPI('pharma-kpi-ok',         okCount,    `produit${okCount>1?'s':''} > 3 mois`);

  const sortiesByMed = {};
  mouvs.filter(m=>m.type==='sortie').forEach(m => { sortiesByMed[m.nom_medicament]=(sortiesByMed[m.nom_medicament]||0)+m.quantite; });
  const top10 = Object.entries(sortiesByMed).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const palette = ['#5C9BD6','#6DBF8A','#F0A070','#A880C8','#E88080','#50B8C8','#A08070','#F0C060','#80A0B8','#90C070'];

  const ctx1 = document.getElementById('pharma-chart-top10');
  if (ctx1) {
    if (_pharmaStatsChart1) _pharmaStatsChart1.destroy();
    _pharmaStatsChart1 = new Chart(ctx1, {
      type: 'bar',
      data: { labels: top10.map(x=>x[0].length>25?x[0].slice(0,22)+'…':x[0]), datasets: [{ data: top10.map(x=>x[1]), backgroundColor: top10.map((_,i)=>palette[i%palette.length]), borderRadius: 4 }] },
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,grid:{color:'#F0F0F0'}},y:{grid:{display:false}}} }
    });
  }

  const ctx2 = document.getElementById('pharma-chart-distrib');
  if (ctx2) {
    if (_pharmaStatsChart2) _pharmaStatsChart2.destroy();
    const counts = {'OK (>3 mois)':0,'Attention (<3 mois)':0,'Urgent (<30j)':0,'Perime':0};
    _pharmaStock.forEach(m => {
      const j = pharmaJoursRestants(m.date_peremption);
      if (j===null) return;
      if (j<0) counts['Perime']++;
      else if (j<SEUIL_ROUGE) counts['Urgent (<30j)']++;
      else if (j<SEUIL_ORANGE) counts['Attention (<3 mois)']++;
      else counts['OK (>3 mois)']++;
    });
    _pharmaStatsChart2 = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor:['#66BB6A','#FFA726','#EF5350','#C62828'], borderWidth:2 }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{legend:{position:'right',labels:{font:{size:12},padding:12}}} }
    });
  }
}

function _setPharmaKPI(id, value, sub) {
  const card = document.getElementById(id);
  if (!card) return;
  card.querySelector('.kpi-value').textContent = value;
  card.querySelector('.kpi-sub').textContent = sub;
}

/* ── Helper reload ──────────────────────────────────── */
async function _reloadPharma() {
  [_pharmaStock, _pharmaMouvs, _pharmaArchive] = await Promise.all([
    getPharmaStockAPI(), getPharmaMouvementsAPI(), getPharmaArchiveAPI()
  ]);
  renderPharmaTable();
  _updatePharmaBadges();
}

/* ══════════════════════════════════════════════════════
   SCANNER USB (GS1 DataMatrix)
══════════════════════════════════════════════════════ */

let _scannerActive = false;
let _scanBuffer = '';
let _scanTimeout = null;

function _parseGS1(data) {
  const result = {};
  // Nettoyer prefixes scanner
  for (const pfx of [']d2',']C1',']e0',']Q3']) {
    if (data.startsWith(pfx)) data = data.slice(pfx.length);
  }
  // Format avec parentheses
  if (data.includes('(')) {
    let m = data.match(/\(01\)(\d{14})/);
    if (m) result.cip = m[1].replace(/^0+/,'') || m[1];
    m = data.match(/\(17\)(\d{6})/);
    if (m) _parseDate17(m[1], result);
    m = data.match(/\(10\)([A-Za-z0-9\-]+)/);
    if (m) result.lot = m[1];
    return result;
  }
  // Format brut GS1
  data = data.replace(/\x1d/g,'\x00').replace(/\x1c/g,'\x00');
  const FIXED = {'01':14,'17':6,'11':6,'13':6,'15':6};
  let pos = 0;
  while (pos < data.length) {
    if (data[pos] === '\x00') { pos++; continue; }
    const ai2 = data.slice(pos, pos+2);
    if (FIXED[ai2]) {
      const flen = FIXED[ai2];
      if (pos+2+flen <= data.length) {
        const val = data.slice(pos+2, pos+2+flen);
        if (ai2==='01') result.cip = val.replace(/^0+/,'') || val;
        else if (ai2==='17') _parseDate17(val, result);
      }
      pos += 2 + flen;
    } else if (ai2==='10') {
      const rest = data.slice(pos+2);
      let end = rest.length;
      for (let i=1; i<rest.length; i++) {
        if (rest[i]==='\x00') { end=i; break; }
        if (/^(01\d{14}|17\d{6}|11\d{6}|15\d{6})/.test(rest.slice(i))) { end=i; break; }
      }
      result.lot = rest.slice(0, end).trim();
      pos += 2 + end;
    } else if (ai2==='21') {
      const rest = data.slice(pos+2);
      let end = rest.length;
      for (let i=1; i<rest.length; i++) { if (rest[i]==='\x00') { end=i; break; } }
      pos += 2 + end;
    } else {
      pos++;
    }
  }
  return result;
}

function _parseDate17(d6, result) {
  try {
    const yy = parseInt(d6.slice(0,2));
    const mm = parseInt(d6.slice(2,4));
    let dd = parseInt(d6.slice(4,6));
    const year = 2000 + yy;
    if (dd === 0) dd = new Date(year, mm, 0).getDate();
    result.date_peremption = `${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  } catch(e) {}
}

function toggleScanner() {
  _scannerActive = !_scannerActive;
  const btn = document.getElementById('pharma-scanner-btn');
  const status = document.getElementById('pharma-scan-status');
  if (_scannerActive) {
    btn.textContent = '🔫 Scanner ON';
    btn.style.background = '#EF6C00';
    if (status) { status.textContent = '⏳ En attente de scan...'; status.style.display = 'inline'; }
    document.addEventListener('keydown', _onScanKeydown);
  } else {
    btn.textContent = '🔫 Scanner (USB)';
    btn.style.background = '#27AE60';
    if (status) status.style.display = 'none';
    document.removeEventListener('keydown', _onScanKeydown);
    _scanBuffer = '';
  }
}

function _onScanKeydown(e) {
  if (!_scannerActive) return;
  // Ignore si focus dans un input/textarea (sauf le scan)
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (_scanBuffer.length > 5) {
      _processScan(_scanBuffer);
    }
    _scanBuffer = '';
    clearTimeout(_scanTimeout);
    return;
  }
  if (e.key.length === 1) {
    _scanBuffer += e.key;
    clearTimeout(_scanTimeout);
    _scanTimeout = setTimeout(() => { _scanBuffer = ''; }, 300);
  }
}

async function _processScan(raw) {
  const status = document.getElementById('pharma-scan-status');
  const btn = document.getElementById('pharma-scanner-btn');

  // Flash orange
  if (btn) { btn.style.background = '#FF9800'; setTimeout(()=> btn.style.background = '#EF6C00', 400); }

  const parsed = _parseGS1(raw);
  if (status) status.textContent = `✅ Scan: CIP=${parsed.cip||'?'} Lot=${parsed.lot||'?'}`;

  // Lookup BDPM
  let nomMed = '';
  if (parsed.cip) {
    try {
      const res = await api(`/api/pharmacie/bdpm/lookup/${parsed.cip}`);
      if (res.found) nomMed = res.nom;
    } catch(e) {}
  }

  // Ouvrir le formulaire pre-rempli
  openPharmaAddDialog();
  if (nomMed) document.getElementById('pharma-med-nom').value = nomMed;
  if (parsed.lot) document.getElementById('pharma-med-lot').value = parsed.lot;
  if (parsed.date_peremption) document.getElementById('pharma-med-peremption').value = parsed.date_peremption;

  showToast(`Scan detecte${nomMed ? ': '+nomMed : ''}`, 'success');
}

/* ── Saisie manuelle du code scan ─────────────────── */
function openManualScanDialog() {
  openModal('🔫 Saisir un code-barres', `
    <div style="padding:10px">
      <p style="font-size:13px;color:#666;margin-bottom:12px">
        Collez ou tapez le code DataMatrix / code-barres GS1 du medicament :
      </p>
      <input id="manual-scan-input" class="modal-input" style="width:100%;font-family:monospace;font-size:14px"
             placeholder="Ex: 010341234500001317250630103AB456" autofocus>
      <div id="manual-scan-result" style="margin-top:12px;font-size:12px;color:#666"></div>
    </div>
  `, async () => {
    const raw = document.getElementById('manual-scan-input')?.value?.trim();
    if (raw) {
      closeGenericModal();
      await _processScan(raw);
    }
  });
}

/* ══════════════════════════════════════════════════════
   BDPM — Base officielle medicaments
══════════════════════════════════════════════════════ */

let _bdpmLoaded = false;

async function checkBdpmStatus() {
  try {
    const res = await api('/api/pharmacie/bdpm/status');
    _bdpmLoaded = res.loaded;
    const el = document.getElementById('pharma-bdpm-status');
    if (el) {
      el.textContent = res.loaded ? `🏛️ BDPM: ${res.count} meds` : '🏛️ BDPM: non chargee';
      el.style.color = res.loaded ? '#2E7D32' : '#999';
    }
  } catch(e) {}
}

async function downloadBdpm() {
  const btn = document.getElementById('pharma-bdpm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Telechargement...'; }
  try {
    const res = await api('/api/pharmacie/bdpm/download', 'POST');
    _bdpmLoaded = true;
    showToast(res.message || 'BDPM chargee.', 'success');
    checkBdpmStatus();
  } catch(e) {
    showToast('Erreur BDPM: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🏛️ BDPM'; }
  }
}

async function searchBdpm() {
  openModal('🏛️ Rechercher un medicament (BDPM)', `
    <div style="padding:10px">
      <p style="font-size:13px;color:#666;margin-bottom:10px">
        Recherchez dans la base officielle des medicaments francais :
      </p>
      <input id="bdpm-search-input" class="modal-input" style="width:100%;font-size:14px"
             placeholder="Nom du medicament..." oninput="_doBdpmSearch()" autofocus>
      <div id="bdpm-search-results" style="margin-top:10px;max-height:300px;overflow:auto"></div>
    </div>
  `, null);
}

async function _doBdpmSearch() {
  const q = document.getElementById('bdpm-search-input')?.value?.trim();
  const div = document.getElementById('bdpm-search-results');
  if (!div) return;
  if (!q || q.length < 2) { div.innerHTML = '<p style="color:#999;font-size:12px">Tapez au moins 2 caracteres...</p>'; return; }
  if (!_bdpmLoaded) { div.innerHTML = '<p style="color:#C62828;font-size:12px">⚠️ BDPM non chargee. Cliquez sur le bouton BDPM pour la telecharger.</p>'; return; }
  try {
    const results = await api(`/api/pharmacie/bdpm/search?q=${encodeURIComponent(q)}`);
    if (results.length === 0) {
      div.innerHTML = '<p style="color:#999;font-size:12px">Aucun resultat.</p>';
    } else {
      div.innerHTML = results.map(r => `
        <div style="padding:8px 10px;border-bottom:1px solid #eee;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center"
             onclick="_selectBdpmResult('${esc(r.nom.replace(/'/g,"\\'"))}','${r.cip13}')"
             onmouseover="this.style.background='#F3E5F5'" onmouseout="this.style.background=''">
          <span style="flex:1">${esc(r.nom)}</span>
          <span style="color:#999;font-size:11px;margin-left:8px">CIP: ${r.cip13}</span>
        </div>
      `).join('');
    }
  } catch(e) {
    div.innerHTML = '<p style="color:#C62828;font-size:12px">Erreur recherche.</p>';
  }
}

function _selectBdpmResult(nom, cip) {
  closeGenericModal();
  openPharmaAddDialog();
  document.getElementById('pharma-med-nom').value = nom;
  showToast('Medicament selectionne: ' + nom, 'success');
}

/* ── Modal helper ───────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
