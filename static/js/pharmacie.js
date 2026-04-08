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

/* ── Modal helper ───────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
