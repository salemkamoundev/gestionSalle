import { Firestore, doc, setDoc, getFirestore } from '@angular/fire/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

export async function seedSeasonalSlots() {
  console.log('%c 🚀 DÉBUT DU SEEDING SAISONNIER...', 'color: blue; font-weight: bold;');
  
  const app = initializeApp(environment.firebase);
  const db = getFirestore(app);
  
  // CONFIGURATION DES SAISONS
  const seasonsDef = [
    { name: 'Hiver', start: '01-01', end: '03-20', priceMatin: 200, priceAprem1: 400, priceAprem2: 500, priceSoir: 600 },
    { name: 'Printemps', start: '03-21', end: '06-20', priceMatin: 300, priceAprem1: 600, priceAprem2: 700, priceSoir: 900 },
    { name: 'Été', start: '06-21', end: '09-21', priceMatin: 500, priceAprem1: 900, priceAprem2: 1200, priceSoir: 1500 },
    { name: 'Automne', start: '09-22', end: '12-20', priceMatin: 250, priceAprem1: 500, priceAprem2: 600, priceSoir: 700 },
    { name: 'Fêtes', start: '12-21', end: '12-31', priceMatin: 400, priceAprem1: 800, priceAprem2: 1000, priceSoir: 1200 }
  ];

  const years = [2025, 2026];
  let allSlots: any[] = [];

  years.forEach(year => {
    seasonsDef.forEach(s => {
      const validFrom = `${year}-${s.start}`;
      const validTo = `${year}-${s.end}`;
      const suffix = `(${s.name} ${year})`;

      allSlots.push({ id: 'matin', label: `Matin ${suffix}`, start: '08:00', end: '12:00', price: s.priceMatin, validFrom, validTo });
      allSlots.push({ id: 'aprem1', label: `Après-midi Option 1 ${suffix}`, start: '12:00', end: '16:00', price: s.priceAprem1, validFrom, validTo });
      allSlots.push({ id: 'aprem2', label: `Après-midi Option 2 ${suffix}`, start: '12:00', end: '19:00', price: s.priceAprem2, validFrom, validTo });
      allSlots.push({ id: 'soir', label: `Soir ${suffix}`, start: '18:00', end: '02:00', price: s.priceSoir, validFrom, validTo });
    });
  });

  try {
    await setDoc(doc(db, 'config/general'), { creneaux: allSlots });
    console.log(`✅ ${allSlots.length} créneaux injectés.`);
    alert('✅ SEEDING TERMINÉ ! Rafraîchissez pour tester.');
  } catch (e) {
    console.error('❌ ERREUR :', e);
    alert('Erreur seeding: ' + e);
  }
}
