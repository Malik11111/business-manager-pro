/* ══════════════════════════════════════════════════════
   GRAPHES — tableaux de bord interactifs
══════════════════════════════════════════════════════ */

let _grapheData = null;
let _grapheTab = 'personnel';
let _grapheCharts = {};

function initGraphes() {
  if (!_grapheData) {
    loadGraphes();
  } else {
    _renderGrapheTab(_grapheTab);
  }
}

async function loadGraphes() {
  document.getElementById('graphes-loading').style.display = 'block';
  document.querySelectorAll('.gpanel').forEach(p => p.style.display = 'none');
  try {
    const res = await fetch('/api/graphes/summary');
    _grapheData = await res.json();
    document.getElementById('graphes-loading').style.display = 'none';
    _renderGrapheTab(_grapheTab);
  } catch (e) {
    document.getElementById('graphes-loading').textContent = 'Erreur de chargement.';
  }
}

function switchGrapheTab(tab) {
  _grapheTab = tab;
  document.querySelectorAll('.graphe-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('gtab-' + tab)?.classList.add('active');
  if (_grapheData) _renderGrapheTab(tab);
}

function _renderGrapheTab(tab) {
  document.querySelectorAll('.gpanel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('gpanel-' + tab);
  if (panel) panel.style.display = 'block';

  const d = _grapheData;
  if (!d) return;

  if (tab === 'personnel') _renderPersonnel(d.personnel);
  else if (tab === 'formation') _renderFormation(d.formation);
  else if (tab === 'stock') _renderStock(d.stock);
  else if (tab === 'auto') _renderAuto(d.auto);
  else if (tab === 'pharmacie') _renderPharmacie(d.pharmacie);
}

/* ── Helpers ────────────────────────────────────────────── */

function _destroyChart(id) {
  if (_grapheCharts[id]) { _grapheCharts[id].destroy(); delete _grapheCharts[id]; }
}

function _kpiHtml(items) {
  return items.map(k => `
    <div class="graphe-kpi-card" style="border-top:3px solid ${k.color||'#4F46E5'}">
      <span class="graphe-kpi-label">${k.label}</span>
      <span class="graphe-kpi-value" style="color:${k.color||'#1E293B'}">${k.value}</span>
      ${k.sub ? `<span style="font-size:11px;color:#9CA3AF">${k.sub}</span>` : ''}
    </div>`).join('');
}

const PALETTE = [
  '#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6',
  '#8B5CF6','#14B8A6','#F97316','#EF4444','#84CC16',
  '#06B6D4','#A78BFA','#FB7185','#34D399','#60A5FA'
];

function _moisLabel(str) {
  if (!str) return '';
  const [y, m] = str.split('-');
  const mois = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  return (mois[parseInt(m, 10) - 1] || m) + ' ' + y.slice(2);
}

/* ── Personnel ──────────────────────────────────────────── */

function _renderPersonnel(d) {
  // KPIs
  const cdi = d.contrats['CDI'] || 0;
  const cdd = d.contrats['CDD'] || 0;
  const ext = d.contrats['Intervenant ext'] || 0;
  document.getElementById('graphes-kpi-personnel').innerHTML = _kpiHtml([
    { label: 'Total personnel', value: d.total, color: '#1E293B' },
    { label: 'CDI', value: cdi, color: '#6366F1' },
    { label: 'CDD', value: cdd, color: '#EC4899' },
    { label: 'Intervenants ext.', value: ext, color: '#14B8A6' },
  ]);

  // Donut contrats
  _destroyChart('chart-contrats');
  const labels = Object.keys(d.contrats);
  const values = Object.values(d.contrats);
  _grapheCharts['chart-contrats'] = new Chart(
    document.getElementById('chart-contrats').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: PALETTE.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, padding: 10 } },
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 11 },
            formatter: (v, ctx) => v > 0 ? v : ''
          }
        },
        cutout: '60%'
      },
      plugins: [ChartDataLabels]
    }
  );

  // Bar horizontal services
  _destroyChart('chart-services');
  const sNoms = d.services.map(s => s.nom);
  const sCounts = d.services.map(s => s.count);
  _grapheCharts['chart-services'] = new Chart(
    document.getElementById('chart-services').getContext('2d'), {
      type: 'bar',
      data: {
        labels: sNoms,
        datasets: [{
          label: 'Personnels',
          data: sCounts,
          backgroundColor: '#6366F1CC',
          borderColor: '#6366F1',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#374151', font: { size: 11, weight: '600' } } },
        scales: { x: { beginAtZero: true, grid: { color: '#F1F5F9' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      },
      plugins: [ChartDataLabels]
    }
  );
}

/* ── Formation ──────────────────────────────────────────── */

function _renderFormation(d) {
  const stats = d.stats;
  if (!stats || !stats.length) {
    document.getElementById('gpanel-formation').innerHTML = '<p style="padding:40px;color:#9CA3AF;text-align:center;">Aucune formation configurée.</p>';
    return;
  }

  // Bar taux conformité
  _destroyChart('chart-formation-bar');
  _grapheCharts['chart-formation-bar'] = new Chart(
    document.getElementById('chart-formation-bar').getContext('2d'), {
      type: 'bar',
      data: {
        labels: stats.map(s => s.nom),
        datasets: [
          { label: 'À jour (%)', data: stats.map(s => s.pct_ok), backgroundColor: '#10B981CC', borderColor: '#10B981', borderWidth: 1, borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'top', color: '#374151', font: { size: 11, weight: '700' }, formatter: v => v + '%' }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } }
        }
      },
      plugins: [ChartDataLabels]
    }
  );

  // Donut statuts globaux
  const totOk = stats.reduce((a, s) => a + s.ok, 0);
  const totBientot = stats.reduce((a, s) => a + s.bientot, 0);
  const totExpire = stats.reduce((a, s) => a + s.expire, 0);
  const totVide = stats.reduce((a, s) => a + s.vide, 0);
  _destroyChart('chart-formation-donut');
  _grapheCharts['chart-formation-donut'] = new Chart(
    document.getElementById('chart-formation-donut').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['À jour', 'Bientôt', 'Expiré', 'Non renseigné'],
        datasets: [{ data: [totOk, totBientot, totExpire, totVide], backgroundColor: ['#10B981','#F59E0B','#EF4444','#94A3B8'], borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 10 } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, formatter: v => v > 0 ? v : '' }
        }
      },
      plugins: [ChartDataLabels]
    }
  );
}

/* ── Stock ──────────────────────────────────────────────── */

function _renderStock(d) {
  const alertes = d.items.filter(i => i.alerte).length;
  document.getElementById('graphes-kpi-stock').innerHTML = _kpiHtml([
    { label: 'Produits total', value: d.total, color: '#1E293B' },
    { label: 'En alerte', value: alertes, color: '#EF4444' },
    { label: 'Catégories', value: Object.keys(d.categories).length, color: '#6366F1' },
  ]);

  // Bar niveaux stock
  _destroyChart('chart-stock-niveaux');
  const items = d.items.slice(0, 18);
  _grapheCharts['chart-stock-niveaux'] = new Chart(
    document.getElementById('chart-stock-niveaux').getContext('2d'), {
      type: 'bar',
      data: {
        labels: items.map(i => i.nom.length > 20 ? i.nom.slice(0, 20) + '…' : i.nom),
        datasets: [
          { label: 'Quantité', data: items.map(i => i.quantite), backgroundColor: items.map(i => i.alerte ? '#EF444480' : '#3B82F680'), borderColor: items.map(i => i.alerte ? '#EF4444' : '#3B82F6'), borderWidth: 1, borderRadius: 4 },
          { label: 'Seuil alerte', data: items.map(i => i.seuil), backgroundColor: 'transparent', borderColor: '#F59E0B', borderWidth: 2, type: 'line', pointRadius: 3, tension: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, datalabels: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 40 } } }
      }
    }
  );

  // Donut catégories
  _destroyChart('chart-stock-cat');
  const catLabels = Object.keys(d.categories);
  const catValues = Object.values(d.categories);
  _grapheCharts['chart-stock-cat'] = new Chart(
    document.getElementById('chart-stock-cat').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{ data: catValues, backgroundColor: PALETTE.slice(0, catLabels.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: v => v > 0 ? v : '' }
        }
      },
      plugins: [ChartDataLabels]
    }
  );

  // Line mouvements par mois
  _destroyChart('chart-stock-mois');
  const mois = d.mouvements_mois;
  _grapheCharts['chart-stock-mois'] = new Chart(
    document.getElementById('chart-stock-mois').getContext('2d'), {
      type: 'line',
      data: {
        labels: mois.map(m => _moisLabel(m.mois)),
        datasets: [
          { label: 'Sorties', data: mois.map(m => m.sortie), borderColor: '#EF4444', backgroundColor: '#EF444420', fill: true, tension: 0.4, pointRadius: 5 },
          { label: 'Réceptions', data: mois.map(m => m.reception), borderColor: '#10B981', backgroundColor: '#10B98120', fill: true, tension: 0.4, pointRadius: 5 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, datalabels: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } }
      }
    }
  );
}

/* ── Parc Auto ──────────────────────────────────────────── */

function _renderAuto(d) {
  document.getElementById('graphes-kpi-auto').innerHTML = _kpiHtml([
    { label: 'Véhicules', value: d.total, color: '#1E293B' },
    { label: 'Marques', value: Object.keys(d.marques).length, color: '#6366F1' },
    { label: 'Coût entretien total', value: d.entretien_costs.reduce((a, c) => a + c.cout, 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), color: '#F59E0B', sub: 'tous véhicules' },
  ]);

  // Donut marques
  _destroyChart('chart-auto-marques');
  const mq = Object.keys(d.marques);
  const mv = Object.values(d.marques);
  _grapheCharts['chart-auto-marques'] = new Chart(
    document.getElementById('chart-auto-marques').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: mq,
        datasets: [{ data: mv, backgroundColor: PALETTE.slice(0, mq.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, formatter: v => v > 0 ? v : '' }
        }
      },
      plugins: [ChartDataLabels]
    }
  );

  // Bar entretiens par véhicule
  _destroyChart('chart-auto-entretien');
  const ec = d.entretien_costs;
  _grapheCharts['chart-auto-entretien'] = new Chart(
    document.getElementById('chart-auto-entretien').getContext('2d'), {
      type: 'bar',
      data: {
        labels: ec.map(e => e.immat),
        datasets: [{ label: 'Coût (€)', data: ec.map(e => e.cout), backgroundColor: '#F59E0B99', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#374151', font: { size: 10 }, formatter: v => v > 0 ? v.toLocaleString('fr-FR') + '€' : '' } },
        scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { callback: v => v + '€' } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }
      },
      plugins: [ChartDataLabels]
    }
  );

  // Line carburant par mois
  _destroyChart('chart-auto-carbu');
  const cb = d.carburant_mois;
  _grapheCharts['chart-auto-carbu'] = new Chart(
    document.getElementById('chart-auto-carbu').getContext('2d'), {
      type: 'line',
      data: {
        labels: cb.map(m => _moisLabel(m.mois)),
        datasets: [{ label: 'Carburant (€)', data: cb.map(m => m.cout), borderColor: '#F97316', backgroundColor: '#F9731620', fill: true, tension: 0.4, pointRadius: 5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { callback: v => v + '€' } }, x: { grid: { display: false } } }
      }
    }
  );
}

/* ── Pharmacie ──────────────────────────────────────────── */

function _renderPharmacie(d) {
  document.getElementById('graphes-kpi-pharmacie').innerHTML = _kpiHtml([
    { label: 'Total en stock', value: d.total_stock + ' réf.', color: '#1E293B' },
    { label: 'Stock bas', value: d.stock_bas, color: '#F59E0B' },
    { label: 'Périmés', value: d.perimes, color: '#EF4444' },
  ]);

  // Bar top médicaments
  _destroyChart('chart-pharma-top');
  const top = d.top_medicaments;
  _grapheCharts['chart-pharma-top'] = new Chart(
    document.getElementById('chart-pharma-top').getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map(m => m.nom.length > 22 ? m.nom.slice(0, 22) + '…' : m.nom),
        datasets: [{ label: 'Unités sorties', data: top.map(m => m.qte), backgroundColor: '#8B5CF699', borderColor: '#8B5CF6', borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#374151', font: { size: 11, weight: '600' } } },
        scales: { x: { beginAtZero: true, grid: { color: '#F1F5F9' } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
      },
      plugins: [ChartDataLabels]
    }
  );

  // Line entrées/sorties par mois
  _destroyChart('chart-pharma-mois');
  const pm = d.mouvements_mois;
  _grapheCharts['chart-pharma-mois'] = new Chart(
    document.getElementById('chart-pharma-mois').getContext('2d'), {
      type: 'line',
      data: {
        labels: pm.map(m => _moisLabel(m.mois)),
        datasets: [
          { label: 'Sorties', data: pm.map(m => m.sortie), borderColor: '#EF4444', backgroundColor: '#EF444420', fill: true, tension: 0.4, pointRadius: 5 },
          { label: 'Entrées', data: pm.map(m => m.reception), borderColor: '#10B981', backgroundColor: '#10B98120', fill: true, tension: 0.4, pointRadius: 5 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, datalabels: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#F1F5F9' } }, x: { grid: { display: false } } }
      }
    }
  );
}
