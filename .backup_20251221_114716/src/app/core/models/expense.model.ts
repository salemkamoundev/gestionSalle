import { Timestamp } from '@angular/fire/firestore';

export type ExpenseCategory = 'SALAIRE' | 'ACHAT_PACK' | 'EQUIPEMENT' | 'FACTURE' | 'AUTRE';
export type BeneficiaryType = 'STAFF' | 'TEAM' | 'PACK' | 'NONE';

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  date: Date | Timestamp;
  category: ExpenseCategory;
  
  // Relations dynamiques
  beneficiaryType: BeneficiaryType;
  beneficiaryId?: string;   // ID du Staff, de l'Équipe ou du Pack
  beneficiaryName?: string; // Nom stocké pour affichage facile
  
  createdAt?: Date;
}
