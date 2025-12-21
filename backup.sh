#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
KEY_FILE="serviceAccountKey.json"
BACKUP_DIR="backups/backup_$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_FILE="full_backup.json"

echo "📦 Démarrage de l'Export Complet (Auth + Firestore)..."

# ==========================================
# VÉRIFICATIONS
# ==========================================
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Erreur : Fichier '$KEY_FILE' introuvable."
    echo "   Télécharge ta clé privée depuis la console Firebase."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Erreur : Node.js n'est pas installé."
    exit 1
fi

# Création du dossier
mkdir -p "$BACKUP_DIR"

# ==========================================
# INSTALLATION DÉPENDANCES (Si nécessaire)
# ==========================================
if [ ! -d "node_modules/firebase-admin" ]; then
    echo "⬇️  Installation temporaire de firebase-admin..."
    npm init -y > /dev/null 2>&1
    npm install firebase-admin --silent
fi

# ==========================================
# SCRIPT NODE.JS EMBARQUÉ
# ==========================================
cat <<'EOF' > export_script.js
const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Récupération des arguments
const outputDir = process.argv[2];
const outputFile = process.argv[3];

// Initialisation
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Fonction pour nettoyer les dates Firestore (Timestamp -> ISO String)
function sanitizeData(data) {
  if (!data) return data;
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    } else if (typeof data[key] === 'object') { // Récursivité pour les objets imbriqués
      sanitizeData(data[key]);
    }
  }
  return data;
}

async function exportAll() {
  const backupData = {};

  try {
    // ---------------------------------------------------------
    // 1. EXPORT DE L'AUTHENTIFICATION (Tous les users Auth)
    // ---------------------------------------------------------
    console.log('🔵 Exportation des utilisateurs Authentication...');
    let allAuthUsers = [];
    let pageToken;
    
    do {
      // Récupère par lot de 1000
      const listUsersResult = await auth.listUsers(1000, pageToken);
      listUsersResult.users.forEach((userRecord) => {
        // .toJSON() est important pour avoir une structure propre
        allAuthUsers.push(userRecord.toJSON());
      });
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    backupData['auth_users'] = allAuthUsers;
    console.log(`   ✅ ${allAuthUsers.length} comptes trouvés.`);


    // ---------------------------------------------------------
    // 2. EXPORT DE FIRESTORE (Toutes les collections)
    // ---------------------------------------------------------
    console.log('🟠 Exportation des données Firestore...');
    const collections = await db.listCollections();

    for (const col of collections) {
      console.log(`   📂 Lecture collection : ${col.id}...`);
      const snapshot = await col.get();
      const docs = [];

      snapshot.forEach(doc => {
        // On combine l'ID du doc avec ses données nettoyées
        docs.push({
          id: doc.id,
          ...sanitizeData(doc.data())
        });
      });

      backupData[col.id] = docs;
    }

    // ---------------------------------------------------------
    // 3. ÉCRITURE DU FICHIER FINAL
    // ---------------------------------------------------------
    const finalPath = `${outputDir}/${outputFile}`;
    fs.writeFileSync(finalPath, JSON.stringify(backupData, null, 2));

    console.log(`\n✨ Export terminé avec succès !`);
    console.log(`📄 Fichier généré : ${finalPath}`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur fatale :', error);
    process.exit(1);
  }
}

exportAll();
EOF

# ==========================================
# EXECUTION
# ==========================================
echo "🚀 Lancement du script Node.js..."
node export_script.js "$BACKUP_DIR" "$OUTPUT_FILE"

# Nettoyage du fichier JS temporaire
rm export_script.js

echo ""
echo "✅ TERMINÉ."
echo "   Ton backup complet est ici : $BACKUP_DIR/$OUTPUT_FILE"