/**
 * analyse_pdf.js — Module Analyse PDF Sécurité
 * Upload PDF → Gemini → affiche problèmes + historique
 */

let _pdfFile = null;
let _analyseInited = false;

/* ── Init ──────────────────────────────────────────── */
async function initAnalysePDF() {
  if (!_analyseInited) {
    _analyseInited = true;
    // Vérifier si le serveur a déjà une clé Gemini configurée
    try {
      const cfg = await api('/api/analyse-pdf/config');
      const keyWrap = document.getElementById('pdf-api-key-wrap');
      if (cfg.has_server_key) {
        // Clé côté serveur : cacher le champ
        if (keyWrap) keyWrap.style.display = 'none';
      } else {
        // Restaurer la clé sauvegardée en local
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
          const inp = document.getElementById('pdf-api-key');
          if (inp) inp.value = savedKey;
        }
      }
    } catch (e) {}
  }
  await loadHistoriqueAnalyses();
}

/* ── Sélection fichier ─────────────────────────────── */
function onPdfSelected(input) {
  const file = input.files[0];
  if (!file) return;
  _pdfFile = file;
  const label = document.getElementById('pdf-filename');
  if (label) label.textContent = file.name + ' (' + (file.size / 1024).toFixed(0) + ' Ko)';
  const btn = document.getElementById('pdf-analyse-btn');
  if (btn) btn.disabled = false;
}

/* ── Barre de progression (smooth) ─────────────────── */
const _pb = { current: 0, target: 0, anim: null, crawl: null };

function _pbTick() {
  const bar = document.getElementById('pdf-progress-bar');
  const lbl = document.getElementById('pdf-progress-label');
  if (!bar) return;
  const diff = _pb.target - _pb.current;
  if (diff > 0.05) {
    const step = Math.max(0.12, diff * 0.035);
    _pb.current = Math.min(_pb.target, _pb.current + step);
    bar.style.width = _pb.current + '%';
    if (lbl) lbl.textContent = 'Analyse ' + Math.round(_pb.current) + '%';
  }
}

function setProgress(pct, label) {
  const wrap = document.getElementById('pdf-progress-wrap');
  if (!wrap) return;
  if (pct <= 0) {
    clearInterval(_pb.anim); _pb.anim = null;
    clearInterval(_pb.crawl); _pb.crawl = null;
    _pb.current = 0; _pb.target = 0;
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  _pb.target = pct;
  if (label) {
    const lbl = document.getElementById('pdf-progress-label');
    if (lbl) lbl.textContent = label;
  }
  if (!_pb.anim) _pb.anim = setInterval(_pbTick, 40);
}

function _pbCrawlStart(maxPct) {
  clearInterval(_pb.crawl);
  _pb.crawl = setInterval(() => {
    if (_pb.target < maxPct) _pb.target = Math.min(maxPct, _pb.target + 0.35);
  }, 320);
}

function _pbCrawlStop() {
  clearInterval(_pb.crawl);
  _pb.crawl = null;
}

/* ── Lancer l'analyse ──────────────────────────────── */
async function lancerAnalysePDF() {
  if (!_pdfFile) { showToast('Sélectionnez un PDF', 'error'); return; }
  const apiKey = (document.getElementById('pdf-api-key')?.value || '').trim();
  const keyWrap = document.getElementById('pdf-api-key-wrap');
  const serverHasKey = keyWrap && keyWrap.style.display === 'none';
  if (!apiKey && !serverHasKey) { showToast('Clé API requise', 'error'); return; }

  if (apiKey) localStorage.setItem('gemini_api_key', apiKey);

  document.getElementById('pdf-analyse-btn').disabled = true;
  document.getElementById('pdf-empty-state').style.display = 'none';
  document.getElementById('pdf-result').style.display = 'none';

  setProgress(12, 'Envoi du PDF...');

  try {
    const formData = new FormData();
    formData.append('file', _pdfFile);
    if (apiKey) formData.append('api_key', apiKey);

    await new Promise(r => setTimeout(r, 500));
    setProgress(25, 'Extraction du texte...');
    await new Promise(r => setTimeout(r, 700));
    setProgress(38, 'Analyse en cours...');

    _pbCrawlStart(88);
    const res = await fetch('/api/analyse-pdf/upload', { method: 'POST', body: formData });
    _pbCrawlStop();

    setProgress(95, 'Traitement des résultats...');
    await new Promise(r => setTimeout(r, 600));

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur analyse', 'error');
      setProgress(0, '');
      document.getElementById('pdf-empty-state').style.display = 'flex';
      return;
    }

    setProgress(100, 'Analyse terminée !');
    await new Promise(r => setTimeout(r, 1200));
    setProgress(0, '');

    afficherResultat(data);
    await loadHistoriqueAnalyses();
    showToast(`Analyse terminée — ${data.total_problemes} problème(s) détecté(s)`, 'success');

  } catch (e) {
    _pbCrawlStop();
    showToast('Erreur : ' + e.message, 'error');
    setProgress(0, '');
    document.getElementById('pdf-empty-state').style.display = 'flex';
  } finally {
    document.getElementById('pdf-analyse-btn').disabled = false;
  }
}

/* ── Afficher les résultats ────────────────────────── */
function afficherResultat(analyse) {
  const data = typeof analyse.data === 'object' ? analyse.data : JSON.parse(analyse.data_json || '{}');
  const stats = data.statistiques || {};
  const meta  = data.metadata || {};
  const problemes = data.problemes || [];

  // KPIs
  document.getElementById('pdf-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value" style="color:#5C52CC">${stats.total || 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Critique</div><div class="kpi-value" style="color:#C62828">${stats.critique || 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Élevé</div><div class="kpi-value" style="color:#EF6C00">${stats.eleve || 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Moyen</div><div class="kpi-value" style="color:#F57F17">${stats.moyen || 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Faible</div><div class="kpi-value" style="color:#2E7D32">${stats.faible || 0}</div></div>
  `;

  // Résumé exécutif
  const resumeEl = document.getElementById('pdf-resume');
  if (data.resume_executif) {
    resumeEl.textContent = data.resume_executif;
    resumeEl.style.display = 'block';
  } else {
    resumeEl.style.display = 'none';
  }

  // Métadonnées
  const metaFields = [
    ['Société', meta.societe], ['Client', meta.client],
    ['Site', meta.site], ['Matériel', meta.materiel],
    ['Date', meta.date_intervention], ['État', meta.etat]
  ].filter(([, v]) => v);
  document.getElementById('pdf-meta').innerHTML = metaFields.map(([k, v]) =>
    `<span style="background:#F0F0F8;border:1px solid #D8D5F0;border-radius:6px;padding:4px 10px;font-size:12px;">
      <strong style="color:#5C52CC">${esc(k)} :</strong> <span style="color:#1A1A2E">${esc(v)}</span>
    </span>`
  ).join('');

  // Tableau problèmes
  document.getElementById('pdf-problems-tbody').innerHTML = problemes.length
    ? problemes.map(p => {
        const { bg, color } = niveauStyle(p.niveau_risque);
        return `<tr>
          <td style="font-weight:700;color:#5C52CC">${p.num || ''}</td>
          <td><span style="background:${bg};color:${color};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">${esc(p.niveau_risque || '—')}</span></td>
          <td style="font-size:12px;color:#5C52CC;font-weight:600">${esc(p.classification || '—')}</td>
          <td style="font-size:12px">${esc(p.description || '—')}</td>
          <td style="font-size:12px;color:#2E7D32">${esc(p.action_corrective || '—')}</td>
          <td style="font-size:11px;color:#9CA3AF">${esc(p.reference_reglementaire || '—')}</td>
          <td><span style="background:#FFF3E0;color:#EF6C00;padding:2px 8px;border-radius:8px;font-size:11px;">${esc(p.statut || '—')}</span></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="7">Aucun problème détecté dans ce rapport.</td></tr>';

  document.getElementById('pdf-result').style.display = 'flex';
  // Basculer sur onglet résultats
  switchTab('analyse', 'resultats');
}

function niveauStyle(niveau) {
  const n = (niveau || '').toUpperCase();
  if (n === 'CRITIQUE') return { bg: '#FFEBEE', color: '#C62828' };
  if (n === 'ÉLEVÉ' || n === 'ELEVE') return { bg: '#FFF3E0', color: '#EF6C00' };
  if (n === 'MOYEN') return { bg: '#FFF8E1', color: '#F57F17' };
  if (n === 'FAIBLE') return { bg: '#E8F5E9', color: '#2E7D32' };
  return { bg: '#F5F5F5', color: '#757575' };
}

/* ── Historique ────────────────────────────────────── */
async function loadHistoriqueAnalyses() {
  try {
    const data = await api('/api/analyse-pdf/historique');
    renderHistorique(data);
  } catch (e) {}
}

function renderHistorique(analyses) {
  const tbody = document.getElementById('historique-tbody');
  if (!tbody) return;
  if (!analyses.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Aucune analyse dans l\'historique.</td></tr>';
    return;
  }
  tbody.innerHTML = analyses.map(a => `<tr>
    <td style="font-size:12px;font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(a.nom_fichier)}">${esc(a.nom_fichier || '—')}</td>
    <td>${esc(a.date_analyse || '—')}</td>
    <td>
      <div class="row-actions">
        <button class="btn-sm btn-sm-blue" onclick="voirDetailAnalyse(${a.id})" title="Voir le détail">👁️</button>
        <button class="btn-sm" style="background:#166534;color:#fff;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:12px;" onclick="downloadAnalyseExcel(${a.id})" title="Télécharger rapport Excel complet">⬇️</button>
        <button class="btn-sm btn-sm-red"  onclick="supprimerAnalyse(${a.id})" title="Supprimer">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function downloadAnalyseExcel(id) {
  window.location.href = `/api/analyse-pdf/${id}/export-excel`;
}

function exportAnalysesExcel() {
  window.location.href = '/api/analyse-pdf/export-excel';
}

async function voirDetailAnalyse(id) {
  try {
    const data = await api(`/api/analyse-pdf/${id}`);
    afficherResultat(data);
    switchTab('analyse', 'resultats');
  } catch (e) { showToast('Erreur chargement', 'error'); }
}

async function supprimerAnalyse(id) {
  if (!confirm('Supprimer cette analyse ?')) return;
  try {
    await api(`/api/analyse-pdf/${id}`, 'DELETE');
    showToast('Analyse supprimée', 'success');
    await loadHistoriqueAnalyses();
  } catch (e) { showToast('Erreur', 'error'); }
}
