#!/bin/bash

TARGET_FILE="src/app/core/services/contract-pdf.service.ts"

echo "Réparation critique du service ContractPdfService (Méthode Image) dans $TARGET_FILE..."

cat << 'EOF' > "$TARGET_FILE"
import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class ContractPdfService {

  constructor() {}

  async generateContract(reservation: any) {
    // 1. Sécurité : Vérifier les données
    if (!reservation) {
      console.error("Aucune réservation fournie pour le contrat.");
      return;
    }

    const client = reservation.client || {};
    
    // 2. Préparation des données (gestion des undefined)
    const data = {
      contractNum: reservation.id ? reservation.id.toString().slice(-6) : Math.floor(Math.random() * 100000),
      clientName: (client.nom || "") + " " + (client.prenom || ""),
      clientPhone: client.telephone || "....................",
      clientCin: client.cin || "....................",
      cinDate: "....................",
      date: this.formatDate(reservation.date),
      start: this.formatTime(reservation.startTime) || "20:00",
      end: this.formatTime(reservation.endTime) || "01:00",
      total: reservation.totalPrice || 0,
      advance: (reservation.totalPrice || 0) * 0.5
    };

    // 3. Construction du HTML (Template Identique au PDF)
    const element = document.createElement('div');
    element.style.width = '210mm';
    element.style.minHeight = '297mm';
    element.style.padding = '20px';
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#000000';
    element.style.fontFamily = "'Arial', sans-serif";
    element.style.position = 'absolute';
    element.style.top = '-9999px'; // Hors écran mais rendu
    element.style.left = '0';
    element.style.zIndex = '-1000';

    // HTML Content
    element.innerHTML = `
      <div style="direction: ltr; font-family: sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
          <div style="text-align: left; font-size: 11px; line-height: 1.5;">
            <div>princesseofsfax@gmail.com</div>
            <div>Avenue Hedi Chaker Sakiet</div>
            <div>Ezzit km 8,5 Route de Tunis</div>
          </div>
          <div style="text-align: right;">
             <h1 style="font-size: 45px; margin: 0; font-family: serif;">الأميرة</h1>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="font-size: 24px; text-decoration: underline; margin: 0;">عقد كراء قاعة أفراح عدد ${data.contractNum}</h2>
        </div>

        <div style="direction: rtl; text-align: right; font-size: 14px; line-height: 1.8;">
          
          <div style="margin-bottom: 20px; font-weight: bold;">
            بين الممضيين أسفله :
          </div>

          <div style="margin-bottom: 5px; font-weight: bold; text-decoration: underline;">: الطرف الأول</div>
          <div style="margin-bottom: 20px; text-align: justify;">
            شركة الأميرة في شخص ممثلها القانوني شركة ذات مسؤولية، سجلها التجاري ، في مقرها الإجتماعي بطريق تونس 249 شارع الهادي شاكر ساقية الزيت صفاقس.
          </div>

          <div style="margin-bottom: 5px; font-weight: bold; text-decoration: underline;">: الطرف الثاني</div>
          <div style="margin-bottom: 5px;">
            الإسم واللقب : <b>${data.clientName}</b> &nbsp;&nbsp;|&nbsp;&nbsp; الهاتف : <b>${data.clientPhone}</b>
          </div>
          <div style="margin-bottom: 5px;">
             صاحب بطاقة تعريف عدد : <b>${data.clientCin}</b> &nbsp;&nbsp;|&nbsp;&nbsp; الصادرة بتونس في : <b>${data.cinDate}</b>
          </div>

          <hr style="margin: 20px 0; border-top: 1px dashed #999;">

          <div style="margin-bottom: 20px;">
            تاريخ إقامة الحفل : <b>${data.date}</b> من الساعة <b>${data.start}</b> إلى <b>${data.end}</b> 
            و تكون قاعة الأفراح تحت تصرف لمدة <b>05</b> ساعة.
            <br>
            و بانقضائها يقع قطع التيار الكهربائي عن ركح الفرقة آليا.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل الأول :</b> وقع الاتفاق على معلوم كراء (<b>${data.total} DT</b>) يدفع 50% منه عند الحجز "la reservation" مقابل وصل في الغرض أما الباقي يدفع على أقصى تقدير قبل أسبوع من موعد الحفل.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل الثاني :</b> يلتزم الطرف الثاني وحده (المتسوغ) باستخراج رخصة لإقامة الحفل من السلط الإدارية المعنية.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل الثالث :</b> يلتزم صاحب الحفل بعدم إدخال أو توزيع المشروبات الكحولية.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل الرابع :</b> يلتزم صاحب القاعة بتوفير 600 مقعد و الطاولات المناسبة لها و ركح واحد للعروس و ركح للفرقة مع الحراسة للمأوى.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل الخامس :</b> من حق الحريف الإستمتاع بالوقت الكامل المخصص للحفل و المنصوص عليه سابقا.
          </div>

          <div style="margin-bottom: 10px;">
            <b>الفصل السادس :</b> من حق صاحب القاعة طرد أي شخص يتصرف تصرفا غير مسؤول.
          </div>

          <div style="margin-bottom: 30px;">
            <b>الفصل التاسع :</b> في صورة عدول الطرف الثاني عن إقامة الحفل يحق لصاحب الفضاء التصرف في القاعة بدون سابق إعلام و يعتبر المبلغ المدفوع تعويضا عما فات الطرف الأول من ربح.
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px;">
             <div style="text-align: center;">
                <div style="font-weight: bold; margin-bottom: 10px;">الطرف الأول</div>
                <div>(صاحب القاعة)</div>
             </div>
             <div style="text-align: center;">
                <div style="font-weight: bold; margin-bottom: 10px;">الطرف الثاني</div>
                <div>(المتسوغ)</div>
             </div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(element);

    try {
      // 4. Capture Canvas -> PDF (Méthode Robuste)
      const canvas = await html2canvas(element, {
        scale: 2, // Meilleure qualité
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Contrat_${reservation.id || 'Nouveau'}.pdf`);

    } catch (error) {
      console.error("Erreur génération PDF:", error);
      alert("Erreur lors de la génération du contrat. Vérifiez la console.");
    } finally {
      // Nettoyage
      document.body.removeChild(element);
    }
  }

  // --- Helpers ---
  private formatDate(dateField: any): string {
    if (!dateField) return "................";
    const d = (dateField.toDate) ? dateField.toDate() : new Date(dateField);
    return isNaN(d.getTime()) ? "................" : d.toLocaleDateString('fr-FR');
  }

  private formatTime(timeField: any): string {
    if (!timeField) return "";
    if (typeof timeField === 'string' && timeField.includes(':')) return timeField;
    const d = (timeField.toDate) ? timeField.toDate() : new Date(timeField);
    return isNaN(d.getTime()) ? "" : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}
EOF

chmod +x "$TARGET_FILE"
echo "Service réparé avec la méthode Image (html2canvas explicite)."