export interface Reservation {
  id?: string;
  date?: any; 
  status?: 'CONFIRMED' | 'CANCELLED' | 'PENDING';
  
  // Infos Client
  clientId?: string;
  clientName?: string;
  customerName?: string;
  
  // Détails
  services?: any[];
  selectedSlotId?: string;
  slotId?: string;
  assignedServerIds?: string[];
  startTime?: string;
  endTime?: string;
  
  // Finances (Correction des erreurs TS4111)
  totalPrice?: number;
  advance?: number;

  // Index signature pour tout le reste
  [key: string]: any;
}
