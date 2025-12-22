import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-list.component.html',
  styleUrls: ['./staff-list.component.scss']
})
export class StaffListComponent implements OnInit {
  private firestore = inject(AngularFirestore);
  
  searchTerm = signal<string>('');
  debugError = signal<string>(''); // Signal pour afficher l'erreur

  // Récupération avec capture d'erreur
  staffList = toSignal(
    this.firestore.collection<any>('staff').valueChanges({ idField: 'id' }).pipe(
      catchError(err => {
        console.error("🔥 ERREUR FIRESTORE:", err);
        // On met à jour le signal d'erreur pour l'afficher dans le HTML
        this.debugError.set(err.message || 'Erreur inconnue');
        return of([]); // Retourne une liste vide pour ne pas planter
      })
    ), 
    { initialValue: [] }
  );

  filteredStaff = computed(() => {
    const rawTerm = this.searchTerm();
    const term = String(rawTerm || '').toLowerCase().trim();
    const list = this.staffList();

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
    this.firestore.collection('staff').get().subscribe({
      next: (snaps) => console.log(`✅ Connexion OK ! ${snaps.size} documents trouvés.`),
      error: (e) => {
        console.error("❌ ECHEC CONNEXION:", e);
        this.debugError.set("Bloqué par Firestore : " + e.code);
      }
    });
  }

  // --- ACTIONS ---
  async deleteStaff(id: string) {
    if (confirm('Supprimer ?')) await this.firestore.collection('staff').doc(id).delete();
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
      const ref = this.firestore.collection('staff').doc(id).ref;
      batch.set(ref, { ...d, status: 'actif', createdAt: new Date().toISOString() });
    });
    await batch.commit().catch(e => alert("Erreur Seed: " + e.message));
    alert("✅ Données envoyées !");
  }

  openModal() { const m = document.getElementById('addDialog') as HTMLDialogElement; if(m) m.showModal(); }
  closeModal() { const m = document.getElementById('addDialog') as HTMLDialogElement; if(m) m.close(); }
  
  // Fonction bidon pour addStaff (pour éviter erreurs de compil template)
  addStaff(n:string, r:string) {} 
}
