import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as arabicReshaper from 'arabic-reshaper';
import Bidi from 'bidi-js';
import { AMIRI_FONT_BASE64 } from './amiri-font';

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {
  private bidiEngine = Bidi();

  constructor() {}

  // --- TRAITEMENT ARABE ---
  processArabic(text: string): string {
    if (!text) return '';
    try {
      const lib: any = arabicReshaper;
      const convertFn = lib.convert || (lib.default ? lib.default.convert : null) || lib;
      const reshaped = (typeof convertFn === 'function') ? convertFn(text) : text;
      return this.bidiEngine.getReorderedString(reshaped);
    } catch (e) {
      console.warn('Erreur Arabe:', e);
      return text;
    }
  }

  // --- GÉNÉRATION PRINCIPALE ---
  generateReceipt(data: any) {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Enregistrement police
    if (AMIRI_FONT_BASE64) {
        doc.addFileToVFS('Amiri.ttf', AMIRI_FONT_BASE64);
        doc.addFont('Amiri.ttf', 'Amiri', 'normal');
    }

    // Exemplaire 1
    this.drawReceiptBlock(doc, data, 10);

    // Ligne de découpe
    doc.setLineDashPattern([2, 2], 0);
    doc.setDrawColor(150, 150, 150);
    doc.line(5, 148, 205, 148);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0, 0, 0);

    // Exemplaire 2
    this.drawReceiptBlock(doc, data, 155);

    doc.save(`Recu_${data.contractNum || 'Impression'}.pdf`);
  }

  // --- DESSIN DU BLOC REÇU ---
  private drawReceiptBlock(doc: jsPDF, data: any, startY: number) {
    let y = startY;
    const margin = 15;
    const pageWidth = 210;
    const rightMargin = pageWidth - margin;

    // 1. EN-TÊTE
    // Logo/Titre Arabe (Droite)
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(26);
    doc.text(this.processArabic('الأميرة'), rightMargin, y + 10, { align: 'right' });

    // Infos Société (Gauche)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('princesseofsfax@gmail.com', margin, y + 5);
    doc.text('Avenue Hedi Chaker Sakiet', margin, y + 10);
    doc.text('Ezzit km 8,5 Route de Tunis', margin, y + 15);

    y += 25;

    // 2. INFOS CONTRAT (Cadre Gris optionnel ou texte simple)
    doc.setFontSize(10);
    
    // Contrat
    doc.setFont('helvetica', 'bold');
    doc.text(`Numero de contrat: ${data.contractNum || '................'}`, margin, y);
    
    y += 6;
    // Dates (Alignées)
    doc.setFont('helvetica', 'normal');
    doc.text(`date de reservation: ${data.resDate || '................'}`, margin, y);
    
    const todayStr = new Date().toLocaleDateString('fr-FR');
    doc.text(`Date d'impression: ${data.printDate || todayStr}`, 130, y);

    y += 6;
    // Client
    doc.setFont('helvetica', 'bold');
    const clientTxt = `Client: ${data.clientName || '................'} / GSM: ${data.phone || '................'}`;
    doc.text(clientTxt, margin, y);

    y += 8;

    // 3. TABLEAU 1: Prestations
    autoTable(doc, {
      startY: y,
      head: [['La reservation', 'Prix']],
      body: [
        [
          data.offerDescription || data.reservationDetails || 'Prestation standard',
          (data.totalPrice !== undefined ? data.totalPrice + ' DT' : '0 DT')
        ]
      ],
      theme: 'grid',
      styles: { 
        font: 'helvetica', 
        fontSize: 9, 
        textColor: [0,0,0], 
        lineColor: [0,0,0], 
        lineWidth: 0.1,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [250, 250, 250], 
        textColor: [0,0,0], 
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [0,0,0]
      },
      columnStyles: {
        0: { cellWidth: 145 },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      }
    });

    // Récupération Y sécurisée
    y = (doc as any).lastAutoTable?.finalY || (y + 20);
    y += 8;

    // 4. MENTIONS PAIEMENT
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Accompte non remboursable', margin, y);
    
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Liste des paiements:', margin, y);

    y += 4;

    // 5. TABLEAU 2: Paiements
    const paymentRows: any[] = [];
    if (data.payments && Array.isArray(data.payments)) {
      data.payments.forEach((p: any) => {
        paymentRows.push([
          p.number || '-',
          p.date || '-',
          p.type || '-',
          (p.amount || '0') + ' DT',
          (p.totalSoFar || p.amount || '0') + ' DT'
        ]);
      });
    } else {
        // Ligne vide si pas de paiement pour garder la structure
        paymentRows.push(['-', '-', '-', '0 DT', '0 DT']);
    }

    // Ligne Montant Restant (intégrée au tableau)
    const remainingRow = [
      '', 
      '', 
      '', 
      { content: 'Montant restant', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: (data.remainingAmount || '0') + ' DT', styles: { fontStyle: 'bold', halign: 'center' } }
    ];

    autoTable(doc, {
      startY: y,
      head: [['Numero', 'Date echeance', 'Type', 'Montant du paiement', 'Total paiement']],
      body: [...paymentRows, remainingRow],
      theme: 'grid',
      styles: { 
        font: 'helvetica', 
        fontSize: 8, 
        textColor: [0,0,0], 
        lineColor: [0,0,0], 
        lineWidth: 0.1, 
        halign: 'center',
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [250,250,250], 
        textColor: [0,0,0], 
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [0,0,0]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 45 },
        4: { cellWidth: 45 }
      }
    });

    y = (doc as any).lastAutoTable?.finalY || (y + 30);
    y += 8;

    // 6. ARABE (Dépot non remboursable)
    // IMPORTANT : Placé juste sous le tableau, à droite
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(11);
    doc.text(this.processArabic('إيداع غير قابل للإسترداد'), rightMargin, y, { align: 'right' }); 

    y += 5;

    // 7. PIED DE PAGE
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('NB: Cette quitance annule et remplace la précédente', margin, y);

    y += 8;
    
    // Bloc Direction & Téléphone
    doc.setFont('helvetica', 'bold');
    doc.text('La direction: M. Mohamed Maalej', margin, y);
    
    doc.text('Téléphone :', 140, y);
    doc.setFont('helvetica', 'normal');
    doc.text('+216 22 203 511', 140, y + 5);

    y += 12;

    // Bloc Signature Client
    doc.text('Le client:', margin, y);
    if (data.clientName) {
        doc.setFont('helvetica', 'normal');
        doc.text(`M./Mme ${data.clientName}`, margin + 20, y);
        if (data.phone) {
            doc.text(`GSM: ${data.phone}`, margin + 20, y + 5);
        }
    }
  }
}
