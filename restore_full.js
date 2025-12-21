const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- CONFIGURATION ---
const serviceAccount = require('./serviceAccountKey.json'); 

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n==========================================');
console.log('♻️  RESTAURATION FIRESTORE + AUTH (CORRIGÉ)');
console.log('==========================================');

rl.question('👉 Entrez le chemin du fichier JSON : ', async (inputPath) => {
  
  // 1. Nettoyage et résolution du chemin
  let cleanPath = inputPath.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  let absolutePath = path.resolve(cleanPath);

  if (!fs.existsSync(absolutePath)) {
    const parts = cleanPath.split(path.sep);
    if (parts.length > 1) {
        const tryPath = path.resolve(parts.slice(1).join(path.sep));
        if (fs.existsSync(tryPath)) absolutePath = tryPath;
    }
  }

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Fichier introuvable : ${absolutePath}`);
    rl.close();
    process.exit(1);
  }

  try {
    console.log(`📂 Lecture du fichier...`);
    const rawData = fs.readFileSync(absolutePath, 'utf8');
    const backupData = JSON.parse(rawData);
    
    // Identification des clés
    const allKeys = Object.keys(backupData);
    
    // On cherche la clé qui contient les utilisateurs (souvent 'users' ou 'auth_users')
    const authKey = allKeys.find(key => key === 'auth_users' || key === 'users');
    const firestoreKeys = allKeys.filter(key => key !== authKey && key !== 'firestore');

    // =========================================================
    // 1. RESTAURATION AUTHENTICATION
    // =========================================================
    if (authKey && Array.isArray(backupData[authKey])) {
      const usersList = backupData[authKey];
      console.log(`\n👤 Restauration Auth via la clé '${authKey}' (${usersList.length} comptes)...`);
      
      let successCount = 0;
      
      for (const user of usersList) {
        try {
            // Supporte 'uid' (standard) ou 'localId' (dump brut)
            const userId = user.uid || user.localId;
            
            if (!userId || !user.email) {
                // Ignore les entrées invalides sans bloquer
                continue; 
            }

            const userImport = {
                uid: userId,
                email: user.email,
                displayName: user.displayName || '',
                emailVerified: true,
                password: 'User123', // Force le mot de passe
            };

            try {
                await auth.updateUser(userId, userImport);
            } catch (e) {
                if (e.code === 'auth/user-not-found') {
                    await auth.createUser(userImport);
                } else {
                    throw e; // Relancer si c'est une autre erreur
                }
            }
            successCount++;
        } catch (e) {
            console.warn(`   ⚠️ Erreur user ${user.email || 'inconnu'}: ${e.message}`);
        }
      }
      console.log(`✅ Auth terminé : ${successCount} utilisateurs importés/mis à jour.`);
    } else {
        console.log(`ℹ️  Aucune donnée d'utilisateurs trouvée (pas de clé 'users' ou 'auth_users').`);
    }

    // =========================================================
    // 2. RESTAURATION FIRESTORE
    // =========================================================
    console.log(`\n📦 Restauration Firestore...`);

    // Si structure ancienne { firestore: { ... } }
    let collectionsToRestore = {};
    if (backupData.firestore) {
        collectionsToRestore = backupData.firestore;
    } else {
        // Structure plate : tout ce qui n'est pas Auth est Firestore
        firestoreKeys.forEach(key => {
            collectionsToRestore[key] = backupData[key];
        });
    }

    const colNames = Object.keys(collectionsToRestore);
    
    if (colNames.length === 0) {
        console.log('⚠️  Aucune collection Firestore trouvée.');
    } else {
        
        for (const colName of colNames) {
            const docs = collectionsToRestore[colName];
            
            if (!Array.isArray(docs)) {
                console.log(`   ⏩ Ignoré '${colName}' (pas un tableau)`);
                continue;
            }

            console.log(`   ↳ Collection '${colName}' : ${docs.length} documents`);
            
            const batch = db.batch();
            let batchCount = 0;

            for (const docData of docs) {
                // Il faut impérativement un ID pour Firestore
                if (!docData.id) {
                    // Petite tolérance : si pas d'ID mais que c'est une config unique, on peut générer
                    // Mais pour un restore fidèle, on log un warning
                    // console.warn(`      ⚠️ Doc sans ID dans ${colName}, ignoré.`);
                    continue;
                }

                const docRef = db.collection(colName).doc(docData.id);
                const { id, ...dataToSave } = docData; // Retire l'ID des données
                
                batch.set(docRef, dataToSave, { merge: true });
                batchCount++;

                if (batchCount >= 400) {
                    await batch.commit();
                    process.stdout.write('.');
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            
            if (batchCount > 0) await batch.commit();
            console.log(`     ✅ OK`);
        }
    }

    console.log('\n🎉 RESTAURATION TERMINÉE AVEC SUCCÈS !');

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE :', error);
  } finally {
    rl.close();
    process.exit(0);
  }
});