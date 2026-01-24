import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Firestore, doc, updateDoc, increment, collection, addDoc } from '@angular/fire/firestore';
import { ReceiptService } from '../../../../../core/services/receipt.service';
import { UiService } from '../../../../../core/services/ui.service';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-modal.component.html'
})
export class PaymentModalComponent implements OnInit {
  @Input() reservation: any;
  @Output() close = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private receiptService = inject(ReceiptService);
  private ui = inject(UiService);

  form: FormGroup;
  isProcessing = false;
  remainingAmount = 0;

  constructor() {
    this.form = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      type: ['ESPECES', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      checkNumber: [''],
      checkDate: [''],
      notes: ['']
    });
  }

  ngOnInit() {
    if (this.reservation) {
      const total = this.reservation.totalPrice || 0;
      const paid = this.reservation.advance || 0;
      this.remainingAmount = Math.max(0, total - paid);
      if (this.remainingAmount > 0) this.form.patchValue({ amount: this.remainingAmount });
    }
    this.form.get('type')?.valueChanges.subscribe(val => {
      const checkNumberControl = this.form.get('checkNumber');
      const checkDateControl = this.form.get('checkDate');
      if (val === 'CHEQUE') {
        checkNumberControl?.setValidators([Validators.required]);
        checkDateControl?.setValidators([Validators.required]);
      } else {
        checkNumberControl?.clearValidators();
        checkDateControl?.clearValidators();
      }
      checkNumberControl?.updateValueAndValidity();
      checkDateControl?.updateValueAndValidity();
    });
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.isProcessing = true;
    const val = this.form.value;
    try {
      await addDoc(collection(this.firestore, 'payments'), {
        reservationId: this.reservation.id,
        clientId: this.reservation.clientId || null,
        amount: val.amount,
        type: val.type,
        date: val.date,
        checkNumber: val.checkNumber || null,
        checkDate: val.checkDate || null,
        notes: val.notes || '',
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(this.firestore, 'reservations', this.reservation.id), { advance: increment(val.amount) });
      this.ui.showToast('success', 'Paiement enregistré avec succès');
      try {
        const newTotal = (this.reservation.advance || 0) + val.amount;
        const receiptData = {
            contractNum: this.reservation.id?.substring(0, 8),
            clientName: this.reservation.clientName,
            phone: this.reservation.customerPhone,
            resDate: new Date(this.reservation.date).toLocaleDateString('fr-FR'),
            offerDescription: 'Paiement partiel/total',
            totalPrice: this.reservation.totalPrice,
            payments: [{ number: 'Nouveau', date: new Date().toLocaleDateString('fr-FR'), type: val.type, amount: val.amount, totalSoFar: newTotal }],
            remainingAmount: Math.max(0, (this.reservation.totalPrice || 0) - newTotal)
        };
        this.receiptService.generateReceipt(receiptData);
      } catch (err) { console.warn("Erreur génération PDF", err); }
      this.paymentSuccess.emit();
      this.close.emit();
    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur technique lors du paiement');
    } finally { this.isProcessing = false; }
  }

  onCancel() { this.close.emit(); }
}
