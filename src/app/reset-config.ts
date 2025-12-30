import { Firestore, doc, deleteDoc, setDoc, getFirestore } from '@angular/fire/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

// Fonction autonome de reset
export async function forceResetConfig() {
  console.log('%c ☢️ DÉBUT DU RESET CONFIGURATION...', 'color: red; font-size: 20px; font-weight: bold;');
  
  // 1. Initialisation manuelle pour être sûr d'avoir l'accès
  const app = initializeApp(environment.firebase);
  const db = getFirestore(app);
  
  const configRef = doc(db, 'config/general');

  // 2. SUPPRESSION TOTALE du document existant
  try {
    await deleteDoc(configRef);
    console.log('🗑️ Ancien document de configuration SUPPRIMÉ.');
  } catch (e) {
    console.warn('Pas d\'ancien document ou erreur suppression:', e);
  }

  // 3. DONNÉES À INJECTER (Les 4 créneaux demandés)
  const validFrom = '2025-01-01';
  const validTo = '2026-12-31';

  const newConfig = {
    creneaux: [
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
    ]
  };

  // 4. ÉCRITURE DES NOUVELLES DONNÉES
  try {
    await setDoc(configRef, newConfig);
    console.log('%c ✅ SUCCÈS : CONFIGURATION CRÉNEAUX 2025-2026 INJECTÉE !', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('Liste des IDs injectés :', newConfig.creneaux.map(c => c.id).join(', '));
    alert('✅ CONFIGURATION RÉINITIALISÉE AVEC SUCCÈS !\n\nLes 4 créneaux (Matin, Aprem1, Aprem2, Soir) sont en place.\n\nL\'application va continuer son démarrage...');
  } catch (e) {
    console.error('❌ ERREUR CRITIQUE PENDANT L\'ÉCRITURE :', e);
    alert('❌ ERREUR LORS DU RESET : ' + e);
  }
}
