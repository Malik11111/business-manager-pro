/* budget.js — Budget Annuel (Travaux & Achats) */

let _budget = { lignes: [], annee: new Date().getFullYear(), annees: [] };
// ── Scan Document Gemini ──────────────────────────────

function openBudgetScanDialog() {
  document.getElementById('sb-file-input').click();
}

function closeBudgetScanDialog() {
  document.getElementById('scan-budget-overlay').style.display = 'none';
}

function sbRetourUpload() {
  document.getElementById('sb-step-upload').style.display = 'block';
  document.getElementById('sb-step-preview').style.display = 'none';
}


function onSbFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  _showSbLoading();
  lancerBudgetScan(file);
}

function _showSbLoading() {
  document.getElementById('sb-step-upload').style.display = 'block';
  document.getElementById('sb-step-preview').style.display = 'none';
  document.getElementById('sb-progress-bar').style.width = '10%';
  document.getElementById('sb-progress-label').textContent = 'Chargement...';
  document.getElementById('scan-budget-overlay').style.display = 'flex';
}

function htToTTCBudget() {
  const inp = document.getElementById('sb-montant');
  inp.value = (parseFloat(inp.value) * 1.20).toFixed(2);
}

async function lancerBudgetScan(file) {
  const bar = document.getElementById('sb-progress-bar');
  const lbl = document.getElementById('sb-progress-label');

  let cur = 0, target = 5;
  bar.style.width = '0%'; lbl.textContent = 'Analyse 0%';

  const anim = setInterval(() => {
    const diff = target - cur;
    if (diff > 0.05) {
      cur = Math.min(target, cur + Math.max(0.12, diff * 0.035));
      bar.style.width = cur + '%';
      lbl.textContent = 'Analyse ' + Math.round(cur) + '%';
    }
  }, 40);

  const crawl = setInterval(() => {
    if (target < 90) target = Math.min(90, target + 1.8);
  }, 80);

  try {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/budget/scan-document', { method: 'POST', body: form });

    clearInterval(crawl);
    target = 100;
    await new Promise(res => setTimeout(res, 600));
    clearInterval(anim);
    bar.style.width = '100%'; lbl.textContent = 'Analyse 100%';

    const data = await r.json();
    if (!r.ok) { showToast(data.error || 'Erreur', 'error'); closeBudgetScanDialog(); return; }
    await new Promise(res => setTimeout(res, 400));

    document.getElementById('sb-desc').value        = data.description || '';
    document.getElementById('sb-secteur').value     = data.secteur     || '';
    document.getElementById('sb-type').value        = data.type_ligne  || 'Achat';
    document.getElementById('sb-realisation').value = data.realisation || 'En attente';
    document.getElementById('sb-entreprise').value  = data.entreprise  || '';
    document.getElementById('sb-montant').value     = data.montant_ttc || 0;
    document.getElementById('sb-notes').value       = data.notes       || '';

    document.getElementById('sb-step-upload').style.display  = 'none';
    document.getElementById('sb-step-preview').style.display = 'block';
  } catch (e) {
    clearInterval(crawl); clearInterval(anim);
    showToast('Erreur : ' + e.message, 'error');
    closeBudgetScanDialog();
  }
}

async function enregistrerBudgetScanne() {
  const desc = document.getElementById('sb-desc').value.trim();
  if (!desc) { showToast('La description est requise', 'error'); return; }
  const maxNum = Math.max(0, ..._budget.lignes.map(l => l.numero_piece || 0));
  const payload = {
    annee:        _budget.annee,
    numero_piece: maxNum + 1,
    description:  desc,
    secteur:      document.getElementById('sb-secteur').value.trim(),
    type_ligne:   document.getElementById('sb-type').value,
    realisation:  document.getElementById('sb-realisation').value,
    entreprise:   document.getElementById('sb-entreprise').value.trim(),
    montant_ttc:  parseFloat(document.getElementById('sb-montant').value) || 0,
    notes:        document.getElementById('sb-notes').value.trim(),
  };
  try {
    await api('/api/budget', 'POST', payload);
    closeBudgetScanDialog();
    await loadBudget();
    showToast('✅ Ligne ajoutée depuis le document scanné', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// Couleurs par statut (reprend les couleurs Excel)
const BUDGET_COLORS = {
  'Fait':           { bg: '#FFFFFF', text: '#166534', badge: '#DCFCE7', badgeText: '#166534' },
  'Devis signé':    { bg: '#FEF9C3', text: '#854D0E', badge: '#FEF08A', badgeText: '#713F12' },
  'Devis en cours': { bg: '#FED7AA', text: '#9A3412', badge: '#FDBA74', badgeText: '#7C2D12' },
  'En attente':     { bg: '#F3F4F6', text: '#374151', badge: '#E5E7EB', badgeText: '#374151' },
};

function _populateSecteurDatalist() {
  const dl = document.getElementById('budget-secteur-list');
  if (!dl) return;
  dl.innerHTML = '';
  // Lieux en premier
  (_actifs?.unites || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.nom;
    opt.label = '📍 ' + u.nom;
    dl.appendChild(opt);
  });
  // Personnel ensuite
  (_actifs?.personnel || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = `${p.nom} ${p.prenom}`;
    opt.label = '👤 ' + `${p.nom} ${p.prenom}`;
    dl.appendChild(opt);
  });
}

async function initBudget() {
  try {
    const annees = await api('/api/budget/annees');
    _budget.annees = annees;
    if (!annees.includes(_budget.annee)) _budget.annee = annees[0] || new Date().getFullYear();
    _populateSecteurDatalist();
    await loadBudget();
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadBudget() {
  try {
    _budget.lignes = await api(`/api/budget?annee=${_budget.annee}`);
    document.getElementById('budget-annee-label').textContent = _budget.annee;
    renderBudget();
    renderBudgetKPIs();
    loadBudgetPrevisionnel();
  } catch (e) { showToast(e.message, 'error'); }
}

function saveBudgetPrevisionnel() {
  const val = parseFloat(document.getElementById('budget-prev-input')?.value) || 0;
  localStorage.setItem(`budget_prev_${_budget.annee}`, val > 0 ? val : '');
}

function loadBudgetPrevisionnel() {
  const saved = localStorage.getItem(`budget_prev_${_budget.annee}`);
  const inp = document.getElementById('budget-prev-input');
  if (inp) inp.value = saved || '';
  renderBudgetPrevisionnel();
}

function renderBudgetPrevisionnel() {
  const prev = parseFloat(document.getElementById('budget-prev-input')?.value) || 0;
  const total = _budget.lignes.reduce((s, l) => s + (l.montant_ttc || 0), 0);
  const result = document.getElementById('budget-prev-result');
  if (!result) return;

  if (prev <= 0) { result.style.display = 'none'; return; }
  result.style.display = 'flex';

  const reste = prev - total;
  const pct = Math.min(100, (total / prev) * 100);
  const over = total > prev;
  const fmt = v => Math.abs(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  document.getElementById('budget-prev-engage').textContent =
    `Engagé : ${fmt(total)} sur ${fmt(prev)}`;

  const resteEl = document.getElementById('budget-prev-reste');
  if (over) {
    resteEl.textContent = `⚠️ Dépassement : ${fmt(Math.abs(reste))}`;
    resteEl.style.background = '#FEE2E2';
    resteEl.style.color = '#991B1B';
  } else {
    resteEl.textContent = `✅ Reste : ${fmt(reste)}`;
    resteEl.style.background = '#DCFCE7';
    resteEl.style.color = '#166534';
  }

  const fill = document.getElementById('budget-prev-bar-fill');
  fill.style.width = pct + '%';
  fill.style.background = over ? '#EF4444' : pct > 80 ? '#F59E0B' : '#22C55E';

  document.getElementById('budget-prev-pct').textContent = Math.round(pct) + '% utilisé';
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
  document.getElementById('bkpi-travaux-v').textContent = `T: ${fmt(travaux)}`;
  document.getElementById('bkpi-achats-v').textContent  = `/ A: ${fmt(achats)}`;
  renderBudgetPrevisionnel();
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
