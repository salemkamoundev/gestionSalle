export interface Reservation {
  id?: string;
  clientId: string;
  clientName?: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  
  assignedServerIds: string[]; // IDs des serveurs (Staff)
  assignedTeamId?: string;     // ID de l'équipe/prestataire externe
  
  notes?: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  totalPrice?: number;
  advance?: number;
  advanceOnly?: boolean; // Flag technique pour mise à jour partielle
}
