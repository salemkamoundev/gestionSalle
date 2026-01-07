import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  // --- CONTRAT ---
  async generateContract(data: any) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.padding = '50px';
    container.style.backgroundColor = 'white';
    container.style.direction = 'rtl';
    container.style.fontFamily = '"Arial", sans-serif';

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

  // --- BON D'AVOIR ---
  async generateCreditVoucher(data: any) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '900px'; 
    container.style.padding = '40px';
    container.style.backgroundColor = 'white';
    container.style.direction = 'rtl';
    container.style.fontFamily = 'Arial, Helvetica, sans-serif';
    container.style.color = '#000000';

    const dateCreation = data.createdAt ? new Date(data.createdAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    
    let amountVal = "0";
    if (data.amount !== undefined && data.amount !== null) {
        amountVal = String(data.amount);
    }

    container.innerHTML = `
      <div style="border: 5px solid #000; padding: 40px; background: #fff;">
        <table style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
            <tr>
                <td style="text-align: right; width: 50%;">
                    <h1 style="margin: 0; font-size: 40px; font-weight: bold; color: #000;">قاعة الأميرة</h1>
                    <p style="margin: 5px 0; font-size: 18px;">للأفراح والمناسبات</p>
                </td>
                <td style="text-align: left; width: 50%; direction: ltr;">
                    <h2 style="margin: 0; font-size: 30px; font-weight: bold; color: #000;">BON D'AVOIR</h2>
                    <p style="margin: 5px 0; font-size: 16px;">Réf: ${data.id?.substring(0, 8).toUpperCase()}</p>
                </td>
            </tr>
        </table>

        <div style="text-align: center; margin: 50px 0;">
           <p style="font-size: 24px; margin-bottom: 10px;">وصل رصيد لفائدة الحريف(ة) :</p>
           <h2 style="font-size: 36px; font-weight: bold; margin: 0 0 40px 0; text-decoration: underline;">
             ${data.clientName || 'Client Inconnu'}
           </h2>

           <table style="margin: 0 auto; border: 4px solid #000; background-color: #f0f0f0;">
               <tr>
                   <td style="padding: 20px 60px; text-align: center;">
                       <p style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">Montant / Valeur</p>
                       <div style="font-size: 70px; font-weight: 900; line-height: 1; margin-top: 10px; color: #000;">
                           ${amountVal} <span style="font-size: 30px;">DT</span>
                       </div>
                   </td>
               </tr>
           </table>
        </div>

        <table style="width: 100%; font-size: 20px; margin: 40px 0; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding: 15px 0; color: #444;">تاريخ الإصدار / Date :</td>
                <td style="padding: 15px 0; font-weight: bold; direction: ltr; text-align: right;">${dateCreation}</td>
            </tr>
            <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding: 15px 0; color: #444;">المصدر / Source :</td>
                <td style="padding: 15px 0; font-weight: bold; text-align: left;">${data.description || 'Annulation'}</td>
            </tr>
            ${data.sourceReservationId ? `
            <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding: 15px 0; color: #444;">مرجع الحجز / Réf Résa :</td>
                <td style="padding: 15px 0; font-weight: bold; text-align: left;">${data.sourceReservationId}</td>
            </tr>` : ''}
        </table>

        <table style="width: 100%; margin-top: 80px;">
            <tr>
                <td style="text-align: center; width: 50%;">
                    <p style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">توقيع الحريف</p>
                    <p style="font-size: 14px;">Signature Client</p>
                </td>
                <td style="text-align: center; width: 50%;">
                    <p style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">الإدارة</p>
                    <p style="font-size: 14px;">L'Administration</p>
                    <div style="margin-top: 30px; font-weight: bold; font-size: 20px;">El Amira</div>
                </td>
            </tr>
        </table>
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
      pdf.save(`Avoir_${data.clientName?.replace(/\s+/g, '_')}_${amountVal}DT.pdf`);
    } catch (err) {
      console.error('Erreur PDF Avoir:', err);
    } finally {
      document.body.removeChild(container);
    }
  }

  // --- PLANNING SERVEUR ---
  async generateServerPlanning(serverName: string, reservations: any[]) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '210mm'; 
    container.style.minHeight = '297mm';
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    container.style.boxSizing = 'border-box';

    let rowsHtml = '';
    
    const sortedResas = reservations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedResas.forEach(res => {
        const dateObj = new Date(res.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        rowsHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px; font-weight:bold;">${dateStr}</td>
                <td style="padding: 12px;">${res.startTime || '?'} - ${res.endTime || '?'}</td>
                <td style="padding: 12px;">${res.clientName || 'Client'}</td>
                <td style="padding: 12px;">${res.status === 'CONFIRMED' ? 'Confirmé' : res.status}</td>
            </tr>
        `;
    });

    if (reservations.length === 0) {
        rowsHtml = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">Aucune réservation trouvée pour ce partenaire.</td></tr>';
    }

    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #333;">Planning Partenaire</h1>
            <h2 style="margin: 10px 0; color: #0ea5e9;">${serverName}</h2>
            <p style="font-size: 14px; color: #888;">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <thead>
                <tr style="background-color: #f3f4f6; text-align: left;">
                    <th style="padding: 12px; border-bottom: 2px solid #ccc;">Date</th>
                    <th style="padding: 12px; border-bottom: 2px solid #ccc;">Horaire</th>
                    <th style="padding: 12px; border-bottom: 2px solid #ccc;">Client</th>
                    <th style="padding: 12px; border-bottom: 2px solid #ccc;">Statut</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        
        <div style="margin-top: 50px; text-align: right; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px;">
            Document interne - El Amira
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
      pdf.save(`Planning_${serverName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
        console.error("Erreur génération planning", e);
    } finally {
      document.body.removeChild(container);
    }
  }
}
