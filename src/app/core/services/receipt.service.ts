import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {

  constructor() {}

  generateReceipt(data: any) {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 15;
    let currentY = 15;

    // --- EN-TÊTE GAUCHE (Email & Adresse) ---
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('princesseofsfax@gmail.com', margin, currentY);
    currentY += 5;
    doc.text('Avenue Hedi Chaker Sakit', margin, currentY);
    currentY += 4;
    doc.text('Ezzit km 8,5 Route de Tunis', margin, currentY);

    // --- EN-TÊTE DROIT (Nom Salle) ---
    doc.setFontSize(22);
    // Note: Pour l'affichage arabe parfait, chargez votre police Amiri-Regular.ttf
    doc.text('الأميرة', 195, 20, { align: 'right' });

    // --- BLOC INFOS CONTRAT / CLIENT ---
    currentY = 40;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Numero de contrat: ' + (data.contractNum || '2500072'), margin, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('date de reservation: ' + (data.resDate || '27/12/2025-SOIR / 20:12-01:12'), margin, currentY);
    
    currentY += 6;
    doc.text('Address:', margin, currentY);
    
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Client: ' + (data.clientName || 'ABOUB SKANDER') + ' / GSM: ' + (data.phone || '28550055'), margin, currentY);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text("Date d'impression: " + (data.printDate || '17/12/2025'), 195, currentY, { align: 'right' });

    // --- TABLEAU 1 : LA RESERVATION ---
    autoTable(doc, {
      startY: currentY + 5,
      head: [['La reservation', 'Prix']],
      body: [[
        data.reservationDetails || 'Offre de type normal TROUPE ARABESQUE HORS SAISON 6 INSTRIMENT ET 2 CHANTEURS | DECORATION BOULBEBA STUDIO MAYA 1CAMERA + PHOTOBOOK | GROUPE SERVEURS ICHBILIA NIZAR MTIBAA |',
        (data.totalPrice || '5000') + 'DT'
      ]],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1 },
      styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: { 1: { halign: 'center', fontStyle: 'bold', cellWidth: 35 } }
    });

    // CORRECTION ICI : Utilisation de finalY pour éviter l'erreur undefined
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- MENTIONS CENTRALES ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Accompte non remboursable', margin, currentY);
    doc.text('إيداع غير قابل للإسترداد', 195, currentY, { align: 'right' });
    
    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('NB : Cette quitance annule et remplace la précédente', margin, currentY);
    
    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('La direction : M. Mohamed Maalej', margin, currentY);
    doc.text('Téléphone : +216 22 203 511', 195, currentY, { align: 'right' });

    // --- TABLEAU 2 : LISTE DES PAIEMENTS ---
    currentY += 12;
    doc.setFont('helvetica', 'normal');
    doc.text('Liste des paiements:', margin, currentY);

    autoTable(doc, {
      startY: currentY + 2,
      head: [['Numero', 'Date echeance', 'Type', 'Montant du paiement', 'Total paiement']],
      body: [
        ...(data.payments || [['N°3417', '17/08/2024', 'espece', '1 DT', '1 DT']]),
        [{ 
          content: 'Montant restant', 
          colSpan: 3, 
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [245, 245, 245] } 
        }, 
        { 
          content: (data.remainingAmount || '4999') + ' DT', 
          colSpan: 2, 
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [245, 245, 245] } 
        }]
      ],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 }
    });

    // --- SIGNATURE CLIENT ---
    currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Le client :', margin, currentY);
    
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('M./Mme ' + (data.clientName || 'ABOUBSKANDER') + ' / GSM: ' + (data.phone || '28550055'), margin, currentY);

    doc.save('Recu_Princesse_' + (data.contractNum || '000') + '.pdf');
  }
}
