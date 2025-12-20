import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, collectionData, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { Expense } from '../models/expense.model';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private firestore = inject(Firestore);
  private collectionName = 'expenses';

  constructor() {}

  async addExpense(expense: Expense): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    // Conversion sécurisée de la date
    const safeDate = expense.date instanceof Date ? expense.date : new Date(expense.date as any);
    
    await addDoc(colRef, {
      ...expense,
      date: Timestamp.fromDate(safeDate),
      createdAt: Timestamp.now()
    });
  }

  getExpenses(): Observable<Expense[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Expense[]>;
  }

  async deleteExpense(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }

  // MÉTHODE MANQUANTE AJOUTÉE POUR CORRIGER L'ERREUR DU RESERVATION-FORM
  async generateExpensesFromPack(pack: any, reservationId: string): Promise<void> {
    console.log('Génération des dépenses pour le pack:', pack, 'Reservation:', reservationId);
    // Logique à implémenter plus tard selon tes besoins
    // Pour l'instant, ça évite juste l'erreur de compilation
    if (!pack) return;
    
    const expense: Expense = {
      description: `Pack: ${pack.name || pack.nom || 'Pack'} (Réservation)`,
      amount: pack.price || pack.prix || 0,
      date: new Date(),
      category: 'ACHAT_PACK',
      beneficiaryType: 'PACK',
      beneficiaryId: pack.id,
      beneficiaryName: pack.name || pack.nom,
    };
    await this.addExpense(expense);
  }
}
