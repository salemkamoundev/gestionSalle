export interface Reservation {
  id?: string;
  clientId: string;
  clientName?: string; // Pour l'affichage (dénormalisation légère ou join)
  date: string; // Format YYYY-MM-DD
  startTime: string; // Format HH:mm
  endTime: string; // Format HH:mm
  assignedServerIds: string[]; // Tableau d'IDs des serveurs
  notes?: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}
