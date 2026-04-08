/**
 * app.js — Application principale
 * Navigation, etablissements, initialisation
 */

/* ── Modules disponibles ────────────────────────────────── */
const MODULES = [
  { id: 'prestataires', icon: '🤝', label: 'Prestataires', ready: true },
  { id: 'actifs',       icon: '🏢', label: 'Actifs',       ready: true },
  { id: 'cles',         icon: '🔑', label: 'Cles',         ready: false },
  { id: 'stock',        icon: '📦', label: 'Stock',        ready: false },
  { id: 'auto',         icon: '🚗', label: 'Parc Auto',    ready: false },
  { id: 'analyse',      icon: '🤖', label: 'Analyse PDF',  ready: false },
  { id: 'caisse',       icon: '💰', label: 'Caisse',       ready: false },
  { id: 'ppms',         icon: '🛡️', label: 'PPMS',         ready: false },
  { id: 'pharmacie',    icon: '💊', label: 'Pharmacie',    ready: true },
];

let _activeModule = 'prestataires';

/* ── Demarrage ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  buildSidebar();
  await buildEtabSelector();
  bindEvents();
  navigateTo('prestataires');
});

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
    } else if (moduleId === 'pharmacie') {
      initPharmacie();
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
