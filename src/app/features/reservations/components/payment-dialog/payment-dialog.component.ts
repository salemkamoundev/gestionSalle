import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PaymentService } from '../../../../core/services/payment.service';
import { PdfService } from '../../../../core/services/pdf.service';
import { Reservation } from '../../../../core/models/reservation.model';
import { Firestore, doc, updateDoc, increment } from '@angular/fire/firestore';

@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatNativeDateModule, MatIconModule, MatSnackBarModule
  ],
  templateUrl: './payment-dialog.component.html',
  styles: [`
    .summary-box { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .summary-total { border-top: 1px solid #cbd5e1; padding-top: 8px; font-weight: bold; color: #059669; font-size: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-width { width: 100%; }
  `]
})
export class PaymentDialogComponent implements OnInit {
  paymentForm: FormGroup;
  reservation: Reservation;
  totalPaid: number = 0;
  remaining: number = 0;
  isProcessing = false;

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private pdfService: PdfService,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { reservation: Reservation }
  ) {
    this.reservation = data.reservation;
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      type: ['ESPECES', Validators.required],
      date: [new Date(), Validators.required],
      checkNumber: [''],
      checkDate: [null],
      notes: ['']
    });
  }

  async ngOnInit() {
    if (this.reservation.id) {
      this.totalPaid = await this.paymentService.getTotalPaid(this.reservation.id);
      const total = this.reservation.totalPrice || 0;
      this.remaining = Math.max(0, total - this.totalPaid);
      this.paymentForm.patchValue({ amount: this.remaining });
    }

    this.paymentForm.get('type')?.valueChanges.subscribe(val => {
      const isCheck = val === 'CHEQUE';
      const controls = [this.paymentForm.get('checkNumber'), this.paymentForm.get('checkDate')];
      controls.forEach(c => {
        isCheck ? c?.setValidators([Validators.required]) : c?.clearValidators();
        c?.updateValueAndValidity();
      });
    });
  }

  async onSubmit() {
    if (this.paymentForm.invalid || !this.reservation.id) return;
    this.isProcessing = true;
    const val = this.paymentForm.value;

    try {
      const paymentData = {
        reservationId: this.reservation.id,
        amount: val.amount,
        type: val.type,
        date: val.date.toISOString(),
        checkNumber: val.type === 'CHEQUE' ? val.checkNumber : null,
        checkDate: val.type === 'CHEQUE' && val.checkDate ? val.checkDate.toISOString() : null,
        notes: val.notes,
        receiptNumber: `REC-${Date.now()}`
      };

      // 1. Enregistrer le paiement
      await this.paymentService.addPayment(paymentData);

      // 2. Mise à jour Réservation
      const newTotal = this.totalPaid + val.amount;
      const isSold = newTotal >= (this.reservation.totalPrice || 0);
      
      await updateDoc(doc(this.firestore, `reservations/${this.reservation.id}`), {
        advance: increment(val.amount),
        status: isSold ? 'CONFIRMED' : this.reservation.status
      });

      // 3. PDF
      this.pdfService.generateReceipt(paymentData, this.reservation);

      this.snackBar.open('Paiement enregistré avec succès', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e) {
      console.error(e);
      this.snackBar.open('Erreur lors du paiement', 'Fermer');
    } finally {
      this.isProcessing = false;
    }
  }
}
