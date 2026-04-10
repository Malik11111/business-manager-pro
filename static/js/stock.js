/**
 * stock.js — Module Gestion du Stock
 * Produits, Sorties, Réceptions, Alertes, Historique
 */

let _stockProduits = [];
let _stockSortField = 'nom';
let _stockSortAsc = true;

/* ── Init ──────────────────────────────────────────── */
async function initStock() {
  await loadStockProduits();
  await loadStockKPIs();
  loadStockCategories();
}

/* ══════════════════════════════════════════════════
   PRODUITS
══════════════════════════════════════════════════ */

async function loadStockProduits() {
  try {
    _stockProduits = await api('/api/stock/produits');
    renderStockProduits(_stockProduits);
    // Badge alertes
    const alertes = _stockProduits.filter(p => p.alerte).length;
    const badge = document.getElementById('stock-alertes-badge');
    if (badge) {
      badge.textContent = alertes;
      badge.style.display = alertes > 0 ? 'inline' : 'none';
    }
  } catch(e) {}
}

function renderStockProduits(list) {
  const tbody = document.getElementById('stock-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Aucun produit enregistré.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => {
    const manquant = Math.max(0, p.seuil_alerte - p.quantite);
    let statut, statusStyle;
    if (p.quantite === 0) {
      statut = '🔴 Rupture'; statusStyle = 'background:#FFEBEE;color:#C62828';
    } else if (p.alerte) {
      statut = '🟠 Alerte'; statusStyle = 'background:#FFF3E0;color:#EF6C00';
    } else {
      statut = '🟢 OK'; statusStyle = 'background:#E8F5E9;color:#2E7D32';
    }
    return `<tr>
      <td style="font-weight:600">${esc(p.nom)}</td>
      <td style="font-size:12px;color:#5C52CC">${esc(p.categorie||'—')}</td>
      <td style="font-weight:700;font-size:15px;text-align:center;color:${p.quantite===0?'#C62828':p.alerte?'#EF6C00':'#2E7D32'}">${p.quantite}</td>
      <td style="font-size:12px;text-align:center">${esc(p.unite)}</td>
      <td style="text-align:center;color:#9CA3AF">${p.seuil_alerte||'—'}</td>
      <td style="font-size:12px">${esc(p.emplacement||'—')}</td>
      <td><span style="${statusStyle};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">${statut}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-orange" onclick="openSortieDialog(${p.id})" title="Sortie">📤</button>
          <button class="btn-sm btn-sm-blue"   onclick="openReceptionDialog(${p.id})" title="Réception">📥</button>
          <button class="btn-sm btn-sm-gray"   onclick="openEditProduitDialog(${p.id})" title="Modifier">✏️</button>
          <button class="btn-sm btn-sm-red"    onclick="deleteStockProduit(${p.id})" title="Supprimer">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterStock() {
  const q = (document.getElementById('stock-search')?.value || '').toLowerCase();
  const cat = document.getElementById('stock-cat-filter')?.value || '';
  let list = _stockProduits.filter(p =>
    (!q || p.nom.toLowerCase().includes(q) || (p.categorie||'').toLowerCase().includes(q)) &&
    (!cat || p.categorie === cat)
  );
  // Tri
  list.sort((a, b) => {
    let va = a[_stockSortField] ?? '', vb = b[_stockSortField] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return _stockSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  renderStockProduits(list);
}

function sortStockBy(field) {
  if (_stockSortField === field) _stockSortAsc = !_stockSortAsc;
  else { _stockSortField = field; _stockSortAsc = true; }
  filterStock();
}

async function loadStockCategories() {
  try {
    const cats = await api('/api/stock/categories');
    const sel = document.getElementById('stock-cat-filter');
    if (!sel) return;
    // Garder l'option "Toutes catégories"
    while (sel.options.length > 1) sel.remove(1);
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

async function loadStockKPIs() {
  try {
    const stats = await api('/api/stock/stats');
    const el = document.getElementById('stock-kpis');
    if (!el) return;
    el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Produits</div><div class="kpi-value" style="color:#5C52CC">${stats.total_produits||0}</div></div>
      <div class="kpi-card"><div class="kpi-label">En alerte</div><div class="kpi-value" style="color:#EF6C00">${stats.alertes||0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ruptures</div><div class="kpi-value" style="color:#C62828">${stats.ruptures||0}</div></div>
    `;
  } catch(e) {}
}

/* ── Ajouter produit ─── */
function openAddProduitDialog() {
  openModal('📦 Ajouter un produit', _produitForm(), async () => {
    const nom = document.getElementById('sp-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api('/api/stock/produits', 'POST', _produitFormData());
    showToast('Produit ajouté', 'success');
    await initStock();
  });
}

async function openEditProduitDialog(id) {
  const p = _stockProduits.find(x => x.id === id);
  if (!p) return;
  openModal('✏️ Modifier le produit', _produitForm(p), async () => {
    const nom = document.getElementById('sp-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api(`/api/stock/produits/${id}`, 'PUT', _produitFormData());
    showToast('Produit modifié', 'success');
    await initStock();
  });
}

const UNITES = ['unité', 'kg', 'g', 'L', 'mL', 'boîte', 'carton', 'palette', 'rouleau', 'flacon', 'sachet', 'paquet'];
const CATEGORIES_STOCK = ['Nettoyage', 'Hygiène', 'Bureautique', 'Alimentaire', 'Médical', 'Informatique', 'Électricité', 'Plomberie', 'Entretien', 'Sécurité', 'Autre'];

function _produitForm(p) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px">
    <div style="grid-column:span 2"><label class="modal-label">Nom *</label><input id="sp-nom" class="modal-input" value="${esc(p?.nom||'')}"></div>
    <div><label class="modal-label">Catégorie</label>
      <select id="sp-cat" class="modal-input">
        <option value="">— Aucune —</option>
        ${CATEGORIES_STOCK.map(c=>`<option ${c===(p?.categorie||'')?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div><label class="modal-label">Unité</label>
      <select id="sp-unite" class="modal-input">
        ${UNITES.map(u=>`<option ${u===(p?.unite||'unité')?'selected':''}>${u}</option>`).join('')}
      </select>
    </div>
    <div><label class="modal-label">Quantité initiale</label><input id="sp-qte" class="modal-input" type="number" value="${p?.quantite??0}" min="0" step="0.01"></div>
    <div><label class="modal-label">Seuil alerte</label><input id="sp-seuil" class="modal-input" type="number" value="${p?.seuil_alerte??0}" min="0" step="0.01"></div>
    <div style="grid-column:span 2"><label class="modal-label">Emplacement</label><input id="sp-empl" class="modal-input" value="${esc(p?.emplacement||'')}"></div>
  </div>`;
}

function _produitFormData() {
  return {
    nom: document.getElementById('sp-nom')?.value.trim(),
    categorie: document.getElementById('sp-cat')?.value,
    unite: document.getElementById('sp-unite')?.value,
    quantite: parseFloat(document.getElementById('sp-qte')?.value)||0,
    seuil_alerte: parseFloat(document.getElementById('sp-seuil')?.value)||0,
    emplacement: document.getElementById('sp-empl')?.value.trim()
  };
}

async function deleteStockProduit(id) {
  const p = _stockProduits.find(x => x.id === id);
  if (!confirm(`Supprimer "${p?.nom}" et tout son historique ?`)) return;
  await api(`/api/stock/produits/${id}`, 'DELETE');
  showToast('Produit supprimé', 'success');
  await initStock();
}

/* ══════════════════════════════════════════════════
   SORTIES
══════════════════════════════════════════════════ */

function openSortieDialog(produitIdPrefill) {
  const today = new Date().toISOString().slice(0,10);
  const prodOptions = _stockProduits.map(p =>
    `<option value="${p.id}" ${p.id===produitIdPrefill?'selected':''}>${esc(p.nom)} (${p.quantite} ${esc(p.unite)})</option>`
  ).join('');

  openModal('📤 Enregistrer une sortie', `
    <div style="display:grid;gap:10px;padding:4px">
      <div><label class="modal-label">Produit *</label>
        <select id="sm-prod" class="modal-input">
          <option value="">— Sélectionner —</option>${prodOptions}
        </select>
      </div>
      <div><label class="modal-label">Quantité *</label>
        <input id="sm-qte" class="modal-input" type="number" value="1" min="0.01" step="0.01">
      </div>
      <div><label class="modal-label">Personne</label>
        <input id="sm-pers" class="modal-input" placeholder="Nom de la personne">
      </div>
      <div><label class="modal-label">Département / Unité</label>
        <input id="sm-dept" class="modal-input" placeholder="Ex: Cuisine, Bureau 2...">
      </div>
      <div><label class="modal-label">Date</label>
        <input id="sm-date" class="modal-input" type="date" value="${today}">
      </div>
      <div><label class="modal-label">Notes</label>
        <input id="sm-notes" class="modal-input" placeholder="Optionnel">
      </div>
    </div>`, async () => {
    const pid = parseInt(document.getElementById('sm-prod')?.value);
    const qte = parseFloat(document.getElementById('sm-qte')?.value);
    if (!pid) { showToast('Sélectionnez un produit', 'error'); return false; }
    if (!qte || qte <= 0) { showToast('Quantité invalide', 'error'); return false; }
    try {
      const res = await api('/api/stock/mouvements', 'POST', {
        produit_id: pid, type: 'sortie', quantite: qte,
        personne: document.getElementById('sm-pers')?.value.trim(),
        departement: document.getElementById('sm-dept')?.value.trim(),
        date: document.getElementById('sm-date')?.value || today,
        notes: document.getElementById('sm-notes')?.value.trim()
      });
      showToast(`Sortie enregistrée — stock : ${res.nouvelle_quantite}`, 'success');
      await loadStockProduits();
      await loadStockKPIs();
    } catch(e) { showToast(e.message||'Erreur', 'error'); return false; }
  });
}

/* ══════════════════════════════════════════════════
   RÉCEPTION
══════════════════════════════════════════════════ */

function openReceptionDialog(produitIdPrefill) {
  const today = new Date().toISOString().slice(0,10);
  const prodOptions = _stockProduits.map(p =>
    `<option value="${p.id}" ${p.id===produitIdPrefill?'selected':''}>${esc(p.nom)} (${p.quantite} ${esc(p.unite)})</option>`
  ).join('');

  openModal('📥 Réception / Approvisionnement', `
    <div style="display:grid;gap:10px;padding:4px">
      <div><label class="modal-label">Produit *</label>
        <select id="rm-prod" class="modal-input">
          <option value="">— Sélectionner —</option>${prodOptions}
        </select>
      </div>
      <div><label class="modal-label">Quantité reçue *</label>
        <input id="rm-qte" class="modal-input" type="number" value="1" min="0.01" step="0.01">
      </div>
      <div><label class="modal-label">Fournisseur</label>
        <input id="rm-fourn" class="modal-input" placeholder="Nom du fournisseur">
      </div>
      <div><label class="modal-label">Date</label>
        <input id="rm-date" class="modal-input" type="date" value="${today}">
      </div>
      <div><label class="modal-label">Notes</label>
        <input id="rm-notes" class="modal-input" placeholder="N° bon de livraison, etc.">
      </div>
    </div>`, async () => {
    const pid = parseInt(document.getElementById('rm-prod')?.value);
    const qte = parseFloat(document.getElementById('rm-qte')?.value);
    if (!pid) { showToast('Sélectionnez un produit', 'error'); return false; }
    if (!qte || qte <= 0) { showToast('Quantité invalide', 'error'); return false; }
    try {
      const res = await api('/api/stock/mouvements', 'POST', {
        produit_id: pid, type: 'reception', quantite: qte,
        personne: document.getElementById('rm-fourn')?.value.trim(),
        date: document.getElementById('rm-date')?.value || today,
        notes: document.getElementById('rm-notes')?.value.trim()
      });
      showToast(`Réception enregistrée — stock : ${res.nouvelle_quantite}`, 'success');
      await loadStockProduits();
      await loadStockKPIs();
    } catch(e) { showToast(e.message||'Erreur', 'error'); return false; }
  });
}

/* ══════════════════════════════════════════════════
   MOUVEMENTS (sorties / réceptions / historique)
══════════════════════════════════════════════════ */

async function loadStockMvts(type) {
  let jours = 30;
  let tbodyId, tableId;
  if (type === 'sortie') {
    jours = parseInt(document.getElementById('stock-sorties-jours')?.value||30);
    tbodyId = 'sorties-tbody'; tableId = 'sorties-table';
  } else if (type === 'reception') {
    jours = parseInt(document.getElementById('stock-receptions-jours')?.value||30);
    tbodyId = 'receptions-tbody'; tableId = 'receptions-table';
  } else {
    tbodyId = 'histo-stock-tbody'; tableId = 'histo-stock-table';
    jours = 0;
  }

  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  try {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (jours > 0) params.set('jours', jours);
    const mvts = await api('/api/stock/mouvements?' + params.toString());

    if (!mvts.length) {
      const cols = type === 'sortie' ? 7 : type === 'reception' ? 6 : 7;
      tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}">Aucun mouvement.</td></tr>`;
      return;
    }

    if (type === 'sortie') {
      tbody.innerHTML = mvts.map(m => `<tr>
        <td style="font-size:12px">${esc(m.date)}</td>
        <td style="font-weight:600">${esc(m.produit_nom)}</td>
        <td style="color:#EF6C00;font-weight:700">${m.quantite}</td>
        <td style="font-size:12px">${esc(m.produit_unite)}</td>
        <td style="font-size:12px">${esc(m.personne||'—')}</td>
        <td style="font-size:12px;color:#5C52CC">${esc(m.departement||'—')}</td>
        <td style="font-size:11px;color:#9CA3AF">${esc(m.notes||'—')}</td>
      </tr>`).join('');
    } else if (type === 'reception') {
      tbody.innerHTML = mvts.map(m => `<tr>
        <td style="font-size:12px">${esc(m.date)}</td>
        <td style="font-weight:600">${esc(m.produit_nom)}</td>
        <td style="color:#2E7D32;font-weight:700">+${m.quantite}</td>
        <td style="font-size:12px">${esc(m.produit_unite)}</td>
        <td style="font-size:12px">${esc(m.personne||'—')}</td>
        <td style="font-size:11px;color:#9CA3AF">${esc(m.notes||'—')}</td>
      </tr>`).join('');
    } else {
      tbody.innerHTML = mvts.map(m => {
        const isSortie = m.type === 'sortie';
        return `<tr>
          <td style="font-size:12px">${esc(m.date)}</td>
          <td><span style="background:${isSortie?'#FFF3E0':'#E8F5E9'};color:${isSortie?'#EF6C00':'#2E7D32'};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${isSortie?'📤 Sortie':'📥 Réception'}</span></td>
          <td style="font-weight:600">${esc(m.produit_nom)}</td>
          <td style="font-weight:700;color:${isSortie?'#EF6C00':'#2E7D32'}">${isSortie?'-':'+'} ${m.quantite}</td>
          <td style="font-size:12px">${esc(m.personne||'—')}</td>
          <td style="font-size:12px;color:#5C52CC">${esc(m.departement||'—')}</td>
          <td style="font-size:11px;color:#9CA3AF">${esc(m.notes||'—')}</td>
        </tr>`;
      }).join('');
    }
  } catch(e) {}
}

/* ══════════════════════════════════════════════════
   ALERTES
══════════════════════════════════════════════════ */

async function loadStockAlertes() {
  const tbody = document.getElementById('alertes-stock-tbody');
  if (!tbody) return;
  try {
    const alertes = await api('/api/stock/alertes');
    if (!alertes.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">✅ Aucune alerte — tous les stocks sont suffisants.</td></tr>';
      return;
    }
    tbody.innerHTML = alertes.map(p => {
      const manquant = Math.max(0, p.seuil_alerte - p.quantite).toFixed(2);
      const isRupture = p.quantite === 0;
      return `<tr>
        <td style="font-weight:700">${esc(p.nom)}</td>
        <td style="font-size:12px;color:#5C52CC">${esc(p.categorie||'—')}</td>
        <td style="font-weight:700;color:${isRupture?'#C62828':'#EF6C00'}">${p.quantite} ${esc(p.unite)}</td>
        <td style="color:#9CA3AF">${p.seuil_alerte} ${esc(p.unite)}</td>
        <td style="font-weight:700;color:#C62828">${manquant} ${esc(p.unite)}</td>
        <td>
          <button class="btn-sm btn-sm-blue" onclick="openReceptionDialog(${p.id})">📥 Réapprovisionner</button>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {}
}

/* ══════════════════════════════════════════════════
   EXPORT CSV
══════════════════════════════════════════════════ */

function exportStockCSV() {
  const headers = ['Nom', 'Catégorie', 'Quantité', 'Unité', 'Seuil alerte', 'Emplacement', 'Statut'];
  const rows = _stockProduits.map(p => [
    p.nom, p.categorie, p.quantite, p.unite, p.seuil_alerte, p.emplacement,
    p.quantite === 0 ? 'Rupture' : p.alerte ? 'Alerte' : 'OK'
  ]);
  exportCSV(rows, headers, 'stock_' + new Date().toISOString().slice(0,10) + '.csv');
}
