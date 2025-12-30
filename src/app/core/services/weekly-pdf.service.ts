import { Injectable, inject } from '@angular/core';
import { ReservationService } from './reservation.service';
import { ClientService } from './client.service';
import { StaffService } from './staff.service';
// SUPPRIMÉ : Import TeamService
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class WeeklyPdfService {
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private staffService = inject(StaffService);
  // SUPPRIMÉ : Injection TeamService

  async printWeek(referenceDateStr: string) {
    if (!referenceDateStr) return;

    // 1. Calcul des dates (Lundi au Dimanche)
    const refDate = new Date(referenceDateStr);
    const currentDay = refDate.getDay(); 
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

    // 2. Récupération des données (Résa, Clients, Staff) - SANS Teams
    const reservations = await firstValueFrom(this.reservationService.getReservations());
    const clients = await firstValueFrom(this.clientService.getAll());
    const staffList = await firstValueFrom(this.staffService.getAll());
    // SUPPRIMÉ : Team fetch

    // 3. Filtrage Semaine
    const weekReservations = reservations.filter((r: any) => {
      if (!r.date) return false;
      const rDate = this.parseDate(r.date);
      const rTime = rDate.setHours(0,0,0,0);
      return rTime >= monday.getTime() && rTime <= sunday.getTime();
    });

    // 4. Init PDF Paysage
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(16);
    doc.text(`Planning Semaine du ${this.formatDateShort(monday)} au ${this.formatDateShort(sunday)}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleDateString()}`, 250, 15);

    // 5. Construction Tableau
    const head = [weekDates.map(d => this.formatDateFull(d))];

    const rowMatin: string[] = [];
    const rowAprem: string[] = [];
    const rowSoir: string[] = [];

    weekDates.forEach(date => {
      const dailyRes = weekReservations.filter((r: any) => 
        this.isSameDay(this.parseDate(r.date), date)
      );

      // Appel sans teamList
      rowMatin.push(this.getCellContent(dailyRes, 'matin', clients, staffList));
      rowAprem.push(this.getCellContent(dailyRes, 'aprem', clients, staffList));
      rowSoir.push(this.getCellContent(dailyRes, 'soir', clients, staffList));
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
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      bodyStyles: {
        minCellHeight: 45
      }
    });

    doc.save(`Planning_${this.formatDateShort(monday)}.pdf`);
  }

  // --- HELPER GÉNÉRATION CONTENU CELLULE (Suppression argument teamList) ---

  private getCellContent(
    reservations: any[], 
    slotType: string, 
    clients: any[], 
    staffList: any[]
  ): string {
    
    const slotRes = reservations.filter((r: any) => {
      const s = (r.slotId || '').toLowerCase();
      return s.includes(slotType);
    });

    if (slotRes.length === 0) return '';

    return slotRes.map((r: any) => {
      const client = clients.find(c => c.id === r.clientId);
      
      let content = `• ${r.startTime || ''}-${r.endTime || ''}`;
      
      // Info Client
      if (client) {
        content += `\n${client.nom?.toUpperCase()} ${client.prenom}`;
        if (client.prenomMarie1 || client.prenomMarie2) {
           content += `\nMariés: ${client.prenomMarie1 || ''} & ${client.prenomMarie2 || ''}`;
        }
        if (client.telephone) {
          content += `\nTel: ${client.telephone}`;
        }
      } else {
        content += `\n${r.clientName || 'Inconnu'}`;
      }

      // SUPPRIMÉ : Info Équipes

      // Info Staff
      if (r.assignedServerIds && r.assignedServerIds.length > 0) {
        const staff = staffList
          .filter((s: any) => r.assignedServerIds.includes(s.id))
          .map((s: any) => `${s.prenom} ${s.nom?.charAt(0)}.`); // Prénom + Initiale Nom pour gain place
        
        if (staff.length > 0) content += `\nStf: ${staff.join(', ')}`;
      }

      // Statut si pas confirmé
      if (r.status === 'PENDING') content += `\n(En attente)`;

      return content;
    }).join('\n\n---\n\n');
  }

  // --- HELPERS DATE ---

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
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}