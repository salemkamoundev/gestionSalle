export interface Reservation {
  id?: string;
  date?: any; 
  status?: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  
  // Infos Client
  clientId?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string; // Ajouté pour corriger TS4111
  
  // Détails
  services?: any[];
  selectedSlotId?: string;
  slotId?: string;
  assignedServerIds?: string[];
  startTime?: string;
  endTime?: string;
  
  // Finances
  totalPrice?: number;
  advance?: number;
  advancePayment?: number; // Ajouté pour corriger TS4111

  // Index signature pour tout le reste
  [key: string]: any;
}
