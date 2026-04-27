/**
 * app.js — Application principale
 * Navigation, etablissements, initialisation
 */

/* ── Modules disponibles ────────────────────────────────── */
const MODULES = [
  { id: 'parametres',   icon: '⚙️', label: 'Paramètres',  ready: true },
  { id: 'prestataires', icon: '🤝', label: 'Prestataires', ready: true },
  { id: 'actifs',       icon: '🏢', label: 'Actifs',       ready: true },
  { id: 'cles',         icon: '🔑', label: 'Clés',         ready: true },
  { id: 'stock',        icon: '📦', label: 'Stock',        ready: true },
  { id: 'auto',         icon: '🚗', label: 'Parc Auto',    ready: true },
  { id: 'analyse',      icon: '📄', label: 'Analyse PDF',  ready: true },
  { id: 'formation',    icon: '🎓', label: 'Formation',    ready: true },
  { id: 'pharmacie',    icon: '💊', label: 'Pharmacie',    ready: true },
];

let _activeModule = 'parametres';

/* ── Demarrage ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await fetchCurrentUser();
  buildSidebar();
  await buildEtabSelector();
  bindEvents();
  updateHeaderForRole();
  navigateTo('parametres');
});

/* ── Affichage conditionnel selon le role ───────────────── */
function updateHeaderForRole() {
  const adminBtn = document.getElementById('btn-admin-panel');
  if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin());
  // Établissement sidebar : admin voit le sélecteur, user voit juste le nom
  const adminBlock = document.getElementById('sidebar-etab-admin');
  const userBlock  = document.getElementById('sidebar-etab-user');
  if (adminBlock) adminBlock.style.display = isAdmin() ? 'block' : 'none';
  if (userBlock)  userBlock.style.display  = isAdmin() ? 'none'  : 'block';
  // Logout label : masquer le texte sur petite sidebar
  const logoutLabel = document.getElementById('sidebar-logout-label');
  if (logoutLabel) logoutLabel.style.display = '';
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
    if (moduleId === 'parametres') {
      initParametres();
    } else if (moduleId === 'prestataires') {
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
    } else if (moduleId === 'formation') {
      initFormation();
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
    if (sel) {
      sel.innerHTML = data.list.map(e =>
        `<option value="${e.id}"${data.current && e.id === data.current.id ? ' selected' : ''}>${esc(e.name)}</option>`
      ).join('');
    }
    // Affiche le nom pour l'utilisateur non-admin
    const nameEl = document.getElementById('sidebar-etab-name');
    if (nameEl && data.current) nameEl.textContent = data.current.name;
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

/* ── Init depuis la sidebar ─────────────────────────────── */
async function initParametres() {
  switchParamsTab('personnel');
  await Promise.all([loadParamsPersonnel(), loadParamsLieux()]);
}

async function openParams() {
  navigateTo('parametres');
}

function closeParams() {
  if (_activeModule === 'actifs') initActifs();
}

function switchParamsTab(tab) {
  document.querySelectorAll('.params-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.params-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`ptab-${tab}`).classList.add('active');
  document.getElementById(`params-panel-${tab}`).classList.remove('hidden');
  if (tab === 'graphes') renderParamsGraphes();
}

/* ── GRAPHIQUES PARAMÈTRES ──────────────────────────────── */
let _chartContrats = null;

const _CONTRAT_PALETTE = [
  { label: 'CDI',             color: '#6366F1', glow: 'rgba(99,102,241,0.4)'  },
  { label: 'CDD',             color: '#EC4899', glow: 'rgba(236,72,153,0.4)'  },
  { label: 'Intérim',         color: '#F59E0B', glow: 'rgba(245,158,11,0.4)'  },
  { label: 'Stage',           color: '#10B981', glow: 'rgba(16,185,129,0.4)'  },
  { label: 'Apprentissage',   color: '#3B82F6', glow: 'rgba(59,130,246,0.4)'  },
  { label: 'Bénévolat',       color: '#8B5CF6', glow: 'rgba(139,92,246,0.4)'  },
  { label: 'Intervenant ext', color: '#14B8A6', glow: 'rgba(20,184,166,0.4)'  },
  { label: 'Autre',           color: '#94A3B8', glow: 'rgba(148,163,184,0.4)' },
];

function renderParamsGraphes() {
  const personnel = _paramsPersonnel || [];
  const total = personnel.length;

  const counts = {};
  personnel.forEach(p => {
    const k = p.type_contrat?.trim() || 'Autre';
    counts[k] = (counts[k] || 0) + 1;
  });
  const knownLabels = _CONTRAT_PALETTE.map(c => c.label);
  Object.keys(counts).forEach(k => {
    if (!knownLabels.includes(k)) { counts['Autre'] = (counts['Autre'] || 0) + counts[k]; delete counts[k]; }
  });
  const entries = _CONTRAT_PALETTE.filter(c => counts[c.label] > 0).map(c => ({ ...c, count: counts[c.label] }));

  // ── KPIs ──
  const kpiEl = document.getElementById('params-graph-kpis');
  if (kpiEl) {
    kpiEl.innerHTML = [{ label: 'Total personnel', value: total, color: '#1E293B', bg: '#F1F5F9' }]
      .concat(entries.map(e => ({ label: e.label, value: e.count, color: e.color, bg: e.color + '18' })))
      .map(k => `<div style="padding:10px 16px;border-radius:10px;background:${k.bg};min-width:80px;text-align:center;border:1.5px solid ${k.color}33">
        <div style="font-size:22px;font-weight:800;color:${k.color}">${k.value}</div>
        <div style="font-size:11px;color:#64748B;font-weight:600;margin-top:2px">${k.label}</div>
      </div>`).join('');
  }

  // ── Légende ──
  const legendEl = document.getElementById('params-graph-legend');
  if (legendEl) {
    legendEl.innerHTML = entries.map(e => {
      const pct = total > 0 ? Math.round(e.count / total * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:10px;">
        <div style="width:14px;height:14px;border-radius:4px;background:${e.color};flex-shrink:0;box-shadow:0 2px 6px ${e.glow}"></div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:3px">
            <span>${e.label}</span>
            <span style="color:${e.color}">${e.count} <span style="font-size:11px;color:#94A3B8">(${pct}%)</span></span>
          </div>
          <div style="height:6px;background:#F1F5F9;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${e.color},${e.color}99);border-radius:3px;transition:width 0.6s ease"></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Chart.js doughnut ──
  const ctx = document.getElementById('chart-params-contrats');
  if (!ctx) return;
  if (_chartContrats) { _chartContrats.destroy(); _chartContrats = null; }
  if (entries.length === 0) return;

  _chartContrats = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e.label),
      datasets: [{
        data: entries.map(e => e.count),
        backgroundColor: entries.map(e => e.color),
        borderColor: '#ffffff',
        borderWidth: 3,
        borderRadius: 6,
        hoverOffset: 16,
      }]
    },
    options: {
      responsive: false,
      cutout: '55%',
      animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
      layout: { padding: 28 },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const label = entries[elements[0].index]?.label;
          const color = entries[elements[0].index]?.color;
          if (label) _showContratDetail(label, color);
        }
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleColor: '#F8FAFC',
          bodyColor: '#CBD5E1',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
              return `  ${ctx.parsed} agent${ctx.parsed > 1 ? 's' : ''} — ${pct}%`;
            }
          }
        },
        datalabels: {
          display: ctx => (ctx.dataset.data[ctx.dataIndex] / total) >= 0.02,
          color: '#fff',
          font: { weight: '700', size: 12 },
          textAlign: 'center',
          anchor: 'center',
          align: 'center',
          formatter: (value, ctx) => {
            const pct = Math.round(value / total * 100);
            return `${ctx.chart.data.labels[ctx.dataIndex]}\n${pct}%`;
          },
          textShadowColor: 'rgba(0,0,0,0.4)',
          textShadowBlur: 4,
        }
      }
    },
    plugins: [ChartDataLabels, {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx: c, chartArea: { width, height, left, top } } = chart;
        const cx = left + width / 2, cy = top + height / 2;
        c.save();
        c.font = '800 30px Arial,sans-serif';
        c.fillStyle = '#1E293B';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(total, cx, cy - 10);
        c.font = '600 11px Arial,sans-serif';
        c.fillStyle = '#94A3B8';
        c.fillText('AGENTS', cx, cy + 14);
        c.restore();
      }
    }]
  });
}

/* ── PERSONNEL ──────────────────────────────────────────── */
async function loadParamsPersonnel() {
  try {
    _paramsPersonnel = await api('/api/personnel');
    buildPersonnelFilters();
    renderParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

let _persFilterContrat = '';

function _contratStyle(type) {
  const found = _CONTRAT_PALETTE.find(c => c.label === (type || '').trim());
  if (found) return `background:${found.color}22;color:${found.color};border:1px solid ${found.color}55;`;
  return 'background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;';
}

function buildPersonnelFilters() {
  // Pills contrat
  const pills = document.getElementById('params-contrat-pills');
  if (pills) {
    const types = ['Tous', ..._CONTRAT_PALETTE.map(c => c.label).filter(l => _paramsPersonnel.some(p => (p.type_contrat || 'Autre').trim() === l || (l === 'Autre' && !p.type_contrat?.trim())))];
    pills.innerHTML = types.map(t => {
      const isAll = t === 'Tous';
      const active = (isAll && !_persFilterContrat) || t === _persFilterContrat;
      const pal = _CONTRAT_PALETTE.find(c => c.label === t);
      const bg   = active ? (pal ? pal.color : '#1E293B') : (pal ? pal.color + '18' : '#F1F5F9');
      const col  = active ? '#fff' : (pal ? pal.color : '#64748B');
      const bord = pal ? pal.color + '66' : '#E2E8F0';
      return `<button onclick="_setPersContrat('${isAll ? '' : t}')" style="padding:3px 10px;border-radius:20px;border:1.5px solid ${bord};background:${bg};color:${col};font-size:11px;font-weight:700;cursor:pointer;transition:all .15s">${t}</button>`;
    }).join('');
  }
  // Select service
  const svcSel = document.getElementById('params-filter-service');
  if (svcSel) {
    const svcs = [...new Set(_paramsPersonnel.map(p => p.service?.trim()).filter(Boolean))].sort();
    const cur = svcSel.value;
    svcSel.innerHTML = '<option value="">Tous les services</option>' + svcs.map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
  }
  // Select poste
  const pstSel = document.getElementById('params-filter-poste');
  if (pstSel) {
    const postes = [...new Set(_paramsPersonnel.map(p => p.poste?.trim()).filter(Boolean))].sort();
    const cur = pstSel.value;
    pstSel.innerHTML = '<option value="">Tous les postes</option>' + postes.map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
  }
}

function _setPersContrat(val) {
  _persFilterContrat = val;
  buildPersonnelFilters();
  renderParamsPersonnel();
}

function renderParamsPersonnel() {
  const q       = (document.getElementById('params-pers-search')?.value || '').toLowerCase();
  const fSvc    = document.getElementById('params-filter-service')?.value || '';
  const fPoste  = document.getElementById('params-filter-poste')?.value || '';

  const list = _paramsPersonnel.filter(p => {
    if (q && ![p.nom, p.prenom, p.poste, p.service, p.type_contrat].some(v => (v || '').toLowerCase().includes(q))) return false;
    if (fSvc   && (p.service?.trim() || '') !== fSvc)   return false;
    if (fPoste && (p.poste?.trim()   || '') !== fPoste) return false;
    if (_persFilterContrat) {
      const k = p.type_contrat?.trim() || 'Autre';
      if (k !== _persFilterContrat) return false;
    }
    return true;
  });

  const count = document.getElementById('params-pers-count');
  if (count) count.textContent = `${list.length} / ${_paramsPersonnel.length} personne${_paramsPersonnel.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('params-pers-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#9CA3AF;padding:18px">Aucun résultat.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => {
    const contrat = p.type_contrat?.trim() || '—';
    const cStyle  = contrat !== '—' ? _contratStyle(contrat) : 'background:#F1F5F9;color:#64748B;';
    return `<tr>
      <td><strong>${esc(p.nom)}</strong></td>
      <td>${esc(p.prenom || '—')}</td>
      <td style="font-size:12px">${esc(p.poste || '—')}</td>
      <td style="font-size:12px">${esc(p.service || '—')}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;${cStyle}">${esc(contrat)}</span></td>
      <td>${esc(p.telephone || '—')}</td>
      <td>${esc(p.date_arrivee || '—')}</td>
      <td>${esc(p.date_depart || '—')}</td>
      <td style="white-space:nowrap">
        <button class="btn-table blue" onclick="openParamsPersonnelModal(${p.id})">✏️</button>
        <button class="btn-table red"  onclick="deleteParamsPersonnel(${p.id},'${esc(p.nom)} ${esc(p.prenom || '')}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
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

async function deleteAllPersonnel() {
  if (!confirm('Supprimer TOUT le personnel ? Cette action est irréversible.')) return;
  try {
    const res = await api('/api/personnel/all', 'DELETE');
    showToast(`${res.deleted} personnel supprimé(s).`, 'success');
    await loadParamsPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteAllLieux() {
  if (!confirm('Supprimer TOUS les lieux ? Cette action est irréversible.')) return;
  try {
    const res = await api('/api/unites/all', 'DELETE');
    showToast(`${res.deleted} lieu(x) supprimé(s).`, 'success');
    await loadParamsLieux();
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
    showToast(`Import terminé — ${data.added} personnel + ${data.added_lieux || 0} lieux ajouté(s).`, 'success');
    await loadParamsPersonnel();
    await loadParamsLieux();
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

function _showContratDetail(typeContrat, color) {
  const liste = (_paramsPersonnel || []).filter(p => {
    const k = p.type_contrat?.trim() || 'Autre';
    return k === typeContrat;
  }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));

  const detail  = document.getElementById('params-graph-detail');
  const header  = document.getElementById('params-graph-detail-header');
  const title   = document.getElementById('params-graph-detail-title');
  const tbody   = document.getElementById('params-graph-detail-tbody');
  if (!detail) return;

  title.textContent = `${typeContrat} — ${liste.length} agent${liste.length > 1 ? 's' : ''}`;
  header.style.background = color;

  tbody.innerHTML = liste.length === 0
    ? '<tr class="empty-row"><td colspan="6">Aucun agent.</td></tr>'
    : liste.map(p => `<tr>
        <td><strong>${esc(p.nom || '—')}</strong></td>
        <td>${esc(p.prenom || '—')}</td>
        <td><span style="font-size:11px;padding:2px 7px;border-radius:8px;background:${color}22;color:${color};font-weight:600">${esc(p.poste || '—')}</span></td>
        <td>${esc(p.service || '—')}</td>
        <td>${esc(p.telephone || '—')}</td>
        <td>${esc(p.date_arrivee || '—')}</td>
      </tr>`).join('');

  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
