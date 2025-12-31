export interface ServerPartenaire {
  id?: string;
  nom: string;
  email: string;
  telephone?: string;
  specialite?: string; // Ex: Serveur, Barman, Sécurité
  role?: 'ADMIN' | 'SERVER';
  active?: boolean;
  createdAt?: string;
  
  // Liste des IDs de services que ce partenaire peut effectuer
  serviceIds?: string[];
}
