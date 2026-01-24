export interface ServiceCatalog {
  id?: string;
  nom: string;
  description?: string;
  prix?: number;     // prix par défaut (optionnel)
  active?: boolean;  // pour masquer sans supprimer
  partnerId?: string | null; // Lien vers le partenaire par défaut
  createdAt?: string;
}
