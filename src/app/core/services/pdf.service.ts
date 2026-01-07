import { Injectable } from '@angular/core';
import { Reservation, PartnerPayment } from '../models/reservation.model';
import { format } from 'date-fns';

// On déclare pdfMake comme variable globale externe.
// Elle sera chargée par les scripts définis dans angular.json.
declare var pdfMake: any;

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() {
    // Rien à initialiser ici, angular.json s'occupe de charger pdfMake et vfs_fonts
  }

  // --- STUBS COMPATIBILITÉ ---
  generateServerPlanning(serverName: string, reservations: any = []) {
    console.log('Stub generateServerPlanning', serverName);
  }
  async generateCreditVoucher(data: any) {
    console.log('Stub generateCreditVoucher', data);
  }
  generateContract(reservation: Reservation) {
     console.log('Stub generateContract');
  }

  // --- MÉTHODES PARTENAIRES ---

  generatePartnerReceipt(reservation: Reservation, payment: PartnerPayment) {
    const docDefinition: any = {
      content: [
        { text: 'REÇU DE PAIEMENT PARTENAIRE', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        {
          style: 'tableExample',
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Information', style: 'tableHeader' }, { text: 'Détail', style: 'tableHeader' }],
              ['Partenaire', payment.partnerName],
              ['Date du paiement', this.formatDate(payment.date)],
              ['Mode de règlement', payment.method],
              ['Référence', payment.reference || '-'],
              ['Concerne la réservation', reservation.clientName],
              ['Date de l\'événement', this.formatDate(reservation.date)],
            ]
          }
        },
        { text: '\n' },
        {
          text: [
            'Montant versé: ',
            { text: `${payment.amount} TND`, bold: true, fontSize: 14 }
          ],
          alignment: 'right'
        },
        { text: '\n\nSignature:', alignment: 'right', margin: [0, 40, 0, 0] }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        tableHeader: { bold: true, fontSize: 12, color: 'black', fillColor: '#eeeeee' },
        tableExample: { margin: [0, 5, 0, 15] }
      }
    };
    
    // Appel direct à la variable globale
    pdfMake.createPdf(docDefinition).open();
  }

  generatePartnersSummary(reservation: Reservation, groupedPartners: any[]) {
    const body = [
        [
            { text: 'Partenaire', style: 'tableHeader' }, 
            { text: 'Services', style: 'tableHeader' }, 
            { text: 'Total Dû', style: 'tableHeader' }, 
            { text: 'Payé', style: 'tableHeader' }, 
            { text: 'Reste', style: 'tableHeader' }
        ]
    ];

    groupedPartners.forEach(p => {
        body.push([
            p.partnerName,
            p.services.join(', '),
            { text: `${p.totalCost} TND`, alignment: 'right' },
            { text: `${p.totalPaid} TND`, alignment: 'right' },
            { text: `${p.remaining} TND`, alignment: 'right', bold: true, color: p.remaining > 0 ? 'red' : 'green' }
        ]);
    });

    const docDefinition: any = {
      content: [
        { text: 'BILAN RÈGLEMENTS PARTENAIRES', style: 'header', alignment: 'center' },
        { text: `Réservation: ${reservation.clientName} (${this.formatDate(reservation.date)})`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] },
        {
            table: {
                headerRows: 1,
                widths: ['*', '*', 'auto', 'auto', 'auto'],
                body: body
            },
            layout: 'lightHorizontalLines'
        },
        { text: `\nEdité le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, style: 'small', alignment: 'right' }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, italics: true },
        tableHeader: { bold: true, fillColor: '#eeeeee' },
        small: { fontSize: 8, color: 'grey' }
      }
    };
    
    pdfMake.createPdf(docDefinition).open();
  }

  private formatDate(date: any): string {
      if (!date) return '-';
      try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return format(d, 'dd/MM/yyyy');
      } catch (e) {
        return 'Date invalide';
      }
  }
}
