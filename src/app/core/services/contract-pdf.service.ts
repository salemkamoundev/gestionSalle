import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {
  private datePipe = new DatePipe('fr-FR');

  constructor() {}

  generateContract(reservation: any, clientArg: any) {
    const doc = new jsPDF();
    const client = clientArg || { nom: '', prenom: '' };
    const pageWidth = doc.internal.pageSize.width;

    // En-tête
    doc.setFontSize(22);
    doc.text('CONTRAT DE LOCATION', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Réf: ${reservation.id || 'N/A'}`, pageWidth - 20, 10, { align: 'right' });
    doc.text(`Date: ${this.formatDate(new Date())}`, pageWidth - 20, 15, { align: 'right' });

    // Client
    doc.setFontSize(14);
    doc.text('ENTRE LES SOUSSIGNÉS :', 15, 40);
    doc.setFontSize(12);
    doc.text(`Client : ${client.nom || ''} ${client.prenom || ''}`, 20, 50);
    if (client.telephone) doc.text(`Tél : ${client.telephone}`, 20, 57);

    // Détails Réservation
    doc.setFontSize(14);
    doc.text('DÉTAILS DE LA RÉSERVATION :', 15, 75);
    doc.setFontSize(12);
    doc.text(`Date de l'événement : ${this.formatDate(reservation.date)}`, 20, 85);
    
    if (reservation.startTime && reservation.endTime) {
        doc.text(`Horaire : ${reservation.startTime} - ${reservation.endTime}`, 20, 92);
    }

    // Financier
    doc.setFontSize(14);
    doc.text('MODALITÉS FINANCIÈRES :', 15, 110);
    doc.setFontSize(12);
    const total = Number(reservation.totalPrice) || 0;
    const advance = Number(reservation.advance) || 0;
    const reste = total - advance;

    doc.text(`Montant Total : ${total.toFixed(3)} DT`, 20, 120);
    doc.text(`Avance perçue : ${advance.toFixed(3)} DT`, 20, 127);
    doc.text(`Reste à payer : ${reste.toFixed(3)} DT`, 20, 134);

    // Signatures
    doc.text('Signature Client', 40, 160);
    doc.text('Signature Responsable', pageWidth - 80, 160);

    doc.save(`Contrat_${client.nom || 'Client'}_${reservation.date}.pdf`);
  }

  private formatDate(date: any): string {
    if (!date) return '-';
    // Gestion des Timestamps Firestore ou Date standard
    const d = (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
    return this.datePipe.transform(d, 'dd/MM/yyyy') || '-';
  }
}
