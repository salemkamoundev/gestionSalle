const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker'); // Utilisation de la locale Française

// CONFIGURATION
const SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const PASSWORD = "User123";
const COUNT = 20; // Nombre d'éléments par collection

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT)
});

const db = admin.firestore();
const auth = admin.auth();

// --- 1. CONFIGURATION DES SAISONS (VOTRE LOGIQUE) ---
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

// Helper pour générer des IDs de créneaux valides pour les réservations
let availableSlotIds = [];

async function generateConfig() {
  console.log('⚙️  Génération de la configuration (Saisons)...');
  let finalCreneaux = [];
  seasons.forEach(s => {
    slotTemplates.forEach(t => {
      const slotId = `${s.name.toLowerCase()}_${t.id}`;
      availableSlotIds.push(slotId);
      finalCreneaux.push({
        id: slotId,
        label: `${t.label} - ${s.name}`,
        start: t.start,
        end: t.end,
        price: t.price,
        validFrom: `${s.year}-${s.startMonth}`,
        validTo: `${s.nextYear}-${s.endMonth}`
      });
    });
  });

  await db.collection('config').doc('general').set({ creneaux: finalCreneaux }, { merge: true });
}

// --- 2. USERS (AUTH + FIRESTORE) ---
async function generateUsers() {
  console.log(`👤 Génération de ${COUNT} utilisateurs (Auth + Firestore)...`);
  const batch = db.batch();

  for (let i = 0; i < COUNT; i++) {
    const email = faker.internet.email();
    const role = i === 0 ? 'ADMIN' : (Math.random() > 0.5 ? 'SERVER' : 'MANAGER');
    
    try {
      // Création Auth
      const userRecord = await auth.createUser({
        email: email,
        password: PASSWORD,
        displayName: faker.person.fullName(),
        emailVerified: true,
        disabled: false
      });

      // Création Firestore
      const userRef = db.collection('users').doc(userRecord.uid);
      batch.set(userRef, {
        id: userRecord.uid,
        nom: userRecord.displayName,
        email: email,
        role: role,
        active: true,
        telephoneDigits: faker.string.numeric(8),
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn(`   ⚠️ Erreur création user ${email}: ${e.message}`);
    }
  }
  await batch.commit();
}

// --- 3. CLIENTS ---
async function generateClients() {
  console.log(`👥 Génération de ${COUNT} clients...`);
  const batch = db.batch();
  const clientIds = [];

  for (let i = 0; i < COUNT; i++) {
    const ref = db.collection('clients').doc();
    clientIds.push(ref.id);
    batch.set(ref, {
      id: ref.id,
      nom: faker.person.lastName(),
      prenom: faker.person.firstName(),
      cin: faker.string.numeric(8),
      dateCin: faker.date.past().toISOString().split('T')[0],
      telephone: faker.string.numeric(8),
      email: faker.internet.email(),
      adresse: faker.location.streetAddress(),
      createdAt: faker.date.recent({ days: 100 }).toISOString()
    });
  }
  await batch.commit();
  return clientIds;
}

// --- 4. SERVICES & TEAMS & PACKS ---
async function generateResources() {
  console.log(`📦 Génération de Services, Équipes, Packs (${COUNT} de chaque)...`);
  const batch = db.batch();

  // Services
  for (let i = 0; i < COUNT; i++) {
    const ref = db.collection('services').doc();
    batch.set(ref, {
      id: ref.id,
      nom: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      prix: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
      active: true
    });
  }

  // Teams
  for (let i = 0; i < COUNT; i++) {
    const ref = db.collection('teams').doc();
    batch.set(ref, {
      id: ref.id,
      nom: `Équipe ${faker.animal.type()}`,
      active: true
    });
  }
  
  // Packs
  for (let i = 0; i < COUNT; i++) {
    const ref = db.collection('packs').doc();
    batch.set(ref, {
      id: ref.id,
      nom: `Pack ${faker.commerce.productAdjective()}`,
      prix: parseFloat(faker.commerce.price({ min: 1000, max: 5000 })),
      services: [], // Simplifié pour l'exemple
      active: true
    });
  }

  await batch.commit();
}

// --- 5. RESERVATIONS & PAIEMENTS ---
async function generateReservationsAndPayments(clientIds) {
  console.log(`📅 Génération des Réservations et Paiements...`);
  const batchRes = db.batch();
  const batchPay = db.batch();
  
  if (clientIds.length === 0) return;

  for (let i = 0; i < COUNT; i++) {
    // Réservation
    const resRef = db.collection('reservations').doc();
    const randomClient = clientIds[Math.floor(Math.random() * clientIds.length)];
    const randomSlot = availableSlotIds[Math.floor(Math.random() * availableSlotIds.length)] || 'hiver_soir';
    const price = parseFloat(faker.commerce.price({ min: 500, max: 3000 }));
    const resDate = faker.date.future().toISOString();

    batchRes.set(resRef, {
      id: resRef.id,
      clientId: randomClient,
      clientName: "Client Mock", // Idéalement on chercherait le vrai nom
      date: resDate,
      selectedSlotId: randomSlot,
      totalPrice: price,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      advance: price // Payé totalement
    });

    // Paiement associé
    const payRef = db.collection('payments').doc();
    batchPay.set(payRef, {
      id: payRef.id,
      reservationId: resRef.id,
      amount: price,
      date: resDate.split('T')[0],
      type: 'ESPECES'
    });
  }

  await batchRes.commit();
  await batchPay.commit();
}

// --- 6. EXPENSES ---
async function generateExpenses() {
  console.log(`💸 Génération de ${COUNT} dépenses...`);
  const batch = db.batch();
  for (let i = 0; i < COUNT; i++) {
    const ref = db.collection('expenses').doc();
    batch.set(ref, {
      id: ref.id,
      description: faker.finance.transactionDescription(),
      amount: parseFloat(faker.commerce.price({ min: 50, max: 2000 })),
      date: faker.date.recent().toISOString(),
      category: faker.helpers.arrayElement(['EQUIPEMENT', 'NOURRITURE', 'MAINTENANCE']),
      beneficiaryType: 'AUTRE'
    });
  }
  await batch.commit();
}

// --- MAIN ---
async function run() {
  try {
    await generateConfig();
    await generateUsers();
    const clientIds = await generateClients();
    await generateResources();
    await generateReservationsAndPayments(clientIds);
    await generateExpenses();
    
    console.log('\n✅ SUCCÈS TOTAL ! La base de données est remplie.');
    console.log('🔑 Mot de passe pour tous les users Auth :', PASSWORD);
  } catch (error) {
    console.error('❌ Erreur :', error);
  }
}

run();
