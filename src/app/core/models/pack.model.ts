export interface PackServiceItem {
  id?: string;
  nom?: string;
  name?: string;     
  prix?: number;
  price?: number;
  icon?: string;
  [key: string]: any;
}

export interface Pack {
  id?: string;
  
  // Champs standards
  nom?: string;
  name?: string;
  description?: string;
  active?: boolean;
  
  // Relations
  services?: PackServiceItem[];
  staffIds?: string[];
  teamIds?: string[];
  
  // Meta
  createdAt?: any;
  
  // Financier
  price?: number;
  prix?: number;

  [key: string]: any;
}
