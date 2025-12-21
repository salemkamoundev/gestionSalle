export interface Reservation {
  id?: string;
  clientId: string;
  clientName?: string;
  date: string;
  startTime: string;
  endTime: string;
  
  assignedServerIds?: string[]; // Staff interne
  assignedTeamIds?: string[];   // Équipes externes (Multiple)
  
  selectedSlotId?: string;
  
  notes?: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  totalPrice?: number;
  advance?: number;
  advanceOnly?: boolean;
  createdAt?: string;
}
