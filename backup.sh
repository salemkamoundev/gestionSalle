#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
KEY_FILE="serviceAccountKey.json"
BACKUP_DIR="backups/backup_$(date +%Y-%m-%d_%H-%M-%S)"

echo "📦 Démarrage du Backup Firebase (JSON)..."

# ==========================================
# VÉRIFICATIONS
# ==========================================

# 1. Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    exit 1
fi

# 2. Vérifier la clé de service
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Erreur : Fichier '$KEY_FILE' introuvable à la racine."
    echo "👉 Va dans Console Firebase > Paramètres > Comptes de service > Générer une nouvelle clé privée."
    echo "👉 Renomme le fichier téléchargé en '$KEY_FILE' et place-le ici."
    exit 1
fi

# 3. Création du dossier
mkdir -p "$BACKUP_DIR"
echo "📂 Dossier créé : $BACKUP_DIR"

# ==========================================
# SCRIPT NODE.JS D'EXTRACTION
# ==========================================
# On génère un script JS temporaire pour utiliser le SDK Admin
cat <<'EOF' > run_backup.js
const fs = require('fs');
const admin = require('firebase-admin');

// 1. Initialisation
const serviceAccount = require('./serviceAccountKey.json');
const backupDir = process.argv[2];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function backupAuth() {
  console.log('👤 Sauvegarde des utilisateurs (Auth)...');
  let users = [];
  let nextPageToken;
  
  // Pagination pour récupérer tout le monde
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    users = users.concat(result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  const filePath = `${backupDir}/users.json`;
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
  console.log(`✅ ${users.length} utilisateurs sauvegardés dans ${filePath}`);
}

async function backupFirestore() {
  console.log('🔥 Sauvegarde de Firestore (Collections racines)...');
  const collections = await db.listCollections();
  const data = {};

  for (const collection of collections) {
    console.log(`   - Collection : ${collection.id}`);
    const snapshot = await collection.get();
    data[collection.id] = {};

    snapshot.forEach(doc => {
      let docData = doc.data();
      
      // Conversion des Dates/Timestamp pour lisibilité JSON
      for (const key in docData) {
        if (docData[key] && typeof docData[key].toDate === 'function') {
          docData[key] = docData[key].toDate().toISOString();
        }
      }
      
      data[collection.id][doc.id] = docData;
    });
  }

  const filePath = `${backupDir}/firestore_dump.json`;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Données Firestore sauvegardées dans ${filePath}`);
}

async function run() {
  try {
    await backupAuth();
    await backupFirestore();
    console.log('✨ Backup terminé avec succès.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur pendant le backup:', error);
    process.exit(1);
  }
}

run();
EOF

# ==========================================
# INSTALLATION DÉPENDANCES & EXECUTION
# ==========================================

echo "⬇️  Installation temporaire de firebase-admin..."
# On installe firebase-admin dans le dossier courant sans modifier le package.json principal si possible
# ou on l'utilise s'il est déjà là.
if [ ! -d "node_modules/firebase-admin" ]; then
    npm install firebase-admin --no-save --silent
else
    echo "ℹ️  firebase-admin déjà présent."
fi

echo "🚀 Lancement de l'extraction..."
node run_backup.js "$BACKUP_DIR"

# Nettoyage du script temporaire
rm run_backup.js

echo ""
echo "========================================="
echo "✅ SAUVEGARDE TERMINÉE"
echo "📁 Vos fichiers sont dans : $BACKUP_DIR/"
echo "========================================="