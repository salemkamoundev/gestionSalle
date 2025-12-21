import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ContractService {

  /**
   * Génère le contrat de location exact (Format Princesse)
   */
  async generatePrincesseContract(data: any) {
    // Note : Pour l'arabe, jsPDF nécessite l'intégration d'une police UTF-8
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // --- EN-TÊTE ---
    doc.setFontSize(9);
    doc.text('princesseofsfax@gmail.com', 14, 15);
    doc.text('Avenue Hedi Chaker Sakit Ezzit km 8,5', 14, 20);
    doc.text('Route de Tunis', 14, 25);
    
    doc.setFontSize(22);
    // Note: Pour l'affichage arabe réel, chargez une police .ttf via doc.addFileToVFS
    doc.text('الأميرة', 160, 25); 

    // --- TITRE ---
    doc.setFontSize(16);
    doc.text('عقد كراء قاعة أفراح عدد ' + (data.id || '2500072'), 105, 45, { align: 'center' });
    doc.line(60, 47, 150, 47);

    // --- LES PARTIES ---
    doc.setFontSize(11);
    doc.text('الطرف الأول : شركة الأميرة في شخص ممثلها القانوني', 196, 60, { align: 'right' });
    
    doc.text('الطرف الثاني (المتسوغ) :', 196, 75, { align: 'right' });
    doc.text('الإسم واللقب : ' + data.clientName, 196, 82, { align: 'right' });
    doc.text('رقم ب.ت.و : ' + data.cin + ' | الهاتف : ' + data.phone, 196, 89, { align: 'right' });

    // --- DÉTAILS ÉVÉNEMENT ---
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 98, 182, 12, 'F');
    doc.text('تاريخ إقامة الحفل : ' + data.eventDate + ' من الساعة 20:00 إلى 01:00', 196, 106, { align: 'right' });

    // --- ARTICLES (Extraits du contrat source) ---
    let y = 125;
    const articles = [
      'الفصل الأول : معلوم الكراء المتفق عليه هو ' + data.totalPrice + ' د.ت يدفع 50% عند الحجز.',
      'الفصل الثاني : يلتزم المتسوغ وحده باستخراج رخصة إقامة الحفل من السلط المعنية.',
      'الفصل الثالث : يلتزم صاحب الحفل بعدم إدخال أو توزيع المشروبات الكحولية.',
      'الفصل الرابع : يلتزم صاحب القاعة بتوفير 600 مقعد والطاولات المناسبة والحراسة.',
      'الفصل التاسع : في صورة العدول عن الحفل لا يحق للمتسوغ المطالبة بإرجاع العربون.'
    ];

    articles.forEach(text => {
      doc.text(text, 196, y, { align: 'right' });
      y += 10;
    });

    // --- SIGNATURES ---
    const footerY = 240;
    doc.setFontSize(12);
    doc.text('المتسوغ (Signature Client)', 20, footerY);
    doc.text('الإدارة (Gérant)', 150, footerY);
    doc.setFontSize(10);
    doc.text('Mohamed Maalej', 150, footerY + 10);

    doc.save(`Contrat_Princesse_${data.clientName}.pdf`);
  }
}
