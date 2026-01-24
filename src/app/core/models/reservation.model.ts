import { Timestamp } from '@angular/fire/firestore';

export interface PartnerPayment {
  id?: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  date: any;
  method: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  reference?: string;
}

export interface ReservationServiceItem {
  name: string;
  price: number;
  cost?: number;
  partnerId?: string;
  partnerName?: string;
}

export interface Reservation {
  id?: string;
  
  // Client Info
  clientName: string;
  customerPhone: string;
  
  // Date & Status
  date: any;
  status: 'EN_ATTENTE' | 'CONFIRMEE' | 'TERMINEE' | 'ANNULEE' | 'CANCELLED' | 'CONFIRMED';
  
  // Services & Pack
  services: ReservationServiceItem[];
  packId?: string;       // AJOUTÉ : Lien vers le pack
  packName?: string;     // Optionnel : Nom du pack pour affichage direct
  assignedServerIds?: string[]; // IDs des partenaires assignés
  
  // Financier Client
  totalPrice: number;
  advance: number;
  clientPayments: { amount: number, date: any, method: string }[];
  
  // Financier Partenaire
  partnerPayments?: PartnerPayment[];

  notes?: string;
  createdAt: any;
}
