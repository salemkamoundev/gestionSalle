import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';

// Modèles simples
interface StaffMember { id: number; nom: string; role: string; }
interface Equipe { id: number; nom: string; color: string; membresIds: number[]; }

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './equipes.component.html'
})
export class EquipesComponent {
  // Données Mock (Simulation Base de données)
  staffList: StaffMember[] = [
    { id: 1, nom: 'Ahmed Ben Ali', role: 'Serveur' },
    { id: 2, nom: 'Sarah K.', role: 'Cuisinier' },
    { id: 3, nom: 'Karim T.', role: 'Serveur' },
    { id: 4, nom: 'Leila J.', role: 'Manager' },
    { id: 5, nom: 'Moez B.', role: 'Sécurité' }
  ];

  equipes: Equipe[] = [
    { id: 1, nom: 'Équipe du Matin', color: 'bg-blue-100 text-blue-800', membresIds: [1, 3] },
    { id: 2, nom: 'Équipe Soirée', color: 'bg-purple-100 text-purple-800', membresIds: [2, 4, 5] }
  ];

  colors = [
    { label: 'Bleu', class: 'bg-blue-100 text-blue-800' },
    { label: 'Vert', class: 'bg-emerald-100 text-emerald-800' },
    { label: 'Violet', class: 'bg-purple-100 text-purple-800' },
    { label: 'Orange', class: 'bg-orange-100 text-orange-800' }
  ];

  showModal = false;
  isEditing = false;
  equipeForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.equipeForm = this.fb.group({
      id: [null],
      nom: ['', Validators.required],
      color: [this.colors[0].class],
      membresIds: [[], Validators.required]
    });
  }

  // --- ACTIONS ---

  openNew() {
    this.isEditing = false;
    this.equipeForm.reset({ color: this.colors[0].class, membresIds: [] });
    this.showModal = true;
  }

  openEdit(e: Equipe) {
    this.isEditing = true;
    this.equipeForm.patchValue(e);
    this.showModal = true;
  }

  saveEquipe() {
    if (this.equipeForm.invalid) return;

    const val = this.equipeForm.value;
    
    if (this.isEditing) {
      const index = this.equipes.findIndex(e => e.id === val.id);
      if (index !== -1) this.equipes[index] = val;
    } else {
      val.id = Date.now();
      this.equipes.push(val);
    }
    this.showModal = false;
  }

  deleteEquipe(id: number) {
    if(confirm('Voulez-vous vraiment supprimer cette équipe ?')) {
      this.equipes = this.equipes.filter(e => e.id !== id);
    }
  }

  // --- HELPERS ---

  toggleMember(id: number) {
    const current = this.equipeForm.get('membresIds')?.value || [];
    const index = current.indexOf(id);

    if (index > -1) {
      current.splice(index, 1); // Retirer
    } else {
      current.push(id); // Ajouter
    }
    this.equipeForm.patchValue({ membresIds: current });
  }

  isMemberSelected(id: number): boolean {
    return (this.equipeForm.get('membresIds')?.value || []).includes(id);
  }

  getMemberName(id: number) {
    return this.staffList.find(s => s.id === id)?.nom || 'Inconnu';
  }
}
