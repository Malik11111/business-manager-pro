/**
 * data.js — Gestion des données (localStorage)
 * Simule le fichier prestataires.json de l'application Python
 */

const STORAGE_KEY_PRESTATAIRES = 'bm_prestataires';
const STORAGE_KEY_CORBEILLE     = 'bm_corbeille';
const STORAGE_KEY_CONTRATS      = 'bm_contrats';
const STORAGE_KEY_ETABLISSEMENTS = 'bm_etablissements';

/* ── Établissements ─────────────────────────────────────── */
function getEtablissements() {
  const raw = localStorage.getItem(STORAGE_KEY_ETABLISSEMENTS);
  if (raw) return JSON.parse(raw);
  return { list: ['Établissement principal'], current: 'Établissement principal' };
}

function saveEtablissements(data) {
  localStorage.setItem(STORAGE_KEY_ETABLISSEMENTS, JSON.stringify(data));
}

function getCurrentEtab() {
  return getEtablissements().current;
}

/* ── Préstataires ───────────────────────────────────────── */
function getAllData() {
  const raw = localStorage.getItem(STORAGE_KEY_PRESTATAIRES);
  return raw ? JSON.parse(raw) : {};
}

function getPrestataires(etab) {
  const all = getAllData();
  return all[etab] || [];
}

function savePrestataires(etab, list) {
  const all = getAllData();
  all[etab] = list;
  localStorage.setItem(STORAGE_KEY_PRESTATAIRES, JSON.stringify(all));
}

/* ── Corbeille ──────────────────────────────────────────── */
function getCorbeille(etab) {
  const raw = localStorage.getItem(STORAGE_KEY_CORBEILLE);
  const all = raw ? JSON.parse(raw) : {};
  return all[etab] || [];
}

function saveCorbeille(etab, list) {
  const raw = localStorage.getItem(STORAGE_KEY_CORBEILLE);
  const all = raw ? JSON.parse(raw) : {};
  all[etab] = list;
  localStorage.setItem(STORAGE_KEY_CORBEILLE, JSON.stringify(all));
}

/* ── Contrats (métadonnées) ─────────────────────────────── */
function getContrats(etab) {
  const raw = localStorage.getItem(STORAGE_KEY_CONTRATS);
  const all = raw ? JSON.parse(raw) : {};
  return all[etab] || [];
}

function saveContrats(etab, list) {
  const raw = localStorage.getItem(STORAGE_KEY_CONTRATS);
  const all = raw ? JSON.parse(raw) : {};
  all[etab] = list;
  localStorage.setItem(STORAGE_KEY_CONTRATS, JSON.stringify(all));
}

/* ── Démo — données initiales ───────────────────────────── */
function loadDemoData(etab) {
  const demo = [
    {
      id: uuid(), nom: 'CleanPro Services', service: 'Nettoyage',
      contact: 'Marie Dupont', email: 'contact@cleanpro.fr', telephone: '01 23 45 67 89',
      date_debut: '2025-01-01', date_fin: '2026-12-31',
      montant: 18000, frequence: 'Hebdomadaire',
      prestations: 'Nettoyage quotidien des locaux, désinfection hebdomadaire, entretien sanitaires.',
      notes: 'Prestataire fiable depuis 3 ans.', evaluations: [
        { id: uuid(), date: '2025-06-15', note: 4, commentaire: 'Bon travail dans l\'ensemble.' },
        { id: uuid(), date: '2025-11-20', note: 5, commentaire: 'Excellent service, équipe réactive.' }
      ]
    },
    {
      id: uuid(), nom: 'MaintenTech', service: 'Maintenance',
      contact: 'Pierre Martin', email: 'p.martin@maintentech.fr', telephone: '01 34 56 78 90',
      date_debut: '2025-06-01', date_fin: '2027-05-31',
      montant: 9600, frequence: 'Mensuelle',
      prestations: 'Maintenance préventive et corrective des équipements, astreinte téléphonique.',
      notes: 'Certifié ISO 9001.', evaluations: [
        { id: uuid(), date: '2025-09-01', note: 4, commentaire: 'Intervient rapidement.' }
      ]
    },
    {
      id: uuid(), nom: 'SecureGuard', service: 'Sécurité',
      contact: 'Jean Leblanc', email: 'jl@secureguard.fr', telephone: '01 45 67 89 01',
      date_debut: '2024-07-01', date_fin: '2027-06-30',
      montant: 36000, frequence: 'Sur demande',
      prestations: 'Surveillance 24h/24, rondes de nuit, contrôle d\'accès, télésurveillance.',
      notes: 'Contrat renouvelé pour 3 ans.', evaluations: []
    },
    {
      id: uuid(), nom: 'VerdurePro', service: 'Espaces verts',
      contact: 'Sophie Vert', email: 'sophie@verdure.fr', telephone: '06 12 34 56 78',
      date_debut: '2026-03-01', date_fin: '2026-10-31',
      montant: 4800, frequence: 'Mensuelle',
      prestations: 'Tonte pelouses, taille haies, désherbage, entretien massifs.',
      notes: 'Saison printemps-automne.', evaluations: []
    },
    {
      id: uuid(), nom: 'InfoSys Solutions', service: 'Informatique',
      contact: 'David Chen', email: 'd.chen@infosys.fr', telephone: '01 56 78 90 12',
      date_debut: '2025-01-15', date_fin: '2026-01-14',
      montant: 7200, frequence: 'Sur demande',
      prestations: 'Support informatique, maintenance parc PC, administration réseau.',
      notes: '', evaluations: []
    },
    {
      id: uuid(), nom: 'Repas & Co', service: 'Restauration',
      contact: 'Anne Cuisine', email: 'anne@repaseco.fr', telephone: '01 67 89 01 23',
      date_debut: '2025-09-01', date_fin: new Date(Date.now() + 25*24*60*60*1000).toISOString().slice(0,10),
      montant: 120000, frequence: 'Hebdomadaire',
      prestations: 'Fourniture des repas du midi, régimes spéciaux, livraison.',
      notes: 'Expiration imminente — renouvellement prévu.', evaluations: [
        { id: uuid(), date: '2026-01-10', note: 3, commentaire: 'Qualité variable selon les jours.' }
      ]
    }
  ];
  savePrestataires(etab, demo);
}

/* ── UUID simple ────────────────────────────────────────── */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
