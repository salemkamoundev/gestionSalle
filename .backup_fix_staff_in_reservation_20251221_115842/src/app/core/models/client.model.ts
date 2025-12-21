export interface Client {
  id?: string;
  // Champs Français (Principaux)
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  cin?: string;
  societe?: string;
  notes?: string;
  dateCin?: Date | any;
  
  // Champs Mariage
  prenomMarie1?: string;
  prenomMarie2?: string;

  // Alias Anglais (Pour compatibilité Template)
  firstName?: string;
  lastName?: string;
  phone?: string;
  tel?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  cp?: string;
  cinNumber?: string;
  company?: string;
  note?: string;
  
  createdAt?: any;
}
