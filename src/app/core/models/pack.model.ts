export interface Pack {
  id?: string;
  nom: string;
  name?: string; // Alias pour nom
  description?: string;
  price: number;
  prix?: number; // Alias pour price
  active: boolean;
  services: PackServiceItem[];
  partenaireIds?: string[]; // IDs des partenaires impliqués (redondant mais utile pour requêtes)
  teamIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PackServiceItem {
  id: string;
  nom: string;
  name?: string;
  prix: number;
  price?: number;
  icon?: string;
  // Nouveaux champs pour le partenaire lié au service
  partenaireId?: string;
  partenaireName?: string;
}
