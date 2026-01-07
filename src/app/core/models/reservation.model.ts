import { Timestamp } from '@angular/fire/firestore';

export interface PartnerPayment {
  id?: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  date: any; // 'any' pour accepter Date ou Timestamp sans erreur TS stricte
  method: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  reference?: string;
}

export interface ReservationService {
  name: string;
  price: number;
  cost?: number;       // Coût partenaire
  partnerId?: string;
  partnerName?: string;
}

export interface Reservation {
  id?: string;
  
  // Champs Client (Noms legacy restaurés pour compatibilité)
  clientName: string;
  customerPhone: string; // Était 'clientPhone' dans le script précédent, remis à 'customerPhone'
  
  date: any; // 'any' temporaire pour éviter les conflits Date vs Timestamp dans les autres fichiers
  status: 'EN_ATTENTE' | 'CONFIRMEE' | 'TERMINEE' | 'ANNULEE';
  
  services: ReservationService[];
  
  // Financier Client (Noms legacy restaurés)
  totalPrice: number;     // Était 'totalAmount', remis à 'totalPrice'
  advance: number;        // Était 'advancePayment', remis à 'advance'
  
  clientPayments: { amount: number, date: any, method: string }[];
  
  // Financier Partenaire (Nouveau)
  partnerPayments?: PartnerPayment[];

  notes?: string;
  createdAt: any;
}
