export interface Client {
  id?: string;
  nom: string;        // Nom de famille
  prenom: string;     // Prénom
  
  cin?: string;       // Numéro CIN
  dateCin?: string;   // Date de délivrance
  
  prenomMarie1?: string; // Prénom du 1er marié(e)
  prenomMarie2?: string; // Prénom du 2ème marié(e)
  
  telephone: string;
  email?: string;
  adresse?: string;
  
  createdAt?: string;
}
