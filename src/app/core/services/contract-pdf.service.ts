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

  generateContract(reservation: any, client: any) {
    const doc = new jsPDF();

    // 1. Chargement de la police Arabe (Amiri)
    doc.addFileToVFS('Amiri-Regular.ttf', amiriFont);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri'); // Activation globale de la police

    const pageWidth = doc.internal.pageSize.width;
    const centerX = pageWidth / 2;
    const rightMargin = 190;
    const leftMargin = 20;

    // --- EN-TÊTE ---
    doc.setFontSize(22);
    doc.text('عقد كراء قاعة أفراح', centerX, 20, { align: 'center' });
    
    doc.setFontSize(10);
    // Affichage correct de la référence (Texte latin à gauche)
    doc.text(`Réf: ${reservation.id ? reservation.id.slice(0, 8) : '---'}`, leftMargin, 15);
    
    const today = formatDate(new Date(), 'dd/MM/yyyy', this.locale);
    doc.text(`Tél: 12 345 678`, leftMargin, 20); 
    doc.text(`Sousse, le ${today}`, leftMargin, 25);

    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, 35, rightMargin + 10, 35);

    // --- PARTIE 1 : DONNÉES CLIENT & ÉVÉNEMENT ---
    let y = 50;
    doc.setFontSize(16);
    doc.text('1. بيانات الحريف و المناسبة', rightMargin, y, { align: 'right' });
    
    y += 10;
    doc.setFontSize(12);
    
    const writeLine = (label: string, value: string, currentY: number) => {
        // Label à droite
        doc.text(`: ${label}`, rightMargin, currentY, { align: 'right' });
        // Valeur décalée vers la gauche
        doc.text(value || '-', rightMargin - 40, currentY, { align: 'right' });
    };

    const clientName = client ? (client.nom + ' ' + (client.prenom || '')) : 'Non spécifié';
    const clientPhone = client?.telephone || '-';
    
    // Formatage Date
    let eventDate = '-';
    if (reservation.date) {
        const dateObj = reservation.date.toDate ? reservation.date.toDate() : new Date(reservation.date);
        eventDate = formatDate(dateObj, 'dd/MM/yyyy', this.locale);
    }

    // Formatage Créneau (Heure)
    const startTime = reservation.startTime || '--:--';
    const endTime = reservation.endTime || '--:--';
    const timeSlot = `${startTime} - ${endTime}`;

    writeLine('الاسم و اللقب', clientName, y);
    writeLine('رقم الهاتف', clientPhone, y + 8);
    writeLine('تاريخ الحفل', eventDate, y + 16);
    writeLine('التوقيت', timeSlot, y + 24); // Ajout du créneau ici
    
    // --- PARTIE 2 : SERVICES ---
    y += 40;
    doc.setFontSize(16);
    doc.text('2. الخدمات المتفق عليها', rightMargin, y, { align: 'right' });

    const servicesData = (reservation.services || []).map((s: any) => [
      `${Number(s.price || 0).toFixed(3)} TND`, 
      s.name || s.nom || 'Service'             
    ]);

    if (reservation.packId) {
       servicesData.unshift(['-', 'Pack inclus']); 
    }

    autoTable(doc, {
      startY: y + 5,
      // Les en-têtes doivent être écrits explicitement en arabe ici
      head: [['السعر', 'الخدمة']], 
      body: servicesData,
      theme: 'grid',
      styles: {
        font: 'Amiri', // CRITIQUE : Applique la police au contenu du tableau
        halign: 'right', 
        fontSize: 11,
        cellPadding: 2
      },
      headStyles: {
        font: 'Amiri', // CRITIQUE : Applique la police aux en-têtes
        fillColor: [50, 50, 50],
        textColor: [255, 255, 255],
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 50 }, // Prix (Latin) à gauche
        1: { halign: 'right' } // Texte Arabe à droite
      },
      margin: { left: leftMargin, right: 20 }
    });

    // --- PARTIE 3 : TOTAUX ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(16);
    doc.text('3. المجموع و الدفع', rightMargin, finalY, { align: 'right' });

    const total = Number(reservation.totalPrice || 0);
    const advance = Number(reservation.advance || 0);
    const rest = total - advance;

    y = finalY + 10;
    doc.setFontSize(13);

    // Cadre
    doc.setDrawColor(0);
    doc.rect(pageWidth - 90, y - 5, 80, 25);

    doc.setFont('Amiri', 'normal'); // S'assurer que la police est active

    // Total
    doc.text('المبلغ الجملي:', rightMargin - 5, y, { align: 'right' });
    doc.text(`${total.toFixed(3)} TND`, rightMargin - 50, y, { align: 'right' });

    // Avance
    y += 8;
    doc.text('التسبقة (العربون):', rightMargin - 5, y, { align: 'right' });
    doc.text(`${advance.toFixed(3)} TND`, rightMargin - 50, y, { align: 'right' });

    // Reste
    y += 8;
    doc.text('الباقي للدفع:', rightMargin - 5, y, { align: 'right' });
    doc.text(`${rest.toFixed(3)} TND`, rightMargin - 50, y, { align: 'right' });


    // --- PIED DE PAGE ---
    const bottomY = 250;
    
    doc.setFontSize(11);
    doc.text('إمضاء الحريف', 40, bottomY, { align: 'center' });
    doc.text('إمضاء و ختم القاعة', pageWidth - 40, bottomY, { align: 'center' });

    doc.setFontSize(9);
    doc.text('ملاحظة: العربون لا يسترجع في صورة إلغاء الحجز.', centerX, bottomY + 20, { align: 'center' });

    doc.save(`Contrat_${clientName.replace(/\s/g, '_')}_${reservation.id || 'new'}.pdf`);
  }
}
