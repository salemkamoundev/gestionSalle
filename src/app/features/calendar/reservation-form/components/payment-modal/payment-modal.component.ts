import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Firestore, doc, updateDoc, increment, collection, addDoc } from '@angular/fire/firestore';

// Imports (5 niveaux)
import { ReceiptService } from '../../../../../core/services/receipt.service';
import { UiService } from '../../../../../core/services/ui.service';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-modal.component.html'
})
export class PaymentModalComponent implements OnInit {
  // Inputs/Outputs requis par le template ou le parent
  @Input() reservation: any; 
  @Output() close = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private receiptService = inject(ReceiptService);
  private ui = inject(UiService);

  form: FormGroup;
  
  // Propriétés requises par le template HTML
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
      
      // Pré-remplir avec le reste à payer
      if (this.remainingAmount > 0) {
        this.form.patchValue({ amount: this.remainingAmount });
      }
    }

    // Gestion validation chèque
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

  // Méthode appelée par le template (ngSubmit)="onSubmit()"
  async onSubmit() {
    if (this.form.invalid) return;
    this.isProcessing = true;
    
    const val = this.form.value;

    try {
      // 1. Enregistrer le paiement
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

      // 2. Mettre à jour la réservation
      const updates: any = {
        advance: increment(val.amount)
      };

      await updateDoc(doc(this.firestore, 'reservations', this.reservation.id), updates);

      this.ui.showToast('success', 'Paiement enregistré avec succès');
      
      // 3. Générer le reçu PDF (avec ReceiptService)
      try {
        const paymentObj = { ...val, reservationId: this.reservation.id };
        
        // Construction des données pour le reçu
        const receiptData = {
            contractNum: this.reservation.id?.substring(0, 8),
            clientName: this.reservation.clientName,
            totalPrice: this.reservation.totalPrice,
            payments: [{...paymentObj, totalSoFar: (this.reservation.advance || 0) + val.amount}],
            remainingAmount: Math.max(0, (this.reservation.totalPrice || 0) - ((this.reservation.advance || 0) + val.amount))
        };
        
        this.receiptService.generateReceipt(receiptData);
        
      } catch (pdfErr) {
        console.warn("Erreur génération PDF", pdfErr);
      }

      this.paymentSuccess.emit();
      this.close.emit(); // Fermer la modale après succès

    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur technique lors du paiement');
    } finally {
      this.isProcessing = false;
    }
  }

  // Méthode appelée par le template (click)="onCancel()"
  onCancel() {
    this.close.emit();
  }
}
