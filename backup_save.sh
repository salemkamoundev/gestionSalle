#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
# Nom du fichier de clé privée (Doit être à la racine)
SERVICE_KEY="serviceAccountKey.json"

# Collections Firestore à sauvegarder (séparées par des espaces)
# Ajoute ici toutes tes collections : users, staff, reservations, clients...
COLLECTIONS=("users" "staff" "clients" "reservations" "payments")

# Génération du dossier de backup avec la date et l'heure
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backups/$TIMESTAMP"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ==========================================
# DÉMARRAGE
# ==========================================
echo -e "${YELLOW}==============================================${NC}"
echo -e "${YELLOW}   DÉMARRAGE DU BACKUP COMPLET FIREBASE       ${NC}"
echo -e "${YELLOW}==============================================${NC}"
echo "Dossier de destination : $BACKUP_DIR"

# 1. Création du dossier
mkdir -p "$BACKUP_DIR"

# 2. Vérification de la clé de service
if [ ! -f "$SERVICE_KEY" ]; then
    echo -e "${RED}❌ ERREUR : Fichier '$SERVICE_KEY' introuvable à la racine.${NC}"
    echo "Veuillez télécharger la clé privée depuis la console Firebase > Paramètres du projet > Comptes de service."
    rm -rf "$BACKUP_DIR" # Nettoyage
    exit 1
fi

# 3. Installation silencieuse des dépendances si nécessaire
if [ ! -d "node_modules/firebase-admin" ]; then
    echo "📦 Installation temporaire de firebase-admin..."
    npm install firebase-admin --no-save --silent > /dev/null 2>&1
fi

# ==========================================
# ÉTAPE 1 : BACKUP AUTHENTICATION (USERS)
# ==========================================
echo -e "\n${YELLOW}[1/2] Export des utilisateurs Authentication (Comptes)...${NC}"
AUTH_FILE="$BACKUP_DIR/auth_accounts.json"

# On utilise npx pour être sûr d'utiliser une version locale ou de télécharger la CLI si absente
# On redirige stderr vers null pour éviter le bruit, sauf en cas d'erreur
npx firebase auth:export "$AUTH_FILE" --format=json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Auth exporté avec succès : $AUTH_FILE${NC}"
else
    echo -e "${RED}❌ Échec de l'export Auth. Es-tu connecté avec 'firebase login' ?${NC}"
    # On continue quand même vers Firestore
fi

# ==========================================
# ÉTAPE 2 : BACKUP FIRESTORE (DATA)
# ==========================================
echo -e "\n${YELLOW}[2/2] Export des données Firestore (Collections)...${NC}"

# Conversion du tableau bash en chaîne JSON pour le passer à Node
JSON_COLLECTIONS=$(printf '%s\n' "${COLLECTIONS[@]}" | jq -R . | jq -s .) 2>/dev/null
# Fallback si jq n'est pas installé, on passe une string simple
if [ $? -ne 0 ]; then
    NODE_COLLECTIONS_ARG="['${COLLECTIONS[*]// /','}']" # Hack simple pour convertir array bash en array JS string
else
    NODE_COLLECTIONS_ARG=$JSON_COLLECTIONS
fi

# Exécution du script Node.js
node -e "
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./$SERVICE_KEY');

// Initialisation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Liste des collections à exporter
// Si l'argument bash complexe échoue, on prend les collections par défaut ici
const collectionsToBackup = ${NODE_COLLECTIONS_ARG// /}; 

async function backupCollection(colName) {
  try {
    const snapshot = await db.collection(colName).get();
    if (snapshot.empty) {
      console.log('   ⚠️ Collection ' + colName + ' est vide ou inexistante.');
      return;
    }
    
    const data = [];
    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });

    const filename = '$BACKUP_DIR/' + colName + '.json';
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log('   ✅ ' + colName + ' : ' + data.length + ' documents sauvegardés.');
  } catch (error) {
    console.error('   ❌ Erreur sur la collection ' + colName + ':', error.message);
  }
}

async function run() {
  console.log('Collections ciblées : ', collectionsToBackup);
  for (const col of collectionsToBackup) {
    await backupCollection(col);
  }
}

run();
"

echo -e "\n${YELLOW}==============================================${NC}"
echo -e "${GREEN}🎉 BACKUP TERMINÉ !${NC}"
echo -e "Tous les fichiers sont dans : ${GREEN}$BACKUP_DIR${NC}"
ls -lh "$BACKUP_DIR"