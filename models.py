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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    etablissements = db.relationship('Etablissement', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


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
    lieu = db.Column(db.String(100), default='')
    date_arrivee = db.Column(db.String(10), default='')
    date_depart = db.Column(db.String(10), default='')

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'prenom': self.prenom,
            'type_contrat': self.type_contrat, 'poste': self.poste,
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
