export type UserRole = 'super_admin' | 'admin' | 'server' | 'partenaire';

export interface UserProfile {
  uid: string;
  id?: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  nom?: string;
  role: UserRole;
  phone?: string;
  telephone?: string;
  specialite?: string;
  active?: boolean;
  teamId?: string; // Crucial pour le filtrage par équipe
  rates?: Record<string, number>;
  createdAt: Date | any;
}

export interface Team {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'salary' | 'rent' | 'purchase' | 'utilities' | 'other';
  date: any;
  createdBy: string;
}

export interface ReceiptPayment {
  number: string;
  dueDate: string;
  type: string;
  amount: string;
  total: string;
}

export interface ReceiptData {
  contractNum: string;
  resDate: string;
  clientName: string;
  phone: string;
  totalPrice: string;
  reservationDetails: string;
  remainingAmount: string;
  payments: ReceiptPayment[];
}
