/**
 * pharmacie.js — Module Pharmacie Sécurisée
 * Gestion du stock médicaments, péremptions, mouvements, alertes, stats
 */

/* ── Constantes ─────────────────────────────────────── */
const PHARMA_KEY = 'bm_pharmacie';   // {etab: {stock:[], mouvements:[], archive:[]}}
const SEUIL_ROUGE  = 30;   // jours — URGENT
const SEUIL_ORANGE = 90;   // jours — ATTENTION

const PHARMA_ROLES = [
  'Infirmier du matin',
  "Infirmier de l'après-midi",
  'Infirmier de nuit',
  'Médecin'
];

const PHARMA_EMPLACEMENTS = [
  'Armoire principale',
  'Réfrigérateur',
  'Chariot urgence',
  'Bureau infirmier',
  'Réserve'
];

/* ── State ──────────────────────────────────────────── */
let _pharmaData    = { stock: [], mouvements: [], archive: [] };
let _pharmaFilter  = 'tous';   // tous | alertes | perimes
let _pharmaSearch  = '';
let _pharmaSortCol = 0;
let _pharmaSortAsc = true;
let _pharmaSimple  = true;     // vue simple par défaut
let _pharmaStatsChart1 = null;
let _pharmaStatsChart2 = null;

/* ── Data helpers ───────────────────────────────────── */
function _getPharmaAll() {
  const raw = localStorage.getItem(PHARMA_KEY);
  return raw ? JSON.parse(raw) : {};
}

function _getPharmaData(etab) {
  const all = _getPharmaAll();
  return all[etab] || { stock: [], mouvements: [], archive: [] };
}

function _savePharmaData(etab, data) {
  const all = _getPharmaAll();
  all[etab] = data;
  localStorage.setItem(PHARMA_KEY, JSON.stringify(all));
}

/* ── Jours restants ─────────────────────────────────── */
function pharmaJoursRestants(datePer) {
  if (!datePer) return null;
  // Accepte ISO (YYYY-MM-DD) ou DD-MM-YYYY ou DD/MM/YYYY ou MM-YYYY
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePer)) {
    d = new Date(datePer + 'T00:00:00');
  } else if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(datePer)) {
    const p = datePer.split(/[-\/]/);
    d = new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`);
  } else if (/^\d{2}[-\/]\d{4}$/.test(datePer)) {
    const p = datePer.split(/[-\/]/);
    const m = parseInt(p[0]), y = parseInt(p[1]);
    d = new Date(y, m, 0); // dernier jour du mois
  } else {
    return null;
  }
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

/* ── Statut ─────────────────────────────────────────── */
function pharmaStatut(jours) {
  if (jours === null) return { label: '⚠️', cls: 'badge-gray', color: '#9E9E9E', key: 'unknown' };
  if (jours < 0)           return { label: '🔴 PERIME',    cls: 'badge-red',    color: '#C62828', key: 'perime' };
  if (jours < SEUIL_ROUGE) return { label: '🟠 URGENT',    cls: 'badge-orange', color: '#EF6C00', key: 'urgent' };
  if (jours < SEUIL_ORANGE)return { label: '🟡 ATTENTION', cls: 'badge-orange', color: '#F9A825', key: 'attention' };
  return { label: '🟢 OK', cls: 'badge-green', color: '#2E7D32', key: 'ok' };
}

/* ── Init ───────────────────────────────────────────── */
function initPharmacie() {
  const etab = getCurrentEtab();
  _pharmaData = _getPharmaData(etab);

  // Demo data si vide
  if (_pharmaData.stock.length === 0 && _pharmaData.mouvements.length === 0) {
    _loadPharmaDemoData();
    _savePharmaData(etab, _pharmaData);
  }

  renderPharmaTable();
  _updatePharmaBadges();

  // Bind search
  const s = document.getElementById('pharma-search');
  if (s) s.oninput = debounce(() => { _pharmaSearch = s.value; renderPharmaTable(); }, 200);
}

/* ── Badges header ──────────────────────────────────── */
function _updatePharmaBadges() {
  const stock = _pharmaData.stock;
  const total = stock.length;
  let alertes = 0, ok = 0;
  stock.forEach(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    const s = pharmaStatut(j);
    if (s.key === 'ok') ok++;
    else alertes++;
  });
  const bTotal   = document.getElementById('pharma-badge-total');
  const bAlertes = document.getElementById('pharma-badge-alertes');
  const bOk      = document.getElementById('pharma-badge-ok');
  if (bTotal)   bTotal.textContent   = `${total} produit${total > 1 ? 's' : ''}`;
  if (bAlertes) bAlertes.textContent = `${alertes} alerte${alertes > 1 ? 's' : ''}`;
  if (bOk)      bOk.textContent      = `${ok} OK`;
}

/* ── Filtres rapides ────────────────────────────────── */
function setPharmaFilter(f) {
  _pharmaFilter = f;
  document.querySelectorAll('.pharma-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  renderPharmaTable();
}

/* ── Toggle vue simple/complète ─────────────────────── */
function togglePharmaView() {
  _pharmaSimple = !_pharmaSimple;
  const btn = document.getElementById('pharma-view-toggle');
  if (btn) btn.textContent = _pharmaSimple ? '☰ Vue complète' : '☰ Vue simple';
  // Toggle colonnes cachables
  document.querySelectorAll('.pharma-col-extra').forEach(el => {
    el.style.display = _pharmaSimple ? 'none' : '';
  });
}

/* ── Tri ────────────────────────────────────────────── */
function setPharmaSortCol(col) {
  if (_pharmaSortCol === col) _pharmaSortAsc = !_pharmaSortAsc;
  else { _pharmaSortCol = col; _pharmaSortAsc = true; }
  renderPharmaTable();
}

/* ── Render table ───────────────────────────────────── */
function renderPharmaTable() {
  const tbody = document.getElementById('pharma-tbody');
  if (!tbody) return;

  let list = [..._pharmaData.stock];

  // Filtre texte
  if (_pharmaSearch) {
    const q = _pharmaSearch.toLowerCase();
    list = list.filter(m =>
      (m.nom_medicament || '').toLowerCase().includes(q) ||
      (m.lot || '').toLowerCase().includes(q) ||
      (m.emplacement || '').toLowerCase().includes(q)
    );
  }

  // Filtre rapide
  if (_pharmaFilter === 'alertes') {
    list = list.filter(m => {
      const j = pharmaJoursRestants(m.date_peremption);
      return j !== null && j < SEUIL_ORANGE;
    });
  } else if (_pharmaFilter === 'perimes') {
    list = list.filter(m => {
      const j = pharmaJoursRestants(m.date_peremption);
      return j !== null && j < 0;
    });
  }

  // Enrichir avec jours
  list.forEach(m => { m._jours = pharmaJoursRestants(m.date_peremption); });

  // Tri
  const cols = ['nom_medicament', 'lot', 'date_peremption', '_jours', 'quantite', 'stock_minimum', 'emplacement'];
  const key = cols[_pharmaSortCol] || 'nom_medicament';
  list.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (typeof va === 'string') va = (va || '').toLowerCase();
    if (typeof vb === 'string') vb = (vb || '').toLowerCase();
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (va < vb) return _pharmaSortAsc ? -1 : 1;
    if (va > vb) return _pharmaSortAsc ? 1 : -1;
    return 0;
  });

  // Indicateurs tri dans thead
  document.querySelectorAll('#pharma-stock-table thead th').forEach((th, i) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (i === _pharmaSortCol) th.classList.add(_pharmaSortAsc ? 'sorted-asc' : 'sorted-desc');
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="12">Aucun médicament trouvé.</td></tr>';
    return;
  }

  const extra = _pharmaSimple ? 'style="display:none"' : '';

  tbody.innerHTML = list.map((m, idx) => {
    const j = m._jours;
    const st = pharmaStatut(j);
    const rowBg = st.key === 'perime' ? 'background:#FFEBEE;' : (idx % 2 ? 'background:#FAFCFF;' : '');
    const bulletColor = st.color;
    const joursText = j !== null ? j : '—';
    const stockBas = m.stock_minimum > 0 && m.quantite <= m.stock_minimum;

    return `<tr style="${rowBg}">
      <td><span style="color:${bulletColor};font-size:16px">●</span> ${esc(m.nom_medicament)}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.lot)}</td>
      <td>${formatDateFR(m.date_peremption)}</td>
      <td style="font-weight:700;color:${st.color}">${joursText}</td>
      <td style="${stockBas ? 'color:#C62828;font-weight:700' : ''}">${m.quantite}${stockBas ? ' ⚠️' : ''}</td>
      <td class="pharma-col-extra" ${extra}>${m.stock_minimum || 0}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.emplacement)}</td>
      <td class="pharma-col-extra" ${extra}>${formatDateFR(m.date_ajout)}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.derniere_sortie || '—')}</td>
      <td class="pharma-col-extra" ${extra}>${esc(m.personne_entree || '—')}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue" onclick="openPharmaDetails('${m.id}')" title="Détails">👁</button>
          <button class="btn-sm btn-sm-green" onclick="openPharmaEdit('${m.id}')" title="Modifier">✏</button>
          <button class="btn-sm btn-sm-red" onclick="deletePharmaItem('${m.id}')" title="Supprimer">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Dialog Ajouter ─────────────────────────────────── */
function openPharmaAddDialog() {
  document.getElementById('modal-pharma-title').textContent = '➕ Ajouter un médicament';
  document.getElementById('pharma-form-id').value = '';
  document.getElementById('pharma-med-nom').value = '';
  document.getElementById('pharma-med-lot').value = '';
  document.getElementById('pharma-med-peremption').value = '';
  document.getElementById('pharma-med-quantite').value = '1';
  document.getElementById('pharma-med-minimum').value = '0';
  document.getElementById('pharma-med-emplacement').value = '';
  document.getElementById('pharma-med-personne').value = '';
  document.getElementById('pharma-med-date-entree').value = today();
  document.getElementById('modal-pharma').classList.remove('hidden');
}

/* ── Dialog Modifier ────────────────────────────────── */
function openPharmaEdit(id) {
  const m = _pharmaData.stock.find(x => x.id === id);
  if (!m) return;
  document.getElementById('modal-pharma-title').textContent = '✏️ Modifier le médicament';
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

/* ── Sauvegarder médicament ─────────────────────────── */
function savePharmaItem() {
  const id   = document.getElementById('pharma-form-id').value;
  const nom  = document.getElementById('pharma-med-nom').value.trim();
  const lot  = document.getElementById('pharma-med-lot').value.trim();
  const per  = document.getElementById('pharma-med-peremption').value.trim();
  const qte  = parseInt(document.getElementById('pharma-med-quantite').value) || 1;
  const min  = parseInt(document.getElementById('pharma-med-minimum').value) || 0;
  const empl = document.getElementById('pharma-med-emplacement').value.trim();
  const pers = document.getElementById('pharma-med-personne').value.trim();
  const dateE= document.getElementById('pharma-med-date-entree').value;

  if (!nom) { showToast('Le nom du médicament est requis.', 'error'); return; }
  if (!per) { showToast('La date de péremption est requise.', 'error'); return; }

  const etab = getCurrentEtab();

  if (id) {
    // Modification
    const m = _pharmaData.stock.find(x => x.id === id);
    if (m) {
      m.nom_medicament = nom;
      m.lot = lot;
      m.date_peremption = per;
      m.quantite = qte;
      m.stock_minimum = min;
      m.emplacement = empl;
      m.personne_entree = pers;
      m.date_ajout = dateE;
    }
    showToast('Médicament modifié.', 'success');
  } else {
    // Vérifier duplicat (même nom + lot + péremption)
    const dup = _pharmaData.stock.find(x =>
      x.nom_medicament === nom && x.lot === lot && x.date_peremption === per
    );
    if (dup) {
      dup.quantite += qte;
      showToast(`Quantité ajoutée au stock existant (total : ${dup.quantite}).`, 'info');
    } else {
      _pharmaData.stock.push({
        id: uuid(),
        nom_medicament: nom,
        lot: lot,
        date_peremption: per,
        quantite: qte,
        stock_minimum: min,
        emplacement: empl,
        personne_entree: pers,
        date_ajout: dateE || today(),
        derniere_sortie: ''
      });
      showToast('Médicament ajouté au stock.', 'success');
    }

    // Enregistrer mouvement réception
    _pharmaData.mouvements.push({
      id: uuid(),
      type: 'reception',
      nom_medicament: nom,
      quantite: qte,
      personne: pers,
      role: pers,
      date_mouvement: today(),
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });
  }

  _savePharmaData(etab, _pharmaData);
  closeModal('modal-pharma');
  renderPharmaTable();
  _updatePharmaBadges();
}

/* ── Détails ────────────────────────────────────────── */
function openPharmaDetails(id) {
  const m = _pharmaData.stock.find(x => x.id === id);
  if (!m) return;

  const j = pharmaJoursRestants(m.date_peremption);
  const st = pharmaStatut(j);
  const stockBas = m.stock_minimum > 0 && m.quantite <= m.stock_minimum;

  const html = `
    <div class="provider-detail-card">
      <h3 style="color:${st.color}">💊 ${esc(m.nom_medicament)}</h3>
      <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value"><span class="badge ${st.cls}">${st.label}</span></span></div>
      <div class="detail-row"><span class="detail-label">N° de lot</span><span class="detail-value">${esc(m.lot) || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Date péremption</span><span class="detail-value">${formatDateFR(m.date_peremption)}</span></div>
      <div class="detail-row"><span class="detail-label">Jours restants</span><span class="detail-value" style="font-weight:700;color:${st.color}">${j !== null ? j + ' jours' : '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Quantité</span><span class="detail-value">${m.quantite}${stockBas ? ' <span style="color:#C62828">⚠️ Stock bas</span>' : ''}</span></div>
      <div class="detail-row"><span class="detail-label">Stock minimum</span><span class="detail-value">${m.stock_minimum || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${esc(m.emplacement) || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Date d'entrée</span><span class="detail-value">${formatDateFR(m.date_ajout)}</span></div>
      <div class="detail-row"><span class="detail-label">Réceptionné par</span><span class="detail-value">${esc(m.personne_entree) || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Dernière sortie</span><span class="detail-value">${m.derniere_sortie ? formatDateFR(m.derniere_sortie) : '—'}</span></div>
    </div>`;

  document.getElementById('pharma-detail-body').innerHTML = html;
  document.getElementById('modal-pharma-detail').classList.remove('hidden');
}

/* ── Supprimer → archive ────────────────────────────── */
function deletePharmaItem(id) {
  const m = _pharmaData.stock.find(x => x.id === id);
  if (!m) return;
  if (!confirmAction(`Supprimer "${m.nom_medicament}" du stock ?`)) return;

  _pharmaData.stock = _pharmaData.stock.filter(x => x.id !== id);
  _pharmaData.archive.push({ ...m, date_suppression: today() });
  _savePharmaData(getCurrentEtab(), _pharmaData);
  renderPharmaTable();
  _updatePharmaBadges();
  showToast(`"${m.nom_medicament}" déplacé en corbeille.`, 'warning');
}

/* ── Sortie de stock ────────────────────────────────── */
function openPharmaSortie() {
  // Remplir le select des médicaments
  const sel = document.getElementById('pharma-sortie-med');
  const meds = [...new Set(_pharmaData.stock.map(m => m.nom_medicament))].sort();
  sel.innerHTML = meds.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  document.getElementById('pharma-sortie-qte').value = '1';
  document.getElementById('pharma-sortie-personne').value = '';
  document.getElementById('modal-pharma-sortie').classList.remove('hidden');
}

function savePharmaSortie() {
  const nom  = document.getElementById('pharma-sortie-med').value;
  const qte  = parseInt(document.getElementById('pharma-sortie-qte').value) || 0;
  const pers = document.getElementById('pharma-sortie-personne').value.trim();

  if (!nom) { showToast('Sélectionnez un médicament.', 'error'); return; }
  if (qte <= 0) { showToast('Quantité invalide.', 'error'); return; }

  // Trouver l'article (prendre celui qui expire le plus tôt — FIFO)
  const candidates = _pharmaData.stock
    .filter(m => m.nom_medicament === nom && m.quantite > 0)
    .sort((a, b) => {
      const ja = pharmaJoursRestants(a.date_peremption) ?? 9999;
      const jb = pharmaJoursRestants(b.date_peremption) ?? 9999;
      return ja - jb;
    });

  if (candidates.length === 0) { showToast('Aucun stock disponible.', 'error'); return; }

  let restant = qte;
  let totalDispo = candidates.reduce((s, m) => s + m.quantite, 0);
  if (qte > totalDispo) {
    showToast(`Stock insuffisant (disponible : ${totalDispo}).`, 'error');
    return;
  }

  // Retirer en FIFO
  for (const m of candidates) {
    if (restant <= 0) break;
    const retire = Math.min(restant, m.quantite);
    m.quantite -= retire;
    m.derniere_sortie = today();
    restant -= retire;

    // Alerte stock bas
    if (m.stock_minimum > 0 && m.quantite <= m.stock_minimum && m.quantite > 0) {
      showToast(`⚠️ Stock bas pour "${m.nom_medicament}" (reste : ${m.quantite})`, 'warning');
    }
  }

  // Supprimer les articles à quantité 0
  _pharmaData.stock = _pharmaData.stock.filter(m => m.quantite > 0);

  // Enregistrer mouvement
  _pharmaData.mouvements.push({
    id: uuid(),
    type: 'sortie',
    nom_medicament: nom,
    quantite: qte,
    personne: pers,
    role: pers,
    date_mouvement: today(),
    heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  });

  _savePharmaData(getCurrentEtab(), _pharmaData);
  closeModal('modal-pharma-sortie');
  renderPharmaTable();
  _updatePharmaBadges();
  showToast(`Sortie de ${qte} unité(s) de "${nom}" enregistrée.`, 'success');
}

/* ── Retirer tous les périmés ───────────────────────── */
function removePharmaPerimes() {
  const perimes = _pharmaData.stock.filter(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    return j !== null && j < 0;
  });
  if (perimes.length === 0) { showToast('Aucun médicament périmé.', 'info'); return; }
  if (!confirmAction(`Retirer ${perimes.length} médicament(s) périmé(s) du stock ?`)) return;

  perimes.forEach(m => {
    _pharmaData.archive.push({ ...m, date_suppression: today(), motif: 'perime' });
  });
  _pharmaData.stock = _pharmaData.stock.filter(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    return j === null || j >= 0;
  });

  _savePharmaData(getCurrentEtab(), _pharmaData);
  renderPharmaTable();
  _updatePharmaBadges();
  showToast(`${perimes.length} médicament(s) périmé(s) retiré(s).`, 'success');
}

/* ── Corbeille / Archive ────────────────────────────── */
function showPharmaCorbeille() {
  const tbody = document.getElementById('pharma-corbeille-tbody');
  const list = _pharmaData.archive || [];

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Corbeille vide.</td></tr>';
  } else {
    tbody.innerHTML = list.map(m => `<tr>
      <td>${esc(m.nom_medicament)}</td>
      <td>${esc(m.lot)}</td>
      <td>${formatDateFR(m.date_peremption)}</td>
      <td>${m.quantite}</td>
      <td>${esc(m.emplacement)}</td>
      <td>${formatDateFR(m.date_suppression)}</td>
      <td><button class="btn-sm btn-sm-green" onclick="restorePharmaItem('${m.id}')">↩️ Restaurer</button></td>
    </tr>`).join('');
  }
  document.getElementById('modal-pharma-corbeille').classList.remove('hidden');
}

function restorePharmaItem(id) {
  const idx = _pharmaData.archive.findIndex(x => x.id === id);
  if (idx < 0) return;
  const m = _pharmaData.archive.splice(idx, 1)[0];
  delete m.date_suppression;
  delete m.motif;
  _pharmaData.stock.push(m);
  _savePharmaData(getCurrentEtab(), _pharmaData);
  showPharmaCorbeille();
  renderPharmaTable();
  _updatePharmaBadges();
  showToast(`"${m.nom_medicament}" restauré.`, 'success');
}

function viderPharmaCorbeille() {
  if (!_pharmaData.archive.length) return;
  if (!confirmAction('Vider définitivement la corbeille ?')) return;
  _pharmaData.archive = [];
  _savePharmaData(getCurrentEtab(), _pharmaData);
  showPharmaCorbeille();
  showToast('Corbeille vidée.', 'success');
}

/* ── Historique mouvements ──────────────────────────── */
function showPharmaHistorique() {
  _renderPharmaHistorique();
  document.getElementById('modal-pharma-historique').classList.remove('hidden');
}

function _renderPharmaHistorique() {
  const periodeSel = document.getElementById('pharma-hist-periode');
  const jours = parseInt(periodeSel?.value) || 0;
  const tbody = document.getElementById('pharma-hist-tbody');

  let list = [..._pharmaData.mouvements].reverse();

  // Filtre période
  if (jours > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - jours);
    const cutStr = cutoff.toISOString().slice(0, 10);
    list = list.filter(m => m.date_mouvement >= cutStr);
  }

  // Badges
  const sorties    = list.filter(m => m.type === 'sortie').reduce((s, m) => s + m.quantite, 0);
  const receptions = list.filter(m => m.type === 'reception').reduce((s, m) => s + m.quantite, 0);
  const bSort = document.getElementById('pharma-hist-sorties');
  const bRecp = document.getElementById('pharma-hist-receptions');
  if (bSort) bSort.textContent = `${sorties} sortie${sorties > 1 ? 's' : ''}`;
  if (bRecp) bRecp.textContent = `${receptions} réception${receptions > 1 ? 's' : ''}`;

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Aucun mouvement.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const typeLabel = m.type === 'sortie'
      ? '<span style="color:#EF6C00;font-weight:700">📤 Sortie</span>'
      : '<span style="color:#2E7D32;font-weight:700">📥 Réception</span>';
    return `<tr>
      <td>${formatDateFR(m.date_mouvement)}</td>
      <td>${esc(m.heure)}</td>
      <td>${typeLabel}</td>
      <td>${esc(m.nom_medicament)}</td>
      <td style="font-weight:700">${m.quantite}</td>
      <td>${esc(m.personne)}</td>
      <td>${esc(m.role)}</td>
    </tr>`;
  }).join('');
}

/* ── Export CSV ──────────────────────────────────────── */
function exportPharmaCSV() {
  const headers = ['Médicament', 'Lot', 'Péremption', 'Jours', 'Statut', 'Qté', 'Stock min', 'Emplacement', 'Date ajout'];
  const rows = _pharmaData.stock.map(m => {
    const j = pharmaJoursRestants(m.date_peremption);
    const st = pharmaStatut(j);
    return [m.nom_medicament, m.lot, m.date_peremption, j ?? '', st.label.replace(/[🔴🟠🟡🟢⚠️]/g, '').trim(), m.quantite, m.stock_minimum, m.emplacement, m.date_ajout];
  });
  exportCSV(rows, headers, `pharmacie_stock_${today()}.csv`);
  showToast('Export CSV téléchargé.', 'success');
}

/* ── Statistiques ───────────────────────────────────── */
function initPharmaStats() {
  _renderPharmaStats();
}

function _renderPharmaStats() {
  const periodeSel = document.getElementById('pharma-stats-periode');
  const jours = parseInt(periodeSel?.value) || 0;

  // Période de filtrage
  let cutStr = '2000-01-01';
  if (jours > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - jours);
    cutStr = cutoff.toISOString().slice(0, 10);
  }

  const mouvs = _pharmaData.mouvements.filter(m => jours === 0 || m.date_mouvement >= cutStr);
  const stock = _pharmaData.stock;

  // KPIs
  const sorties    = mouvs.filter(m => m.type === 'sortie').reduce((s, m) => s + m.quantite, 0);
  const receptions = mouvs.filter(m => m.type === 'reception').reduce((s, m) => s + m.quantite, 0);
  let stockBas = 0, perimes30 = 0, okCount = 0;
  stock.forEach(m => {
    if (m.stock_minimum > 0 && m.quantite <= m.stock_minimum) stockBas++;
    const j = pharmaJoursRestants(m.date_peremption);
    if (j !== null && j < SEUIL_ROUGE) perimes30++;
    if (j !== null && j >= SEUIL_ORANGE) okCount++;
  });

  _setKPI('pharma-kpi-sorties', sorties, `unités sur ${jours || 'toute la'} ${jours ? 'jours' : 'période'}`);
  _setKPI('pharma-kpi-receptions', receptions, `unités reçues`);
  _setKPI('pharma-kpi-stockbas', stockBas, `produit${stockBas > 1 ? 's' : ''} sous le seuil`);
  _setKPI('pharma-kpi-perimes', perimes30, `périmé${perimes30 > 1 ? 's' : ''} ou < 30j`);
  _setKPI('pharma-kpi-ok', okCount, `produit${okCount > 1 ? 's' : ''} > 3 mois`);

  // Top 10 sorties
  const sortiesByMed = {};
  mouvs.filter(m => m.type === 'sortie').forEach(m => {
    sortiesByMed[m.nom_medicament] = (sortiesByMed[m.nom_medicament] || 0) + m.quantite;
  });
  const top10 = Object.entries(sortiesByMed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Chart 1 — Top 10 bar
  const ctx1 = document.getElementById('pharma-chart-top10');
  if (ctx1) {
    if (_pharmaStatsChart1) _pharmaStatsChart1.destroy();
    const palette = ['#5C9BD6','#6DBF8A','#F0A070','#A880C8','#E88080','#50B8C8','#A08070','#F0C060','#80A0B8','#90C070'];
    _pharmaStatsChart1 = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: top10.map(x => x[0].length > 25 ? x[0].slice(0, 22) + '…' : x[0]),
        datasets: [{
          data: top10.map(x => x[1]),
          backgroundColor: top10.map((_, i) => palette[i % palette.length]),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: '#F0F0F0' } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // Chart 2 — Distribution (donut)
  const ctx2 = document.getElementById('pharma-chart-distrib');
  if (ctx2) {
    if (_pharmaStatsChart2) _pharmaStatsChart2.destroy();
    // Distribution par statut
    let counts = { 'OK (>3 mois)': 0, 'Attention (<3 mois)': 0, 'Urgent (<30j)': 0, 'Périmé': 0 };
    stock.forEach(m => {
      const j = pharmaJoursRestants(m.date_peremption);
      if (j === null) return;
      if (j < 0) counts['Périmé']++;
      else if (j < SEUIL_ROUGE) counts['Urgent (<30j)']++;
      else if (j < SEUIL_ORANGE) counts['Attention (<3 mois)']++;
      else counts['OK (>3 mois)']++;
    });
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const colors = ['#66BB6A', '#FFA726', '#EF5350', '#C62828'];

    _pharmaStatsChart2 = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } }
        }
      }
    });
  }
}

function _setKPI(id, value, sub) {
  const card = document.getElementById(id);
  if (!card) return;
  card.querySelector('.kpi-value').textContent = value;
  card.querySelector('.kpi-sub').textContent = sub;
}

/* ── Données démo ───────────────────────────────────── */
function _loadPharmaDemoData() {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  _pharmaData.stock = [
    {
      id: uuid(), nom_medicament: 'Doliprane 1000mg', lot: 'LOT-2025-A1',
      date_peremption: iso(addDays(now, 450)), quantite: 120, stock_minimum: 20,
      emplacement: 'Armoire principale', personne_entree: 'Infirmier du matin',
      date_ajout: iso(addDays(now, -90)), derniere_sortie: iso(addDays(now, -2))
    },
    {
      id: uuid(), nom_medicament: 'Ibuprofène 400mg', lot: 'LOT-2025-B3',
      date_peremption: iso(addDays(now, 180)), quantite: 45, stock_minimum: 10,
      emplacement: 'Armoire principale', personne_entree: "Infirmier de l'après-midi",
      date_ajout: iso(addDays(now, -60)), derniere_sortie: iso(addDays(now, -5))
    },
    {
      id: uuid(), nom_medicament: 'Amoxicilline 500mg', lot: 'LOT-2024-C7',
      date_peremption: iso(addDays(now, 22)), quantite: 8, stock_minimum: 5,
      emplacement: 'Réfrigérateur', personne_entree: 'Médecin',
      date_ajout: iso(addDays(now, -180)), derniere_sortie: iso(addDays(now, -10))
    },
    {
      id: uuid(), nom_medicament: 'Ventoline spray', lot: 'LOT-2025-D2',
      date_peremption: iso(addDays(now, 75)), quantite: 6, stock_minimum: 3,
      emplacement: 'Chariot urgence', personne_entree: 'Infirmier de nuit',
      date_ajout: iso(addDays(now, -45)), derniere_sortie: ''
    },
    {
      id: uuid(), nom_medicament: 'Sérum physiologique', lot: 'LOT-2025-E9',
      date_peremption: iso(addDays(now, 300)), quantite: 200, stock_minimum: 50,
      emplacement: 'Réserve', personne_entree: 'Infirmier du matin',
      date_ajout: iso(addDays(now, -30)), derniere_sortie: iso(addDays(now, -1))
    },
    {
      id: uuid(), nom_medicament: 'Bisoprolol 5mg', lot: 'LOT-2024-F4',
      date_peremption: iso(addDays(now, -15)), quantite: 3, stock_minimum: 5,
      emplacement: 'Armoire principale', personne_entree: 'Médecin',
      date_ajout: iso(addDays(now, -200)), derniere_sortie: iso(addDays(now, -30))
    },
    {
      id: uuid(), nom_medicament: 'Lovenox 4000UI', lot: 'LOT-2025-G1',
      date_peremption: iso(addDays(now, 120)), quantite: 15, stock_minimum: 5,
      emplacement: 'Réfrigérateur', personne_entree: 'Infirmier du matin',
      date_ajout: iso(addDays(now, -20)), derniere_sortie: ''
    },
    {
      id: uuid(), nom_medicament: 'Spasfon Lyoc', lot: 'LOT-2025-H8',
      date_peremption: iso(addDays(now, 500)), quantite: 30, stock_minimum: 10,
      emplacement: 'Bureau infirmier', personne_entree: "Infirmier de l'après-midi",
      date_ajout: iso(addDays(now, -15)), derniere_sortie: ''
    },
    {
      id: uuid(), nom_medicament: 'Augmentin 1g', lot: 'LOT-2024-I2',
      date_peremption: iso(addDays(now, 10)), quantite: 4, stock_minimum: 3,
      emplacement: 'Armoire principale', personne_entree: 'Médecin',
      date_ajout: iso(addDays(now, -120)), derniere_sortie: iso(addDays(now, -7))
    },
    {
      id: uuid(), nom_medicament: 'Dafalgan 500mg', lot: 'LOT-2025-J5',
      date_peremption: iso(addDays(now, 250)), quantite: 80, stock_minimum: 15,
      emplacement: 'Armoire principale', personne_entree: 'Infirmier du matin',
      date_ajout: iso(addDays(now, -40)), derniere_sortie: iso(addDays(now, -3))
    }
  ];

  // Mouvements démo
  const mouvDays = [1, 2, 3, 5, 7, 10, 14, 20, 25, 30];
  _pharmaData.mouvements = [];
  mouvDays.forEach(d => {
    const med = _pharmaData.stock[Math.floor(Math.random() * _pharmaData.stock.length)];
    _pharmaData.mouvements.push({
      id: uuid(), type: Math.random() > 0.4 ? 'sortie' : 'reception',
      nom_medicament: med.nom_medicament,
      quantite: Math.floor(Math.random() * 5) + 1,
      personne: PHARMA_ROLES[Math.floor(Math.random() * PHARMA_ROLES.length)],
      role: PHARMA_ROLES[Math.floor(Math.random() * PHARMA_ROLES.length)],
      date_mouvement: iso(addDays(now, -d)),
      heure: `${8 + Math.floor(Math.random() * 10)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
    });
  });

  _pharmaData.archive = [];
}

/* ── Modal helper ───────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
