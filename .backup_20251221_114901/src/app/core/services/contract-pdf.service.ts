import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {

  /**
   * Génère le contrat de location complet (Modèle Princesse)
   */
  generateContract(data: any) {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // NOTE : Pour l'arabe, vous devrez charger une police UTF-8 (ex: Amiri) 
    // car jsPDF ne supporte pas l'arabe nativement sans font personnalisée.
    
    // --- EN-TÊTE ---
    doc.setFontSize(10);
    doc.text('princesseofsfax@gmail.com', 14, 15); // [cite: 571]
    doc.text('Avenue Hedi Chaker Sakit Ezzit km 8,5', 14, 20); // [cite: 571]
    
    doc.setFontSize(22);
    doc.text('الأميرة', 160, 20); // Nom de la salle [cite: 572]

    // --- TITRE DU CONTRAT ---
    doc.setFontSize(16);
    doc.text('عقد كراء قاعة أفراح عدد ' + (data.contractNum || '2500072'), 105, 40, { align: 'center' }); // [cite: 573]
    doc.line(60, 42, 150, 42);

    // --- LES PARTIES ---
    doc.setFontSize(12);
    doc.text(': بين الممضيين أسفله', 190, 55, { align: 'right' }); // [cite: 574]
    
    doc.setFontSize(11);
    doc.text('الطرف الأول : شركة الأميرة (الممثل القانوني)', 190, 65, { align: 'right' }); // [cite: 575, 576]
    
    doc.text('الطرف الثاني : ' + (data.clientName || 'ABOUB SKANDER'), 190, 75, { align: 'right' }); // [cite: 577, 578]
    doc.text('الهاتف : ' + (data.phone || '28550055') + ' | بطاقة تعريف : ' + (data.cin || '08800316'), 190, 82, { align: 'right' }); // [cite: 578]

    // --- DÉTAILS DE L'ÉVÉNEMENT ---
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 90, 182, 15, 'F');
    doc.text('تاريخ إقامة الحفل : ' + (data.eventDate || '27/12/2025'), 190, 100, { align: 'right' }); // [cite: 579]

    // --- ARTICLES (FASL) ---
    let y = 115;
    const articles = [
      'الفصل الأول : معلوم الكراء ' + (data.price || '5000') + ' د.ت (50% عند الحجز والباقي قبل أسبوع).', // 
      'الفصل الثاني : يلتزم المتسوغ باستخراج رخصة إقامة الحفل.', // [cite: 581]
      'الفصل الثالث : يلتزم صاحب الحفل بعدم إدخال المشروبات الكحولية.', // 
      'الفصل الرابع : توفير 600 مقعد، الطاولات، ركح العروس، ركح الفرقة والحراسة.', // 
      'الفصل التاسع : في صورة العدول عن الحفل لا يحق للمتسوغ استرجاع العربون.', // 
      'الفصل العاشر : لا يتحمل صاحب القاعة مسؤولية ضياع الأدباش غير المسجلة.' // [cite: 588]
    ];

    articles.forEach(art => {
      doc.text(art, 190, y, { align: 'right' });
      y += 10;
    });

    // --- BLOC DE SIGNATURE ---
    const footerY = 240;
    doc.setFontSize(12);
    doc.text('المتسوغ', 40, footerY); // [cite: 593]
    doc.text('الإدارة (Gérant)', 150, footerY); // [cite: 591, 592]
    doc.text('Mohamed Maalej', 150, footerY + 10); // [cite: 592]

    // Sauvegarde
    doc.save(`Contrat_Princesse_${data.clientName || 'Client'}.pdf`);
  }
}
