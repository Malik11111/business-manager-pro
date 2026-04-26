/**
 * cles.js — Module Gestion des Clés
 * CRUD clés, employés, attributions + scanner USB
 */

let _clesList = [];
let _employesList = [];
let _attribsList = [];
let _clesPersFilterContrat = '';

/* ── Init ──────────────────────────────────────────── */
async function initCles() {
  await Promise.all([loadCles(), loadEmployesCles(), loadAttribs()]);
  renderClesKPIs();
  loadAlertesClesBadge();
}

async function loadAlertesClesBadge() {
  try {
    const data = await api('/api/cles/alertes');
    const total = (data.partis?.length || 0) + (data.bientot?.length || 0);
    const badge = document.getElementById('alertes-cles-badge');
    if (badge) {
      if (total > 0) { badge.textContent = total; badge.style.display = 'inline'; }
      else badge.style.display = 'none';
    }
  } catch(e) {}
}

async function loadAlertesCles() {
  try {
    const data = await api('/api/cles/alertes');
    renderAlertesCles(data);
  } catch(e) { showToast('Erreur alertes', 'error'); }
}

function renderAlertesCles(data) {
  const container = document.getElementById('alertes-cles-container');
  if (!container) return;
  const partis  = data.partis  || [];
  const bientot = data.bientot || [];

  if (!partis.length && !bientot.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#6B7280">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:600">Aucune alerte</div>
      <div style="font-size:13px;margin-top:6px">Toutes les clés sont à jour.</div>
    </div>`;
    return;
  }

  const cardStyle = (bg, border) =>
    `background:${bg};border-left:4px solid ${border};border-radius:8px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06)`;

  const clesList = cles => cles.map(c =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.06);border-radius:10px;padding:2px 8px;font-size:12px;margin:2px">
      🔑 ${esc(c.cle_nom)}${c.cle_numero ? ` <span style="color:#6B7280">(${esc(c.cle_numero)})</span>` : ''}
    </span>`
  ).join('');

  let html = '';

  if (partis.length) {
    html += `<div>
      <div style="font-size:13px;font-weight:700;color:#991B1B;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        🚨 PARTIS — Clés non rendues (${partis.length} personne${partis.length>1?'s':''})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${partis.map(p => `<div style="${cardStyle('#FEF2F2','#EF4444')}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div>
              <span style="font-weight:700;font-size:14px">${esc(p.prenom)} ${esc(p.nom)}</span>
              <span style="color:#6B7280;font-size:12px;margin-left:8px">${esc(p.poste||'')}</span>
            </div>
            <div style="text-align:right">
              <span style="background:#FEE2E2;color:#991B1B;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700">
                Parti le ${esc(p.date_depart)} · il y a ${p.jours_retard} jour${p.jours_retard>1?'s':''}
              </span>
            </div>
          </div>
          <div style="margin-top:8px">${clesList(p.cles)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  if (bientot.length) {
    html += `<div>
      <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        ⚠️ DÉPART IMMINENT — À surveiller (${bientot.length} personne${bientot.length>1?'s':''})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${bientot.map(p => {
          const urgent = p.jours_restants <= 14;
          return `<div style="${cardStyle(urgent?'#FFFBEB':'#FEFCE8', urgent?'#F59E0B':'#EAB308')}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-weight:700;font-size:14px">${esc(p.prenom)} ${esc(p.nom)}</span>
                <span style="color:#6B7280;font-size:12px;margin-left:8px">${esc(p.poste||'')}</span>
              </div>
              <div style="text-align:right">
                <span style="background:${urgent?'#FEF3C7':'#FEF9C3'};color:#92400E;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700">
                  Départ le ${esc(p.date_depart)} · dans ${p.jours_restants} jour${p.jours_restants>1?'s':''}
                </span>
              </div>
            </div>
            <div style="margin-top:8px">${clesList(p.cles)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   CLÉS
══════════════════════════════════════════════════ */

async function loadCles() {
  try {
    _clesList = await api('/api/cles/cles');
    renderCles(_clesList);
  } catch(e) {}
}

function renderCles(list) {
  const tbody = document.getElementById('cles-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aucune clé enregistrée.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => {
    const dispo = c.disponibles;
    const color = dispo === 0 ? '#C62828' : dispo < c.quantite_totale ? '#EF6C00' : '#2E7D32';
    return `<tr>
      <td style="font-weight:700;color:#5C52CC">${esc(c.numero||'—')}</td>
      <td style="font-weight:600">${esc(c.nom)}</td>
      <td style="text-align:center">${c.quantite_totale}</td>
      <td style="text-align:center;color:#EF6C00;font-weight:700">${c.attribuees}</td>
      <td style="text-align:center;color:${color};font-weight:700">${dispo}</td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue" onclick="openEditCleDialog(${c.id})">✏️</button>
          <button class="btn-sm btn-sm-green" onclick="openAttribuerDialog(${c.id})">📋</button>
          <button class="btn-sm btn-sm-red"  onclick="deleteCle(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterCles() {
  const q = (document.getElementById('cles-search')?.value || '').toLowerCase();
  renderCles(_clesList.filter(c =>
    c.nom.toLowerCase().includes(q) || (c.numero||'').toLowerCase().includes(q)
  ));
}

function openAddCleDialog() {
  openModal('🔑 Ajouter une clé', `
    <div style="display:grid;gap:10px;padding:4px">
      <div><label class="modal-label">N° de clé</label><input id="m-cle-num" class="modal-input" placeholder="Ex: K001"></div>
      <div><label class="modal-label">Nom *</label><input id="m-cle-nom" class="modal-input" placeholder="Ex: Bureau direction"></div>
      <div><label class="modal-label">Quantité</label><input id="m-cle-qte" class="modal-input" type="number" value="1" min="1"></div>
    </div>`, async () => {
    const nom = document.getElementById('m-cle-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api('/api/cles/cles', 'POST', {
      numero: document.getElementById('m-cle-num')?.value.trim(),
      nom,
      quantite_totale: parseInt(document.getElementById('m-cle-qte')?.value)||1
    });
    showToast('Clé ajoutée', 'success');
    await initCles();
  });
}

async function openEditCleDialog(id) {
  const c = _clesList.find(x => x.id === id);
  if (!c) return;
  openModal('✏️ Modifier la clé', `
    <div style="display:grid;gap:10px;padding:4px">
      <div><label class="modal-label">N° de clé</label><input id="m-cle-num" class="modal-input" value="${esc(c.numero||'')}"></div>
      <div><label class="modal-label">Nom *</label><input id="m-cle-nom" class="modal-input" value="${esc(c.nom)}"></div>
      <div><label class="modal-label">Quantité</label><input id="m-cle-qte" class="modal-input" type="number" value="${c.quantite_totale}" min="1"></div>
    </div>`, async () => {
    const nom = document.getElementById('m-cle-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api(`/api/cles/cles/${id}`, 'PUT', {
      numero: document.getElementById('m-cle-num')?.value.trim(),
      nom,
      quantite_totale: parseInt(document.getElementById('m-cle-qte')?.value)||1
    });
    showToast('Clé modifiée', 'success');
    await initCles();
  });
}

async function deleteCle(id) {
  const c = _clesList.find(x => x.id === id);
  if (!confirmAction(`Supprimer la clé "${c?.nom}" ?`)) return;
  try {
    await api(`/api/cles/cles/${id}`, 'DELETE');
    showToast('Clé supprimée', 'success');
    await initCles();
  } catch(e) { showToast(e.message || 'Erreur', 'error'); }
}

/* ══════════════════════════════════════════════════
   EMPLOYÉS
══════════════════════════════════════════════════ */

async function loadEmployesCles() {
  try {
    _employesList = await api('/api/cles/employes');
    buildClesEmployesFilters();
    filterEmployesCles();
  } catch(e) {}
}

function buildClesEmployesFilters() {
  const container = document.getElementById('cles-emp-contrat-pills');
  if (!container) return;
  const allPill = `<button onclick="_setClesPersContrat('')" style="padding:3px 10px;border-radius:12px;border:2px solid ${_clesPersFilterContrat===''?'#5C52CC':'#D1D5DB'};background:${_clesPersFilterContrat===''?'#5C52CC':'#fff'};color:${_clesPersFilterContrat===''?'#fff':'#374151'};font-size:11px;font-weight:600;cursor:pointer;">Tous</button>`;
  const pills = (_CONTRAT_PALETTE || []).map(c => {
    const active = _clesPersFilterContrat === c.label;
    return `<button onclick="_setClesPersContrat('${c.label}')" style="padding:3px 10px;border-radius:12px;border:2px solid ${active?c.color:'#D1D5DB'};background:${active?c.color:'#fff'};color:${active?'#fff':'#374151'};font-size:11px;font-weight:600;cursor:pointer;${active?'box-shadow:0 0 6px '+c.color+'88;':''}">${c.label}</button>`;
  });
  container.innerHTML = allPill + pills.join('');
}

function _setClesPersContrat(val) {
  _clesPersFilterContrat = val;
  buildClesEmployesFilters();
  filterEmployesCles();
}

function filterEmployesCles() {
  const q = (document.getElementById('cles-emp-search')?.value || '').toLowerCase();
  const list = _employesList.filter(e => {
    if (_clesPersFilterContrat && e.type_contrat !== _clesPersFilterContrat) return false;
    if (q && ![e.nom, e.prenom, e.poste, e.type_contrat].some(v => (v||'').toLowerCase().includes(q))) return false;
    return true;
  });
  renderEmployesCles(list);
}

function renderEmployesCles(list) {
  const tbody = document.getElementById('employes-cles-tbody');
  if (!tbody) return;
  const countEl = document.getElementById('cles-emp-count');
  if (countEl) countEl.textContent = `${list.length} employé${list.length > 1 ? 's' : ''}`;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Aucun employé enregistré.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(e => {
    const clesBadges = (e.cles||[]).map(c =>
      `<span style="background:#E8EAF6;color:#3949AB;border-radius:10px;padding:2px 8px;font-size:11px;margin:2px;display:inline-block;">🔑 ${esc(c.nom)}</span>`
    ).join('') || '<span style="color:#9CA3AF;font-size:11px">Aucune</span>';
    const contratBadge = (typeof _contratStyle === 'function')
      ? `<span style="${_contratStyle(e.type_contrat)}">${esc(e.type_contrat||'—')}</span>`
      : `<span style="background:#E0E0E0;color:#374151;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700">${esc(e.type_contrat||'—')}</span>`;
    return `<tr>
      <td style="font-weight:700">${esc(e.nom)}</td>
      <td>${esc(e.prenom)}</td>
      <td>${contratBadge}</td>
      <td style="font-size:12px;color:#5C52CC">${esc(e.poste||'—')}</td>
      <td style="font-size:12px">${esc(e.date_arrivee||'—')}</td>
      <td style="font-size:12px;color:${e.date_depart?'#DC2626':'#9CA3AF'}">${esc(e.date_depart||'—')}</td>
      <td>${clesBadges}</td>
      <td>
        <div class="row-actions">
          <button class="btn-sm btn-sm-blue"  onclick="openEditEmployeDialog(${e.id})">✏️</button>
          <button class="btn-sm btn-sm-green" onclick="openAttribuerDialog(null, ${e.id})">🔑</button>
          <button class="btn-sm btn-sm-red"   onclick="deleteEmploye(${e.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function syncClesFromConfig() {
  try {
    const res = await api('/api/cles/sync-config', 'POST');
    showToast(`${res.added} employé(s) chargé(s) depuis Config`, 'success');
    await initCles();
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddEmployeDialog() {
  openModal('👤 Ajouter un employé', _employeForm(), async () => {
    const nom = document.getElementById('m-emp-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api('/api/cles/employes', 'POST', _employeFormData());
    showToast('Employé ajouté', 'success');
    await initCles();
  });
}

async function openEditEmployeDialog(id) {
  const e = _employesList.find(x => x.id === id);
  if (!e) return;
  openModal('✏️ Modifier l\'employé', _employeForm(e), async () => {
    const nom = document.getElementById('m-emp-nom')?.value.trim();
    if (!nom) { showToast('Nom requis', 'error'); return false; }
    await api(`/api/cles/employes/${id}`, 'PUT', _employeFormData());
    showToast('Employé modifié', 'success');
    await initCles();
  });
}

function _employeForm(e) {
  const CONTRATS = ['CDI','CDD','Intérim','Stage','Apprentissage','Bénévolat','Intervenant ext','Autre'];
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px">
    <div><label class="modal-label">Nom *</label><input id="m-emp-nom" class="modal-input" value="${esc(e?.nom||'')}"></div>
    <div><label class="modal-label">Prénom</label><input id="m-emp-prenom" class="modal-input" value="${esc(e?.prenom||'')}"></div>
    <div><label class="modal-label">Type contrat</label>
      <select id="m-emp-contrat" class="modal-input">
        ${CONTRATS.map(c => `<option ${c===(e?.type_contrat||'CDI')?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div><label class="modal-label">Poste</label><input id="m-emp-poste" class="modal-input" value="${esc(e?.poste||'')}"></div>
    <div><label class="modal-label">Date d'arrivée</label><input id="m-emp-arrivee" class="modal-input" type="date" value="${e?.date_arrivee||''}"></div>
    <div><label class="modal-label">Date de départ</label><input id="m-emp-depart" class="modal-input" type="date" value="${e?.date_depart||''}"></div>
  </div>`;
}

function _employeFormData() {
  return {
    nom: document.getElementById('m-emp-nom')?.value.trim(),
    prenom: document.getElementById('m-emp-prenom')?.value.trim(),
    type_contrat: document.getElementById('m-emp-contrat')?.value,
    poste: document.getElementById('m-emp-poste')?.value.trim(),
    date_arrivee: document.getElementById('m-emp-arrivee')?.value,
    date_depart: document.getElementById('m-emp-depart')?.value,
  };
}

async function deleteEmploye(id) {
  const e = _employesList.find(x => x.id === id);
  if (!confirmAction(`Supprimer "${e?.prenom} ${e?.nom}" ?`)) return;
  try {
    await api(`/api/cles/employes/${id}`, 'DELETE');
    showToast('Employé supprimé', 'success');
    await initCles();
  } catch(e2) { showToast(e2.message || 'Erreur', 'error'); }
}

/* ══════════════════════════════════════════════════
   ATTRIBUTIONS
══════════════════════════════════════════════════ */

async function loadAttribs() {
  try {
    _attribsList = await api('/api/cles/attributions');
    renderAttribs(_attribsList);
  } catch(e) {}
}

function renderAttribs(list) {
  const tbody = document.getElementById('attribs-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Aucune attribution en cours.</td></tr>';
    return;
  }

  // Grouper par employé (en préservant l'ordre d'apparition)
  const grouped = {};
  const order = [];
  list.forEach(a => {
    if (!grouped[a.employe_nom]) {
      grouped[a.employe_nom] = { nom: a.employe_nom, poste: a.employe_poste, cles: [] };
      order.push(a.employe_nom);
    }
    grouped[a.employe_nom].cles.push(a);
  });

  const rows = [];
  order.forEach((nom, idx) => {
    const g = grouped[nom];
    const n = g.cles.length;
    const badge = n === 1
      ? `<span style="background:#DBEAFE;color:#1E40AF;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700">1 clé</span>`
      : `<span style="background:#EDE9FE;color:#5C52CC;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700">${n} clés</span>`;

    // Ligne parent (cliquable)
    rows.push(`<tr class="attrib-parent-row" onclick="toggleAttribDetail(${idx})" style="cursor:pointer;background:#F8F8FF;border-bottom:2px solid #E5E7EB">
      <td style="width:20px;color:#5C52CC;font-size:13px;text-align:center"><span id="arrow-${idx}">▶</span></td>
      <td style="font-weight:700;padding:10px 8px">${esc(g.nom)}</td>
      <td style="font-size:12px;color:#5C52CC">${esc(g.poste||'—')}</td>
      <td>${badge}</td>
      <td style="text-align:right">
        <button class="btn-sm btn-sm-blue" onclick="event.stopPropagation();openAttribuerDialog(null, null)" title="Attribuer une clé">+ Attribuer</button>
      </td>
    </tr>`);

    // Lignes enfants — simples <tr> avec data-group, cachées par défaut
    g.cles.forEach(a => {
      rows.push(`<tr class="attrib-child-row" data-group="${idx}" style="display:none;background:#FAFBFF;border-bottom:1px solid #EEF0F8;border-left:3px solid #5C52CC">
        <td></td>
        <td style="padding-left:28px;font-size:13px;color:#374151;font-weight:500">🔑 ${esc(a.cle_nom)}</td>
        <td style="font-size:12px;color:#5C52CC">${esc(a.cle_numero||'—')}</td>
        <td style="font-size:12px;color:#9CA3AF">${esc(a.date_attribution||'—')}</td>
        <td style="text-align:right">
          <button class="btn-sm btn-sm-green" onclick="retourCle(${a.id}, '${esc(a.employe_nom)}', '${esc(a.cle_nom)}')">✅ Retour</button>
        </td>
      </tr>`);
    });
  });

  tbody.innerHTML = rows.join('');
}

function toggleAttribDetail(idx) {
  const arrow = document.getElementById('arrow-' + idx);
  const children = document.querySelectorAll(`#attribs-tbody tr[data-group="${idx}"]`);
  const isOpen = children.length > 0 && children[0].style.display !== 'none';
  children.forEach(tr => tr.style.display = isOpen ? 'none' : '');
  if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

async function retourCle(attrId, empNom, cleNom) {
  if (!confirm(`Enregistrer le retour de "${cleNom}" par ${empNom} ?`)) return;
  const today = new Date().toISOString().slice(0,10);
  await api(`/api/cles/attributions/${attrId}/retour`, 'POST', { date_retour: today });
  showToast('Retour enregistré', 'success');
  await initCles();
}

function openAttribuerDialog(cleIdPrefill, empIdPrefill) {
  const cleOptions = _clesList.filter(c => c.disponibles > 0)
    .map(c => `<option value="${c.id}" ${c.id===cleIdPrefill?'selected':''}>${esc(c.nom)} (n°${esc(c.numero||'?')}) — ${c.disponibles} dispo</option>`)
    .join('');
  const empOptions = _employesList
    .map(e => `<option value="${e.id}" ${e.id===empIdPrefill?'selected':''}>${esc(e.prenom+' '+e.nom)} — ${esc(e.poste||'')}</option>`)
    .join('');
  const today = new Date().toISOString().slice(0,10);

  openModal('📋 Attribuer une clé', `
    <div style="display:grid;gap:10px;padding:4px">
      <div><label class="modal-label">Clé *</label>
        <select id="m-attr-cle" class="modal-input">
          <option value="">— Sélectionner —</option>${cleOptions}
        </select>
      </div>
      <div><label class="modal-label">Employé *</label>
        <select id="m-attr-emp" class="modal-input">
          <option value="">— Sélectionner —</option>${empOptions}
        </select>
      </div>
      <div><label class="modal-label">Date</label>
        <input id="m-attr-date" class="modal-input" type="date" value="${today}">
      </div>
      <div><label class="modal-label">Notes</label>
        <input id="m-attr-notes" class="modal-input" placeholder="Optionnel">
      </div>
    </div>`, async () => {
    const cleId = parseInt(document.getElementById('m-attr-cle')?.value);
    const empId = parseInt(document.getElementById('m-attr-emp')?.value);
    if (!cleId || !empId) { showToast('Clé et employé requis', 'error'); return false; }
    try {
      await api('/api/cles/attributions', 'POST', {
        cle_id: cleId, employe_id: empId,
        date_attribution: document.getElementById('m-attr-date')?.value || today,
        notes: document.getElementById('m-attr-notes')?.value || ''
      });
      showToast('Clé attribuée', 'success');
      await initCles();
    } catch(e) { showToast(e.message || 'Erreur', 'error'); return false; }
  });
}

/* ══════════════════════════════════════════════════
   HISTORIQUE
══════════════════════════════════════════════════ */

async function loadHistoCles() {
  try {
    const hist = await api('/api/cles/historique');
    const tbody = document.getElementById('histo-cles-tbody');
    if (!tbody) return;
    if (!hist.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Aucun événement.</td></tr>';
      return;
    }
    const icons = {
      cle_ajoutee:'🔑', cle_modifiee:'✏️', cle_supprimee:'🗑️',
      employe_ajoute:'👤', employe_modifie:'✏️', employe_supprime:'🗑️',
      attribution:'📋', retour:'✅'
    };
    tbody.innerHTML = hist.map(h => `<tr>
      <td style="font-size:12px;color:#6B6B8A">${esc(h.event_date)}</td>
      <td>${icons[h.event_type]||'📌'} <span style="font-size:12px;font-weight:700">${esc(h.event_type.replace(/_/g,' '))}</span></td>
      <td style="font-size:12px">${esc(h.details)}</td>
    </tr>`).join('');
  } catch(e) {}
}

/* ══════════════════════════════════════════════════
   KPIs
══════════════════════════════════════════════════ */

function renderClesKPIs() {
  const el = document.getElementById('cles-kpis');
  if (!el) return;
  const totalCles = _clesList.reduce((s,c) => s+c.quantite_totale, 0);
  const totalAttrib = _clesList.reduce((s,c) => s+c.attribuees, 0);
  const totalDispo = _clesList.reduce((s,c) => s+c.disponibles, 0);
  el.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Types de clés</div><div class="kpi-value" style="color:#5C52CC">${_clesList.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total exemplaires</div><div class="kpi-value" style="color:#1565C0">${totalCles}</div></div>
    <div class="kpi-card"><div class="kpi-label">Attribuées</div><div class="kpi-value" style="color:#EF6C00">${totalAttrib}</div></div>
    <div class="kpi-card"><div class="kpi-label">Disponibles</div><div class="kpi-value" style="color:#2E7D32">${totalDispo}</div></div>
    <div class="kpi-card"><div class="kpi-label">Employés</div><div class="kpi-value" style="color:#6A1B9A">${_employesList.length}</div></div>
  `;
}

/* ══════════════════════════════════════════════════
   SCANNER USB — dialog dédié
══════════════════════════════════════════════════ */

let _scanCleDialogOpen = false;
let _scanCleBuffer = '';
let _scanCleTimeout = null;

function openScannerCleDialog() {
  if (_scanCleDialogOpen) return;
  _scanCleDialogOpen = true;
  _scanCleBuffer = '';

  const overlay = document.createElement('div');
  overlay.id = 'scanner-cle-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:4000;display:flex;align-items:center;justify-content:center;';

  overlay.innerHTML = `
    <div style="background:#1A1A2E;border-radius:14px;width:500px;max-width:96vw;box-shadow:0 20px 60px rgba(0,0,0,.5);">
      <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:14px 20px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <span style="color:#fff;font-weight:700;font-size:15px;">🔫 Scanner badge employé</span>
        <button id="sc-close" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;">✕</button>
      </div>
      <div id="sc-bar" style="background:#1B5E20;padding:10px 20px;display:flex;align-items:center;gap:10px;">
        <div id="sc-led" style="width:10px;height:10px;border-radius:50%;background:#4CAF50;box-shadow:0 0 6px #4CAF50;"></div>
        <span id="sc-status" style="color:#fff;font-size:13px;font-weight:600;">⏳ Scannez le badge d'un employé...</span>
      </div>
      <div style="padding:20px;">
        <div id="sc-result" style="display:none;margin-bottom:14px;background:#0F0F23;border-radius:10px;padding:14px;color:#fff;">
          <div id="sc-emp-info" style="font-size:14px;margin-bottom:10px;"></div>
          <div style="display:grid;gap:8px;">
            <div><label style="font-size:11px;color:#9CA3AF;display:block;margin-bottom:4px;">🔑 Clé à attribuer</label>
              <select id="sc-cle-select" style="width:100%;padding:8px;border:2px solid #3949AB;border-radius:8px;background:#0F0F23;color:#fff;font-size:13px;">
                <option value="">— Sélectionner —</option>
              </select>
            </div>
            <div><label style="font-size:11px;color:#9CA3AF;display:block;margin-bottom:4px;">📅 Date</label>
              <input id="sc-date" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:8px;border:2px solid #3949AB;border-radius:8px;background:#0F0F23;color:#fff;font-size:13px;box-sizing:border-box;">
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="sc-cancel" style="padding:9px 18px;border:1px solid #444;border-radius:8px;background:transparent;color:#ccc;cursor:pointer;">❌ Fermer</button>
          <button id="sc-save" style="display:none;padding:9px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,#2E7D32,#43A047);color:#fff;font-weight:700;cursor:pointer;">✅ Attribuer</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  let _foundEmployee = null;

  const closeDialog = () => {
    _scanCleDialogOpen = false;
    _scanCleBuffer = '';
    clearTimeout(_scanCleTimeout);
    document.removeEventListener('keydown', _scKeydown);
    overlay.remove();
  };

  document.getElementById('sc-close').onclick = closeDialog;
  document.getElementById('sc-cancel').onclick = closeDialog;

  // Remplir la liste des clés disponibles
  const cleSelect = document.getElementById('sc-cle-select');
  _clesList.filter(c => c.disponibles > 0).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `🔑 ${c.nom}${c.numero ? ' (n°'+c.numero+')' : ''} — ${c.disponibles} dispo`;
    cleSelect.appendChild(opt);
  });

  document.getElementById('sc-save').onclick = async () => {
    if (!_foundEmployee) return;
    const cleId = parseInt(document.getElementById('sc-cle-select')?.value);
    if (!cleId) { showToast('Sélectionnez une clé', 'error'); return; }
    const date = document.getElementById('sc-date')?.value || new Date().toISOString().slice(0,10);
    try {
      await api('/api/cles/attributions', 'POST', {
        employe_id: _foundEmployee.id, cle_id: cleId, date_attribution: date
      });
      showToast(`Clé attribuée à ${_foundEmployee.prenom} ${_foundEmployee.nom}`, 'success');
      closeDialog();
      await initCles();
    } catch(e) { showToast(e.message||'Erreur', 'error'); }
  };

  // Bloquer Enter sur les inputs
  overlay.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key==='Enter') e.preventDefault(); });
  });

  function _scKeydown(e) {
    if (!_scanCleDialogOpen) return;
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (_scanCleBuffer.length > 2) {
        _processScanCle(_scanCleBuffer);
      }
      _scanCleBuffer = '';
      clearTimeout(_scanCleTimeout);
      return;
    }
    if (e.key.length !== 1) return;
    const tag = document.activeElement?.tagName;
    if ((tag === 'INPUT' || tag === 'SELECT') && document.activeElement.id !== 'sc-scan-cap') return;
    _scanCleBuffer += e.key;
    clearTimeout(_scanCleTimeout);
    _scanCleTimeout = setTimeout(() => { _scanCleBuffer = ''; }, 300);
  }
  document.addEventListener('keydown', _scKeydown);

  function _processScanCle(raw) {
    const q = raw.trim().toLowerCase();
    // Chercher l'employé par nom/prénom/matricule
    const found = _employesList.find(e =>
      (e.prenom+' '+e.nom).toLowerCase().includes(q) ||
      (e.nom+' '+e.prenom).toLowerCase().includes(q) ||
      e.nom.toLowerCase() === q || e.prenom.toLowerCase() === q
    );

    const led = document.getElementById('sc-led');
    const status = document.getElementById('sc-status');
    const result = document.getElementById('sc-result');
    const empInfo = document.getElementById('sc-emp-info');
    const saveBtn = document.getElementById('sc-save');

    // Blink
    led.style.background = '#FF9800';
    led.style.boxShadow = '0 0 6px #FF9800';
    setTimeout(() => {
      led.style.background = found ? '#4CAF50' : '#C62828';
      led.style.boxShadow = `0 0 6px ${found ? '#4CAF50' : '#C62828'}`;
    }, 600);

    if (found) {
      _foundEmployee = found;
      status.textContent = `✅ Employé trouvé : ${found.prenom} ${found.nom}`;
      empInfo.innerHTML = `
        <div style="font-weight:700;font-size:15px;color:#4CAF50">${esc(found.prenom+' '+found.nom)}</div>
        <div style="font-size:12px;color:#9CA3AF;margin-top:4px">${esc(found.poste||'')} — ${esc(found.type_contrat||'')}</div>
        <div style="font-size:11px;color:#607D8B;margin-top:2px">${found.cles?.length ? found.cles.map(c=>`🔑 ${c.nom}`).join(', ') : 'Aucune clé actuellement'}</div>
      `;
      result.style.display = 'block';
      saveBtn.style.display = 'inline-block';
    } else {
      _foundEmployee = null;
      status.textContent = `⚠️ Employé non trouvé pour "${raw.slice(0,20)}"`;
      result.style.display = 'none';
      saveBtn.style.display = 'none';
    }
  }
}

/* ── Hook tab historique ─────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tab-group="cles"][data-tab-id="histo-tab"]').forEach(btn => {
    btn.addEventListener('click', loadHistoCles);
  });
});

/* ── Import Excel clés ───────────────────────────── */
function importClesExcel() {
  const input = document.getElementById('import-cles-input');
  input.value = '';
  input.click();
}

async function onImportClesFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const form = new FormData();
  form.append('file', file);
  showToast('Import en cours...', 'info');
  try {
    const res = await fetch('/api/cles/import-excel', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur import', 'error'); return; }
    showToast(`✅ ${data.added} clé(s) importée(s) — ${data.skipped} ignorée(s)`, 'success');
    await initCles();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

/* ── Scan fiche distribution de clés ─────────────── */
function openScanFicheCles() {
  const input = document.getElementById('scan-cles-input');
  input.value = '';
  input.click();
}

async function onScanFicheClsSelected(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // Overlay de chargement (réutilise le même overlay que les véhicules)
  const overlay = document.getElementById('scan-vehicule-overlay');
  const bar     = document.getElementById('scan-vehicule-bar');
  const lbl     = document.getElementById('scan-vehicule-label');
  document.querySelector('#scan-vehicule-overlay h2').textContent = 'Lecture de la fiche clés';
  const _svIcon = document.querySelector('#scan-vehicule-overlay [style*="font-size:40px"]');
  if (_svIcon) _svIcon.textContent = '🔑';
  overlay.style.display = 'flex';
  let cPct = 5; bar.style.width = cPct + '%';
  lbl.textContent = 'Envoi du document…';
  const cCrawl = setInterval(() => { if (cPct < 90) { cPct = Math.min(90, cPct + 1.8); bar.style.width = cPct + '%'; } }, 80);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/cles/scan-fiche', { method: 'POST', body: formData });
    clearInterval(cCrawl); bar.style.width = '95%';
    lbl.textContent = 'Extraction des informations…';
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

    _afficherPreviewScanCles(data);

  } catch (e) {
    clearInterval(cCrawl);
    overlay.style.display = 'none';
    showToast('Erreur : ' + e.message, 'error');
  }
}

function _afficherPreviewScanCles(data) {
  const entries = data.entries || [];
  const empOptions = _employesList.map(e =>
    `<option value="${e.id}" ${e.id == data.employee_id ? 'selected' : ''}>${esc(e.nom)} ${esc(e.prenom)} — ${esc(e.poste||'')}</option>`
  ).join('');

  const lignesCles = entries.map((entry, i) => {
    const cleFound = _clesList.find(c => c.id == entry.key_id);
    const badge = entry.confidence === 'high' ? '🟢' : entry.confidence === 'medium' ? '🟡' : '🔴';
    const cleOpts = _clesList.filter(c => c.disponibles > 0 || c.id == entry.key_id).map(c =>
      `<option value="${c.id}" ${c.id == entry.key_id ? 'selected' : ''}>${esc(c.nom)}${c.numero ? ` (N°${c.numero})` : ''}</option>`
    ).join('');
    return `
      <tr>
        <td><input type="checkbox" id="sc-chk-${i}" checked></td>
        <td style="font-size:12px;color:#6B6B8A">${badge} ${esc(entry.raw||'')}</td>
        <td>
          <select id="sc-key-${i}" class="modal-input" style="padding:4px 6px;font-size:12px;">
            <option value="">— Aucune correspondance —</option>${cleOpts}
          </select>
        </td>
      </tr>`;
  }).join('');

  openModal('📋 Fiche clés détectée — vérifier', `
    <div style="display:grid;gap:10px;padding:4px">
      <div>
        <label class="modal-label">Employé *</label>
        <select id="sc-emp" class="modal-input">
          <option value="">— Sélectionner l'employé —</option>${empOptions}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="modal-label">Date attribution</label>
          <input id="sc-date" class="modal-input" placeholder="JJ-MM-AAAA" value="${esc(data.assignment_date||'')}">
        </div>
        <div>
          <label class="modal-label">Notes</label>
          <input id="sc-notes-cle" class="modal-input" placeholder="Optionnel" value="${esc(data.notes||'')}">
        </div>
      </div>
      ${entries.length ? `
      <div>
        <label class="modal-label">Clés détectées — cochez celles à attribuer</label>
        <div style="max-height:220px;overflow-y:auto;border:1px solid #E0E0E0;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#F5F4FF">
              <th style="padding:6px;width:30px">✓</th>
              <th style="padding:6px;text-align:left">Lu sur la fiche</th>
              <th style="padding:6px;text-align:left">Clé identifiée</th>
            </tr></thead>
            <tbody>${lignesCles}</tbody>
          </table>
        </div>
      </div>` : '<p style="color:#9CA3AF;font-size:13px">Aucune clé détectée sur cette fiche.</p>'}
    </div>
  `, async () => {
    const empId = parseInt(document.getElementById('sc-emp').value);
    if (!empId) { showToast('Sélectionnez un employé', 'error'); return false; }
    const date = document.getElementById('sc-date').value.trim();
    const notes = document.getElementById('sc-notes-cle').value.trim();

    const taches = [];
    entries.forEach((_, i) => {
      const chk = document.getElementById(`sc-chk-${i}`);
      const keyId = parseInt(document.getElementById(`sc-key-${i}`).value);
      if (chk?.checked && keyId) {
        taches.push(api('/api/cles/attributions', 'POST', {
          employe_id: empId, cle_id: keyId,
          date_attribution: date, notes
        }));
      }
    });

    if (!taches.length) { showToast('Aucune clé cochée', 'error'); return false; }
    try {
      await Promise.all(taches);
      showToast(`✅ ${taches.length} clé(s) attribuée(s) avec succès`, 'success');
      await initCles();
    } catch (e) { showToast(e.message || 'Erreur attribution', 'error'); return false; }
  });
}
