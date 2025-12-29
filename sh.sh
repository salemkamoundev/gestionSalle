#!/bin/bash

echo "🚀 Correction des méthodes manquantes (ReservationService & PaymentModal)..."

# 1. Correction RESERVATION SERVICE (Restaurer getReservations + Typage any)
# --------------------------------------------------------------------------
echo "🔧 Correction src/app/core/services/reservation.service.ts..."
cat << 'EOF' > src/app/core/services/reservation.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);

  constructor() {}

  // Méthode principale observable
  getAll(): Observable<any[]> {
    return new Observable(observer => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'asc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(r => r.status !== 'CANCELLED');
        observer.next(list);
      });
      return () => unsubscribe();
    });
  }

  // ALIAS CRITIQUE POUR LA COMPATIBILITÉ (Manquait précédemment)
  getReservations(): Observable<any[]> {
    return this.getAll();
  }

  getById(id: string): Observable<Reservation> {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
  }

  addReservation(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
  }

  updateReservation(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  }

  async cancelReservation(id: string): Promise<void> {
    if (!id) return;
    await this.updateReservation(id, { status: 'CANCELLED' });
  }

  deleteReservation(id: string) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return deleteDoc(docRef);
  }
}
EOF

# 2. Correction PAYMENT MODAL (Alignement TS <-> HTML)
# ----------------------------------------------------
# Le template HTML appelle des propriétés (onCancel, isProcessing, remainingAmount, reservation, onSubmit)
# qui doivent exister dans la classe TS.

echo "🔧 Correction calendar/.../payment-modal.component.ts..."
cat << 'EOF' > src/app/features/calendar/reservation-form/components/payment-modal/payment-modal.component.ts
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
EOF

echo "✅ Méthodes manquantes restaurées. Le build devrait passer."