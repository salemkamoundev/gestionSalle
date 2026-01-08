#!/bin/bash
set -e

echo "🚀 Configuration du bouton 'Imprimer le reçu' (jsPDF)..."

# --- 1. MISE À JOUR DU SERVICE (Ajout de generatePartnerReceipt) ---
SERVICE_FILE="src/app/core/services/contract-pdf.service.ts"
echo "📝 Ajout de la méthode de reçu dans $SERVICE_FILE..."

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

  // --- INIT COMMUNE ---
  private initDoc(): { doc: jsPDF, fontName: string, align: 'right' | 'left' } {
    const doc = new jsPDF();
    let fontName = 'helvetica';
    let align: 'right' | 'left' = 'left';

    if (amiriFont && amiriFont.length > 100) {
        try {
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFont);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            fontName = 'Amiri';
            align = 'right'; 
        } catch (e) {
            console.error('Erreur chargement police Arabe', e);
        }
    }
    return { doc, fontName, align };
  }

  // 1. CONTRAT
  generateContract(reservation: any, client: any) {
    try {
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        
        doc.setFontSize(22);
        doc.text('CONTRAT / عقد', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(\`Réf: \${reservation.id}\`, 20, 30);
        
        const clientName = client ? (client.nom + ' ' + (client.prenom || '')) : 'Non spécifié';
        const total = Number(reservation.totalPrice || 0).toFixed(3);
        const advance = Number(reservation.advance || 0).toFixed(3);

        autoTable(doc, {
            startY: 40,
            head: [['Détails', 'Valeur / القيمة']],
            body: [
                ['Client / الحريف', clientName],
                ['Date / التاريخ', reservation.date ? formatDate(new Date(reservation.date.toDate ? reservation.date.toDate() : reservation.date), 'dd/MM/yyyy', this.locale) : '-'],
                ['Total / المجموع', total + ' DT'],
                ['Avance / العربون', advance + ' DT']
            ],
            styles: { font: fontName, halign: 'right' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
        });

        doc.save(\`Contrat_\${reservation.id}.pdf\`);
    } catch (e) { alert('Erreur PDF Contrat'); }
  }

  // 2. BILAN PARTENAIRES
  generatePartnersSummary(resData: any, partners: any[]) {
    try {
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;

        doc.setFontSize(18);
        doc.text('Bilan Partenaires / تقرير الشركاء', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(\`Client: \${resData.clientName}\`, 14, 30);

        const tableBody = partners.map(p => [
            p.remaining ? Number(p.remaining).toFixed(3) : '0.000',
            p.totalPaid ? Number(p.totalPaid).toFixed(3) : '0.000',
            p.totalCost ? Number(p.totalCost).toFixed(3) : '0.000',
            (p.services || []).join(', '),
            p.partnerName
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Reste', 'Payé', 'Total', 'Services', 'Partenaire']],
            body: tableBody,
            styles: { font: fontName, fontSize: 10, halign: 'center' },
            headStyles: { fillColor: [100, 100, 255] }
        });

        doc.save(\`Bilan_Global_\${resData.id || Date.now()}.pdf\`);
    } catch (e) { alert('Erreur PDF Bilan'); }
  }

  // 3. REÇU PARTENAIRE (NOUVEAU pour le bouton "Imprimer le reçu")
  generatePartnerReceipt(resData: any, payment: any) {
    try {
        console.log('📄 Génération Reçu Partenaire...', payment);
        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        const centerX = pageWidth / 2;

        // Cadre extérieur
        doc.setDrawColor(100);
        doc.rect(10, 10, pageWidth - 20, 130);

        // Titre
        doc.setFontSize(22);
        doc.text('REÇU DE PAIEMENT', centerX, 25, { align: 'center' });
        doc.setFontSize(16);
        doc.text('وصل خلاص', centerX, 32, { align: 'center' });

        // Date et Réf
        doc.setFontSize(10);
        const today = formatDate(new Date(), 'dd/MM/yyyy HH:mm', this.locale);
        doc.text(\`Date: \${today}\`, 20, 45);
        doc.text(\`Réf Paiement: \${payment.reference || '---'}\`, pageWidth - 80, 45);

        // Corps du reçu
        let y = 60;
        const leftX = 30;
        const rightX = pageWidth - 50;

        doc.setFontSize(14);
        
        // Bénéficiaire
        doc.text(\`Bénéficiaire: \${payment.partnerName}\`, leftX, y);
        doc.text(':المستفيد', rightX, y, { align: 'right' });
        
        y += 15;
        // Montant
        doc.setFontSize(16);
        doc.setTextColor(220, 38, 38); // Rouge
        doc.text(\`Montant: \${Number(payment.amount).toFixed(3)} DT\`, leftX, y);
        doc.text(':المبلغ', rightX, y, { align: 'right' });
        doc.setTextColor(0); // Noir

        y += 15;
        // Méthode
        doc.setFontSize(14);
        doc.text(\`Mode de paiement: \${payment.method || 'ESPECES'}\`, leftX, y);
        doc.text(':طريقة الدفع', rightX, y, { align: 'right' });

        y += 15;
        // Concerne (Client / Event)
        doc.text(\`Concerne: \${resData.clientName}\`, leftX, y);
        doc.text(':عن السيد(ة)', rightX, y, { align: 'right' });

        // Signature
        y += 30;
        doc.setFontSize(12);
        doc.text('Signature / الإمضاء', pageWidth - 60, y);

        doc.save(\`Recu_\${payment.partnerName}_\${Date.now()}.pdf\`);
        console.log('✅ Reçu généré !');

    } catch (e) {
        console.error('❌ Erreur Reçu Partenaire', e);
        alert('Erreur lors de la génération du reçu.');
    }
  }
}
EOF

# --- 2. CORRECTION DU COMPOSANT ---
COMPONENT="src/app/features/calendar/reservation-form/reservation-form.component.ts"
echo "🔗 Liaison du bouton dans $COMPONENT..."

# Remplacement de l'appel pdfService par contractPdfService pour le reçu
if grep -q "this.pdfService.generatePartnerReceipt" "$COMPONENT"; then
    sed -i.bak 's/this.pdfService.generatePartnerReceipt/this.contractPdfService.generatePartnerReceipt/g' "$COMPONENT"
    echo "✅ Bouton 'Imprimer le reçu' connecté au nouveau service."
else
    echo "ℹ️ Le code semble déjà correct ou introuvable."
fi

# Nettoyage
rm -f "${COMPONENT}.bak"

echo "🎉 Terminé ! Essayez le bouton 'Imprimer le reçu'."