export interface ActivityLog {
  id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT';
  entity: 'RESERVATION' | 'CLIENT' | 'PARTENAIRE' | 'CONFIG';
  description: string;
  userEmail: string;
  timestamp: string; // ISO String
  metadata?: any;    // ID de l'objet concerné, montant, etc.
}
