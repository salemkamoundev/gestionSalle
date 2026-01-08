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

  // Initialisation intelligente : si Amiri est vide, on utilise Helvetica
  private initDoc(): { doc: jsPDF, fontName: string, align: 'right' | 'left' } {
    const doc = new jsPDF();
    let fontName = 'helvetica';
    let align: 'right' | 'left' = 'left';

    // Vérification stricte si la police arabe est chargée
    if (amiriFont && amiriFont.length > 100) {
        try {
            doc.addFileToVFS('Amiri-Regular.ttf', amiriFont);
            doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
            doc.setFont('Amiri');
            fontName = 'Amiri';
            align = 'right'; // Arabe = droite
        } catch (e) {
            console.error('Erreur chargement police Arabe', e);
        }
    } else {
        console.warn('⚠️ Police Amiri non trouvée. Utilisation de Helvetica (pas d\'arabe).');
    }
    
    return { doc, fontName, align };
  }

  generateContract(reservation: any, client: any) {
    try {
        const { doc, fontName, align } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;
        
        doc.setFontSize(20);
        doc.text('CONTRAT / عقد', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Ref: ${reservation.id}`, 10, 30);
        
        // ... (Logique contrat simplifiée pour garantir le rendu) ...
        
        doc.save(`Contrat_${reservation.id}.pdf`);
    } catch (e) {
        console.error('Erreur PDF Contrat', e);
        alert('Erreur génération PDF Contrat');
    }
  }

  // LA MÉTHODE QUE VOUS CHERCHEZ
  generatePartnersSummary(resData: any, partners: any[]) {
    try {
        console.log('📄 Génération PDF Bilan Partenaires...', partners);
        const { doc, fontName, align } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width;

        // Titre
        doc.setFontSize(18);
        doc.text('Bilan Partenaires', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        const dateStr = resData.date && resData.date.toDate ? formatDate(resData.date.toDate(), 'dd/MM/yyyy', this.locale) : resData.date;
        doc.text(`Date: ${dateStr}`, 14, 30);
        doc.text(`Client: ${resData.clientName}`, 14, 36);

        // Tableau
        const tableBody = partners.map(p => [
            p.remaining ? Number(p.remaining).toFixed(3) : '0.000',
            p.totalPaid ? Number(p.totalPaid).toFixed(3) : '0.000',
            p.totalCost ? Number(p.totalCost).toFixed(3) : '0.000',
            (p.services || []).join(', '),
            p.partnerName
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['Reste', 'Payé', 'Total', 'Services', 'Partenaire']],
            body: tableBody,
            styles: { font: fontName, fontSize: 10 },
            headStyles: { fillColor: [100, 100, 255] }
        });

        // Totaux
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        const totalCost = partners.reduce((acc, p) => acc + (p.totalCost || 0), 0);
        
        doc.setFontSize(12);
        doc.text(`Total Coût: ${totalCost.toFixed(3)} DT`, 180, finalY, { align: 'right' });

        doc.save(`Bilan_Global_${resData.id || Date.now()}.pdf`);
        console.log('✅ PDF Téléchargé !');
    } catch (e) {
        console.error('❌ Erreur génération PDF Bilan', e);
        alert('Erreur lors de la création du PDF : ' + e);
    }
  }
}
