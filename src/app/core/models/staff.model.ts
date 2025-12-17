export interface ServerStaff {
  id?: string;
  nom: string;
  email: string;
  role: 'ADMIN' | 'SERVER';
  specialite?: 'Salle' | 'Bar' | 'Cuisine';
  telephone?: string;
  active: boolean;
}
