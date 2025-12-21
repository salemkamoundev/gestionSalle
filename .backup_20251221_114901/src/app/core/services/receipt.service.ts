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

  /**
   * Traitement pour l'Arabe : Ligatures + Inversion de sens
   */
  processArabic(text: string): string {
    if (!text) return '';
    try {
      const lib: any = arabicReshaper;
      const convertFn = lib.convert || (lib.default ? lib.default.convert : null) || lib;
      const reshaped = (typeof convertFn === 'function') ? convertFn(text) : text;
      return this.bidiEngine.getReorderedString(reshaped);
    } catch (e) {
      return text;
    }
  }

  generateReceipt(data: any) {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // --- ENREGISTREMENT DE LA POLICE UNICODE ---
    doc.addFileToVFS('Amiri.ttf', AMIRI_FONT_BASE64);
    doc.addFont('Amiri.ttf', 'Amiri', 'normal');

    // Exemplaire 1 et 2 sur la même page
    this.drawReceiptBlock(doc, data, 10);
    
    doc.setLineDashPattern([2, 2], 0);
    doc.line(0, 148, 210, 148); // Ligne de découpe
    doc.setLineDashPattern([], 0);

    this.drawReceiptBlock(doc, data, 155);

    doc.save(`Recu_Princesse_${data.contractNum || '000'}.pdf`);
  }

  private drawReceiptBlock(doc: jsPDF, data: any, startY: number) {
    const margin = 15;
    let y = startY;

    // --- TITRE ARABE (On change la police pour Amiri ici) ---
    doc.setFont('Amiri', 'normal'); 
    doc.setFontSize(22);
    doc.text(this.processArabic('الأميرة'), 195, y + 5, { align: 'right' });

    // --- INFOS GAUCHE (Retour en Helvetica pour le français) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('princesseofsfax@gmail.com', margin, y);
    doc.text('Avenue Hedi Chaker Sakit', margin, y + 5);
    doc.text('Ezzit km 8,5 Route de Tunis', margin, y + 9);

    // --- INFOS CONTRAT ---
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Numero de contrat : ${data.contractNum || '2500072'}`, margin, y);
    doc.text(`Client : ${data.clientName || 'ABOUB SKANDER'} / GSM: ${data.phone || '28550055'}`, 100, y);
    
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`date de reservation : ${data.resDate || '27/12/2025-SOIR'}`, margin, y);
    doc.text(`Date d'impression: ${data.printDate || '17/12/2025'}`, 150, y);

    // --- TABLEAU PRESTATION ---
    autoTable(doc, {
      startY: y + 5,
      head: [['La reservation', 'Prix']],
      body: [[data.reservationDetails || 'Prestation Standard Princesse...', (data.totalPrice || '5000') + 'DT']],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      styles: { fontSize: 8, font: 'helvetica' }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // --- MENTIONS LÉGALES (Mélange Arabe / Français) ---
    doc.setFont('helvetica', 'bold');
    doc.text('Accompte non remboursable', margin, y);
    
    // Switch vers Amiri pour le texte Arabe
    doc.setFont('Amiri', 'normal');
    doc.text(this.processArabic('إيداع غير قابل للإسترداد'), 195, y, { align: 'right' });

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('NB : Cette quitance annule et remplace la précédente', margin, y);
    
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('La direction : M. Mohamed Maalej', margin, y);
    doc.text('Téléphone : +216 22 203 511', 195, y, { align: 'right' });

    y += 10;
    doc.text('Le client :', margin, y);
  }
}
