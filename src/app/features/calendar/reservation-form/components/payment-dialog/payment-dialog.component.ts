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
import { Firestore, doc, updateDoc, increment, collection, addDoc } from '@angular/fire/firestore';

// --- CORRECTION IMPORTS (5 niveaux) ---
import { ReceiptService } from '../../../../../core/services/receipt.service';
import { Reservation } from '../../../../../core/models/reservation.model';

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
    .summary-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
    .full-width { width: 100%; margin-bottom: 10px; }
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
    private receiptService: ReceiptService,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PaymentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { reservation: Reservation }
  ) {
    this.reservation = data.reservation;
    this.totalPaid = data.reservation.advance || 0; 
    
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      type: ['ESPECES', Validators.required],
      date: [new Date(), Validators.required],
      checkNumber: [''],
      checkDate: [null],
      notes: ['']
    });
  }

  ngOnInit() {
    const total = this.reservation.totalPrice || 0;
    this.remaining = Math.max(0, total - this.totalPaid);
    if (this.remaining > 0) this.paymentForm.patchValue({ amount: this.remaining });

    this.paymentForm.get('type')?.valueChanges.subscribe(val => {
      const isCheck = val === 'CHEQUE';
      const ctrls = [this.paymentForm.get('checkNumber'), this.paymentForm.get('checkDate')];
      ctrls.forEach(c => { isCheck ? c?.setValidators([Validators.required]) : c?.clearValidators(); c?.updateValueAndValidity(); });
    });
  }

  async onSubmit() {
    if (this.paymentForm.invalid) return;
    this.isProcessing = true;
    const val = this.paymentForm.value;

    try {
      await addDoc(collection(this.firestore, 'payments'), {
        reservationId: this.reservation.id,
        ...val,
        date: val.date instanceof Date ? val.date.toISOString() : val.date,
        checkDate: val.checkDate instanceof Date ? val.checkDate.toISOString() : val.checkDate,
        createdAt: new Date().toISOString()
      });

      const newTotal = this.totalPaid + val.amount;
      const isSold = newTotal >= (this.reservation.totalPrice || 0);
      await updateDoc(doc(this.firestore, `reservations/${this.reservation.id}`), {
        advance: increment(val.amount),
        status: isSold ? 'CONFIRMED' : this.reservation.status
      });

      const receiptData = {
        contractNum: this.reservation.id?.substring(0, 8).toUpperCase(),
        clientName: this.reservation.clientName,
        phone: this.reservation.customerPhone,
        resDate: new Date(this.reservation.date).toLocaleDateString('fr-FR'),
        offerDescription: 'Prestation Événementielle',
        totalPrice: this.reservation.totalPrice,
        payments: [{
            number: 'Nouveau',
            date: new Date().toLocaleDateString('fr-FR'),
            type: val.type,
            amount: val.amount,
            totalSoFar: newTotal
        }],
        remainingAmount: (this.reservation.totalPrice || 0) - newTotal
      };

      this.receiptService.generateReceipt(receiptData);
      
      this.snackBar.open('Paiement enregistré !', 'OK', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e) {
      console.error(e);
      this.snackBar.open('Erreur technique', 'Fermer');
    } finally {
      this.isProcessing = false;
    }
  }
}
