export interface Payment {
  id?: string;
  reservationId: string;
  
  // Direction du paiement
  direction?: 'INCOME' | 'EXPENSE'; // INCOME = Client paie, EXPENSE = On paie un service
  
  // Champs pour le règlement d'un SERVICE
  partnerId?: string;     // Optionnel (si le service est fait par un partenaire)
  serviceId?: string;     // L'ID ou le Nom du service payé
  origin?: 'PACK' | 'PARTNER_SKILL'; // Source du service
  
  // Champs Communs
  type: 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'BON' | 'CASH';
  amount: number;
  date: string;
  
  // Détails chèques/reçus
  checkDate?: string;    
  checkNumber?: string;  
  receiptNumber?: string; 
  notes?: string;
  
  // Meta
  createdAt?: string;
  createdBy?: string;
  
  // Champs optionnels d'affichage (non stockés)
  serviceName?: string;
  partnerName?: string;
}
