import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, updateDoc, doc, collectionData, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Expense } from '../models/expense.model';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private firestore = inject(Firestore);
  private collectionName = 'expenses';

  constructor() {}

  // CREATE
  async addExpense(expense: Expense): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    const safeDate = expense.date instanceof Date ? expense.date : new Date(expense.date as any);
    
    await addDoc(colRef, {
      ...expense,
      date: Timestamp.fromDate(safeDate),
      createdAt: Timestamp.now()
    });
  }

  // READ
  getExpenses(): Observable<Expense[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Expense[]>;
  }

  // UPDATE (Nouveau)
  async updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const dataToUpdate = { ...expense };
    
    // Conversion de date si nécessaire
    if (dataToUpdate.date && dataToUpdate.date instanceof Date) {
      dataToUpdate.date = Timestamp.fromDate(dataToUpdate.date);
    }

    await updateDoc(docRef, dataToUpdate);
  }

  // DELETE
  async deleteExpense(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }

  // Helper pour éviter les erreurs de compilation si appelé ailleurs
  async generateExpensesFromPack(pack: any, reservationId: string): Promise<void> {
    if (!pack) return;
    const expense: Expense = {
      description: `Pack: ${pack.name || pack.nom || 'Pack'}`,
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
