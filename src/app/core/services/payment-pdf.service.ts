import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class PaymentPdfService {
  private datePipe = new DatePipe('en-US');

  generateReceipt(reservation: any, client: any, payments: any[]) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- EN-TÊTE ---
    doc.setFontSize(22);
    doc.setTextColor(50, 50, 50);
    doc.text('RELEVÉ DE PAIEMENTS', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Émis le : ${this.formatDate(new Date())}`, pageWidth / 2, 28, { align: 'center' });

    // --- INFOS CLIENT & RÉSERVATION ---
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    const startY = 40;
    
    // Cadre Client
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, startY, 85, 40, 3, 3, 'F');
    doc.setFontSize(12);
    doc.text('CLIENT', 18, startY + 8);
    doc.setFontSize(10);
    doc.text((client?.nom || 'Client') + ' ' + (client?.prenom || ''), 18, startY + 16);
    doc.text('Tél : ' + (client?.telephone || '-'), 18, startY + 22);
    if (client?.adresse) {
        doc.setFontSize(9);
        doc.text(client.adresse, 18, startY + 28, { maxWidth: 75 });
    }

    // Cadre Réservation
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(110, startY, 85, 40, 3, 3, 'F');
    doc.setFontSize(12);
    doc.text('RÉSERVATION', 114, startY + 8);
    doc.setFontSize(10);
    doc.text(`Réf : ${reservation.id || '-'}`, 114, startY + 16);
    doc.text(`Date : ${this.formatDate(reservation.date)}`, 114, startY + 22);
    doc.text(`Créneau : ${reservation.slotId || '-'}`, 114, startY + 28);
    
    // --- TABLEAU DES PAIEMENTS (3 COLONNES) ---
    const tableBody = payments.map(p => [
      this.formatDate(p.date),
      (p.type || 'AUTRE').toUpperCase(),
      this.formatMoney(p.amount) + ' DT'
    ]);

    autoTable(doc, {
      startY: startY + 50,
      head: [['Date', 'Mode', 'Montant']], // Colonne Détails supprimée
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 50 }, // Date plus large
        1: { cellWidth: 60 }, // Mode plus large
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } // Montant (Index 2 maintenant)
      }
    });

    // --- TOTAUX ---
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalPaye = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalPrix = Number(reservation.totalPrice) || 0;
    const reste = totalPrix - totalPaye;

    doc.setFontSize(10);
    doc.text(`Prix Total : ${this.formatMoney(totalPrix)} DT`, 140, finalY);
    doc.text(`Déjà Réglé : ${this.formatMoney(totalPaye)} DT`, 140, finalY + 6);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    if (reste > 0.1) {
      doc.setTextColor(200, 50, 50);
      doc.text(`Reste à Payer : ${this.formatMoney(reste)} DT`, 140, finalY + 14);
    } else {
      doc.setTextColor(50, 150, 50);
      doc.text(`Solde : RÉGLÉ`, 140, finalY + 14);
    }

    doc.save(`Releve_Paiements_${client?.nom || 'Client'}.pdf`);
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    try {
        const d = (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
        return this.datePipe.transform(d, 'dd/MM/yyyy') || '-';
    } catch (e) {
        return '-';
    }
  }

  private formatMoney(val: number): string {
    return (Number(val) || 0).toFixed(2);
  }
}
