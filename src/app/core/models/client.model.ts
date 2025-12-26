export interface Client {
  id?: string;
  nom: string;
  prenom: string;
  
  // Contacts
  telephone: string;
  telephone2?: string;  // Nouveau champ
  email?: string;
  
  // Adresse & Infos
  adresse?: string;
  ville?: string;
  cin?: string;
  
  // Champs nécessaires pour éviter les erreurs TS2353 dans generateMockClients
  dateCin?: string;
  prenomMarie1?: string;
  prenomMarie2?: string;
  
  notes?: string;
  createdAt?: any;
}
