#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
KEY_FILE="serviceAccountKey.json"
BACKUP_DIR="backups/backup_smart_$(date +%Y-%m-%d_%H-%M-%S)"

echo "📦 Démarrage du Backup Intelligent..."

# ==========================================
# VÉRIFICATIONS
# ==========================================
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Erreur : Fichier '$KEY_FILE' introuvable."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# ==========================================
# SCRIPT NODE.JS
# ==========================================
cat <<'EOF' > run_smart_backup.js
const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const backupDir = process.argv[2];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Helper pour convertir les dates Firestore
function sanitizeData(data) {
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitizeData(data[key]);
    }
  }
  return data;
}

async function run() {
  try {
    console.log('--- 1. AUTHENTIFICATION ---');
    // 1. BACKUP AUTH (Comptes de connexion)
    let authUsers = [];
    let nextPageToken;
    do {
      const result = await auth.listUsers(1000, nextPageToken);
      authUsers = authUsers.concat(result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    fs.writeFileSync(`${backupDir}/auth_accounts.json`, JSON.stringify(authUsers, null, 2));
    console.log(`✅ ${authUsers.length} comptes de connexion sauvegardés (auth_accounts.json).`);


    console.log('--- 2. DONNÉES FIRESTORE ---');
    // 2. BACKUP FIRESTORE (Clients & Autres)
    const collections = await db.listCollections();
    const fullDump = {};

    for (const col of collections) {
      const snapshot = await col.get();
      const colData = [];
      
      snapshot.forEach(doc => {
        colData.push({ id: doc.id, ...sanitizeData(doc.data()) });
      });

      // Sauvegarde dans le dump global
      fullDump[col.id] = colData;

      // EXPORT SPÉCIFIQUE POUR LES CLIENTS (pour vérification facile)
      if (col.id === 'clients' || col.id === 'users') {
        const filename = `firestore_${col.id}.json`;
        fs.writeFileSync(`${backupDir}/${filename}`, JSON.stringify(colData, null, 2));
        console.log(`✅ COLLECTION '${col.id}' exportée séparément -> ${filename} (${colData.length} fiches).`);
      } else {
        console.log(`   - Collection '${col.id}' sauvegardée (${colData.length} docs).`);
      }
    }

    fs.writeFileSync(`${backupDir}/firestore_full_dump.json`, JSON.stringify(fullDump, null, 2));
    console.log(`✅ Dump complet sauvegardé (firestore_full_dump.json).`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();
EOF

# ==========================================
# EXECUTION
# ==========================================
if ! command -v npm &> /dev/null; then
    echo "❌ NPM requis."
    exit 1
fi

if [ ! -d "node_modules/firebase-admin" ]; then
    echo "⬇️  Installation firebase-admin..."
    npm install firebase-admin --no-save --silent
fi

echo "🚀 Lancement de l'extraction..."
node run_smart_backup.js "$BACKUP_DIR"
rm run_smart_backup.js

echo ""
echo "📂 Dossier de backup : $BACKUP_DIR"
echo "   👉 auth_accounts.json : Tes admins"
echo "   👉 firestore_clients.json : Tes clients (Vérifie ici !)"