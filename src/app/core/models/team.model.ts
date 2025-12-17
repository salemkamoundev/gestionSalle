export interface Team {
  id?: string;
  nom: string;          // Ex: Troupe El Manar, Traiteur Ben Ali
  type: 'ORCHESTRE' | 'TRAITEUR' | 'PHOTOGRAPHE' | 'TROUPE' | 'AUTRE';
  chefEquipe?: string;  // Nom du responsable
  telephone: string;
  prixReference?: number; // Prix standard de la prestation (optionnel)
  active: boolean;
  createdAt?: string;
}
