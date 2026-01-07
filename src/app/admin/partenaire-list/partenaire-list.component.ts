import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { PdfService } from '../../core/services/pdf.service';

@Component({
  selector: 'app-partenaire-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partenaire-list.component.html',
  styleUrls: ['./partenaire-list.component.scss']
})
export class PartenaireListComponent implements OnInit {
  private firestore = inject(AngularFirestore);
  private pdfService = inject(PdfService); // Injection du service PDF
  
  searchTerm = signal<string>('');
  debugError = signal<string>(''); 

  partenaireList = toSignal(
    this.firestore.collection<any>('partenaire').valueChanges({ idField: 'id' }).pipe(
      catchError(err => {
        console.error("🔥 ERREUR FIRESTORE:", err);
        this.debugError.set(err.message || 'Erreur inconnue');
        return of([]); 
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

  // --- IMPRESSION PLANNING ---
  printPlanning(person: any) {
    if (!person || !person.id) return;

    // Récupérer les réservations où ce partenaire est assigné
    // Note: On filtre côté client si besoin pour éviter les index complexes, 
    // ou on utilise array-contains directement si possible.
    this.firestore.collection('reservations', ref => 
      ref.where('assignedServerIds', 'array-contains', person.id)
    ).valueChanges({ idField: 'id' })
    .pipe(take(1))
    .subscribe({
      next: (resas: any[]) => {
        // Filtrer les annulées
        const activeResas = resas.filter(r => r.status !== 'CANCELLED');
        this.pdfService.generateServerPlanning(person.nom || 'Partenaire', activeResas);
      },
      error: (err) => {
        console.error("Erreur chargement réservations partenaire", err);
        alert("Impossible de charger les réservations pour ce partenaire.");
      }
    });
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
  
  addPartenaire(n:string, r:string) {} 
}
