import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class SeederService {
  private firestore = inject(Firestore);

  constructor() {
    this.forceSeed();
  }

  async forceSeed() {
    console.warn('⚡ [SEEDER] Écrasement forcé de la configuration des créneaux...');

    const validFrom = '2025-01-01';
    const validTo = '2026-12-31';

    // LES 4 OPTIONS DEMANDÉES
    const slots = [
      {
        id: 'matin',
        label: 'Matin (08h-12h)',
        start: '08:00',
        end: '12:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'aprem1',
        label: 'Après-midi Option 1 (12h-16h)',
        start: '12:00',
        end: '16:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'aprem2',
        label: 'Après-midi Option 2 (12h-19h)',
        start: '12:00',
        end: '19:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'soir',
        label: 'Soir (18h-02h)',
        start: '18:00',
        end: '02:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      }
    ];

    try {
      // On utilise setDoc pour ÉCRASER totalement le document existant (adieu p2_matin)
      await setDoc(doc(this.firestore, 'config/general'), { creneaux: slots });
      console.log('✅ [SEEDER] SUCCÈS : Les 4 créneaux (Matin, Aprem1, Aprem2, Soir) sont injectés.');
      console.log('🔄 Veuillez rafraîchir la page du formulaire pour voir les changements.');
    } catch (e) {
      console.error('❌ [SEEDER] Erreur critique :', e);
    }
  }
}
