import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-partenaire-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partenaire-list.component.html',
  styleUrls: ['./partenaire-list.component.scss']
})
export class PartenaireListComponent implements OnInit {
  private firestore = inject(AngularFirestore);
  
  searchTerm = signal<string>('');
  debugError = signal<string>(''); // Signal pour afficher l'erreur

  // Récupération avec capture d'erreur
  partenaireList = toSignal(
    this.firestore.collection<any>('partenaire').valueChanges({ idField: 'id' }).pipe(
      catchError(err => {
        console.error("🔥 ERREUR FIRESTORE:", err);
        // On met à jour le signal d'erreur pour l'afficher dans le HTML
        this.debugError.set(err.message || 'Erreur inconnue');
        return of([]); // Retourne une liste vide pour ne pas planter
      })
    ), 
    { initialValue: [] }
  );

  filteredPartenaire = computed(() => {
    const rawTerm = this.searchTerm();
    const term = String(rawTerm || '').toLowerCase().trim();
    const list = this.partenaireList();

    if (!list) return [];

    return list.filter((person: any) => {
      if (!person) return false;
      const nom = String(person.nom ?? '').toLowerCase();
      const role = String(person.role ?? '').toLowerCase();
      return nom.includes(term) || role.includes(term);
    });
  });

  ngOnInit() {
    // Test de connexion direct au démarrage
    this.firestore.collection('partenaire').get().subscribe({
      next: (snaps) => console.log(`✅ Connexion OK ! ${snaps.size} documents trouvés.`),
      error: (e) => {
        console.error("❌ ECHEC CONNEXION:", e);
        this.debugError.set("Bloqué par Firestore : " + e.code);
      }
    });
  }

  // --- ACTIONS ---
  async deletePartenaire(id: string) {
    if (confirm('Supprimer ?')) await this.firestore.collection('partenaire').doc(id).delete();
  }
  
  // --- SEED ---
  async seedDatabase() {
    if(!confirm("Ajouter 5 membres fictifs ?")) return;
    const batch = this.firestore.firestore.batch();
    const dummyData = [
      { nom: 'Sarah Ben Ali', role: 'Manager' },
      { nom: 'Mohamed Tounsi', role: 'Cuisinier' }
    ];
    dummyData.forEach(d => {
      const id = this.firestore.createId();
      const ref = this.firestore.collection('partenaire').doc(id).ref;
      batch.set(ref, { ...d, status: 'actif', createdAt: new Date().toISOString() });
    });
    await batch.commit().catch(e => alert("Erreur Seed: " + e.message));
    alert("✅ Données envoyées !");
  }

  openModal() { const m = document.getElementById('addDialog') as HTMLDialogElement; if(m) m.showModal(); }
  closeModal() { const m = document.getElementById('addDialog') as HTMLDialogElement; if(m) m.close(); }
  
  // Fonction bidon pour addPartenaire (pour éviter erreurs de compil template)
  addPartenaire(n:string, r:string) {} 
}
