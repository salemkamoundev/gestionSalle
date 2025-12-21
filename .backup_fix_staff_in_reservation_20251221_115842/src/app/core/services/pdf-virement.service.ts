import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expense } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class PdfVirementService {

  /**
   * Génère un PDF de virement au format standard tunisien
   * Adapté pour les dépenses (salaires, fournisseurs)
   */
  generateVirementPDF(expense: Expense, beneficiaryName: string) {
    const doc = new jsPDF();
    const dateStr = new Date(expense.date?.toDate ? expense.date.toDate() : expense.date).toLocaleDateString('fr-FR');

    // --- EN-TÊTE ---
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('ORDRE DE VIREMENT / RÈGLEMENT', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('RestoManager - Gestion Restaurant', 14, 28);
    doc.text('Date d\'émission : ' + dateStr, 14, 33);
    doc.text('Référence : ' + expense.id, 14, 38);

    // --- CADRE BÉNÉFICIAIRE ---
    doc.setDrawColor(200);
    doc.line(14, 45, 196, 45); // Ligne de séparation

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DU BÉNÉFICIAIRE', 14, 55);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Nom / Raison Sociale : ' + beneficiaryName, 14, 62);
    doc.text('Catégorie : ' + expense.category.toUpperCase(), 14, 69);

    // --- TABLEAU DU RÈGLEMENT ---
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Date', 'Mode', 'Montant (TND)']],
      body: [
        [
          expense.description, 
          dateStr, 
          'Virement Bancaire', 
          expense.amount.toFixed(3)
        ]
      ],
      headStyles: { fillColor: [67, 56, 202] }, // Indigo-700
      styles: { fontSize: 10, cellPadding: 5 }
    });

    // --- MONTANT EN TOUTES LETTRES (Placeholder) ---
    const finalY = (doc as any).lastAutoTable.cursor.y + 20;
    doc.setFontSize(11);
    doc.text('Arrêté la présente somme à la valeur de :', 14, finalY);
    doc.setFont('helvetica', 'bold');
    doc.text(expense.amount.toFixed(3) + ' DINARS TUNISIENS', 14, finalY + 7);

    // --- SIGNATURES ---
    doc.setFont('helvetica', 'normal');
    doc.text('Cachet et Signature de la Direction', 130, finalY + 30);
    
    // Pied de page
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Document généré via RestoManager - Système de gestion interne', 105, 285, { align: 'center' });

    // Sauvegarde
    doc.save(`Virement_${beneficiaryName.replace(/\s+/g, '_')}_${expense.id}.pdf`);
  }
}
