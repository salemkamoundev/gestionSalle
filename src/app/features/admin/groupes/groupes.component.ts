import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';

interface Serveur { id: number; nom: string; }
interface Groupe { id: number; nom: string; serveurIds: number[]; services: string[]; }

@Component({
  selector: 'app-groupes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './groupes.component.html'
})
export class GroupesComponent {
  groupes: Groupe[] = [
    { id: 1, nom: 'Équipe Matin', serveurIds: [1, 2], services: ['Nettoyage', 'Mise en place'] }
  ];
  
  // Mock des serveurs et services disponibles
  serveursDisponibles: Serveur[] = [
    { id: 1, nom: 'Ahmed' }, { id: 2, nom: 'Sarah' }, { id: 3, nom: 'Karim' }, { id: 4, nom: 'Leila' }
  ];
  servicesDisponibles = ['Service Salle', 'Service Bar', 'Accueil', 'Nettoyage'];

  showModal = false;
  isEditing = false;
  groupeForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.groupeForm = this.fb.group({
      id: [null],
      nom: ['', Validators.required],
      serveurIds: [[], Validators.required], // Multi-select
      services: [[], Validators.required]    // Multi-select
    });
  }

  openNew() {
    this.isEditing = false;
    this.groupeForm.reset({ serveurIds: [], services: [] });
    this.showModal = true;
  }

  openEdit(g: Groupe) {
    this.isEditing = true;
    this.groupeForm.patchValue(g);
    this.showModal = true;
  }

  saveGroupe() {
    if (this.groupeForm.invalid) return;
    
    const val = this.groupeForm.value;
    if (this.isEditing) {
      // Update logic
      const index = this.groupes.findIndex(g => g.id === val.id);
      if (index !== -1) this.groupes[index] = val;
    } else {
      // Create logic
      val.id = Date.now(); // Fake ID
      this.groupes.push(val);
    }
    this.showModal = false;
  }

  deleteGroupe(id: number) {
    if(confirm('Supprimer ce groupe ?')) {
      this.groupes = this.groupes.filter(g => g.id !== id);
    }
  }

  // Helpers pour les Checkboxes
  onCheckChange(event: any, type: 'serveur' | 'service') {
    const formArray: any[] = type === 'serveur' 
      ? this.groupeForm.get('serveurIds')?.value || [] 
      : this.groupeForm.get('services')?.value || [];
    
    const value = type === 'serveur' ? +event.target.value : event.target.value;

    if (event.target.checked) {
      formArray.push(value);
    } else {
      const index = formArray.indexOf(value);
      if (index > -1) formArray.splice(index, 1);
    }
    
    if (type === 'serveur') this.groupeForm.patchValue({ serveurIds: formArray });
    else this.groupeForm.patchValue({ services: formArray });
  }

  isChecked(value: any, type: 'serveur' | 'service'): boolean {
    const currentList = type === 'serveur' 
      ? this.groupeForm.get('serveurIds')?.value || [] 
      : this.groupeForm.get('services')?.value || [];
    return currentList.includes(value);
  }
  
  getServeurNames(ids: number[]): string {
    return ids.map(id => this.serveursDisponibles.find(s => s.id === id)?.nom).join(', ');
  }
}
