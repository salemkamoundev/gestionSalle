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

  // Chargement de l'image de fond
  private async getBase64Image(fileNames: string[]): Promise<string> {
    for (const url of fileNames) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {}
    }
    throw new Error("Image de fond introuvable.");
  }

  async generateContract(reservation: any, client: any) {
    try {
        // 1. Chargement de l'image
        const urlsToTest = ['/assets/conratVide.jpg', 'assets/conratVide.jpg', '/assets/contratVide.jpg'];
        const base64Img = await this.getBase64Image(urlsToTest);

        const { doc, fontName } = this.initDoc();
        const pageWidth = doc.internal.pageSize.width; // 210 mm
        const pageHeight = doc.internal.pageSize.height; // 297 mm
        
        // 2. AJOUTER UNIQUEMENT L'IMAGE (efface tout le reste)
        doc.addImage(base64Img, 'JPEG', 0, 0, pageWidth, pageHeight);

        // 3. PRÉPARATION DES VARIABLES
        const ref = reservation.id ? reservation.id.slice(0, 8) : '---';
        const cName = client ? (client.nom + ' ' + (client.prenom || '')) : '';
        const cPhone = client?.telephone || '';
        const cCin = client?.cin || '';
        const cDateDelivrance = client?.dateCin || '';
        
        let dateStr = '';
        if (reservation.date) {
             const d = reservation.date.toDate ? reservation.date.toDate() : new Date(reservation.date);
             dateStr = formatDate(d, 'dd/MM/yyyy', this.locale);
        }
        const startT = reservation.startTime || '';
        const endT = reservation.endTime || '';
        const total = reservation.totalPrice || 0;

        // 4. RÉGLAGE DE LA POLICE DU TEXTE DYNAMIQUE
        doc.setFontSize(12);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(0, 0, 150); // J'ai mis le texte en Bleu Foncé pour que tu le voies bien sur l'image !

// =========================================================================
        // 🔴🔴🔴 TABLEAU DE RÉGLAGE DES ZONES ROUGES (EN MILLIMÈTRES) 🔴🔴🔴
        // =========================================================================
        // X = Gauche à Droite | Y = Haut en Bas
        
        const pos = {
            reference:      { x: 45,  y: 40 },  // ↕️ Modifie 35 pour monter/descendre la Réf
            
            // Ligne Identité
            telephone:      { x: 160, y: 89 },  // ↕️ Modifie 84
            nomComplet:     { x: 90,  y: 89 },  // ↕️ Modifie 84
            cin:            { x: 25,  y: 89 },  // ↕️ Modifie 84
            
            // Date CIN
            dateDelivrance: { x: 140, y: 94 },  // ↕️ Modifie 91
            
            // Ligne Fête
            dateFete:       { x: 150, y: 102 }, // ↕️ Modifie 103
            horaires:       { x: 90,  y: 103 }, // ↕️ Modifie 103
            
            // Montant
            prixTotal:      { x: 150, y: 126 }  // ↕️ Modifie 121
        };

        // =========================================================================
        // IMPRESSION DU TEXTE SUR L'IMAGE (Centré sur les coordonnées X)
        // =========================================================================
        const center = { align: 'center' as any };

        doc.text(ref, pos.reference.x, pos.reference.y, center);
        doc.text(cPhone, pos.telephone.x, pos.telephone.y, center);
        doc.text(cName, pos.nomComplet.x, pos.nomComplet.y, center);
        doc.text(cCin, pos.cin.x, pos.cin.y, center);
        doc.text(cDateDelivrance, pos.dateDelivrance.x, pos.dateDelivrance.y, center);
        doc.text(dateStr, pos.dateFete.x, pos.dateFete.y, center);
        doc.text(`${startT} - ${endT}`, pos.horaires.x, pos.horaires.y, center);
        doc.text(`${total} DT`, pos.prixTotal.x, pos.prixTotal.y, center);

        // 5. SAUVEGARDE
        doc.save(`Contrat_${reservation.id}.pdf`);
    } catch (e: any) { 
        console.error(e);
        alert("Erreur PDF : " + e.message); 
    }
  }

  // --- Fonctions Bilan inchangées ---
  private _generatePartnerReport(filename: string, resData: any, partners: any[], singleMode: boolean = false) { }
  generatePartnersSummary(resData: any, partners: any[]) { this._generatePartnerReport('Bilan_Complet', resData, partners); }
  generateSinglePartnerReport(resData: any, partner: any) { this._generatePartnerReport(`Bilan_${partner.partnerName}`, resData, [partner], true); }
  generatePartnerReceipt(resData: any, payment: any) {}
}
