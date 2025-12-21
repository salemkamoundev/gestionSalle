import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  async generateContract(data: any) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.padding = '50px';
    container.style.backgroundColor = 'white';
    container.style.direction = 'rtl';
    container.style.fontFamily = '"Arial", sans-serif';

    // Calcul du reste à payer
    const total = data.totalPrice || 0;
    const avance = data.advance || 0;
    const reste = total - avance;

    container.innerHTML = `
      <div style="border: 3px double #000; padding: 30px; min-height: 1000px; position: relative;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
          <div style="text-align: left; font-size: 12px; direction: ltr;">
            <strong>princesseofsfax@gmail.com</strong><br>
            Avenue Hedi Chaker Sakiet Ezzit km 8,5<br>
            Sfax, Tunisie
          </div>
          <div style="text-align: right;">
            <h1 style="margin: 0; font-size: 40px; color: #1e293b;">الأميرة</h1>
          </div>
        </div>

        <h2 style="text-align: center; font-size: 24px; text-decoration: underline; margin-bottom: 40px;">
          عقد كراء قاعة أفراح عدد ${data.id?.substring(0, 8) || '2025/001'}
        </h2>

        <p style="font-size: 18px; margin-bottom: 20px;">بين الممضيين أسفله :</p>

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 18px; text-decoration: underline;">الطرف الأول :</h3>
          <p>شركة الأميرة في شخص ممثلها القانوني بمقرها الإجتماعي بطريق تونس 249 شارع الهادي شاكر ساقية الزيت صفاقس.</p>
        </div>

        <div style="margin-bottom: 30px; line-height: 1.8;">
          <h3 style="font-size: 18px; text-decoration: underline;">الطرف الثاني :</h3>
          <table style="width: 100%; font-size: 16px;">
            <tr>
              <td><strong>الإسم واللقب :</strong> ${data.clientName || '................'}</td>
              <td><strong>الهاتف :</strong> ${data.clientPhone || '................'}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>صاحب بطاقة تعريف عدد :</strong> ${data.clientCin || '................'}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
          <p style="margin: 0; font-size: 18px;">
            تاريخ إقامة الحفل : <strong>${data.date || '..../..../....'}</strong> <br>
            من الساعة <strong>${data.startTime || '--:--'}</strong> إلى الساعة <strong>${data.endTime || '--:--'}</strong>
          </p>
        </div>

        <div style="font-size: 15px; line-height: 1.6; text-align: justify;">
          <p><strong>الفصل الأول :</strong> وقع الاتفاق على معلوم كراء قدره (<strong>${total} DT</strong>) يدفع منه مبلغ (<strong>${avance} DT</strong>) عند الحجز والباقي وقدره (<strong>${reste} DT</strong>) قبل أسبوع من موعد الحفل.</p>
          <p><strong>الفصل الثاني :</strong> يلتزم الطرف الثاني وحده باستخراج رخصة لإقامة الحفل من السلط الإدارية المعنية.</p>
          <p><strong>الفصل الثالث :</strong> يلتزم صاحب الحفل بعدم إدخال أو توزيع المشروبات الكحولية.</p>
          <p><strong>الفصل الرابع :</strong> يلتزم صاحب القاعة بتوفير 600 مقعد و الطاولات المناسبة لها.</p>
          <p><strong>الفصل التاسع :</strong> في صورة عدول الطرف الثاني عن إقامة الحفل لا يحق له المطالبة بإرجاع العربون.</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 100px;">
          <div style="text-align: center; width: 200px;">
            <p style="font-weight: bold; text-decoration: underline;">المتسوغ</p>
            <div style="height: 100px; border: 1px dashed #ccc; margin-top: 10px;"></div>
          </div>
          <div style="text-align: center; width: 200px;">
            <p style="font-weight: bold; text-decoration: underline;">الإدارة</p>
            <p style="font-size: 14px; margin: 5px 0;">Mohamed Maalej</p>
            <div style="height: 100px; border: 1px dashed #ccc; margin-top: 10px;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Contrat_${data.clientName?.replace(/\s+/g, '_')}_${data.date}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  }

  generateReceipt(payment: any, reservation: any) {
    const doc = new jsPDF();
    doc.text(`RECU DE PAIEMENT - ${reservation.clientName}`, 20, 20);
    doc.text(`Montant: ${payment.amount} DT`, 20, 30);
    doc.save(`Recu_${payment.id}.pdf`);
  }
}
