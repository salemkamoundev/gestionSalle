import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, writeBatch, doc, setDoc, addDoc } from '@angular/fire/firestore';
import { UiService } from './ui.service';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private firestore = inject(Firestore);
  private ui = inject(UiService);

  // Listes de noms pour la génération aléatoire
  private firstNames = ['Mohamed', 'Ahmed', 'Sami', 'Walid', 'Karim'];
  private lastNames = ['Ben Ali', 'Trabelsi', 'Gharbi', 'Jaziri', 'Riahi'];

  async resetAndSeed() {
    const confirmed = await this.ui.confirm(
      '⚠ CORRECTION FINALE',
      'Ceci va injecter la liste COMPLÈTE des 27 créneaux manuellement. Êtes-vous sûr ?',
      'OUI, INJECTER',
      'Annuler'
    );

    if (!confirmed) return;

    this.ui.showToast('info', 'Nettoyage...');
    
    try {
      await this.clearCollection('reservations'); // On vide les résas pour éviter les conflits d'ID
      await this.clearCollection('payments');
      
      // ON NE VIDE PAS LES CLIENTS/STAFF/TEAMS pour gagner du temps, on reset juste la config
      
      this.ui.showToast('info', 'Écriture de la configuration...');
      await this.seedConfiguration();

      this.ui.showToast('success', 'SUCCÈS : 27 Créneaux injectés.');
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
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  // --- CONFIGURATION EN DUR (PAS DE BOUCLE, PAS D'ERREUR POSSIBLE) ---
  private async seedConfiguration() {
    const configRef = doc(this.firestore, 'config/general');
    
    // LISTE EXPLICTE DES 27 CRÉNEAUX
    const allSlots = [
      // --- 2024 ---
      { id: 'bs_matin_2024', label: 'Matin (Basse Saison 2024)', start: '08:00', end: '12:00', price: 500, validFrom: '2024-01-01', validTo: '2024-05-31' },
      { id: 'bs_aprem_2024', label: 'Après-midi (Basse Saison 2024)', start: '13:00', end: '17:00', price: 800, validFrom: '2024-01-01', validTo: '2024-05-31' },
      { id: 'bs_soir_2024', label: 'Soirée (Basse Saison 2024)', start: '19:00', end: '02:00', price: 2000, validFrom: '2024-01-01', validTo: '2024-05-31' },
      
      { id: 'hs_matin_2024', label: 'Matin (Haute Saison 2024)', start: '08:00', end: '12:00', price: 1000, validFrom: '2024-06-01', validTo: '2024-09-30' },
      { id: 'hs_aprem_2024', label: 'Après-midi (Haute Saison 2024)', start: '13:00', end: '18:00', price: 1500, validFrom: '2024-06-01', validTo: '2024-09-30' },
      { id: 'hs_soir_2024', label: 'Grand Soir (Haute Saison 2024)', start: '20:00', end: '04:00', price: 4500, validFrom: '2024-06-01', validTo: '2024-09-30' },

      { id: 'as_matin_2024', label: 'Matin (Hiver 2024)', start: '08:00', end: '12:00', price: 600, validFrom: '2024-10-01', validTo: '2024-12-31' },
      { id: 'as_aprem_2024', label: 'Après-midi (Hiver 2024)', start: '13:00', end: '17:00', price: 900, validFrom: '2024-10-01', validTo: '2024-12-31' },
      { id: 'as_soir_2024', label: 'Soirée (Hiver 2024)', start: '19:00', end: '02:00', price: 2500, validFrom: '2024-10-01', validTo: '2024-12-31' },

      // --- 2025 ---
      { id: 'bs_matin_2025', label: 'Matin (Basse Saison 2025)', start: '08:00', end: '12:00', price: 500, validFrom: '2025-01-01', validTo: '2025-05-31' },
      { id: 'bs_aprem_2025', label: 'Après-midi (Basse Saison 2025)', start: '13:00', end: '17:00', price: 800, validFrom: '2025-01-01', validTo: '2025-05-31' },
      { id: 'bs_soir_2025', label: 'Soirée (Basse Saison 2025)', start: '19:00', end: '02:00', price: 2000, validFrom: '2025-01-01', validTo: '2025-05-31' },
      
      { id: 'hs_matin_2025', label: 'Matin (Haute Saison 2025)', start: '08:00', end: '12:00', price: 1000, validFrom: '2025-06-01', validTo: '2025-09-30' },
      { id: 'hs_aprem_2025', label: 'Après-midi (Haute Saison 2025)', start: '13:00', end: '18:00', price: 1500, validFrom: '2025-06-01', validTo: '2025-09-30' },
      { id: 'hs_soir_2025', label: 'Grand Soir (Haute Saison 2025)', start: '20:00', end: '04:00', price: 4500, validFrom: '2025-06-01', validTo: '2025-09-30' },

      { id: 'as_matin_2025', label: 'Matin (Hiver 2025)', start: '08:00', end: '12:00', price: 600, validFrom: '2025-10-01', validTo: '2025-12-31' },
      { id: 'as_aprem_2025', label: 'Après-midi (Hiver 2025)', start: '13:00', end: '17:00', price: 900, validFrom: '2025-10-01', validTo: '2025-12-31' },
      { id: 'as_soir_2025', label: 'Soirée (Hiver 2025)', start: '19:00', end: '02:00', price: 2500, validFrom: '2025-10-01', validTo: '2025-12-31' },

      // --- 2026 ---
      { id: 'bs_matin_2026', label: 'Matin (Basse Saison 2026)', start: '08:00', end: '12:00', price: 500, validFrom: '2026-01-01', validTo: '2026-05-31' },
      { id: 'bs_aprem_2026', label: 'Après-midi (Basse Saison 2026)', start: '13:00', end: '17:00', price: 800, validFrom: '2026-01-01', validTo: '2026-05-31' },
      { id: 'bs_soir_2026', label: 'Soirée (Basse Saison 2026)', start: '19:00', end: '02:00', price: 2000, validFrom: '2026-01-01', validTo: '2026-05-31' },
      
      { id: 'hs_matin_2026', label: 'Matin (Haute Saison 2026)', start: '08:00', end: '12:00', price: 1000, validFrom: '2026-06-01', validTo: '2026-09-30' },
      { id: 'hs_aprem_2026', label: 'Après-midi (Haute Saison 2026)', start: '13:00', end: '18:00', price: 1500, validFrom: '2026-06-01', validTo: '2026-09-30' },
      { id: 'hs_soir_2026', label: 'Grand Soir (Haute Saison 2026)', start: '20:00', end: '04:00', price: 4500, validFrom: '2026-06-01', validTo: '2026-09-30' },

      { id: 'as_matin_2026', label: 'Matin (Hiver 2026)', start: '08:00', end: '12:00', price: 600, validFrom: '2026-10-01', validTo: '2026-12-31' },
      { id: 'as_aprem_2026', label: 'Après-midi (Hiver 2026)', start: '13:00', end: '17:00', price: 900, validFrom: '2026-10-01', validTo: '2026-12-31' },
      { id: 'as_soir_2026', label: 'Soirée (Hiver 2026)', start: '19:00', end: '02:00', price: 2500, validFrom: '2026-10-01', validTo: '2026-12-31' }
    ];

    await setDoc(configRef, { creneaux: allSlots });
  }

  // --- FONCTIONS SUPPRIMÉES POUR CETTE VERSION FIX (Pour alléger) ---
  // On ne génère plus de clients/staff/teams ici pour se concentrer sur la config
  // Si besoin, vous pouvez réactiver les anciennes fonctions, mais la priorité est la config.
  
  private async seedClients(count: number) { return []; } 
  private async seedStaff(count: number) { return []; }
  private async seedTeams(count: number) { return []; }
  private async seedReservations(c: number, ci: any, si: any, ti: any) { return; }
}
