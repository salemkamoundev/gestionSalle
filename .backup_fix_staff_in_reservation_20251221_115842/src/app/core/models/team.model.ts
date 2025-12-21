export interface TeamMember {
  nom: string;
  role: string; // Ex: Chanteur, Batteur, Chef cuisinier
}

export interface TeamServiceItem {
  nom: string;        // Ex: "Pack Mariage Standard"
  description: string;
  prix: number;
}

export interface Team {
  id?: string;
  nom: string;
  type: 'ORCHESTRE' | 'TRAITEUR' | 'PHOTOGRAPHE' | 'TROUPE' | 'AUTRE';
  chefEquipe?: string;
  telephone: string;
  
  // NOUVEAUX CHAMPS
  members?: TeamMember[];
  services?: TeamServiceItem[];
  
  active: boolean;
  createdAt?: string;
}
