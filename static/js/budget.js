/* budget.js — Budget Annuel (Travaux & Achats) */

let _budget = { lignes: [], annee: new Date().getFullYear(), annees: [] };
let _sbData = null; // résultat Gemini en attente de confirmation

// ── Scan Document Gemini ──────────────────────────────

function openBudgetScanDialog() {
  _sbData = null;
  document.getElementById('sb-progress-wrap').style.display = 'none';
  document.getElementById('sb-result').style.display = 'none';
  document.getElementById('sb-confirm-btn').style.display = 'none';
  document.getElementById('sb-file-input').value = '';
  document.getElementById('scan-budget-overlay').style.display = 'flex';
}

function closeBudgetScanDialog() {
  document.getElementById('scan-budget-overlay').style.display = 'none';
  _sbData = null;
}

document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('sb-drop-zone');
  if (!dz) return;
  dz.addEventListener('click', () => document.getElementById('sb-file-input').click());
  dz.addEventListener('dragover', e => e.preventDefault());
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) lancerBudgetScan(file);
  });
});

function onSbFileSelected(input) {
  const file = input.files[0];
  if (file) lancerBudgetScan(file);
  input.value = '';
}

async function lancerBudgetScan(file) {
  const bar   = document.getElementById('sb-progress-bar');
  const lbl   = document.getElementById('sb-progress-label');
  const wrap  = document.getElementById('sb-progress-wrap');
  const res   = document.getElementById('sb-result');
  const btn   = document.getElementById('sb-confirm-btn');
  res.style.display = 'none';
  btn.style.display = 'none';
  wrap.style.display = 'block';
  bar.style.width = '20%'; lbl.textContent = 'Envoi du fichier...';

  try {
    const form = new FormData();
    form.append('file', file);
    bar.style.width = '55%'; lbl.textContent = 'Analyse Gemini en cours...';
    const r = await fetch('/api/budget/scan-document', { method: 'POST', body: form });
    bar.style.width = '90%'; lbl.textContent = 'Traitement...';
    const data = await r.json();
    if (!r.ok) { showToast(data.error || 'Erreur', 'error'); wrap.style.display = 'none'; return; }
    bar.style.width = '100%'; lbl.textContent = 'Analyse terminée !';
    setTimeout(() => wrap.style.display = 'none', 600);

    _sbData = data;

    // Labels lisibles
    const typDoc = { facture: '🧾 Facture', devis_signe: '✅ Devis signé', devis_en_cours: '📝 Devis en cours' };
    const rea = data.realisation || '—';
    document.getElementById('sb-result-text').innerHTML =
      `<b>Type document :</b> ${typDoc[data.type_document] || data.type_document || '—'}<br>` +
      `<b>Réalisation :</b> ${rea}<br>` +
      `<b>Type :</b> ${data.type_ligne || '—'}<br>` +
      `<b>Description :</b> ${data.description || '—'}<br>` +
      `<b>Secteur :</b> ${data.secteur || '—'}<br>` +
      `<b>Entreprise :</b> ${data.entreprise || '—'}<br>` +
      `<b>Montant TTC :</b> ${data.montant_ttc ? data.montant_ttc.toLocaleString('fr-FR') + ' €' : '—'}`;

    res.style.display = 'block';
    btn.style.display = 'inline-block';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
    wrap.style.display = 'none';
  }
}

function confirmBudgetScan() {
  if (!_sbData) return;
  closeBudgetScanDialog();
  // Pré-remplir le modal avec les données Gemini
  openBudgetModal({
    description: _sbData.description || '',
    secteur:     _sbData.secteur     || '',
    type_ligne:  _sbData.type_ligne  || 'Achat',
    realisation: _sbData.realisation || 'En attente',
    entreprise:  _sbData.entreprise  || '',
    montant_ttc: _sbData.montant_ttc || 0,
    notes:       _sbData.notes       || '',
  });
}

// Couleurs par statut (reprend les couleurs Excel)
const BUDGET_COLORS = {
  'Fait':           { bg: '#FFFFFF', text: '#166534', badge: '#DCFCE7', badgeText: '#166534' },
  'Devis signé':    { bg: '#FEF9C3', text: '#854D0E', badge: '#FEF08A', badgeText: '#713F12' },
  'Devis en cours': { bg: '#FED7AA', text: '#9A3412', badge: '#FDBA74', badgeText: '#7C2D12' },
  'En attente':     { bg: '#F3F4F6', text: '#374151', badge: '#E5E7EB', badgeText: '#374151' },
};

async function initBudget() {
  try {
    const annees = await api('/api/budget/annees');
    _budget.annees = annees;
    if (!annees.includes(_budget.annee)) _budget.annee = annees[0] || new Date().getFullYear();
    await loadBudget();
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadBudget() {
  try {
    _budget.lignes = await api(`/api/budget?annee=${_budget.annee}`);
    document.getElementById('budget-annee-label').textContent = _budget.annee;
    renderBudget();
    renderBudgetKPIs();
  } catch (e) { showToast(e.message, 'error'); }
}

function budgetPrevYear() {
  _budget.annee--;
  loadBudget();
}
function budgetNextYear() {
  _budget.annee++;
  loadBudget();
}

function renderBudgetKPIs() {
  const ls = _budget.lignes;
  const total    = ls.reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const fait     = ls.filter(l => l.realisation === 'Fait').reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const encours  = ls.filter(l => l.realisation !== 'Fait' && l.realisation !== 'En attente').reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const travaux  = ls.filter(l => l.type_ligne === 'Travaux').reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const achats   = ls.filter(l => l.type_ligne === 'Achat').reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const fmt = v => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  document.getElementById('bkpi-total-v').textContent   = fmt(total);
  document.getElementById('bkpi-fait-v').textContent    = fmt(fait);
  document.getElementById('bkpi-encours-v').textContent = fmt(encours);
  document.getElementById('bkpi-travaux-v').textContent = `T: ${fmt(travaux)} / A: ${fmt(achats)}`;
}

function renderBudget() {
  const q    = (document.getElementById('budget-search')?.value || '').toLowerCase();
  const ftyp = document.getElementById('budget-filter-type')?.value || '';
  const frea = document.getElementById('budget-filter-realisation')?.value || '';

  let list = _budget.lignes.filter(l => {
    if (ftyp && l.type_ligne !== ftyp) return false;
    if (frea && l.realisation !== frea) return false;
    if (q && ![ l.description, l.secteur, l.entreprise, String(l.numero_piece) ].some(v => (v||'').toLowerCase().includes(q))) return false;
    return true;
  });

  const tbody = document.getElementById('budget-tbody');
  if (!list.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Aucune ligne pour ${_budget.annee}</td></tr>`; return; }

  tbody.innerHTML = list.map(l => {
    const c = BUDGET_COLORS[l.realisation] || BUDGET_COLORS['En attente'];
    const reaBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${c.badge};color:${c.badgeText}">${esc(l.realisation)}</span>`;
    const typBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;background:${l.type_ligne==='Travaux'?'#DBEAFE':'#F3E8FF'};color:${l.type_ligne==='Travaux'?'#1E40AF':'#6B21A8'}">${esc(l.type_ligne)}</span>`;
    const fmt = v => (v||0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
    return `<tr style="background:${c.bg};color:${c.text}">
      <td style="text-align:center;font-weight:700">${l.numero_piece}</td>
      <td style="font-weight:500">${esc(l.description)}</td>
      <td style="font-size:12px;color:inherit">${esc(l.secteur)}</td>
      <td>${typBadge}</td>
      <td>${reaBadge}</td>
      <td style="font-size:12px">${esc(l.entreprise)}</td>
      <td style="text-align:right;font-weight:600">${l.montant_ttc ? fmt(l.montant_ttc) : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn-table blue"   onclick="editBudgetLigne(${l.id})">✏️</button>
        <button class="btn-table danger" onclick="deleteBudgetLigne(${l.id})">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function openBudgetModal(prefill = null) {
  document.getElementById('modal-budget-title').textContent = prefill ? 'Modifier la ligne' : 'Ajouter une ligne';
  document.getElementById('budget-form-id').value      = prefill?.id || '';
  const maxNum = Math.max(0, ..._budget.lignes.map(l => l.numero_piece || 0));
  document.getElementById('budget-num').value          = prefill?.numero_piece ?? (maxNum + 1);
  document.getElementById('budget-type').value         = prefill?.type_ligne || 'Achat';
  document.getElementById('budget-desc').value         = prefill?.description || '';
  document.getElementById('budget-secteur').value      = prefill?.secteur || '';
  document.getElementById('budget-realisation').value  = prefill?.realisation || 'En attente';
  document.getElementById('budget-entreprise').value   = prefill?.entreprise || '';
  document.getElementById('budget-montant').value      = prefill?.montant_ttc ?? 0;
  document.getElementById('budget-notes').value        = prefill?.notes || '';
  document.getElementById('modal-budget').classList.remove('hidden');
}

function editBudgetLigne(id) {
  const l = _budget.lignes.find(x => x.id === id);
  if (l) openBudgetModal(l);
}

async function saveBudgetLigne() {
  const desc = document.getElementById('budget-desc').value.trim();
  if (!desc) { showToast('La description est requise', 'error'); return; }
  const id = document.getElementById('budget-form-id').value;
  const payload = {
    annee:        _budget.annee,
    numero_piece: parseInt(document.getElementById('budget-num').value) || 1,
    description:  desc,
    secteur:      document.getElementById('budget-secteur').value.trim(),
    type_ligne:   document.getElementById('budget-type').value,
    realisation:  document.getElementById('budget-realisation').value,
    entreprise:   document.getElementById('budget-entreprise').value.trim(),
    montant_ttc:  parseFloat(document.getElementById('budget-montant').value) || 0,
    notes:        document.getElementById('budget-notes').value.trim(),
  };
  try {
    if (id) {
      await api(`/api/budget/${id}`, 'PUT', payload);
    } else {
      await api('/api/budget', 'POST', payload);
    }
    closeModal('modal-budget');
    await loadBudget();
    showToast('Ligne enregistrée', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteBudgetLigne(id) {
  const l = _budget.lignes.find(x => x.id === id);
  if (!confirmAction(`Supprimer "${l?.description || ''}" ?`)) return;
  try {
    await api(`/api/budget/${id}`, 'DELETE');
    await loadBudget();
    showToast('Ligne supprimée', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

function exportBudgetCSV() {
  const rows = _budget.lignes.map(l => [
    l.numero_piece, l.description, l.secteur, l.type_ligne, l.realisation, l.entreprise, l.montant_ttc, l.notes
  ]);
  exportCSV(rows, ['N° Pièce','Description','Secteur','Type','Réalisation','Entreprise','Réel TTC','Notes'], `budget_${_budget.annee}.csv`);
}
