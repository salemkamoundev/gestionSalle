import { Timestamp } from '@angular/fire/firestore';

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  date: Date | Timestamp;
  createdAt?: Date;
}
