export interface Payment {
  id?: string;
  reservationId: string; // Lien avec la réservation
  
  type: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  amount: number;
  
  date: string;          // Date du règlement
  checkDate?: string;    // Date d'échéance (si chèque)
  checkNumber?: string;  // Numéro de chèque
  receiptNumber?: string; // Numéro de reçu
  
  createdAt?: string;
  createdBy?: string;
}
