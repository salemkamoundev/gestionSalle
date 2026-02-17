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
  
  packId?: string;       
  packName?: string;     
  
  // --- CHAMPS NOTIFICATIONS ---
  packs?: { id: string, nom: string, price?: number }[]; 
  assignedServerIds?: string[]; 
  
  // Champ technique pour signaler une suppression au bot
  uidsToRemove?: string[]; 

  // Champs internes bots
  notifiedPackIds?: string[]; 
  staffNotifiedUids?: string[];
  cancellationNotified?: boolean;
  staffNotificationSentAt?: any;
  // -----------------------------
  
  totalPrice: number;
  advance: number;
  clientPayments: { amount: number, date: any, method: string }[];
  partnerPayments?: PartnerPayment[];

  notes?: string;
  brideName?: string;
  groomName?: string;
  createdAt: any;
}
