import { Injectable, inject } from '@angular/core';
import { ReservationService } from './reservation.service';
import { ClientService } from './client.service';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class WeeklyPdfService {
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);

  async printWeek(referenceDateStr: string) {
    if (!referenceDateStr) return;

    // 1. Calcul des dates de la semaine (Lundi au Dimanche) basées sur la date choisie
    const refDate = new Date(referenceDateStr);
    const currentDay = refDate.getDay(); // 0=Dim, 1=Lun
    // Si Dimanche (0), on recule de 6 jours pour avoir le Lundi précédent, sinon on recule de (jour - 1)
    const diff = refDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    
    const monday = new Date(refDate);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    
    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }
    const sunday = weekDates[6];

    // 2. Récupération des données
    const reservations = await firstValueFrom(this.reservationService.getReservations());
    const clients = await firstValueFrom(this.clientService.getAll());

    // 3. Filtrage pour la semaine
    const weekReservations = reservations.filter((r: any) => {
      if (!r.date) return false;
      const rDate = this.parseDate(r.date);
      // Comparaison simple des timestamps jour
      const rTime = rDate.setHours(0,0,0,0);
      return rTime >= monday.getTime() && rTime <= sunday.getTime();
    });

    // 4. Initialisation PDF (Paysage A4)
    const doc = new jsPDF('l', 'mm', 'a4');

    // Titre
    doc.setFontSize(16);
    doc.text(`Planning des Fêtes : Semaine du ${this.formatDateShort(monday)} au ${this.formatDateShort(sunday)}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleDateString()}`, 250, 15);

    // 5. Construction du Tableau
    // En-tête : Les jours
    const head = [weekDates.map(d => this.formatDateFull(d))];

    // Corps : 3 Lignes (Matin, Aprem, Soir)
    const rowMatin: string[] = [];
    const rowAprem: string[] = [];
    const rowSoir: string[] = [];

    weekDates.forEach(date => {
      const dailyRes = weekReservations.filter((r: any) => 
        this.isSameDay(this.parseDate(r.date), date)
      );

      rowMatin.push(this.getCellContent(dailyRes, 'matin', clients));
      rowAprem.push(this.getCellContent(dailyRes, 'aprem', clients));
      rowSoir.push(this.getCellContent(dailyRes, 'soir', clients));
    });

    const body = [rowMatin, rowAprem, rowSoir];

    autoTable(doc, {
      head: head,
      body: body,
      startY: 25,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      // Force une hauteur minimale pour la lisibilité
      bodyStyles: {
        minCellHeight: 40
      },
      // Personnalisation des lignes pour afficher le nom du créneau (Matin/Aprem/Soir) ?
      // Ici on laisse le contenu parler, mais on pourrait ajouter une première colonne "Créneau" si besoin.
      // Pour l'instant, c'est implicite par la position (Ligne 1 = Matin, etc)
    });

    doc.save(`Semaine_${this.formatDateShort(monday)}.pdf`);
  }

  // --- HELPERS ---

  private getCellContent(reservations: any[], slotType: string, clients: any[]): string {
    // Trouve les résa qui correspondent au slot (ex: slotId contient 'matin' ou startTime correspond)
    // Ici on suppose que slotId ou le contexte permet de filtrer. 
    // Si slotId n'est pas fiable, il faudrait filtrer par heure.
    // On va utiliser une recherche large sur slotId.
    const slotRes = reservations.filter((r: any) => {
      const s = (r.slotId || '').toLowerCase();
      // Si pas de slotId, on peut essayer de deviner avec l'heure (optionnel)
      return s.includes(slotType);
    });

    if (slotRes.length === 0) return '';

    return slotRes.map((r: any) => {
      const client = clients.find(c => c.id === r.clientId);
      
      // Infos de base
      let content = `• ${r.startTime || ''}-${r.endTime || ''}`;
      
      if (client) {
        content += `\nCLT: ${client.nom?.toUpperCase()} ${client.prenom}`;
        
        // Mariés
        if (client.prenomMarie1 || client.prenomMarie2) {
           content += `\nMariés: ${client.prenomMarie1 || ''} & ${client.prenomMarie2 || ''}`;
        }
        
        // Téléphone
        if (client.telephone) {
          content += `\nTel: ${client.telephone}`;
        }
      } else {
        content += `\n${r.clientName || 'Client Inconnu'}`;
      }

      // Note éventuelle courte
      if (r.status === 'PENDING') content += `\n(En attente)`;

      return content;
    }).join('\n\n----------------\n\n');
  }

  private parseDate(value: any): Date {
    if (value?.toDate) return value.toDate();
    if (typeof value === 'string') return new Date(value);
    return new Date();
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  }

  private formatDateShort(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  private formatDateFull(d: Date): string {
    const str = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    // Met la première lettre en majuscule
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
