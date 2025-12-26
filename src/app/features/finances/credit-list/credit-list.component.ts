import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, where, getDocs, deleteDoc, doc } from '@angular/fire/firestore';
import { UiService } from '../../../core/services/ui.service';
import { ClientService } from '../../../core/services/client.service';

@Component({
  selector: 'app-credit-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credit-list.component.html',
  styles: []
})
export class CreditListComponent implements OnInit {
  private firestore = inject(Firestore);
  private ui = inject(UiService);
  private clientService = inject(ClientService);

  credits = signal<any[]>([]);
  loading = signal(true);
  clientsMap = new Map<string, any>();

  async ngOnInit() {
    await this.loadClients();
    await this.loadCredits();
  }

  async loadClients() {
    try {
      this.clientService.getAll().subscribe(clients => {
        clients.forEach(c => this.clientsMap.set(c.id!, c));
      });
    } catch (e) { console.error(e); }
  }

  async loadCredits() {
    this.loading.set(true);
    try {
      // Récupère uniquement les avoirs 'AVAILABLE'
      const q = query(collection(this.firestore, 'provisional_receipts'), where('status', '==', 'AVAILABLE'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Tri par date décroissante
      data.sort((a: any, b: any) => {
         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
         return dateB.getTime() - dateA.getTime();
      });

      this.credits.set(data);
    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur chargement avoirs');
    }
    this.loading.set(false);
  }

  getClientName(id: string): string {
    const c = this.clientsMap.get(id);
    return c ? `${c.nom} ${c.prenom}` : 'Client inconnu';
  }

  getDate(dateField: any): Date {
    if (!dateField) return new Date();
    if (dateField.toDate) return dateField.toDate();
    return new Date(dateField);
  }

  async deleteCredit(credit: any) {
    if (!await this.ui.confirm('Supprimer cet avoir ?', 'Action irréversible.')) return;
    
    try {
      await deleteDoc(doc(this.firestore, 'provisional_receipts', credit.id));
      this.ui.showToast('success', 'Avoir supprimé');
      await this.loadCredits();
    } catch (e) {
      this.ui.showToast('error', 'Erreur suppression');
    }
  }
}
