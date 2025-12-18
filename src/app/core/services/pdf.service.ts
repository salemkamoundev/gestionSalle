import { Injectable, Inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';
import { jsPDF } from 'jspdf';
import { AMIRI_FONT_B64 } from './amiri-font';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor(@Inject(LOCALE_ID) private locale: string) {}

  private initDoc(): jsPDF {
    const doc = new jsPDF();
    const fontFileName = 'Amiri-Regular.ttf';
    doc.addFileToVFS(fontFileName, AMIRI_FONT_B64);
    doc.addFont(fontFileName, 'Amiri', 'normal');
    doc.setFont('Amiri');
    return doc;
  }

  generateContract(reservation: any) {
    try {
      const doc = this.initDoc();
      this.drawExactContract(doc, reservation);
      const clientName = reservation.clientName || 'Client';
      doc.save(`Contrat_${clientName.replace(/ /g, '_')}.pdf`);
    } catch (e) {
      console.error('Erreur Contrat:', e);
    }
  }

  private drawExactContract(doc: jsPDF, r: any) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const rightX = pageWidth - 15;
    let y = 20;

    doc.setFontSize(9); doc.setTextColor(50);
    doc.text('princesseofsfax@gmail.com', margin, y);
    doc.text('Avenue Hedi Chaker Sakit', margin, y + 5);
    doc.text('Ezzit km 8,5 Route de Tunis', margin, y + 10);

    doc.setTextColor(0); doc.setFontSize(24);
    doc.text('الأميرة', pageWidth / 2, y + 10, { align: 'center' });
    
    y += 25; doc.setFontSize(16);
    const contractNum = r.id ? r.id.substring(0, 7).toUpperCase() : '2500072';
    doc.text(`عقد كراء قاعة أفراح عدد ${contractNum}`, pageWidth / 2, y, { align: 'center' });

    y += 15; doc.setFontSize(13);
    doc.text(': بين الممضيين أسفله', rightX, y, { align: 'right' });
    
    y += 10; doc.setFontSize(12);
    doc.text(': الطرف الأول', rightX, y, { align: 'right' });
    y += 6; doc.setFontSize(10);
    doc.text("شركة الأميرة في شخص ممثلها القانوني طريق تونس، صفاقس.", rightX, y, { align: 'right' });

    y += 15; doc.text(': الطرف الثاني', rightX, y, { align: 'right' });
    y += 6;
    const clientInfo = `الهاتف : ${r.telephone || '...'}  الإسم واللقب : ${(r.clientName || '...').toUpperCase()}  ب.ت.و : ${r.cin || '...'}`;
    doc.text(clientInfo, rightX, y, { align: 'right' });

    y += 20;
    doc.setFontSize(11);
    const dateStr = r.date ? formatDate(r.date, 'dd/MM/yyyy', this.locale) : '...';
    doc.text(`تاريخ إقامة الحفل : ${dateStr} من الساعة ${r.startTime || '20:00'} إلى ${r.endTime || '01:00'}`, rightX, y, { align: 'right' });
    
    y += 60;
    doc.setFontSize(12);
    doc.text('المتسوغ (Client)', margin + 30, y, { align: 'center' });
    doc.text('الإدارة (Gérant)', rightX - 30, y, { align: 'center' });
  }

  generateReceipt(payment: any, reservation: any) {
    try {
      const doc = this.initDoc();
      this.drawExactReceipt(doc, payment, reservation);
      doc.save(`Recu_${payment.receiptNumber || 'Pay'}.pdf`);
    } catch (e) {
      console.error('Erreur Reçu:', e);
    }
  }

  private drawExactReceipt(doc: jsPDF, pay: any, res: any) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const rightX = pageWidth - 15;
    const leftX = 15;
    let y = 15;

    doc.setFontSize(18); doc.setTextColor(0);
    doc.text('الأميرة', rightX, y + 5, { align: 'right' });

    doc.setFontSize(9); doc.setTextColor(50);
    doc.text('princesseofsfax@gmail.com', leftX, y);
    doc.text('Avenue Hedi Chaker Sakit', leftX, y + 5);
    doc.text('Ezzit km 8,5 Route de Tunis', leftX, y + 10);

    y += 25;

    const contractNum = res.id ? res.id.substring(0, 7).toUpperCase() : '2500072';
    const dateEvent = res.date ? formatDate(res.date, 'dd/MM/yyyy', this.locale) : '...';
    const clientName = (res.clientName || '...').toUpperCase();
    const printDate = formatDate(new Date(), 'dd/MM/yyyy', this.locale);

    doc.setFontSize(10); doc.setTextColor(0);
    doc.text(`Numero de contrat: ${contractNum}`, leftX, y);
    y += 6;
    doc.text(`Date de reservation: ${dateEvent}-SOIR`, leftX, y);
    y += 6;
    doc.text(`Client: ${clientName} / GSM: ${res.telephone || '...'}`, leftX, y);
    y += 6;
    doc.text(`Date d'impression: ${printDate}`, leftX, y);

    y += 12;

    doc.setLineWidth(0.1); doc.line(leftX, y, rightX, y);
    doc.setFont('helvetica', 'bold');
    doc.text('La reservation', leftX + 2, y + 5);
    doc.text('Prix', rightX - 20, y + 5);
    y += 7; doc.line(leftX, y, rightX, y);
    
    y += 6; doc.setFont('Amiri', 'normal'); doc.setFontSize(9);
    const desc = "Offre de location Salle La Princesse avec services inclus.";
    doc.text(desc, leftX + 2, y);
    doc.text(`${res.totalPrice || 0} DT`, rightX - 20, y);
    
    y += 8; doc.line(leftX, y, rightX, y);

    y += 10; doc.setFont('helvetica', 'bold');
    doc.text('Accompte non remboursable', leftX, y);
    y += 6; doc.text('Liste des paiements:', leftX, y);

    y += 5;

    doc.line(leftX, y, rightX, y);
    y += 5; doc.setFontSize(8);
    doc.text('Numero', leftX + 2, y);
    doc.text('Date', leftX + 35, y);
    doc.text('Type', leftX + 75, y);
    doc.text('Montant', leftX + 115, y);
    doc.text('Total', rightX - 25, y);
    y += 3; doc.line(leftX, y, rightX, y);

    y += 7; doc.setFont('helvetica', 'normal');
    doc.text(pay.receiptNumber || 'N/A', leftX + 2, y);
    doc.text(formatDate(pay.date, 'dd/MM/yyyy', this.locale), leftX + 35, y);
    doc.text((pay.type || 'ESPECES').toLowerCase(), leftX + 75, y);
    doc.text(`${pay.amount || 0} DT`, leftX + 115, y);
    doc.text(`${pay.amount || 0} DT`, rightX - 25, y);

    y += 5; doc.line(leftX, y, rightX, y);
    
    y += 8; doc.setFont('helvetica', 'bold');
    const reste = (Number(res.totalPrice || 0) - Number(res.advance || 0));
    doc.text('Montant restant', leftX + 115, y);
    doc.text(`${reste} DT`, rightX - 25, y);

    y += 20;
    doc.setFont('Amiri', 'normal'); doc.setFontSize(14);
    doc.text('إيداع غير قابل للإسترداد', leftX, y);
    
    y += 8; doc.setFontSize(9); doc.setFont('helvetica', 'italic');
    doc.text('NB: Cette quitance annule et remplace la précédente', leftX, y);

    y += 10; doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('La direction: M. Mohamed Maalej', leftX, y);

    doc.rect(rightX - 80, y - 5, 80, 25);
    doc.text('Le client:', rightX - 75, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`M./Mme ${clientName}`, rightX - 75, y + 8);

    y += 35; doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Téléphone : +216 22 203 511', leftX, y);
  }
}
