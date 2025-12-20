export type ExpenseType = 'PRESTATAIRE' | 'STAFF' | 'PACK_ITEM' | 'AUTRE';
export type ExpenseStatus = 'A_PAYER' | 'PAYE';

export interface Expense {
  id: string;
  reservationId: string;
  beneficiaryName: string;
  staffId?: string;
  amount: number;
  type: ExpenseType;
  status: ExpenseStatus;
  date: string;
  note?: string;
}
