from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date

db = SQLAlchemy()


# ── Utilisateurs & Etablissements ─────────────────────

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='user')  # superadmin, admin, user
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    etablissements = db.relationship('Etablissement', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_superadmin(self):
        return self.role == 'superadmin'

    def is_admin(self):
        return self.role in ('admin', 'superadmin')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email,
            'role': self.role, 'created_at': self.created_at.isoformat() if self.created_at else ''
        }


class Etablissement(db.Model):
    __tablename__ = 'etablissements'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_current = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relations
    prestataires = db.relationship('Prestataire', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    corbeille_prestas = db.relationship('CorbeillePresta', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    personnel = db.relationship('Personnel', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    unites = db.relationship('Unite', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    materiels = db.relationship('Materiel', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    pharma_stock = db.relationship('PharmaStock', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    pharma_mouvements = db.relationship('PharmaMouvement', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    pharma_archive = db.relationship('PharmaArchive', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    vehicules = db.relationship('Vehicule', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    analyses_pdf = db.relationship('AnalysePDF', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    stock_produits = db.relationship('StockProduit', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    cles_items = db.relationship('CleItem', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    employes_cles = db.relationship('EmployeCle', backref='etablissement', lazy=True, cascade='all, delete-orphan')
    historique_cles = db.relationship('HistoriqueCle', backref='etablissement', lazy=True, cascade='all, delete-orphan')


# ── Prestataires ──────────────────────────────────────

class Prestataire(db.Model):
    __tablename__ = 'prestataires'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(200), nullable=False)
    service = db.Column(db.String(100), default='')
    contact = db.Column(db.String(200), default='')
    email = db.Column(db.String(200), default='')
    telephone = db.Column(db.String(50), default='')
    date_debut = db.Column(db.String(10), default='')
    date_fin = db.Column(db.String(10), default='')
    montant = db.Column(db.Float, default=0)
    frequence = db.Column(db.String(50), default='')
    prestations = db.Column(db.Text, default='')
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    evaluations = db.relationship('Evaluation', backref='prestataire', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'service': self.service,
            'contact': self.contact, 'email': self.email, 'telephone': self.telephone,
            'date_debut': self.date_debut, 'date_fin': self.date_fin,
            'montant': self.montant, 'frequence': self.frequence,
            'prestations': self.prestations, 'notes': self.notes,
            'evaluations': [e.to_dict() for e in self.evaluations]
        }


class Evaluation(db.Model):
    __tablename__ = 'evaluations'
    id = db.Column(db.Integer, primary_key=True)
    presta_id = db.Column(db.Integer, db.ForeignKey('prestataires.id'), nullable=False)
    date = db.Column(db.String(10), default='')
    note = db.Column(db.Integer, default=4)
    commentaire = db.Column(db.Text, default='')

    def to_dict(self):
        return {'id': self.id, 'date': self.date, 'note': self.note, 'commentaire': self.commentaire}


class CorbeillePresta(db.Model):
    __tablename__ = 'corbeille_prestas'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(200))
    service = db.Column(db.String(100))
    montant = db.Column(db.Float, default=0)
    data_json = db.Column(db.Text, default='{}')
    deleted_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'service': self.service,
            'montant': self.montant, 'deleted_at': self.deleted_at.isoformat() if self.deleted_at else ''
        }


# ── Actifs ────────────────────────────────────────────

class Personnel(db.Model):
    __tablename__ = 'personnel'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), default='')
    type_contrat = db.Column(db.String(50), default='')
    poste = db.Column(db.String(100), default='')
    service = db.Column(db.String(100), default='')
    telephone = db.Column(db.String(30), default='')
    lieu = db.Column(db.String(100), default='')
    date_arrivee = db.Column(db.String(10), default='')
    date_depart = db.Column(db.String(10), default='')

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'prenom': self.prenom,
            'type_contrat': self.type_contrat, 'poste': self.poste,
            'service': self.service, 'telephone': self.telephone,
            'lieu': self.lieu, 'date_arrivee': self.date_arrivee,
            'date_depart': self.date_depart
        }


class Unite(db.Model):
    __tablename__ = 'unites'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(300), default='')
    emplacement = db.Column(db.String(200), default='')

    def to_dict(self):
        return {'id': self.id, 'nom': self.nom, 'description': self.description, 'emplacement': self.emplacement}


class Materiel(db.Model):
    __tablename__ = 'materiels'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(200), nullable=False)
    reference = db.Column(db.String(100), default='')
    type_materiel = db.Column(db.String(100), default='')
    date_achat = db.Column(db.String(10), default='')
    cout = db.Column(db.Float, default=0)
    duree_amortissement = db.Column(db.Integer, default=5)
    statut = db.Column(db.String(50), default='En service')
    attribue_a = db.Column(db.String(200), default='')
    notes = db.Column(db.Text, default='')

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'reference': self.reference,
            'type_materiel': self.type_materiel, 'date_achat': self.date_achat,
            'cout': self.cout, 'duree_amortissement': self.duree_amortissement,
            'statut': self.statut, 'attribue_a': self.attribue_a, 'notes': self.notes
        }


# ── Pharmacie ─────────────────────────────────────────

class PharmaStock(db.Model):
    __tablename__ = 'pharma_stock'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom_medicament = db.Column(db.String(300), nullable=False)
    lot = db.Column(db.String(100), default='')
    date_peremption = db.Column(db.String(10), nullable=False)
    quantite = db.Column(db.Integer, default=1)
    stock_minimum = db.Column(db.Integer, default=0)
    emplacement = db.Column(db.String(200), default='')
    personne_entree = db.Column(db.String(200), default='')
    date_ajout = db.Column(db.String(10), default='')
    derniere_sortie = db.Column(db.String(10), default='')

    def to_dict(self):
        return {
            'id': self.id, 'nom_medicament': self.nom_medicament, 'lot': self.lot,
            'date_peremption': self.date_peremption, 'quantite': self.quantite,
            'stock_minimum': self.stock_minimum, 'emplacement': self.emplacement,
            'personne_entree': self.personne_entree, 'date_ajout': self.date_ajout,
            'derniere_sortie': self.derniere_sortie
        }


class PharmaMouvement(db.Model):
    __tablename__ = 'pharma_mouvements'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # sortie / reception
    nom_medicament = db.Column(db.String(300), nullable=False)
    quantite = db.Column(db.Integer, nullable=False)
    personne = db.Column(db.String(200), default='')
    role = db.Column(db.String(200), default='')
    date_mouvement = db.Column(db.String(10), default='')
    heure = db.Column(db.String(5), default='')

    def to_dict(self):
        return {
            'id': self.id, 'type': self.type, 'nom_medicament': self.nom_medicament,
            'quantite': self.quantite, 'personne': self.personne, 'role': self.role,
            'date_mouvement': self.date_mouvement, 'heure': self.heure
        }


class PharmaArchive(db.Model):
    __tablename__ = 'pharma_archive'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom_medicament = db.Column(db.String(300))
    lot = db.Column(db.String(100), default='')
    date_peremption = db.Column(db.String(10))
    quantite = db.Column(db.Integer, default=0)
    emplacement = db.Column(db.String(200), default='')
    date_suppression = db.Column(db.String(10), default='')

    def to_dict(self):
        return {
            'id': self.id, 'nom_medicament': self.nom_medicament, 'lot': self.lot,
            'date_peremption': self.date_peremption, 'quantite': self.quantite,
            'emplacement': self.emplacement, 'date_suppression': self.date_suppression
        }


# ── Analyse PDF ───────────────────────────────────────

class AnalysePDF(db.Model):
    __tablename__ = 'analyses_pdf'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    date_analyse = db.Column(db.String(10), default='')
    nom_fichier = db.Column(db.String(300), default='')
    societe = db.Column(db.String(200), default='')
    client = db.Column(db.String(200), default='')
    site = db.Column(db.String(200), default='')
    materiel = db.Column(db.String(200), default='')
    etat = db.Column(db.String(100), default='')
    total_problemes = db.Column(db.Integer, default=0)
    nb_critique = db.Column(db.Integer, default=0)
    nb_eleve = db.Column(db.Integer, default=0)
    nb_moyen = db.Column(db.Integer, default=0)
    nb_faible = db.Column(db.Integer, default=0)
    resume_executif = db.Column(db.Text, default='')
    data_json = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'date_analyse': self.date_analyse,
            'nom_fichier': self.nom_fichier, 'societe': self.societe,
            'client': self.client, 'site': self.site,
            'materiel': self.materiel, 'etat': self.etat,
            'total_problemes': self.total_problemes, 'nb_critique': self.nb_critique,
            'nb_eleve': self.nb_eleve, 'nb_moyen': self.nb_moyen,
            'nb_faible': self.nb_faible, 'resume_executif': self.resume_executif,
            'data_json': self.data_json
        }


# ── Stock ─────────────────────────────────────────────

class StockProduit(db.Model):
    __tablename__ = 'stock_produits'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    nom = db.Column(db.String(200), nullable=False)
    categorie = db.Column(db.String(100), default='')
    quantite = db.Column(db.Float, default=0)
    unite = db.Column(db.String(30), default='unité')
    seuil_alerte = db.Column(db.Float, default=0)
    emplacement = db.Column(db.String(200), default='')

    mouvements = db.relationship('StockMouvement', backref='produit', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'categorie': self.categorie,
            'quantite': self.quantite, 'unite': self.unite,
            'seuil_alerte': self.seuil_alerte, 'emplacement': self.emplacement,
            'alerte': self.quantite <= self.seuil_alerte and self.seuil_alerte > 0
        }


class StockMouvement(db.Model):
    __tablename__ = 'stock_mouvements'
    id = db.Column(db.Integer, primary_key=True)
    produit_id = db.Column(db.Integer, db.ForeignKey('stock_produits.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # sortie / reception
    quantite = db.Column(db.Float, nullable=False)
    personne = db.Column(db.String(200), default='')
    departement = db.Column(db.String(200), default='')
    date = db.Column(db.String(10), default='')
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'produit_id': self.produit_id,
            'produit_nom': self.produit.nom if self.produit else '',
            'produit_unite': self.produit.unite if self.produit else '',
            'type': self.type, 'quantite': self.quantite,
            'personne': self.personne, 'departement': self.departement,
            'date': self.date, 'notes': self.notes
        }


# ── Clés ──────────────────────────────────────────────

class CleItem(db.Model):
    __tablename__ = 'cles_items'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    numero = db.Column(db.String(50), default='')
    nom = db.Column(db.String(200), nullable=False)
    quantite_totale = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {'id': self.id, 'numero': self.numero, 'nom': self.nom,
                'quantite_totale': self.quantite_totale}


class EmployeCle(db.Model):
    __tablename__ = 'employes_cles'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    prenom = db.Column(db.String(100), default='')
    nom = db.Column(db.String(100), nullable=False)
    type_contrat = db.Column(db.String(50), default='CDI')
    poste = db.Column(db.String(100), default='')
    date_arrivee = db.Column(db.String(10), default='')
    date_depart = db.Column(db.String(10), default='')

    def to_dict(self):
        return {'id': self.id, 'prenom': self.prenom, 'nom': self.nom,
                'type_contrat': self.type_contrat, 'poste': self.poste,
                'date_arrivee': self.date_arrivee, 'date_depart': self.date_depart}


class AttributionCle(db.Model):
    __tablename__ = 'attributions_cles'
    id = db.Column(db.Integer, primary_key=True)
    employe_id = db.Column(db.Integer, db.ForeignKey('employes_cles.id'), nullable=False)
    cle_id = db.Column(db.Integer, db.ForeignKey('cles_items.id'), nullable=False)
    date_attribution = db.Column(db.String(10), nullable=False)
    date_retour = db.Column(db.String(10), default='')
    notes = db.Column(db.Text, default='')

    employe = db.relationship('EmployeCle', backref='attributions', lazy=True)
    cle = db.relationship('CleItem', backref='attributions', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'employe_id': self.employe_id,
            'cle_id': self.cle_id,
            'date_attribution': self.date_attribution,
            'date_retour': self.date_retour,
            'notes': self.notes,
            'employe_nom': f"{self.employe.prenom} {self.employe.nom}".strip() if self.employe else '',
            'employe_poste': self.employe.poste if self.employe else '',
            'cle_nom': self.cle.nom if self.cle else '',
            'cle_numero': self.cle.numero if self.cle else '',
        }


class HistoriqueCle(db.Model):
    __tablename__ = 'historique_cles'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    event_type = db.Column(db.String(50), default='')
    details = db.Column(db.Text, default='')
    event_date = db.Column(db.String(20), default='')

    def to_dict(self):
        return {'id': self.id, 'event_type': self.event_type,
                'details': self.details, 'event_date': self.event_date}


# ── Parc Auto ─────────────────────────────────────────

class Vehicule(db.Model):
    __tablename__ = 'vehicules'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    immatriculation = db.Column(db.String(20), nullable=False)
    marque = db.Column(db.String(100), default='')
    modele = db.Column(db.String(100), default='')
    annee = db.Column(db.Integer, default=0)
    kilometrage = db.Column(db.Integer, default=0)
    couleur = db.Column(db.String(20), default='#808080')
    conducteur = db.Column(db.String(200), default='')
    date_ct = db.Column(db.String(10), default='')
    date_assurance = db.Column(db.String(10), default='')
    remarques_ct = db.Column(db.Text, default='')
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    entretiens = db.relationship('Entretien', backref='vehicule', lazy=True, cascade='all, delete-orphan')
    carburants = db.relationship('Carburant', backref='vehicule', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'immatriculation': self.immatriculation,
            'marque': self.marque, 'modele': self.modele,
            'annee': self.annee, 'kilometrage': self.kilometrage,
            'couleur': self.couleur, 'conducteur': self.conducteur,
            'date_ct': self.date_ct, 'date_assurance': self.date_assurance,
            'remarques_ct': self.remarques_ct, 'notes': self.notes
        }


class Entretien(db.Model):
    __tablename__ = 'entretiens'
    id = db.Column(db.Integer, primary_key=True)
    vehicule_id = db.Column(db.Integer, db.ForeignKey('vehicules.id'), nullable=False)
    date = db.Column(db.String(10), default='')
    type_entretien = db.Column(db.String(100), default='')
    kilometrage = db.Column(db.Integer, default=0)
    description = db.Column(db.Text, default='')
    cout = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            'id': self.id, 'vehicule_id': self.vehicule_id,
            'date': self.date, 'type_entretien': self.type_entretien,
            'kilometrage': self.kilometrage, 'description': self.description,
            'cout': self.cout,
            'immatriculation': self.vehicule.immatriculation if self.vehicule else ''
        }


class Carburant(db.Model):
    __tablename__ = 'carburants'
    id = db.Column(db.Integer, primary_key=True)
    vehicule_id = db.Column(db.Integer, db.ForeignKey('vehicules.id'), nullable=False)
    date = db.Column(db.String(10), default='')
    litres = db.Column(db.Float, default=0)
    cout = db.Column(db.Float, default=0)
    kilometrage = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id, 'vehicule_id': self.vehicule_id,
            'date': self.date, 'litres': self.litres,
            'cout': self.cout, 'kilometrage': self.kilometrage,
            'immatriculation': self.vehicule.immatriculation if self.vehicule else ''
        }


class ContratPDF(db.Model):
    __tablename__ = 'contrats_pdf'
    id = db.Column(db.Integer, primary_key=True)
    etab_id = db.Column(db.Integer, db.ForeignKey('etablissements.id'), nullable=False)
    presta_id = db.Column(db.Integer, db.ForeignKey('prestataires.id'), nullable=True)
    nom_fichier = db.Column(db.String(300), nullable=False)
    date_ajout = db.Column(db.String(10), default='')
    contenu = db.Column(db.LargeBinary, nullable=False)

    def to_dict(self):
        presta = Prestataire.query.get(self.presta_id) if self.presta_id else None
        return {
            'id': self.id,
            'presta_id': self.presta_id,
            'presta_nom': presta.nom if presta else '—',
            'presta_service': presta.service if presta else '—',
            'nom_fichier': self.nom_fichier,
            'date_ajout': self.date_ajout,
        }
