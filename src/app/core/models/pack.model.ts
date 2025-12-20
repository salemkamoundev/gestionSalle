export interface PackServiceItem {
  nom: string;
  prix: number;
}

export interface Pack {
  id?: string;
  nom: string;
  description?: string;
  active?: boolean;
  services?: PackServiceItem[];
  staffIds?: string[];
  teamIds?: string[];
  createdAt?: string;  // Ajouté pour corriger l'erreur TS
  price?: number;
}
