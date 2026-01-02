import { Firestore, doc, deleteDoc, setDoc, getFirestore } from '@angular/fire/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

// Fonction autonome de reset
export async function forceResetConfig() {
  console.log('%c ☢️ DÉBUT DU RESET CONFIGURATION 2026...', 'color: red; font-size: 20px; font-weight: bold;');
  
  // 1. Initialisation manuelle
  const app = initializeApp(environment.firebase);
  const db = getFirestore(app);
  const configRef = doc(db, 'config/general');

  // 2. Définition des saisons et prix (Basé sur seed-seasons.ts)
  const seasonsDef = [
    { name: 'Hiver', start: '01-01', end: '03-20', priceMatin: 200, priceAprem1: 400, priceAprem2: 500, priceSoir: 600 },
    { name: 'Printemps', start: '03-21', end: '06-20', priceMatin: 300, priceAprem1: 600, priceAprem2: 700, priceSoir: 900 },
    { name: 'Été', start: '06-21', end: '09-21', priceMatin: 500, priceAprem1: 900, priceAprem2: 1200, priceSoir: 1500 },
    { name: 'Automne', start: '09-22', end: '12-20', priceMatin: 250, priceAprem1: 500, priceAprem2: 600, priceSoir: 700 },
    { name: 'Fêtes', start: '12-21', end: '12-31', priceMatin: 400, priceAprem1: 800, priceAprem2: 1000, priceSoir: 1200 }
  ];

  // On cible uniquement 2026 comme demandé
  const years = [2026];
  let allSlots: any[] = [];

  // 3. Génération des créneaux
  years.forEach(year => {
    seasonsDef.forEach(s => {
      const validFrom = `${year}-${s.start}`;
      const validTo = `${year}-${s.end}`;
      // On ajoute le nom de la saison dans le label pour plus de clarté
      const suffix = `(${s.name})`;

      allSlots.push({ 
        id: 'matin', 
        label: `Matin ${suffix}`, 
        start: '08:00', end: '12:00', 
        price: s.priceMatin, 
        validFrom, validTo 
      });
      
      allSlots.push({ 
        id: 'aprem1', 
        label: `Après-midi Option 1 ${suffix}`, 
        start: '12:00', end: '16:00', 
        price: s.priceAprem1, 
        validFrom, validTo 
      });
      
      allSlots.push({ 
        id: 'aprem2', 
        label: `Après-midi Option 2 ${suffix}`, 
        start: '12:00', end: '19:00', 
        price: s.priceAprem2, 
        validFrom, validTo 
      });
      
      allSlots.push({ 
        id: 'soir', 
        label: `Soir ${suffix}`, 
        start: '18:00', end: '02:00', 
        price: s.priceSoir, 
        validFrom, validTo 
      });
    });
  });

  // 4. Écriture en base
  try {
    // Suppression propre avant écriture (optionnel, setDoc écrase si on ne met pas merge:true)
    await deleteDoc(configRef).catch(() => {}); 
    
    await setDoc(configRef, { creneaux: allSlots });
    
    console.log(`%c ✅ SUCCÈS : ${allSlots.length} CRÉNEAUX 2026 INJECTÉS !`, 'color: green; font-size: 16px; font-weight: bold;');
    alert(`✅ CONFIGURATION 2026 RÉINITIALISÉE !\n\n${allSlots.length} créneaux générés pour toutes les saisons.\nL'application va démarrer.`);
  } catch (e) {
    console.error('❌ ERREUR CRITIQUE PENDANT LE SEEDING :', e);
    alert('❌ ERREUR LORS DU SEEDING : ' + e);
  }
}
