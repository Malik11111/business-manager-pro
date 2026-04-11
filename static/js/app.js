/**
 * app.js — Application principale
 * Navigation, etablissements, initialisation
 */

/* ── Modules disponibles ────────────────────────────────── */
const MODULES = [
  { id: 'prestataires', icon: '🤝', label: 'Prestataires', ready: true },
  { id: 'actifs',       icon: '🏢', label: 'Actifs',       ready: true },
  { id: 'cles',         icon: '🔑', label: 'Clés',         ready: true },
  { id: 'stock',        icon: '📦', label: 'Stock',        ready: true },
  { id: 'auto',         icon: '🚗', label: 'Parc Auto',    ready: true },
  { id: 'analyse',      icon: '📄', label: 'Analyse PDF',  ready: true },
  { id: 'pharmacie',    icon: '💊', label: 'Pharmacie',    ready: true },
];

let _activeModule = 'prestataires';

/* ── Demarrage ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCurrentUser();
  buildSidebar();
  await buildEtabSelector();
  bindEvents();
  updateHeaderForRole();
  navigateTo('prestataires');
});

/* ── Affichage conditionnel selon le role ───────────────── */
function updateHeaderForRole() {
  const adminBtn = document.getElementById('btn-admin-panel');
  if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin());
  const roleTag = document.getElementById('user-role-tag');
  if (roleTag) {
    const role = getCurrentUserRole();
    roleTag.textContent = role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : '';
    roleTag.classList.toggle('hidden', role === 'user');
  }
}

/* ── Sidebar ────────────────────────────────────────────── */
function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = MODULES.map(m => `
    <div class="sidebar-item${m.id === _activeModule ? ' active' : ''}"
         id="nav-${m.id}"
         onclick="navigateTo('${m.id}')"
         title="${m.label}">
      <span class="icon">${m.icon}</span>
      <span>${m.label}</span>
      ${!m.ready ? '<span class="soon">bientot</span>' : ''}
    </div>
  `).join('');
  // Ajouter Admin si le role est admin+
  if (isAdmin()) {
    nav.innerHTML += `
      <div class="sidebar-section" style="margin-top:16px">Administration</div>
      <div class="sidebar-item" id="nav-admin" onclick="navigateTo('admin')" title="Administration">
        <span class="icon">👑</span>
        <span>Admin</span>
      </div>`;
  }
}

function navigateTo(moduleId) {
  _activeModule = moduleId;

  // Mettre a jour la sidebar
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${moduleId}`)?.classList.add('active');

  // Afficher la bonne vue
  document.querySelectorAll('.module-view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById(`view-${moduleId}`);
  if (view) {
    view.classList.remove('hidden');
    if (moduleId === 'prestataires') {
      initPrestataires();
    } else if (moduleId === 'actifs') {
      initActifs();
      const typeFilter = document.getElementById('materiel-type-filter');
      if (typeFilter && typeFilter.options.length <= 1) {
        TYPES_MATERIEL.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeFilter.appendChild(o); });
      }
      const statutFilter = document.getElementById('materiel-statut-filter');
      if (statutFilter && statutFilter.options.length <= 1) {
        STATUTS_MATERIEL.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; statutFilter.appendChild(o); });
      }
    } else if (moduleId === 'auto') {
      initParcAuto();
    } else if (moduleId === 'analyse') {
      initAnalysePDF();
    } else if (moduleId === 'pharmacie') {
      initPharmacie();
    } else if (moduleId === 'cles') {
      initCles();
    } else if (moduleId === 'stock') {
      initStock();
    } else if (moduleId === 'admin') {
      initAdminPanel();
    }
  }
}

/* ── Etablissements (API) ──────────────────────────────── */
async function buildEtabSelector() {
  const sel = document.getElementById('etab-select');
  if (!sel) return;
  try {
    const data = await getEtablissements();
    sel.innerHTML = data.list.map(e =>
      `<option value="${e.id}"${data.current && e.id === data.current.id ? ' selected' : ''}>${esc(e.name)}</option>`
    ).join('');
  } catch (err) {
    console.error('Erreur chargement etablissements:', err);
  }
}

async function onEtabChange(val) {
  try {
    await selectEtablissement(parseInt(val));
    navigateTo(_activeModule);
    showToast(`Etablissement change.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addEtab() {
  const nom = prompt('Nom du nouvel etablissement :');
  if (!nom?.trim()) return;
  try {
    await addEtablissementAPI(nom.trim());
    await buildEtabSelector();
    navigateTo(_activeModule);
    showToast(`Etablissement "${nom.trim()}" cree.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renameEtab() {
  const etabs = getCachedEtabs();
  if (!etabs?.current) return;
  const ancien = etabs.current.name;
  const nouveau = prompt(`Renommer "${ancien}" en :`, ancien);
  if (!nouveau?.trim() || nouveau.trim() === ancien) return;
  try {
    await renameEtablissementAPI(etabs.current.id, nouveau.trim());
    await buildEtabSelector();
    showToast(`Renomme en "${nouveau.trim()}".`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeEtab() {
  const etabs = getCachedEtabs();
  if (!etabs?.current) return;
  if (etabs.list.length <= 1) { showToast('Impossible de supprimer le seul etablissement.', 'error'); return; }
  if (!confirmAction(`Retirer "${etabs.current.name}" ?\n(Les donnees seront supprimees.)`)) return;
  try {
    await deleteEtablissementAPI(etabs.current.id);
    await buildEtabSelector();
    navigateTo(_activeModule);
    showToast('Etablissement supprime.', 'warning');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Onglets (tabs) ─────────────────────────────────────── */
function switchTab(tabGroup, tabId) {
  const group = document.querySelectorAll(`[data-tab-group="${tabGroup}"]`);
  const contents = document.querySelectorAll(`[data-tab-content="${tabGroup}"]`);

  group.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tabId === tabId);
  });
  contents.forEach(c => {
    c.classList.toggle('active', c.dataset.tabId === tabId);
  });

  if (tabId === 'analyse') {
    setTimeout(() => renderCharts(), 80);
  }
}

/* ── Bindings globaux ───────────────────────────────────── */
function bindEvents() {
  // Fermer les modals en cliquant sur l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Echap pour fermer les modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });

  // Recherche avec debounce
  const searchInput = document.getElementById('presta-search');
  if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 200));

  // Filtre service
  const svcFilter = document.getElementById('presta-service-filter');
  if (svcFilter) svcFilter.addEventListener('change', applyFilters);
}

/* ── Sauvegarde manuelle ────────────────────────────────── */
function saveAll() {
  showToast('Donnees sauvegardees automatiquement en base.', 'success');
}

/* ── Deconnexion ────────────────────────────────────────── */
function doLogout() {
  logout();
}

/* ══════════════════════════════════════════════════════════
   VUE TOGGLE — Vue simple / Vue complète (par module)
   Même principe que pharmacie : masquer les colonnes secondaires
══════════════════════════════════════════════════════════ */

/* ── Prestataires ───────────────────────────────────────── */
let _prestaSimple = false;
function togglePrestaView() {
  _prestaSimple = !_prestaSimple;
  const btn = document.getElementById('presta-view-toggle');
  document.querySelectorAll('.presta-col-extra').forEach(el => {
    el.style.display = _prestaSimple ? 'none' : '';
  });
  if (btn) btn.textContent = _prestaSimple ? '☰ Vue complète' : '☰ Vue simple';
}

/* ── Investissement / Matériel (Actifs) ─────────────────── */
let _matSimple = false;
function toggleMaterielView() {
  _matSimple = !_matSimple;
  const btn = document.getElementById('mat-view-toggle');
  document.querySelectorAll('.mat-col-extra').forEach(el => {
    el.style.display = _matSimple ? 'none' : '';
  });
  if (btn) btn.textContent = _matSimple ? '☰ Vue complète' : '☰ Vue simple';
}

/* ── Parc Auto ──────────────────────────────────────────── */
let _autoSimple = false;
function toggleAutoView() {
  _autoSimple = !_autoSimple;
  const btn = document.getElementById('auto-view-toggle');
  document.querySelectorAll('.auto-col-extra').forEach(el => {
    el.style.display = _autoSimple ? 'none' : '';
  });
  if (btn) btn.textContent = _autoSimple ? '☰ Vue complète' : '☰ Vue simple';
}

/* ══════════════════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════════════════ */

let _adminUsers = [];

async function initAdminPanel() {
  if (!isAdmin()) return;
  try {
    _adminUsers = await getAdminUsersAPI();
    renderAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-body2');
  if (!tbody) return;
  if (_adminUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">Aucun utilisateur.</td></tr>';
    return;
  }
  tbody.innerHTML = _adminUsers.map(u => {
    const roleBadge = u.role === 'superadmin' ? '<span class="badge badge-superadmin">Super Admin</span>'
                    : u.role === 'admin' ? '<span class="badge badge-admin">Admin</span>'
                    : '<span class="badge badge-user">Utilisateur</span>';
    const etabList = u.etablissements.map(e => e.name).join(', ') || '<em>Aucun</em>';
    const canDelete = isSuperAdmin() && u.role !== 'superadmin';
    return `<tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.email)}</td>
      <td>${roleBadge}</td>
      <td style="font-size:0.85em">${etabList}</td>
      <td style="font-size:0.85em">${u.created_at ? u.created_at.slice(0,10) : ''}</td>
      <td>
        ${isSuperAdmin() ? `<button class="btn-table blue" onclick="editAdminUser(${u.id})">✏️</button>` : ''}
        ${isSuperAdmin() ? `<button class="btn-table" onclick="addEtabForUser(${u.id})" title="Ajouter un etablissement">🏢+</button>` : ''}
        ${canDelete ? `<button class="btn-table red" onclick="deleteAdminUser(${u.id},'${esc(u.name)}')">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function showCreateUserModal() {
  const name = prompt('Nom complet :');
  if (!name?.trim()) return;
  const email = prompt('Email :');
  if (!email?.trim()) return;
  const password = prompt('Mot de passe (min 6 car.) :');
  if (!password || password.length < 6) { showToast('Mot de passe trop court (min 6).', 'error'); return; }

  let role = 'user';
  if (isSuperAdmin()) {
    const r = prompt('Role (user / admin / superadmin) :', 'user');
    if (r && ['user', 'admin', 'superadmin'].includes(r)) role = r;
  }

  try {
    await createAdminUserAPI({ name: name.trim(), email: email.trim(), password, role });
    showToast(`Utilisateur "${name.trim()}" cree (${role}).`, 'success');
    await initAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editAdminUser(uid) {
  const user = _adminUsers.find(u => u.id === uid);
  if (!user) return;

  const name = prompt('Nom :', user.name);
  if (name === null) return;
  const email = prompt('Email :', user.email);
  if (email === null) return;
  const password = prompt('Nouveau mot de passe (laisser vide pour ne pas changer) :', '');

  let role = user.role;
  if (isSuperAdmin()) {
    const r = prompt('Role (user / admin / superadmin) :', user.role);
    if (r && ['user', 'admin', 'superadmin'].includes(r)) role = r;
  }

  const updates = { name: name.trim(), email: email.trim(), role };
  if (password && password.length >= 6) updates.password = password;

  try {
    await updateAdminUserAPI(uid, updates);
    showToast('Utilisateur modifie.', 'success');
    await initAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAdminUser(uid, name) {
  if (!confirmAction(`Supprimer l'utilisateur "${name}" et TOUTES ses donnees ?`)) return;
  try {
    await deleteAdminUserAPI(uid);
    showToast('Utilisateur supprime.', 'warning');
    await initAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addEtabForUser(uid) {
  const user = _adminUsers.find(u => u.id === uid);
  const name = prompt(`Nom du nouvel etablissement pour ${user?.name || 'cet utilisateur'} :`);
  if (!name?.trim()) return;
  try {
    await assignEtabToUserAPI(uid, name.trim());
    showToast(`Etablissement "${name.trim()}" cree.`, 'success');
    await initAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   PARAMÈTRES — Référentiel central Personnel & Lieux
══════════════════════════════════════════════════════════ */

let _paramsPersonnel = [];
let _paramsLieux     = [];

/* ── Ouverture / fermeture ──────────────────────────────── */
async function openParams() {
  document.getElementById('modal-params').classList.remove('hidden');
  switchParamsTab('personnel');
  await Promise.all([loadParamsPersonnel(), loadParamsLieux()]);
}

function closeParams() {
  document.getElementById('modal-params').classList.add('hidden');
  // Rafraîchir les modules actifs si besoin
  if (_activeModule === 'actifs') initActifs();
}

function switchParamsTab(tab) {
  document.querySelectorAll('.params-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.params-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`ptab-${tab}`).classList.add('active');
  document.getElementById(`params-panel-${tab}`).classList.remove('hidden');
}

/* ── PERSONNEL ──────────────────────────────────────────── */
async function loadParamsPersonnel() {
  try {
    _paramsPersonnel = await api('/api/personnel');
    renderParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderParamsPersonnel() {
  const q = (document.getElementById('params-pers-search')?.value || '').toLowerCase();
  const list = _paramsPersonnel.filter(p =>
    !q || [p.nom, p.prenom, p.poste, p.service, p.type_contrat].some(v => (v || '').toLowerCase().includes(q))
  );
  const count = document.getElementById('params-pers-count');
  if (count) count.textContent = `${list.length} personne${list.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('params-pers-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#9CA3AF;padding:18px">Aucun personnel.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><strong>${esc(p.nom)}</strong></td>
      <td>${esc(p.prenom || '—')}</td>
      <td>${esc(p.poste || '—')}</td>
      <td>${esc(p.service || '—')}</td>
      <td><span style="font-size:11px;padding:2px 6px;border-radius:10px;background:#EDE9FE;color:#5B21B6">${esc(p.type_contrat || '—')}</span></td>
      <td>${esc(p.telephone || '—')}</td>
      <td>${esc(p.date_arrivee || '—')}</td>
      <td>${esc(p.date_depart || '—')}</td>
      <td style="white-space:nowrap">
        <button class="btn-table blue" onclick="openParamsPersonnelModal(${p.id})">✏️</button>
        <button class="btn-table red" onclick="deleteParamsPersonnel(${p.id},'${esc(p.nom)} ${esc(p.prenom || '')}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openParamsPersonnelModal(id) {
  const p = id ? _paramsPersonnel.find(x => x.id === id) : null;
  document.getElementById('params-pers-modal-title').textContent = p ? 'Modifier le personnel' : 'Ajouter du personnel';
  document.getElementById('params-pers-id').value = p?.id || '';
  document.getElementById('pp-nom').value       = p?.nom || '';
  document.getElementById('pp-prenom').value    = p?.prenom || '';
  document.getElementById('pp-poste').value     = p?.poste || '';
  document.getElementById('pp-service').value   = p?.service || '';
  document.getElementById('pp-contrat').value   = p?.type_contrat || '';
  document.getElementById('pp-tel').value       = p?.telephone || '';
  document.getElementById('pp-entree').value    = p?.date_arrivee || '';
  document.getElementById('pp-sortie').value    = p?.date_depart || '';
  document.getElementById('modal-params-pers').classList.remove('hidden');
  setTimeout(() => document.getElementById('pp-nom').focus(), 80);
}

async function saveParamsPersonnel() {
  const nom = document.getElementById('pp-nom').value.trim();
  if (!nom) { showToast('Le nom est requis.', 'error'); return; }
  const id = document.getElementById('params-pers-id').value;
  const payload = {
    nom, prenom: document.getElementById('pp-prenom').value.trim(),
    poste:        document.getElementById('pp-poste').value.trim(),
    service:      document.getElementById('pp-service').value.trim(),
    type_contrat: document.getElementById('pp-contrat').value,
    telephone:    document.getElementById('pp-tel').value.trim(),
    date_arrivee: document.getElementById('pp-entree').value,
    date_depart:  document.getElementById('pp-sortie').value,
  };
  try {
    if (id) {
      await api(`/api/personnel/${id}`, 'PUT', payload);
      showToast('Personnel mis à jour.', 'success');
    } else {
      await api('/api/personnel', 'POST', payload);
      showToast('Personnel ajouté.', 'success');
    }
    document.getElementById('modal-params-pers').classList.add('hidden');
    await loadParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteParamsPersonnel(id, name) {
  if (!confirmAction(`Supprimer "${name}" du référentiel ?`)) return;
  try {
    await api(`/api/personnel/${id}`, 'DELETE');
    showToast('Supprimé.', 'warning');
    await loadParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function importPersonnelExcel(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch('/api/personnel/import-excel', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur import');
    showToast(`Import terminé — ${data.added} ajouté(s).`, 'success');
    await loadParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
  input.value = '';
}

/* ── LIEUX ──────────────────────────────────────────────── */
async function loadParamsLieux() {
  try {
    _paramsLieux = await api('/api/unites');
    renderParamsLieux();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderParamsLieux() {
  const q = (document.getElementById('params-lieux-search')?.value || '').toLowerCase();
  const list = _paramsLieux.filter(l =>
    !q || [l.nom, l.description, l.emplacement].some(v => (v || '').toLowerCase().includes(q))
  );
  const count = document.getElementById('params-lieux-count');
  if (count) count.textContent = `${list.length} lieu${list.length !== 1 ? 'x' : ''}`;
  const tbody = document.getElementById('params-lieux-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:18px">Aucun lieu.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(l => `
    <tr>
      <td><strong>${esc(l.nom)}</strong></td>
      <td>${esc(l.description || '—')}</td>
      <td>${esc(l.emplacement || '—')}</td>
      <td style="white-space:nowrap">
        <button class="btn-table blue" onclick="openParamsLieuModal(${l.id})">✏️</button>
        <button class="btn-table red" onclick="deleteParamsLieu(${l.id},'${esc(l.nom)}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openParamsLieuModal(id) {
  const l = id ? _paramsLieux.find(x => x.id === id) : null;
  document.getElementById('params-lieu-modal-title').textContent = l ? 'Modifier le lieu' : 'Ajouter un lieu';
  document.getElementById('params-lieu-id').value = l?.id || '';
  document.getElementById('pl-nom').value  = l?.nom || '';
  document.getElementById('pl-desc').value = l?.description || '';
  document.getElementById('pl-emp').value  = l?.emplacement || '';
  document.getElementById('modal-params-lieu').classList.remove('hidden');
  setTimeout(() => document.getElementById('pl-nom').focus(), 80);
}

async function saveParamsLieu() {
  const nom = document.getElementById('pl-nom').value.trim();
  if (!nom) { showToast('Le nom est requis.', 'error'); return; }
  const id = document.getElementById('params-lieu-id').value;
  const payload = {
    nom, description: document.getElementById('pl-desc').value.trim(),
    emplacement: document.getElementById('pl-emp').value.trim()
  };
  try {
    if (id) {
      await api(`/api/unites/${id}`, 'PUT', payload);
      showToast('Lieu mis à jour.', 'success');
    } else {
      await api('/api/unites', 'POST', payload);
      showToast('Lieu ajouté.', 'success');
    }
    document.getElementById('modal-params-lieu').classList.add('hidden');
    await loadParamsLieux();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteParamsLieu(id, name) {
  if (!confirmAction(`Supprimer le lieu "${name}" ?`)) return;
  try {
    await api(`/api/unites/${id}`, 'DELETE');
    showToast('Supprimé.', 'warning');
    await loadParamsLieux();
  } catch (e) { showToast(e.message, 'error'); }
}

/* ── Demo data ──────────────────────────────────────────── */
async function loadDemoData() {
  if (!confirmAction('Charger les donnees de demonstration dans cet etablissement ?\n(Les donnees existantes ne seront pas ecrasees.)')) return;
  try {
    const res = await api('/api/seed-demo', 'POST');
    showToast(res.message || 'Demo chargee.', 'success');
    navigateTo(_activeModule);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
