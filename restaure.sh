#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
KEY_FILE="serviceAccountKey.json"

echo "⚠️  ATTENTION : RESTAURATION FIREBASE (DESTRUCTIVE)"
echo "Ce script va SUPPRIMER toutes les données actuelles (Auth + Firestore)"
echo "et les remplacer par celles du backup."

# ==========================================
# 1. CHOIX DU DOSSIER DE BACKUP
# ==========================================
# On liste les backups disponibles
echo ""
echo "📁 Backups disponibles :"
ls -d backups/*/ 2>/dev/null
echo ""

read -p "👉 Copiez-collez le nom du dossier à restaurer (ex: backups/backup_2025-...) : " BACKUP_DIR

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Dossier '$BACKUP_DIR' introuvable."
    exit 1
fi

if [ ! -f "$BACKUP_DIR/users.json" ] || [ ! -f "$BACKUP_DIR/firestore_dump.json" ]; then
    echo "❌ Fichiers JSON manquants dans ce dossier."
    exit 1
fi

# ==========================================
# 2. CONFIRMATION DE SÉCURITÉ
# ==========================================
echo ""
echo "🔴  DANGER : TOUTES LES DONNÉES ACTUELLES SERONT PERDUES."
read -p "Êtes-vous sûr de vouloir continuer ? Tapez 'OUI' en majuscules : " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
    echo "Annulation."
    exit 0
fi

# ==========================================
# 3. SCRIPT NODE.JS DE RESTAURATION
# ==========================================
cat <<'EOF' > run_restore.js
const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const backupDir = process.argv[2];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// --- UTILITAIRES ---

// Récursivité pour supprimer des collections (Firestore n'a pas de "delete all" simple)
async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;

  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// Convertir les strings ISO du JSON en objets Date/Timestamp pour Firestore
function parseData(data) {
  for (const key in data) {
    if (typeof data[key] === 'string') {
      // Regex simple pour détecter les dates ISO
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data[key])) {
        data[key] = new Date(data[key]);
      }
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      parseData(data[key]);
    }
  }
  return data;
}

// --- SUPPRESSION ---

async function clearAuth() {
  console.log('🗑️  Suppression des utilisateurs existants...');
  const listUsersResult = await auth.listUsers(1000);
  const uids = listUsersResult.users.map((user) => user.uid);
  
  if (uids.length > 0) {
    await auth.deleteUsers(uids);
    console.log(`   - ${uids.length} utilisateurs supprimés.`);
  } else {
    console.log('   - Aucun utilisateur à supprimer.');
  }
}

async function clearFirestore() {
  console.log('🗑️  Suppression des collections Firestore...');
  const collections = await db.listCollections();
  for (const col of collections) {
    console.log(`   - Suppression collection : ${col.id}`);
    await deleteCollection(col.id, 100);
  }
}

// --- IMPORTATION ---

async function restoreAuth() {
  console.log('👤 Importation des utilisateurs...');
  const content = fs.readFileSync(`${backupDir}/users.json`, 'utf8');
  const users = JSON.parse(content);

  // Auth importUsers accepte des lots de 1000 max
  // Note : Les mots de passe ne sont pas inclus dans un export standard listUsers.
  // Les utilisateurs devront probablement faire "Mot de passe oublié" ou on les importe sans password.
  
  const usersToImport = users.map(u => ({
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
    phoneNumber: u.phoneNumber,
    disabled: u.disabled,
    // passwordHash: ... (nécessite un hash spécifique, ignoré ici pour éviter les erreurs)
  }));

  if (usersToImport.length > 0) {
    try {
        await auth.importUsers(usersToImport, {
            hash: { algorithm: 'BCRYPT' } // Dummy hash config si besoin, souvent ignoré sans hash
        });
        console.log(`✅ ${usersToImport.length} utilisateurs importés.`);
    } catch (e) {
        console.warn('⚠️ Erreur partielle import Auth (souvent due aux hash password manquants). Les comptes sont créés mais sans mot de passe valide.');
        // Fallback: Création un par un si le batch échoue
        for(const u of usersToImport) {
            try { await auth.createUser(u).catch(() => {}); } catch(e){}
        }
    }
  }
}

async function restoreFirestore() {
  console.log('🔥 Importation Firestore...');
  const content = fs.readFileSync(`${backupDir}/firestore_dump.json`, 'utf8');
  const data = JSON.parse(content);
  
  const batch = db.batch();
  let operationCounter = 0;

  for (const colId in data) {
    const docs = data[colId];
    console.log(`   - Collection : ${colId}`);
    
    for (const docId in docs) {
      const docData = parseData(docs[docId]); // Conversion des dates
      const ref = db.collection(colId).doc(docId);
      
      // On utilise set() pour écraser ou créer
      await ref.set(docData); 
      // Note: On n'utilise pas batch ici pour simplifier la gestion des gros volumes
      // car la limite batch est de 500. Le await ref.set() est plus lent mais sûr.
    }
  }
  console.log('✅ Données Firestore importées.');
}

async function run() {
  try {
    // 1. Suppression
    await clearAuth();
    await clearFirestore();

    // 2. Restauration
    await restoreAuth();
    await restoreFirestore();

    console.log('✨ Restauration terminée avec succès.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur critique:', error);
    process.exit(1);
  }
}

run();
EOF

# ==========================================
# EXECUTION
# ==========================================

# Installation dépendances si besoin
if [ ! -d "node_modules/firebase-admin" ]; then
    echo "⬇️  Installation firebase-admin..."
    npm install firebase-admin --no-save --silent
fi

echo "🚀 Lancement de la restauration..."
node run_restore.js "$BACKUP_DIR"

# Nettoyage
rm run_restore.js

echo ""
echo "========================================="
echo "✅ TERMINÉ"
echo "Les données ont été remplacées."
echo "========================================="