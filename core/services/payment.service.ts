import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Payment } from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(private firestore: FirestoreCrudService) {}

  processPayment(payment: Payment) {
    return this.firestore.add('payments', payment);
  }
}
