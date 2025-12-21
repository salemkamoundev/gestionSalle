#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
SERVICE_KEY="serviceAccountKey.json"
DEFAULT_PASSWORD="User123"      # Pour les utilisateurs importés du backup
ADMIN_EMAIL="admin@gmail.com"   # Email de l'admin à ajouter/forcer
ADMIN_PASSWORD="Admin123"       # Mot de passe spécifique pour l'admin

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ==========================================
# VÉRIFICATIONS
# ==========================================

if [ -z "$1" ]; then
    echo -e "${RED}Erreur : Tu dois spécifier le dossier de backup.${NC}"
    echo "Usage : ./import_reset.sh backups/DOSSIER_DATE"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Erreur : Le dossier '$BACKUP_DIR' n'existe pas.${NC}"
    exit 1
fi

if [ ! -f "$SERVICE_KEY" ]; then
    echo -e "${RED}Erreur : Fichier '$SERVICE_KEY' introuvable.${NC}"
    exit 1
fi

# ==========================================
# ALERTE DE SÉCURITÉ
# ==========================================
echo -e "${RED}=====================================================${NC}"
echo -e "${RED}⚠️  ATTENTION : ZONE DESTRUCTION & RESTAURATION  ⚠️${NC}"
echo -e "${RED}=====================================================${NC}"
echo -e "Actions prévues :"
echo -e "  1. ${RED}SUPPRIMER${NC} tout Auth et Firestore."
echo -e "  2. ${GREEN}RESTAURER${NC} depuis : $BACKUP_DIR"
echo -e "  3. ${YELLOW}FORCER${NC} les mots de passe utilisateurs à : '$DEFAULT_PASSWORD'"
echo -e "  4. ${CYAN}AJOUTER/UPDATE${NC} l'admin '$ADMIN_EMAIL' avec : '$ADMIN_PASSWORD'"
echo ""
read -p "Tapes 'oui' pour confirmer l'écrasement total : " confirmation

if [ "$confirmation" != "oui" ]; then
    echo "Annulation."
    exit 0
fi

# Installation dépendances si besoin
if [ ! -d "node_modules/firebase-admin" ]; then
    npm install firebase-admin --no-save --silent > /dev/null 2>&1
fi

# ==========================================
# SCRIPT NODE.JS EMBARQUÉ
# ==========================================
echo -e "${YELLOW}Lancement du moteur de restauration...${NC}"

node -e "
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./$SERVICE_KEY');

// Initialisation
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();
const backupDir = '$BACKUP_DIR';
const userPassword = '$DEFAULT_PASSWORD';
const adminEmail = '$ADMIN_EMAIL';
const adminPassword = '$ADMIN_PASSWORD';

// --- FONCTIONS ---

// 1. Vider Auth
async function clearAuth() {
  console.log('\n🗑️  [1/5] Suppression des utilisateurs Auth...');
  const listUsersResult = await auth.listUsers(1000);
  const uids = listUsersResult.users.map(u => u.uid);
  if (uids.length > 0) {
    await auth.deleteUsers(uids);
    console.log('   -> ' + uids.length + ' utilisateurs supprimés.');
  } else {
    console.log('   -> Auth déjà vide.');
  }
}

// 2. Vider Firestore
async function clearFirestore() {
  console.log('🗑️  [2/5] Suppression des données Firestore...');
  const collections = await db.listCollections();
  for (const collection of collections) {
    const snapshot = await collection.get();
    if (snapshot.size === 0) continue;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log('   -> Collection ' + collection.id + ' vidée.');
  }
}

// 3. Importer Users (Backup)
async function importAuth() {
  console.log('📥 [3/5] Import des utilisateurs du backup...');
  const authFile = path.join(backupDir, 'auth_accounts.json');
  
  if (!fs.existsSync(authFile)) {
    console.log('   ⚠️ Pas de backup Auth trouvé.');
    return;
  }

  try {
    const content = fs.readFileSync(authFile, 'utf8');
    const data = JSON.parse(content);
    const users = data.users || [];
    let count = 0;

    for (const user of users) {
      // On ignore l'admin ici pour le traiter spécifiquement après, 
      // ou on le laisse et on l'écrasera. On va le laisser.
      try {
        await auth.createUser({
          uid: user.localId,
          email: user.email,
          password: userPassword, // Tout le monde reçoit User123
          displayName: user.displayName || '',
          emailVerified: true
        });
        count++;
      } catch (e) {
        // Ignorer les doublons si jamais
      }
    }
    console.log('   -> ' + count + ' utilisateurs restaurés (Password: ' + userPassword + ').');
  } catch (e) {
    console.error('   ❌ Erreur lecture auth file:', e.message);
  }
}

// 4. Gérer l'Admin Spécifique
async function ensureAdmin() {
  console.log('👑 [4/5] Configuration du Super Admin...');
  try {
    // Tentative de création
    await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: 'Super Admin',
      emailVerified: true
    });
    console.log('   -> Admin créé avec succès : ' + adminEmail);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      // Si l'admin était dans le backup, il a actuellement le mdp User123.
      // On va chercher son UID pour mettre à jour son mot de passe.
      const user = await auth.getUserByEmail(adminEmail);
      await auth.updateUser(user.uid, {
        password: adminPassword
      });
      console.log('   -> Admin existait déjà (backup). Mot de passe corrigé vers : ' + adminPassword);
    } else {
      console.error('   ❌ Erreur création Admin:', error.message);
    }
  }
}

// 5. Importer Firestore
async function importFirestore() {
  console.log('📥 [5/5] Import des collections Firestore...');
  const files = fs.readdirSync(backupDir);
  
  for (const file of files) {
    if (file === 'auth_accounts.json' || !file.endsWith('.json')) continue;
    const colName = file.replace('.json', '');
    const filePath = path.join(backupDir, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const docs = JSON.parse(content);
      if (!Array.isArray(docs)) continue;

      const batchSize = 400;
      let batch = db.batch();
      let count = 0;
      let total = 0;

      for (const docData of docs) {
        const { id, ...data } = docData;
        if (id) {
            batch.set(db.collection(colName).doc(id), data);
            count++;
        }
        if (count >= batchSize) {
          await batch.commit();
          total += count;
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
        total += count;
      }
      console.log('   -> Collection ' + colName + ' : ' + total + ' docs.');
    } catch (e) {
      console.error('   ❌ Erreur collection ' + colName, e.message);
    }
  }
}

// EXECUTION
async function run() {
  try {
    await clearAuth();
    await clearFirestore();
    await importAuth();
    await ensureAdmin(); // <-- L'étape ajoutée
    await importFirestore();
    console.log('\n✅ SUCCÈS TOTAL !');
  } catch (error) {
    console.error('\n❌ ERREUR FATALE :', error);
    process.exit(1);
  }
}

run();
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Opération terminée. Admin prêt : admin@gmail.com / Admin123${NC}"
else
    echo -e "${RED}Échec du script.${NC}"
fi