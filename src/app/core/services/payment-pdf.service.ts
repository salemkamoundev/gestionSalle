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
    doc.roundedRect(14, startY, 85, 35, 3, 3, 'F');
    doc.setFontSize(12);
    doc.text('CLIENT', 18, startY + 8);
    doc.setFontSize(10);
    doc.text((client?.nom || 'Client') + ' ' + (client?.prenom || ''), 18, startY + 16);
    doc.text('Tél : ' + (client?.telephone || '-'), 18, startY + 22);
    if (client?.adresse) doc.text(client.adresse, 18, startY + 28);

    // Cadre Réservation
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(110, startY, 85, 35, 3, 3, 'F');
    doc.setFontSize(12);
    doc.text('RÉSERVATION', 114, startY + 8);
    doc.setFontSize(10);
    doc.text(`Date : ${this.formatDate(reservation.date)}`, 114, startY + 16);
    doc.text(`Créneau : ${reservation.slotId || '-'}`, 114, startY + 22);
    
    // --- TABLEAU DES PAIEMENTS ---
    const tableBody = payments.map(p => [
      this.formatDate(p.date),
      p.type,
      this.getDetails(p),
      this.formatMoney(p.amount) + ' DT'
    ]);

    autoTable(doc, {
      startY: startY + 45,
      head: [['Date', 'Mode', 'Détails / Réf', 'Montant']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 }, // Date
        1: { cellWidth: 30 }, // Mode
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } // Montant
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
    if (reste > 0) {
      doc.setTextColor(200, 50, 50); // Rouge si reste
      doc.text(`Reste à Payer : ${this.formatMoney(reste)} DT`, 140, finalY + 14);
    } else {
      doc.setTextColor(50, 150, 50); // Vert si payé
      doc.text(`Solde : RÉGLÉ`, 140, finalY + 14);
    }

    doc.save(`Releve_Paiements_${client?.nom || 'Client'}.pdf`);
  }

  private getDetails(p: any): string {
    if (p.type === 'CHEQUE') return `N° ${p.checkNumber || '-'} (Ech: ${this.formatDate(p.checkDate)})`;
    if (p.type === 'VIREMENT') return p.reference || '-';
    if (p.type === 'BON') return 'Utilisation Avoir';
    return '-';
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    // Gestion date firestore ou string
    const d = (date.toDate) ? date.toDate() : new Date(date);
    return this.datePipe.transform(d, 'dd/MM/yyyy') || '-';
  }

  private formatMoney(val: number): string {
    return val.toFixed(2); // Pas de format complexe pour éviter erreurs
  }
}
