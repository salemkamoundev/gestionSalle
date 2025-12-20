import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Expense } from '../models/expense.model';
import { Pack } from '../models/pack.model'; // Assurez-vous que pack.model existe

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private expensesSignal = signal<Expense[]>([]);

  constructor() {
    // Données de test
    this.expensesSignal.set([
      {
        id: 'exp_1', reservationId: 'res_1', beneficiaryName: 'Test Traiteur', 
        amount: 1000, type: 'PRESTATAIRE', status: 'A_PAYER', date: new Date().toISOString()
      }
    ]);
  }

  getByReservationId(reservationId: string): Observable<Expense[]> {
    return of(this.expensesSignal().filter(e => e.reservationId === reservationId));
  }

  add(expense: Expense): void {
    this.expensesSignal.update(list => [...list, expense]);
  }

  toggleStatus(id: string): void {
    this.expensesSignal.update(list => list.map(e => {
      if (e.id === id) return { ...e, status: e.status === 'PAYE' ? 'A_PAYER' : 'PAYE' };
      return e;
    }));
  }

  generateExpensesFromPack(pack: any, reservationId: string): void {
    if (!pack || !pack.services) return;
    
    // Conversion sécurisée en tableau d'Expenses
    const newExpenses: Expense[] = pack.services.map((svc: any, index: number) => ({
      id: `auto_${Date.now()}_${index}`,
      reservationId: reservationId,
      beneficiaryName: svc.nom || 'Service Pack',
      amount: Number(svc.prix) || 0,
      type: 'PACK_ITEM',
      status: 'A_PAYER',
      date: new Date().toISOString(),
      note: `Pack: ${pack.nom}`
    }));

    this.expensesSignal.update(list => [...list, ...newExpenses]);
    console.log('Dépenses générées:', newExpenses.length);
  }
}
