/**
 * data.js — Couche d'acces aux donnees (API REST)
 * Remplace localStorage par des appels fetch() au backend Flask
 */

/* ── API Helper ────────────────────────────────────── */
async function api(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Non autorise');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/* ── Etablissements ────────────────────────────────── */
let _etabCache = null;

async function getEtablissements() {
  _etabCache = await api('/api/etablissements');
  return _etabCache;
}

function getCachedEtabs() {
  return _etabCache;
}

function getCurrentEtab() {
  return _etabCache?.current?.name || 'Etablissement principal';
}

function getCurrentEtabId() {
  return _etabCache?.current?.id || null;
}

async function selectEtablissement(id) {
  await api(`/api/etablissements/${id}/select`, 'POST');
  await getEtablissements();
}

async function addEtablissementAPI(name) {
  return await api('/api/etablissements', 'POST', { name });
}

async function renameEtablissementAPI(id, name) {
  return await api(`/api/etablissements/${id}`, 'PUT', { name });
}

async function deleteEtablissementAPI(id) {
  return await api(`/api/etablissements/${id}`, 'DELETE');
}

/* ── Prestataires ──────────────────────────────────── */
async function getPrestatairesAPI() {
  return await api('/api/prestataires');
}

async function savePrestaAPI(data) {
  if (data.id) return await api(`/api/prestataires/${data.id}`, 'PUT', data);
  return await api('/api/prestataires', 'POST', data);
}

async function deletePrestaAPI(id) {
  return await api(`/api/prestataires/${id}`, 'DELETE');
}

async function addEvaluationAPI(prestaId, data) {
  return await api(`/api/prestataires/${prestaId}/evaluations`, 'POST', data);
}

async function deleteEvaluationAPI(evalId) {
  return await api(`/api/evaluations/${evalId}`, 'DELETE');
}

async function getCorbeillePrestas() {
  return await api('/api/corbeille/prestataires');
}

async function restorePrestaAPI(corbeilleId) {
  return await api(`/api/corbeille/prestataires/${corbeilleId}/restore`, 'POST');
}

/* ── Actifs — Personnel ────────────────────────────── */
async function getPersonnelAPI() {
  return await api('/api/personnel');
}

async function savePersonnelAPI(data) {
  if (data.id) return await api(`/api/personnel/${data.id}`, 'PUT', data);
  return await api('/api/personnel', 'POST', data);
}

async function deletePersonnelAPI(id) {
  return await api(`/api/personnel/${id}`, 'DELETE');
}

/* ── Actifs — Unites ───────────────────────────────── */
async function getUnitesAPI() {
  return await api('/api/unites');
}

async function saveUniteAPI(data) {
  if (data.id) return await api(`/api/unites/${data.id}`, 'PUT', data);
  return await api('/api/unites', 'POST', data);
}

async function deleteUniteAPI(id) {
  return await api(`/api/unites/${id}`, 'DELETE');
}

/* ── Actifs — Materiels ────────────────────────────── */
async function getMaterielsAPI() {
  return await api('/api/materiels');
}

async function saveMaterielAPI(data) {
  if (data.id) return await api(`/api/materiels/${data.id}`, 'PUT', data);
  return await api('/api/materiels', 'POST', data);
}

async function deleteMaterielAPI(id) {
  return await api(`/api/materiels/${id}`, 'DELETE');
}

/* ── Pharmacie ─────────────────────────────────────── */
async function getPharmaStockAPI() {
  return await api('/api/pharmacie/stock');
}

async function savePharmaStockAPI(data) {
  if (data.id) return await api(`/api/pharmacie/stock/${data.id}`, 'PUT', data);
  return await api('/api/pharmacie/stock', 'POST', data);
}

async function deletePharmaStockAPI(id) {
  return await api(`/api/pharmacie/stock/${id}`, 'DELETE');
}

async function pharmaSortieAPI(data) {
  return await api('/api/pharmacie/sortie', 'POST', data);
}

async function getPharmaMouvementsAPI() {
  return await api('/api/pharmacie/mouvements');
}

async function getPharmaArchiveAPI() {
  return await api('/api/pharmacie/archive');
}

async function restorePharmaAPI(archiveId) {
  return await api(`/api/pharmacie/archive/${archiveId}/restore`, 'POST');
}

async function retirerPerimesAPI() {
  return await api('/api/pharmacie/retirer-perimes', 'POST');
}

/* ── Admin ────────────────────────────────────────── */
let _currentUserRole = 'user';

async function fetchCurrentUser() {
  const me = await api('/auth/me');
  _currentUserRole = me.role || 'user';
  return me;
}

function getCurrentUserRole() { return _currentUserRole; }
function isAdmin() { return _currentUserRole === 'admin' || _currentUserRole === 'superadmin'; }
function isSuperAdmin() { return _currentUserRole === 'superadmin'; }

async function getAdminUsersAPI() { return await api('/api/admin/users'); }
async function createAdminUserAPI(data) { return await api('/api/admin/users', 'POST', data); }
async function updateAdminUserAPI(uid, data) { return await api(`/api/admin/users/${uid}`, 'PUT', data); }
async function deleteAdminUserAPI(uid) { return await api(`/api/admin/users/${uid}`, 'DELETE'); }
async function assignEtabToUserAPI(uid, name) { return await api(`/api/admin/users/${uid}/etabs`, 'POST', { name }); }

/* ── UUID simple (pour compatibilite frontend) ────── */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Auth ──────────────────────────────────────────── */
async function logout() {
  await api('/auth/logout', 'POST');
  window.location.href = '/login';
}
