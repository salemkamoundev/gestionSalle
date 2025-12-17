import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, writeBatch, doc, addDoc } from '@angular/fire/firestore';
import { UiService } from './ui.service';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private firestore = inject(Firestore);
  private ui = inject(UiService);

  // Listes de données fictives
  private firstNames = ['Mohamed', 'Ahmed', 'Sami', 'Walid', 'Karim', 'Youssef', 'Amine', 'Bilel', 'Ali', 'Omar', 'Mariem', 'Fatma', 'Sarra', 'Imen', 'Nour', 'Rym', 'Hela', 'Salma'];
  private lastNames = ['Ben Ali', 'Trabelsi', 'Gharbi', 'Jaziri', 'Riahi', 'Hammami', 'Sassi', 'Mejri', 'Dridi', 'Ayari', 'Bouazizi', 'Masmoudi', 'Karray'];
  
  private teamTypes = ['ORCHESTRE', 'PHOTOGRAPHE', 'TRAITEUR', 'TROUPE', 'AUTRE'];
  private staffRoles = ['Serveur', 'Chef Serveur', 'Cuisinier', 'Sécurité', 'Nettoyage'];

  async resetAndSeed() {
    const confirmed = await this.ui.confirm(
      '⚠ ATTENTION : ZONE DE DANGER',
      'Cette action va EFFACER TOUTES les données (Clients, Réservations, Équipes, Staff) et générer des données fictives. Êtes-vous sûr ?',
      'OUI, TOUT EFFACER',
      'Annuler'
    );

    if (!confirmed) return;

    this.ui.showToast('info', 'Nettoyage de la base de données...');
    
    try {
      // 1. Nettoyage
      await this.clearCollection('clients');
      await this.clearCollection('staff');
      await this.clearCollection('teams');
      await this.clearCollection('reservations');

      this.ui.showToast('info', 'Génération des données...');

      // 2. Génération
      const clientIds = await this.seedClients(15);
      const staffIds = await this.seedStaff(8);
      const teamIds = await this.seedTeams(5);
      await this.seedReservations(10, clientIds, staffIds, teamIds);

      this.ui.showToast('success', 'Base de données régénérée avec succès !');
      // Recharger la page pour rafraîchir les vues
      setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur lors de la génération');
    }
  }

  private async clearCollection(path: string) {
    const colRef = collection(this.firestore, path);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(this.firestore);
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  private async seedClients(count: number): Promise<string[]> {
    const ids: string[] = [];
    const colRef = collection(this.firestore, 'clients');
    
    for (let i = 0; i < count; i++) {
      const nom = this.getRandom(this.lastNames).toUpperCase();
      const prenom = this.getRandom(this.firstNames);
      const data = {
        nom,
        prenom,
        telephone: '2' + Math.floor(Math.random() * 10000000),
        email: `${prenom.toLowerCase()}.${nom.toLowerCase()}@test.com`,
        cin: Math.floor(Math.random() * 100000000).toString(),
        adresse: 'Tunis, Tunisie',
        prenomMarie1: this.getRandom(this.firstNames),
        prenomMarie2: this.getRandom(this.firstNames),
        createdAt: new Date().toISOString()
      };
      const ref = await addDoc(colRef, data);
      ids.push(ref.id);
    }
    return ids;
  }

  private async seedStaff(count: number): Promise<string[]> {
    const ids: string[] = [];
    const colRef = collection(this.firestore, 'staff');

    for (let i = 0; i < count; i++) {
      const nom = this.getRandom(this.firstNames) + ' ' + this.getRandom(this.lastNames);
      const role = this.getRandom(this.staffRoles);
      const data = {
        nom,
        role: 'SERVER',
        specialite: role,
        telephone: '5' + Math.floor(Math.random() * 10000000),
        email: `staff${i}@princesse.com`,
        active: true,
        createdAt: new Date().toISOString()
      };
      const ref = await addDoc(colRef, data);
      ids.push(ref.id);
    }
    return ids;
  }

  private async seedTeams(count: number): Promise<string[]> {
    const ids: string[] = [];
    const colRef = collection(this.firestore, 'teams');

    for (let i = 0; i < count; i++) {
      const type = this.getRandom(this.teamTypes);
      const nom = `${type === 'ORCHESTRE' ? 'Troupe' : type} ${this.getRandom(this.lastNames)}`;
      const data = {
        nom,
        type,
        chefEquipe: this.getRandom(this.firstNames) + ' ' + this.getRandom(this.lastNames),
        telephone: '9' + Math.floor(Math.random() * 10000000),
        active: true,
        services: [
            { nom: 'Prestation Standard', prix: Math.floor(Math.random() * 2000) + 500, description: 'Service complet' }
        ],
        createdAt: new Date().toISOString()
      };
      const ref = await addDoc(colRef, data);
      ids.push(ref.id);
    }
    return ids;
  }

  private async seedReservations(count: number, clientIds: string[], staffIds: string[], teamIds: string[]) {
    const colRef = collection(this.firestore, 'reservations');
    const slots = [
        { id: 'matin', start: '08:00', end: '12:00', price: 1000 },
        { id: 'aprem', start: '13:00', end: '17:00', price: 1500 },
        { id: 'soir', start: '19:00', end: '02:00', price: 3000 }
    ];

    const today = new Date();

    for (let i = 0; i < count; i++) {
      // Date aléatoire dans les 30 prochains jours
      const date = new Date(today);
      date.setDate(today.getDate() + Math.floor(Math.random() * 30));
      const dateStr = date.toISOString().split('T')[0];
      
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const clientId = this.getRandom(clientIds);
      
      // Affectation aléatoire
      const hasTeam = Math.random() > 0.5;
      const assignedTeamId = hasTeam ? this.getRandom(teamIds) : '';
      
      // Sélection de 2 ou 3 staffs aléatoires
      const randomStaff = staffIds.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

      const data = {
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,
        clientId,
        clientName: 'Client Test', // Sera mis à jour par l'app si besoin, mais pour le mock c'est ok
        selectedSlotId: slot.id,
        totalPrice: slot.price,
        advance: Math.floor(Math.random() * 500),
        status: Math.random() > 0.2 ? 'CONFIRMED' : 'PENDING',
        assignedServerIds: randomStaff,
        assignedTeamId: assignedTeamId,
        createdAt: new Date().toISOString()
      };
      await addDoc(colRef, data);
    }
  }

  private getRandom(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
