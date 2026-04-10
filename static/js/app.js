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
