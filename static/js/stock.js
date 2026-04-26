/**
 * stock.js — Module Gestion du Stock
 * Produits, Sorties, Réceptions, Alertes, Historique
 */

let _stockProduits = [];
let _stockSortField = 'nom';
let _stockSortAsc = true;

/* ── Init ──────────────────────────────────────────── */
let _stockLieux = [];

async function initStock() {
  await loadStockProduits();
  await loadStockKPIs();
  loadStockCategories();
  // Charger les lieux depuis le référentiel
  try {
    _stockLieux = await api('/api/unites');
  } catch(e) { _stockLieux = []; }
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
        <select id="sm-dept" class="modal-input">
          <option value="">— Sélectionner ou saisir —</option>
          ${_stockLieux.map(l => `<option value="${esc(l.nom)}">${esc(l.nom)}${l.emplacement?' — '+esc(l.emplacement):''}</option>`).join('')}
        </select>
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

/* ── Scan fiche distribution produits ─────────────── */
function openScanFicheStock() {
  const input = document.getElementById('scan-stock-input');
  input.value = '';
  input.click();
}

async function onScanFicheStockSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const overlay = document.getElementById('scan-vehicule-overlay');
  const bar     = document.getElementById('scan-vehicule-bar');
  const lbl     = document.getElementById('scan-vehicule-label');
  document.querySelector('#scan-vehicule-overlay h2').textContent = 'Lecture de la fiche stock';
  const _svIconStock = document.querySelector('#scan-vehicule-overlay [style*="font-size:40px"]');
  if (_svIconStock) _svIconStock.textContent = '📦';
  overlay.style.display = 'flex';
  let sPct = 5; bar.style.width = sPct + '%';
  lbl.textContent = 'Envoi du document…';
  const sCrawl = setInterval(() => { if (sPct < 90) { sPct = Math.min(90, sPct + 1.8); bar.style.width = sPct + '%'; } }, 80);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/stock/scan-fiche', { method: 'POST', body: formData });
    clearInterval(sCrawl); bar.style.width = '95%';
    lbl.textContent = 'Extraction des produits…';
    await new Promise(r => setTimeout(r, 400));
    const data = await res.json();

    if (!res.ok) {
      overlay.style.display = 'none';
      showToast(data.error || 'Erreur scan', 'error');
      return;
    }

    bar.style.width = '100%';
    lbl.textContent = 'Terminé !';
    await new Promise(r => setTimeout(r, 400));
    overlay.style.display = 'none';

    _afficherPreviewScanStock(data);

  } catch (e) {
    clearInterval(sCrawl);
    overlay.style.display = 'none';
    showToast('Erreur : ' + e.message, 'error');
  }
}

function _afficherPreviewScanStock(data) {
  const entries = data.entries || [];

  const lignes = entries.map((entry, i) => {
    const prodOpts = _stockProduits.map(p =>
      `<option value="${p.id}" ${p.id == entry.produit_id ? 'selected' : ''}>${esc(p.nom)} (${esc(p.unite)})</option>`
    ).join('');
    return `
      <tr>
        <td style="padding:4px"><input type="checkbox" id="ss-chk-${i}" checked></td>
        <td style="padding:4px">
          <select id="ss-prod-${i}" class="modal-input" style="padding:4px 6px;font-size:12px;width:100%">
            <option value="">— Non identifié —</option>${prodOpts}
          </select>
        </td>
        <td style="padding:4px">
          <input id="ss-qte-${i}" type="number" class="modal-input" value="${entry.quantite||1}" min="0.01" step="0.01" style="width:70px;padding:4px;font-size:12px;">
        </td>
      </tr>`;
  }).join('');

  const today = new Date().toISOString().slice(0,10);

  openModal('📦 Fiche de distribution détectée — vérifier', `
    <div style="display:grid;gap:10px;padding:4px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="modal-label">Département / Unité</label>
          <input id="ss-dept" class="modal-input" value="${esc(data.departement||'')}" placeholder="Ex: Cuisine, Bureau 2...">
        </div>
        <div>
          <label class="modal-label">Date (YYYY-MM-DD)</label>
          <input id="ss-date" class="modal-input" type="date" value="${data.date ? _ddmmyyyyToISO(data.date) : today}">
        </div>
      </div>
      ${entries.length ? `
      <div>
        <label class="modal-label">Produits détectés — cochez ceux à enregistrer en sortie</label>
        <div style="max-height:240px;overflow-y:auto;border:1px solid #E0E0E0;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#F5F4FF">
              <th style="padding:6px;width:30px">✓</th>
              <th style="padding:6px;text-align:left">Produit</th>
              <th style="padding:6px;width:80px">Qté remise</th>
            </tr></thead>
            <tbody>${lignes}</tbody>
          </table>
        </div>
      </div>` : '<p style="color:#9CA3AF;font-size:13px">Aucun produit détecté sur cette fiche.</p>'}
    </div>
  `, async () => {
    const dept  = document.getElementById('ss-dept').value.trim();
    const date  = document.getElementById('ss-date').value || today;

    const taches = [];
    entries.forEach((_, i) => {
      const chk  = document.getElementById(`ss-chk-${i}`);
      const pid  = parseInt(document.getElementById(`ss-prod-${i}`).value);
      const qte  = parseFloat(document.getElementById(`ss-qte-${i}`).value);
      if (chk?.checked && pid && qte > 0) {
        taches.push(api('/api/stock/mouvements', 'POST', {
          produit_id: pid, type: 'sortie', quantite: qte,
          departement: dept, date, notes: 'Fiche scannée'
        }));
      }
    });

    if (!taches.length) { showToast('Aucune ligne cochée', 'error'); return false; }
    try {
      await Promise.all(taches);
      showToast(`✅ ${taches.length} sortie(s) enregistrée(s)`, 'success');
      await loadStockProduits();
      await loadStockKPIs();
      switchTab('stock', 'sorties-tab');
      loadStockMvts('sortie');
    } catch (e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

function _ddmmyyyyToISO(ddmmyyyy) {
  // Convertit DD-MM-YYYY → YYYY-MM-DD pour input[type=date]
  const m = ddmmyyyy.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : new Date().toISOString().slice(0,10);
}

/* ══════════════════════════════════════════════════════
   ONGLET ANALYSE DE DONNÉES
══════════════════════════════════════════════════════ */
let _analyseChartDept = null, _analyseChartProd = null;

async function renderStockAnalyse() {
  try {
    const jours = document.getElementById('stock-analyse-jours')?.value || '30';
    let url = '/api/stock/mouvements?type=sortie';
    if (jours !== '0') url += `&jours=${jours}`;
    const mvts = await api(url);

    const pal1 = ['#1565C0','#C62828','#2E7D32','#E65100','#6A1B9A','#00838F','#AD1457','#F9A825','#37474F','#558B2F'];
    const pal2 = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E67E22','#95A5A6','#D35400','#27AE60'];

    // Par département
    const byDept = {};
    mvts.forEach(m => {
      const d = m.departement || 'Non spécifié';
      byDept[d] = (byDept[d] || 0) + (m.quantite || 0);
    });
    const deptList = Object.entries(byDept).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const ctxDept = document.getElementById('chart-stock-dept')?.getContext('2d');
    if (ctxDept) {
      if (_analyseChartDept) _analyseChartDept.destroy();
      _analyseChartDept = new Chart(ctxDept, {
        type: 'bar',
        data: {
          labels: deptList.map(([d]) => d.length > 18 ? d.slice(0, 16) + '…' : d),
          datasets: [{ data: deptList.map(([, v]) => Math.round(v * 10) / 10), backgroundColor: deptList.map((_, i) => pal1[i % pal1.length]), borderRadius: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Quantité sortie' } } }
        }
      });
    }

    // Par produit
    const byProd = {};
    mvts.forEach(m => {
      const p = m.produit_nom || 'Inconnu';
      byProd[p] = (byProd[p] || 0) + (m.quantite || 0);
    });
    const prodList = Object.entries(byProd).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const ctxProd = document.getElementById('chart-stock-prod')?.getContext('2d');
    if (ctxProd) {
      if (_analyseChartProd) _analyseChartProd.destroy();
      _analyseChartProd = new Chart(ctxProd, {
        type: 'bar',
        data: {
          labels: prodList.map(([p]) => p.length > 20 ? p.slice(0, 18) + '…' : p),
          datasets: [{ data: prodList.map(([, v]) => Math.round(v * 10) / 10), backgroundColor: prodList.map((_, i) => pal2[i % pal2.length]), borderRadius: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Quantité sortie' } } }
        }
      });
    }
  } catch (e) {
    console.error('Erreur analyse stock:', e);
    showToast('Erreur chargement analyse stock', 'error');
  }
}
