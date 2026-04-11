/**
 * app.js — Application principale
 * Navigation, établissements, initialisation
 */

/* ── Modules disponibles ────────────────────────────────── */
const MODULES = [
  { id: 'prestataires', icon: '🤝', label: 'Prestataires', ready: true },
  { id: 'actifs',       icon: '🏢', label: 'Actifs',       ready: true },
  { id: 'cles',         icon: '🔑', label: 'Clés',         ready: false },
  { id: 'stock',        icon: '📦', label: 'Stock',        ready: false },
  { id: 'auto',         icon: '🚗', label: 'Parc Auto',    ready: false },
  { id: 'analyse',      icon: '🤖', label: 'Analyse PDF',  ready: false },
  { id: 'caisse',       icon: '💰', label: 'Caisse',       ready: false },
  { id: 'ppms',         icon: '🛡️', label: 'PPMS',         ready: false },
  { id: 'pharmacie',    icon: '💊', label: 'Pharmacie',    ready: true },
];

let _activeModule = 'prestataires';

/* ── Démarrage ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  buildEtabSelector();
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
      ${!m.ready ? '<span class="soon">bientôt</span>' : ''}
    </div>
  `).join('');
}

function navigateTo(moduleId) {
  _activeModule = moduleId;

  // Mettre à jour la sidebar
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
      // Remplir les filtres type/statut si pas encore fait
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

/* ── Établissements ─────────────────────────────────────── */
function buildEtabSelector() {
  const sel = document.getElementById('etab-select');
  if (!sel) return;
  const data = getEtablissements();
  sel.innerHTML = data.list.map(e =>
    `<option value="${esc(e)}"${e === data.current ? ' selected' : ''}>${esc(e)}</option>`
  ).join('');
}

function onEtabChange(val) {
  const data = getEtablissements();
  data.current = val;
  saveEtablissements(data);
  if (_activeModule === 'prestataires') initPrestataires();
  showToast(`Établissement : ${val}`, 'info');
}

function addEtab() {
  const nom = prompt('Nom du nouvel établissement :');
  if (!nom?.trim()) return;
  const data = getEtablissements();
  if (data.list.includes(nom.trim())) { showToast('Établissement déjà existant.', 'error'); return; }
  data.list.push(nom.trim());
  data.current = nom.trim();
  saveEtablissements(data);
  buildEtabSelector();
  if (_activeModule === 'prestataires') initPrestataires();
  showToast(`Établissement "${nom.trim()}" créé.`, 'success');
}

function renameEtab() {
  const data = getEtablissements();
  const ancien = data.current;
  const nouveau = prompt(`Renommer "${ancien}" en :`, ancien);
  if (!nouveau?.trim() || nouveau.trim() === ancien) return;
  const idx = data.list.indexOf(ancien);
  if (idx < 0) return;
  data.list[idx] = nouveau.trim();
  data.current = nouveau.trim();
  // Migrer les données
  const allP = getAllData();
  if (allP[ancien]) { allP[ancien] = allP[ancien]; localStorage.setItem('bm_prestataires', JSON.stringify({ ...allP, [nouveau.trim()]: allP[ancien] })); delete allP[ancien]; localStorage.setItem('bm_prestataires', JSON.stringify(allP)); }
  saveEtablissements(data);
  buildEtabSelector();
  if (_activeModule === 'prestataires') initPrestataires();
  showToast(`Renommé en "${nouveau.trim()}".`, 'success');
}

function removeEtab() {
  const data = getEtablissements();
  if (data.list.length <= 1) { showToast('Impossible de supprimer le seul établissement.', 'error'); return; }
  if (!confirmAction(`Retirer "${data.current}" de la liste ?\n(Les données ne seront pas supprimées.)`)) return;
  const ancien = data.current;
  data.list = data.list.filter(e => e !== ancien);
  data.current = data.list[0];
  saveEtablissements(data);
  buildEtabSelector();
  if (_activeModule === 'prestataires') initPrestataires();
  showToast(`"${ancien}" retiré.`, 'warning');
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

  // Rendre les graphiques si on passe sur l'onglet Analyse
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
  showToast('Données sauvegardées localement.', 'success');
}
