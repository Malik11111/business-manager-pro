/**
 * utils.js — Fonctions utilitaires partagées
 */

/* ── Dates ─────────────────────────────────────────────── */
function formatDateFR(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysRemaining(isoDate) {
  if (!isoDate) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(isoDate + 'T00:00:00');
  return Math.round((end - now) / 86400000);
}

function contractProgress(dateDebut, dateFin) {
  if (!dateDebut || !dateFin) return 0;
  const start = new Date(dateDebut + 'T00:00:00');
  const end   = new Date(dateFin   + 'T00:00:00');
  const now   = new Date(); now.setHours(0,0,0,0);
  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, Math.round(elapsed / total * 100)));
}

function contractStatus(dateFin) {
  const j = daysRemaining(dateFin);
  if (j === null) return { label: '—', cls: 'badge-gray' };
  if (j < 0)   return { label: 'Expiré',          cls: 'badge-red' };
  if (j < 30)  return { label: `⚠️ ${j}j`,          cls: 'badge-red' };
  if (j < 90)  return { label: `⏳ ${j}j`,          cls: 'badge-orange' };
  return { label: '✅ Actif', cls: 'badge-green' };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addYears(isoDate, n) {
  if (!isoDate) return today();
  const d = new Date(isoDate + 'T00:00:00');
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/* ── Montant ────────────────────────────────────────────── */
function formatEUR(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function htToTTC(ht) {
  return Math.round(ht * 1.20);
}

/* ── Toast notifications ────────────────────────────────── */
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

/* ── Étoiles ────────────────────────────────────────────── */
function renderStars(note, max = 5) {
  let html = '<span class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="star${i <= note ? '' : ' empty'}">★</span>`;
  }
  return html + '</span>';
}

function avgNote(evaluations) {
  if (!evaluations || evaluations.length === 0) return null;
  return evaluations.reduce((s, e) => s + e.note, 0) / evaluations.length;
}

/* ── Escape HTML ────────────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Confirmation simple ────────────────────────────────── */
function confirmAction(msg) {
  return window.confirm(msg);
}

/* ── Export CSV ─────────────────────────────────────────── */
function exportCSV(rows, headers, filename) {
  const lines = [headers.join(';')];
  rows.forEach(r => lines.push(r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ── Debounce ───────────────────────────────────────────── */
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ── Services disponibles ───────────────────────────────── */
const SERVICES = [
  'Nettoyage', 'Maintenance', 'Sécurité', 'Restauration',
  'Espaces verts', 'Fournitures', 'Informatique', 'Téléphonie',
  'Transport / Logistique', 'Comptabilité / Finance', 'Juridique',
  'Formation', 'Communication / Marketing', 'Déchets / Recyclage',
  'Énergie', 'Assurance', 'Désinsectisation', 'Autre'
];

const FREQUENCES = [
  '', 'Hebdomadaire', 'Mensuelle', 'Trimestrielle',
  'Semestrielle', 'Annuelle', 'Ponctuelle', 'Sur demande'
];
