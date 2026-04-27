/* ══════════════════════════════════════════════════════
   GRAPHES — Formation uniquement
══════════════════════════════════════════════════════ */

let _grapheData = null;
let _grapheCharts = {};

function initGraphes() {
  if (!_grapheData) {
    loadGraphes();
  } else {
    _renderFormation(_grapheData.formation);
  }
}

async function loadGraphes() {
  document.getElementById('graphes-loading').style.display = 'block';
  document.getElementById('gpanel-formation').style.display = 'none';
  try {
    const res = await fetch('/api/graphes/summary');
    _grapheData = await res.json();
    document.getElementById('graphes-loading').style.display = 'none';
    _renderFormation(_grapheData.formation);
  } catch (e) {
    document.getElementById('graphes-loading').textContent = 'Erreur de chargement.';
  }
}

function _destroyChart(id) {
  if (_grapheCharts[id]) { _grapheCharts[id].destroy(); delete _grapheCharts[id]; }
}

function _renderFormation(d) {
  const stats = d.stats;
  document.getElementById('gpanel-formation').style.display = 'block';

  if (!stats || !stats.length) {
    document.getElementById('gpanel-formation').innerHTML = '<p style="padding:40px;color:#9CA3AF;text-align:center;">Aucune formation configurée.</p>';
    return;
  }

  // Bar taux de conformité
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
          datalabels: { anchor: 'end', align: 'top', color: '#374151', font: { size: 12, weight: '700' }, formatter: v => v + '%' }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 20 } }
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
          legend: { position: 'bottom', labels: { font: { size: 13 }, padding: 12 } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 13 }, formatter: v => v > 0 ? v : '' }
        }
      },
      plugins: [ChartDataLabels]
    }
  );
}
