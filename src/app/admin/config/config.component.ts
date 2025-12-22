import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './config.component.html',
  styles: []
})
export class ConfigComponent {
  private firestore = inject(AngularFirestore);

  // Observables pour voir les données en temps réel
  eventTypes$: Observable<any[]>;
  options$: Observable<any[]>;

  constructor() {
    this.eventTypes$ = this.firestore.collection('config_event_types').valueChanges({ idField: 'id' });
    this.options$ = this.firestore.collection('config_options').valueChanges({ idField: 'id' });
  }

  // --- FONCTION D'INJECTION DES DONNÉES ---
  async seedConfiguration() {
    if (!confirm("⚠️ Attention : Cela va écraser/ajouter des configurations par défaut. Continuer ?")) return;

    const batch = this.firestore.firestore.batch();

    // 1. Types d'événements (Packages)
    const events = [
      { label: 'Mariage Royal', price: 5000, description: 'Salle complète + Suite mariés' },
      { label: 'Fiançailles', price: 2500, description: 'Après-midi uniquement' },
      { label: 'Outia / Henné', price: 3000, description: 'Soirée traditionnelle' },
      { label: 'Conférence', price: 1500, description: 'Matinée + Projecteur' },
      { label: 'Anniversaire', price: 1200, description: 'Espace réduit' }
    ];

    events.forEach(evt => {
      const id = this.firestore.createId();
      const ref = this.firestore.collection('config_event_types').doc(id).ref;
      batch.set(ref, { ...evt, active: true });
    });

    // 2. Options (Extras)
    const options = [
      { label: 'Photographe & Caméra', price: 800, unit: 'Forfait' },
      { label: 'Troupe Musicale (3h)', price: 1200, unit: 'Forfait' },
      { label: 'Décoration Florale', price: 400, unit: 'Forfait' },
      { label: 'Jus & Pâtisseries', price: 5, unit: 'Par personne' },
      { label: 'Climatisation Extra', price: 200, unit: 'Heure' }
    ];

    options.forEach(opt => {
      const id = this.firestore.createId();
      const ref = this.firestore.collection('config_options').doc(id).ref;
      batch.set(ref, { ...opt, active: true });
    });

    try {
      await batch.commit();
      alert("✅ Configuration initialisée avec succès !");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement.");
    }
  }

  // Suppression pour nettoyer si besoin
  async deleteItem(collection: string, id: string) {
    if(confirm('Supprimer cet élément ?')) {
      await this.firestore.collection(collection).doc(id).delete();
    }
  }
}
