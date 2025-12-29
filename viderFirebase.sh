#!/usr/bin/env bash
set -euo pipefail

echo "🔥 WIPE FIREBASE : Suppression TOTALE (Auth + Firestore)..."

# 1. Vérification de la clé de service
if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ Erreur : 'serviceAccountKey.json' introuvable à la racine."
  echo "Veuillez télécharger votre clé privée depuis la console Firebase."
  exit 1
fi

# 2. Installation des dépendances si nécessaire
if [ ! -d "node_modules/firebase-admin" ]; then
  echo "📦 Installation de firebase-admin..."
  npm install firebase-admin --no-save >/dev/null 2>&1
fi

# 3. Création du script Node.js temporaire
cat > wipe-script.js <<'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialisation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function wipeAll() {
  try {
    console.log("------------------------------------------------");
    
    // --- 1. SUPPRESSION DES UTILISATEURS (AUTH) ---
    console.log("👤 Suppression des utilisateurs Auth...");
    let nextPageToken;
    let deletedUsersCount = 0;
    
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      const uids = listUsersResult.users.map((user) => user.uid);
      
      if (uids.length > 0) {
        await auth.deleteUsers(uids);
        deletedUsersCount += uids.length;
        process.stdout.write(`   - ${deletedUsersCount} utilisateurs supprimés...\r`);
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`\n✅ Auth vidé (${deletedUsersCount} comptes supprimés).`);

    // --- 2. SUPPRESSION DE FIRESTORE (COLLECTIONS) ---
    console.log("\n🗄️  Suppression des collections Firestore...");
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log("   - Aucune collection trouvée.");
    } else {
      for (const collection of collections) {
        const colId = collection.id;
        process.stdout.write(`   - Suppression de la collection '${colId}'... `);
        
        // Suppression par lots (Batch)
        await deleteCollection(db, colId, 500);
        console.log("OK");
      }
    }
    
    console.log("✅ Firestore vidé.");
    console.log("------------------------------------------------");
    console.log("🎉 Nettoyage terminé avec succès !");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ ERREUR CRITIQUE :", error);
    process.exit(1);
  }
}

// Fonction récursive pour supprimer une collection par lots
async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // Récursion pour le lot suivant
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// Lancement
wipeAll();
EOF

# 4. Exécution du script Node
node wipe-script.js

# 5. Nettoyage
rm wipe-script.js
