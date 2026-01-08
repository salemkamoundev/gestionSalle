#!/bin/bash
set -e

echo "🎨 Amélioration du style PDF (Tableau Services + Suppression texte inutile)..."

SERVICE_FILE="src/app/core/services/contract-pdf.service.ts"

cat <<EOF > "$SERVICE_FILE"
import { Injectable, Inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { amiriFont } from './amiri-font'; 

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {

  constructor(@Inject(LOCALE_ID) private locale: string) {}

  private initDoc(): { doc: jsPDF, fontName: string } {
    const doc = new jsPDF();
    let fontName = 'helvetica';
    if (amiriFont && amiriFont.length > 1000) {
        try {
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFont);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            fontName = 'Amiri';
        } catch (e) { console.error(e); }
    }
    return { doc, fontName };
  }

  // --- 1. CONTRAT (Code Unicode Inchangé - Modèle Princesse) ---
  generateContract(reservation: any, client: any) {
    try {
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        
        const rightAlign = (t: string, y: number, s: number = 10, isBold: boolean = false) => { 
            doc.setFontSize(s); doc.setFont(fontName, 'normal'); 
            doc.text(t, pageWidth - margin, y, { align: 'right' }); 
        };
        const centerAlign = (t: string, y: number, s: number = 12) => { 
            doc.setFontSize(s); doc.setFont(fontName, 'normal'); 
            doc.text(t, pageWidth / 2, y, { align: 'center' }); 
        };

        let y = 20;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text('princesseofsfax@gmail.com', margin, y);
        doc.text('Avenue Hedi Chaker Sakiet', margin, y + 5);
        doc.text('Ezzit km 8.5 Route de Tunis', margin, y + 10);

        doc.setFont(fontName, 'normal'); doc.setFontSize(18);
        doc.text('\u0627\u0644\u0623\u0645\u064a\u0631\u0629', pageWidth - margin, y, { align: 'right' });
        
        y += 15;
        doc.setFontSize(14);
        const ref = reservation.id ? reservation.id.slice(0, 8) : '---';
        doc.text(\`\u0639\u0642\u062f \u0643\u0631\u0627\u0621 \u0642\u0627\u0639\u0629 \u0623\u0641\u0631\u0627\u062d \u0639\u062f\u062f \${ref}\`, pageWidth - margin, y, { align: 'right' });

        y += 10;
        centerAlign('\u0628\u064a\u0646 \u0627\u0644\u0645\u0645\u0636\u064a\u064a\u0646 \u0623\u0633\u0641\u0644\u0647 :', y, 12);

        y += 10;
        rightAlign(': \u0627\u0644\u0637\u0631\u0641 \u0627\u0644\u0623\u0648\u0644', y, 12, true);
        y += 7;
        const textParty1 = '\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0645\u064a\u0631\u0629 \u0641\u064a \u0634\u062e\u0635 \u0645\u0645\u062b\u0644\u0647\u0627 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a \u0634\u0631\u0643\u0629 \u0630\u0627\u062a \u0645\u0633\u0624\u0648\u0644\u064a\u0629\u060c \u0633\u062c\u0644\u0647\u0627 \u0627\u0644\u062a\u062c\u0627\u0631\u064a \u060c \u0641\u064a \u0645\u0642\u0631\u0647\u0627 \u0627\u0644\u0625\u062c\u062a\u0645\u0627\u0639\u064a \u0628\u0637\u0631\u064a\u0642 \u062a\u0648\u0646\u0633 249 \u0634\u0627\u0631\u0639 \u0627\u0644\u0647\u0627\u062f\u064a \u0634\u0627\u0643\u0631 \u0633\u0627\u0642\u064a\u0629 \u0627\u0644\u0632\u064a\u062a \u0635\u0641\u0627\u0642\u0633.';
        doc.text(doc.splitTextToSize(textParty1, pageWidth - (margin * 2)), pageWidth - margin, y, { align: 'right' });
        
        y += 15;
        rightAlign(': \u0627\u0644\u0637\u0631\u0641 \u0627\u0644\u062b\u0627\u0646\u064a', y, 12, true);
        y += 7;
        const cName = client ? (client.nom + ' ' + (client.prenom || '')) : '..................';
        const cPhone = client?.telephone || '..................';
        const cCin = client?.cin || '..................';
        const textParty2 = \`\u0627\u0644\u0647\u0627\u062a\u0641 : \${cPhone} \u0627\u0644\u0625\u0633\u0645 \u0648\u0627\u0644\u0644\u0642\u0628 : \${cName} \u0635\u0627\u062d\u0628 \u0628\u0637\u0627\u0642\u0629 \u062a\u0639\u0631\u064a\u0641 \u0639\u062f\u062f : \${cCin}\`;
        doc.text(textParty2, pageWidth - margin, y, { align: 'right' });
        y += 7;
        doc.text('\u0627\u0644\u0635\u0627\u062f\u0631\u0629 \u0628\u062a\u0648\u0646\u0633 \u0641\u064a : ........................', pageWidth - margin, y, { align: 'right' });

        y += 12;
        let dateStr = '.../.../....';
        if (reservation.date) {
             const d = reservation.date.toDate ? reservation.date.toDate() : new Date(reservation.date);
             dateStr = formatDate(d, 'dd/MM/yyyy', this.locale);
        }
        const startT = reservation.startTime || '20:00';
        const endT = reservation.endTime || '01:00';
        const lineDate = \`\u062a\u0627\u0631\u064a\u062e \u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u062d\u0641\u0644 : \${dateStr} \u0645\u0646 \u0627\u0644\u0633\u0627\u0639\u0629 \${startT} \u0625\u0644\u0649 \${endT} \u0648 \u062a\u0643\u0648\u0646 \u0642\u0627\u0639\u0629 \u0627\u0644\u0623\u0641\u0631\u0627\u062d \u062a\u062d\u062a \u062a\u0635\u0631\u0641 \u0644\u0645\u062f\u0629 05 \u0633\u0627\u0639\u0629\`;
        doc.text(lineDate, pageWidth - margin, y, { align: 'right' });
        y += 6;
        doc.text('\u0648 \u0628\u0627\u0646\u0642\u0636\u0627\u0626\u0647\u0627 \u064a\u0642\u0639 \u0642\u0637\u0639 \u0627\u0644\u062a\u064a\u0627\u0631 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064a \u0639\u0646 \u0631\u0643\u062d \u0627\u0644\u0641\u0631\u0642\u0629 \u0622\u0644\u064a\u0627.', pageWidth - margin, y, { align: 'right' });

        y += 12;
        const total = reservation.totalPrice || 0;
        const art1 = \`\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u0623\u0648\u0644 : \u0648\u0642\u0639 \u0627\u0644\u0627\u062a\u0641\u0627\u0642 \u0639\u0644\u0649 \u0645\u0639\u0644\u0648\u0645 \u0643\u0631\u0627\u0621 (\${total}) \u064a\u062f\u0641\u0639 50% \u0645\u0646\u0647 \u0639\u0646\u062f \u0627\u0644\u062d\u062c\u0632 "la reservation" \u0645\u0642\u0627\u0628\u0644 \u0648\u0635\u0644 \u0641\u064a \u0627\u0644\u063a\u0631\u0636 \u0623\u0645\u0627 \u0627\u0644\u0628\u0627\u0642\u064a \u064a\u062f\u0641\u0639 \u0639\u0644\u0649 \u0623\u0642\u0635\u0649 \u062a\u0642\u062f\u064a\u0631 \u0642\u0628\u0644 \u0623\u0633\u0628\u0648\u0639 \u0645\u0646 \u0645\u0648\u0639\u062f \u0627\u0644\u062d\u0641\u0644 \u0648 \u064a\u062b\u0628\u062a \u0627\u0644\u062f\u0641\u0639 \u0628\u0645\u0648\u062c\u0628 \u0648\u0635\u0644 \u062e\u0644\u0627\u0635.\`;
        let s = doc.splitTextToSize(art1, pageWidth - 40); doc.text(s, pageWidth - margin, y, { align: 'right' }); y += (s.length * 5) + 3;

        const art2 = '\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062b\u0627\u0646\u064a : \u064a\u0644\u062a\u0632\u0645 \u0627\u0644\u0637\u0631\u0641 \u0627\u0644\u062b\u0627\u0646\u064a \u0648\u062d\u062f\u0647 (\u0627\u0644\u0645\u062a\u0633\u0648\u063a) \u0628\u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0631\u062e\u0635\u0629 \u0644\u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u062d\u0641\u0644 \u0645\u0646 \u0627\u0644\u0633\u0644\u0637 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629 \u0627\u0644\u0645\u0639\u0646\u064a\u0629.';
        doc.text(doc.splitTextToSize(art2, pageWidth - 40), pageWidth - margin, y, { align: 'right' }); y += 8;

        const art3 = '\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062b\u0627\u0644\u062b : \u064a\u0644\u062a\u0632\u0645 \u0635\u0627\u062d\u0628 \u0627\u0644\u062d\u0641\u0644 \u0628\u0639\u062f\u0645 \u0625\u062f\u062e\u0627\u0644 \u0623\u0648 \u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0627\u0644\u0643\u062d\u0648\u0644\u064a\u0629.';
        doc.text(doc.splitTextToSize(art3, pageWidth - 40), pageWidth - margin, y, { align: 'right' }); y += 8;

        const art4 = '\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u0631\u0627\u0628\u0639 : \u064a\u0644\u062a\u0632\u0645 \u0635\u0627\u062d\u0628 \u0627\u0644\u0642\u0627\u0639\u0629 \u0628\u062a\u0648\u0641\u064a\u0631 600 \u0645\u0642\u0639\u062f \u0648 \u0627\u0644\u0637\u0627\u0648\u0644\u0627\u062a \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0647\u0627 \u0648 \u0631\u0643\u062d \u0648\u0627\u062d\u062f \u0644\u0644\u0639\u0631\u0648\u0633 \u0648 \u0631\u0643\u062d \u0644\u0644\u0641\u0631\u0642\u0629 \u0645\u0639 \u0627\u0644\u062d\u0631\u0627\u0633\u0629 \u0644\u0644\u0645\u0623\u0648\u0649.';
        s = doc.splitTextToSize(art4, pageWidth - 40); doc.text(s, pageWidth - margin, y, { align: 'right' }); y += (s.length * 5) + 3;

        const art5 = '\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062e\u0627\u0645\u0633 : \u0645\u0646 \u062d\u0642 \u0627\u0644\u062d\u0631\u064a\u0641 \u0627\u0644\u0625\u0633\u062a\u0645\u062a\u0627\u0639 \u0628\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u062e\u0635\u0635 \u0644\u0644\u062d\u0641\u0644.';
        doc.text(art5, pageWidth - margin, y, { align: 'right' }); y += 8;

        y += 10;
        if (y > pageHeight - 30) { doc.addPage(); y = 30; }

        doc.setFontSize(12);
        doc.text('\u0627\u0644\u0625\u062f\u0627\u0631\u0629', 40, y, { align: 'center' });
        doc.text('Gérant', 40, y + 5, { align: 'center' });
        doc.text('Mohamed Maalej', 40, y + 12, { align: 'center' });
        doc.text('\u0627\u0644\u0645\u062a\u0633\u0648\u063a', pageWidth - 40, y, { align: 'center' });

        doc.save(\`Contrat_\${reservation.id}.pdf\`);
    } catch (e) { alert('Erreur PDF'); }
  }

  // --- 2. GENERATEUR UNIFIÉ DE BILAN ---
  private _generatePartnerReport(filename: string, resData: any, partners: any[], singleMode: boolean = false) {
    try {
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        doc.setFont(fontName);
        doc.setFontSize(22);
        doc.setTextColor(80, 0, 150);
        
        const titleFr = singleMode ? 'Bilan Partenaire' : 'Bilan Global Partenaires';
        const titleAr = singleMode ? '\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0634\u0631\u064a\u0643' : '\u062a\u0642\u0631\u064a\u0631 \u0634\u0627\u0645\u0644 \u0644\u0644\u0634\u0631\u0643\u0627\u0621';

        doc.text(titleFr, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(16);
        doc.text(titleAr, pageWidth / 2, 28, { align: 'center' });
        doc.setTextColor(0);

        doc.setFontSize(11);
        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 255);
        doc.roundedRect(margin, 35, pageWidth - (margin*2), 30, 3, 3, 'FD');

        let eventDate = resData.date;
        if (eventDate && eventDate.toDate) eventDate = formatDate(eventDate.toDate(), 'dd/MM/yyyy', this.locale);
        
        doc.text(\`Client: \${resData.clientName || 'N/A'}\`, margin + 10, 45);
        doc.text(\`Date Evt: \${eventDate || 'N/A'}\`, margin + 10, 52);
        doc.text(\`Heure: \${resData.startTime || '--:--'} - \${resData.endTime || '--:--'}\`, margin + 10, 59);
        
        const now = formatDate(new Date(), 'dd/MM/yyyy HH:mm', this.locale);
        doc.text(\`Genere le: \${now}\`, pageWidth - margin - 10, 45, { align: 'right' });

        let currentY = 75;

        partners.forEach((p) => {
            if (currentY > doc.internal.pageSize.height - 60) { doc.addPage(); currentY = 20; }

            doc.setFillColor(230, 230, 230);
            doc.rect(margin, currentY, pageWidth - (margin*2), 10, 'F');
            doc.setFontSize(12);
            doc.setFont(fontName, 'normal');
            
            // "Partenaire: Nom"
            doc.text(\`\u0627\u0644\u0634\u0631\u064a\u0643: \${p.partnerName}\`, pageWidth - margin - 5, currentY + 7, { align: 'right' });
            
            doc.setFontSize(10);
            doc.text(\`Total: \${p.totalCost.toFixed(3)} | Payé: \${p.totalPaid.toFixed(3)} | Reste: \${p.remaining.toFixed(3)}\`, margin + 5, currentY + 7);

            currentY += 15;

            // --- SERVICES (EN TABLEAU) ---
            if (p.services && p.services.length > 0) {
                const servicesBody = p.services.map((s: string) => [s]);
                
                autoTable(doc, {
                    startY: currentY,
                    head: [['Services / \u0627\u0644\u062e\u062f\u0645\u0627\u062a']], 
                    body: servicesBody,
                    theme: 'grid',
                    styles: { fontSize: 10, font: fontName, halign: 'left' },
                    headStyles: { fillColor: [240, 240, 240], textColor: 50, font: fontName, fontStyle: 'bold' },
                    margin: { left: margin + 5, right: margin + 5 }
                });
                
                currentY = (doc as any).lastAutoTable.finalY + 10;
            }

            // --- PAIEMENTS ---
            if (p.payments && p.payments.length > 0) {
                const payBody = p.payments.map((pay: any) => [
                    formatDate(new Date(pay.date.toDate ? pay.date.toDate() : pay.date), 'dd/MM/yyyy HH:mm', this.locale),
                    pay.method,
                    pay.reference || '-',
                    Number(pay.amount).toFixed(3) + ' DT'
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Date', 'Mode', 'Ref', 'Montant']],
                    body: payBody,
                    theme: 'grid',
                    styles: { fontSize: 9, halign: 'center', font: fontName },
                    headStyles: { fillColor: [100, 100, 100], font: fontName },
                    margin: { left: margin + 5, right: margin + 5 }
                });
                
                currentY = (doc as any).lastAutoTable.finalY + 10;
            } 
            
            // Note: Le texte "Aucun règlement" a été supprimé ici
            
            currentY += 5;
        });

        // Totaux finaux
        if (currentY > doc.internal.pageSize.height - 40) { doc.addPage(); currentY = 20; }
        
        const totalCostAll = partners.reduce((acc, p) => acc + (p.totalCost || 0), 0);
        const totalPaidAll = partners.reduce((acc, p) => acc + (p.totalPaid || 0), 0);
        const totalRestAll = totalCostAll - totalPaidAll;

        doc.setDrawColor(0);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;

        doc.setFontSize(14);
        doc.text(singleMode ? 'TOTAL PARTENAIRE' : 'TOTAL GLOBAL', pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        doc.setFontSize(12);
        doc.text(\`Coût: \${totalCostAll.toFixed(3)} DT\`, margin, currentY);
        currentY += 7;
        doc.setTextColor(0, 128, 0);
        doc.text(\`Payé: \${totalPaidAll.toFixed(3)} DT\`, margin, currentY);
        currentY += 7;
        doc.setTextColor(255, 0, 0);
        doc.text(\`Reste: \${totalRestAll.toFixed(3)} DT\`, margin, currentY);

        doc.save(\`\${filename}_\${resData.id}.pdf\`);
    } catch (e) { console.error(e); alert('Erreur PDF Bilan'); }
  }

  generatePartnersSummary(resData: any, partners: any[]) {
    this._generatePartnerReport('Bilan_Complet', resData, partners);
  }

  generateSinglePartnerReport(resData: any, partner: any) {
    this._generatePartnerReport(\`Bilan_\${partner.partnerName}\`, resData, [partner], true);
  }

  generatePartnerReceipt(resData: any, payment: any) {
    try {
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        const centerX = pageWidth / 2;

        doc.setDrawColor(100);
        doc.rect(10, 10, pageWidth - 20, 130);

        doc.setFontSize(22);
        doc.text('REÇU DE PAIEMENT / \u0648\u0635\u0644 \u062e\u0644\u0627\u0635', centerX, 25, { align: 'center' });

        doc.setFontSize(10);
        const today = formatDate(new Date(), 'dd/MM/yyyy HH:mm', this.locale);
        doc.text(\`Date: \${today}\`, 20, 45);
        doc.text(\`Réf: \${payment.reference || '---'}\`, pageWidth - 80, 45);

        let y = 60;
        const leftX = 30;
        doc.setFontSize(14);
        
        doc.text(\`Bénéficiaire / \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f : \${payment.partnerName}\`, leftX, y);
        y += 15;
        doc.setTextColor(220, 38, 38);
        doc.text(\`Montant / \u0627\u0644\u0645\u0628\u0644\u063a : \${Number(payment.amount).toFixed(3)} DT\`, leftX, y);
        doc.setTextColor(0);
        y += 15;
        doc.text(\`Mode / \u0627\u0644\u0637\u0631\u064a\u0642\u0629 : \${payment.method || 'ESPECES'}\`, leftX, y);
        y += 15;
        doc.text(\`Client / \u0627\u0644\u062d\u0631\u064a\u0641 : \${resData.clientName}\`, leftX, y);
        y += 30;
        doc.setFontSize(12);
        doc.text('Signature / \u0627\u0644\u0625\u0645\u0636\u0627\u0621', pageWidth - 60, y);

        doc.save(\`Recu_\${payment.partnerName}_\${Date.now()}.pdf\`);
    } catch (e) { alert('Erreur Reçu'); }
  }
}
EOF

echo "✅ Style PDF amélioré (Tableaux Services + Nettoyage)."