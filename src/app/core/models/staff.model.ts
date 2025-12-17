export interface ServerStaff {
  id?: string;
  nom: string;
  email: string;
  telephone?: string;
  specialite?: string; // Ex: Serveur, Barman, Sécurité
  role?: 'ADMIN' | 'SERVER';
  active?: boolean;
  createdAt?: string;
  
  // NOUVEAU : Grille tarifaire
  // Clé = ID du créneau (ex: 'slot_123'), Valeur = Prix en TND (ex: 80)
  rates?: Record<string, number>;
}
