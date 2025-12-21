const admin = require('firebase-admin');

// ⚠️ Assurez-vous d'avoir téléchargé votre clé depuis la console Firebase
// Console Firebase > Paramètres Projet > Comptes de service > Générer une clé
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seasons = [
  { name: 'Hiver', startMonth: '12-01', endMonth: '02-28', year: 2025, nextYear: 2026 },
  { name: 'Printemps', startMonth: '03-01', endMonth: '05-31', year: 2026, nextYear: 2026 },
  { name: 'Été', startMonth: '06-01', endMonth: '08-31', year: 2026, nextYear: 2026 },
  { name: 'Automne', startMonth: '09-01', endMonth: '11-30', year: 2026, nextYear: 2026 }
];

const slotTemplates = [
  { id: 'matin', label: 'Matin', start: '08:00', end: '12:00', price: 500 },
  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', price: 800 },
  { id: 'soir', label: 'Soirée', start: '19:00', end: '02:00', price: 2200 }
];

let finalCreneaux = [];

seasons.forEach(s => {
  slotTemplates.forEach(t => {
    finalCreneaux.push({
      id: `${s.name.toLowerCase()}_${t.id}`,
      label: `${t.label} - ${s.name}`,
      start: t.start,
      end: t.end,
      price: t.price,
      validFrom: `${s.year}-${s.startMonth}`,
      validTo: `${s.nextYear}-${s.endMonth}`
    });
  });
});

async function run() {
  try {
    console.log('⏳ Injection de 12 créneaux (4 saisons)...');
    await db.collection('config').doc('general').set({
      creneaux: finalCreneaux
    }, { merge: true });
    
    console.log('✅ Succès !');
    console.log('📅 HIVER : 2025-12-01 au 2026-02-28 (Le 09/12 est inclus)');
    console.log('🆔 Exemple ID pour URL : slotId=hiver_soir');
  } catch (error) {
    console.error('❌ Erreur :', error);
  }
}

run();
