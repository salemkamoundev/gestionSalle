export interface ServiceCatalog {
  id?: string;
  nom: string;
  description?: string;
  prix?: number;     // prix par défaut (optionnel)
  active?: boolean;  // pour masquer sans supprimer
  createdAt?: string;
}