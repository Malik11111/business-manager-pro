# -*- coding: utf-8 -*-
"""Genere des PDFs de test pour chaque module de scan."""
from fpdf import FPDF
import os

OUT = os.path.dirname(os.path.abspath(__file__))

def new_pdf():
    p = FPDF()
    p.add_page()
    p.set_font("Helvetica", size=12)
    return p

# 1. FACTURE INVESTISSEMENT (Actifs)
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "FACTURE N F-2024-0892", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(4)
p.set_font("Helvetica", size=11)
p.cell(0, 8, "Fournisseur : BUREAU VALLEE PRO", new_x="LMARGIN", new_y="NEXT")
p.cell(0, 8, "Date achat : 15/03/2024", new_x="LMARGIN", new_y="NEXT")
p.ln(3)
p.set_font("Helvetica", "B", 11)
p.cell(100, 8, "Designation", border=1)
p.cell(40, 8, "Quantite", border=1)
p.cell(50, 8, "Prix TTC", border=1, new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=11)
p.cell(100, 8, "Ordinateur portable Dell Latitude 5540", border=1)
p.cell(40, 8, "1", border=1)
p.cell(50, 8, "1249.00 EUR", border=1, new_x="LMARGIN", new_y="NEXT")
p.cell(100, 8, "Souris sans fil Logitech MX Master", border=1)
p.cell(40, 8, "2", border=1)
p.cell(50, 8, "89.90 EUR", border=1, new_x="LMARGIN", new_y="NEXT")
p.ln(4)
p.set_font("Helvetica", "B", 12)
p.cell(0, 10, "TOTAL TTC : 1338.90 EUR", new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=10)
p.cell(0, 8, "N/S Dell : SN-DELL-2024-XF7K9  |  Type : Informatique", new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "facture_investissement.pdf"))
print("OK facture_investissement.pdf")

# 2. CARTE GRISE VEHICULE
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "CERTIFICAT D'IMMATRICULATION", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(4)
infos = [
    ("A  - Immatriculation", "AB-456-CD"),
    ("B  - Date 1ere mise en circulation", "12/06/2019"),
    ("D.1 - Marque", "RENAULT"),
    ("D.2 - Type", "Trafic"),
    ("D.3 - Version", "L1H1 2.0 dCi 120 Grand Confort"),
    ("E  - N VIN", "VF1FL000567890123"),
    ("P.1 - Cylindree", "1 995 cm3"),
]
for label, val in infos:
    p.set_font("Helvetica", "B", 10)
    p.cell(90, 7, label, border="B")
    p.set_font("Helvetica", size=10)
    p.cell(0, 7, val, border="B", new_x="LMARGIN", new_y="NEXT")
p.ln(8)
p.set_font("Helvetica", "B", 11)
p.cell(0, 8, "CONTROLE TECHNIQUE", new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=11)
p.cell(0, 8, "Prochain CT valable jusqu'au : 14-06-2026", new_x="LMARGIN", new_y="NEXT")
p.cell(0, 8, "Assurance valide jusqu'au : 31-12-2025", new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "carte_grise_vehicule.pdf"))
print("OK carte_grise_vehicule.pdf")

# 3. FICHE DISTRIBUTION CLES
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "FICHE DE DISTRIBUTION DES CLES", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(4)
p.set_font("Helvetica", size=12)
p.cell(0, 8, "Employe : MARTIN Jean   |   Poste : Agent de maintenance", new_x="LMARGIN", new_y="NEXT")
p.cell(0, 8, "Date attribution : 08-04-2026", new_x="LMARGIN", new_y="NEXT")
p.ln(4)
p.set_font("Helvetica", "B", 11)
p.cell(70, 8, "Cle / Badge", border=1)
p.cell(50, 8, "Numero", border=1)
p.cell(70, 8, "Observations", border=1, new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=11)
rows = [
    ("Passe general", "PG-001", "Remis en main propre"),
    ("Cle batiment A", "BA-012", "OK"),
    ("Badge portail", "BADGE-07", "Teste fonctionnel"),
    ("Cle bureau direction", "DIR-003", ""),
]
for r in rows:
    p.cell(70, 8, r[0], border=1)
    p.cell(50, 8, r[1], border=1)
    p.cell(70, 8, r[2], border=1, new_x="LMARGIN", new_y="NEXT")
p.ln(6)
p.cell(0, 8, "Signature employe : ____________________", new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "fiche_distribution_cles.pdf"))
print("OK fiche_distribution_cles.pdf")

# 4. FICHE DISTRIBUTION STOCK
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "FICHE DE DISTRIBUTION PRODUITS ENTRETIEN", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(2)
p.set_font("Helvetica", size=12)
p.cell(0, 8, "Date : 08/04/2026     Groupe / Unite de vie : Les Colombes", new_x="LMARGIN", new_y="NEXT")
p.ln(4)
p.set_font("Helvetica", "B", 11)
p.cell(80, 8, "Produit", border=1)
p.cell(50, 8, "Qte demandee", border=1)
p.cell(50, 8, "QUANTITEE REMISE", border=1, new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=11)
produits = [
    ("Javel 5L", "3", "2"),
    ("Liquide vaisselle 1L", "5", "5"),
    ("Desinfectant sol 2L", "2", "2"),
    ("Papier essuie-tout x6", "10", "8"),
    ("Sacs poubelle 100L x25", "4", "3"),
    ("Produit WC 750ml", "2", "0"),
]
for nom, dem, rem in produits:
    p.cell(80, 8, nom, border=1)
    p.cell(50, 8, dem, border=1)
    p.cell(50, 8, rem, border=1, new_x="LMARGIN", new_y="NEXT")
p.ln(4)
p.set_font("Helvetica", size=10)
p.cell(0, 7, "Remis par : ___________________   Signature : ___________________", new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "fiche_distribution_stock.pdf"))
print("OK fiche_distribution_stock.pdf")

# 5. CONTRAT PRESTATAIRE
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "CONTRAT DE PRESTATION DE SERVICES", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(4)
p.set_font("Helvetica", size=12)
lignes = [
    "Prestataire : NETTOYAGE PRO SARL",
    "SIRET : 412 345 678 00019",
    "Contact : M. Dupont Pierre",
    "Email : contact@nettoyagepro.fr",
    "Telephone : 01 23 45 67 89",
    "",
    "Service : Nettoyage des locaux - 5 jours/semaine",
    "Frequence : Mensuel",
    "Montant HT : 2 500.00 EUR / mois",
    "Montant TTC : 3 000.00 EUR / mois  (TVA 20%)",
    "Montant annuel TTC : 36 000.00 EUR",
    "",
    "Date de debut : 01/01/2025",
    "Date de fin : 31/12/2025",
    "",
    "Prestations : Nettoyage quotidien bureaux, sanitaires, couloirs.",
]
for l in lignes:
    p.cell(0, 8, l, new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "contrat_prestataire.pdf"))
print("OK contrat_prestataire.pdf")

# 6. RAPPORT INSPECTION
p = new_pdf()
p.set_font("Helvetica", "B", 16)
p.cell(0, 12, "RAPPORT D'INSPECTION SECURITE", new_x="LMARGIN", new_y="NEXT", align="C")
p.ln(4)
p.set_font("Helvetica", size=11)
p.cell(0, 8, "Etablissement : IME Les Pins   |   Date : 08/04/2026", new_x="LMARGIN", new_y="NEXT")
p.cell(0, 8, "Inspecteur : M. Bernard Robert", new_x="LMARGIN", new_y="NEXT")
p.ln(4)
p.set_font("Helvetica", "B", 12)
p.cell(0, 8, "NON-CONFORMITES DETECTEES :", new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", "B", 10)
p.cell(25, 8, "Ref.", border=1)
p.cell(30, 8, "Gravite", border=1)
p.cell(125, 8, "Description", border=1, new_x="LMARGIN", new_y="NEXT")
p.set_font("Helvetica", size=10)
ncs = [
    ("NC-001", "CRITIQUE", "Extincteur batiment B expire depuis 03/2024"),
    ("NC-002", "MAJEURE", "Issue de secours salle 12 bloquee par mobilier"),
    ("NC-003", "MINEURE", "Signaletique sortie de secours manquante couloir Est"),
    ("NC-004", "MAJEURE", "Systeme alarme incendie non teste depuis 6 mois"),
    ("NC-005", "MINEURE", "Extincteur salle reunion mal positionne"),
]
for ref, grav, desc in ncs:
    p.cell(25, 8, ref, border=1)
    p.cell(30, 8, grav, border=1)
    p.cell(125, 8, desc, border=1, new_x="LMARGIN", new_y="NEXT")
p.output(os.path.join(OUT, "rapport_inspection.pdf"))
print("OK rapport_inspection.pdf")

print("\nTous les PDFs generes dans :", OUT)
