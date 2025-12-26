#!/bin/bash

# fix_expense_service.sh
# Corrige ExpenseService pour supprimer les références aux anciens champs (category, beneficiary...)

cat > src/app/core/services/expense.service.ts << 'EOF'
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

  // UPDATE
  async updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const dataToUpdate = { ...expense };
    
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

  // Helper corrigé (compatible avec le modèle simplifié)
  async generateExpensesFromPack(pack: any, reservationId: string): Promise<void> {
    if (!pack) return;
    const expense: Expense = {
      description: `Pack: ${pack.name || pack.nom || 'Pack'}`,
      amount: pack.price || pack.prix || 0,
      date: new Date()
    };
    await this.addExpense(expense);
  }
}
EOF