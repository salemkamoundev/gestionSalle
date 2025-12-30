#!/bin/bash

# ==============================================================================
# SCRIPT DE RÉINITIALISATION FORCÉE DE LA CONFIGURATION (MODE NODE.JS DIRECT)
# ==============================================================================

echo "🔥 DÉMARRAGE DU RESET FORCÉ DES CRÉNEAUX..."

# 1. On crée un petit script TS temporaire qui va faire le travail
# On utilise ts-node ou on compile à la volée, mais le plus simple dans un projet Angular
# est de créer un service temporaire qui s'auto-détruit ou s'exécute au boot.

# Cependant, pour être RADICAL, on va modifier le fichier main.ts pour qu'il lance
# une fonction de nettoyage AVANT de démarrer l'application.

# Création du fichier de logique de reset
cat > src/app/reset-config.ts <<EOF
import { Firestore, doc, deleteDoc, setDoc, getFirestore } from '@angular/fire/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

// Fonction autonome de reset
export async function forceResetConfig() {
  console.log('%c ☢️ DÉBUT DU RESET CONFIGURATION...', 'color: red; font-size: 20px; font-weight: bold;');
  
  // 1. Initialisation manuelle pour être sûr d'avoir l'accès
  const app = initializeApp(environment.firebase);
  const db = getFirestore(app);
  
  const configRef = doc(db, 'config/general');

  // 2. SUPPRESSION TOTALE du document existant
  try {
    await deleteDoc(configRef);
    console.log('🗑️ Ancien document de configuration SUPPRIMÉ.');
  } catch (e) {
    console.warn('Pas d\'ancien document ou erreur suppression:', e);
  }

  // 3. DONNÉES À INJECTER (Les 4 créneaux demandés)
  const validFrom = '2025-01-01';
  const validTo = '2026-12-31';

  const newConfig = {
    creneaux: [
      {
        id: 'matin',
        label: 'Matin (08h-12h)',
        start: '08:00',
        end: '12:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'aprem1',
        label: 'Après-midi Option 1 (12h-16h)',
        start: '12:00',
        end: '16:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'aprem2',
        label: 'Après-midi Option 2 (12h-19h)',
        start: '12:00',
        end: '19:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      },
      {
        id: 'soir',
        label: 'Soir (18h-02h)',
        start: '18:00',
        end: '02:00',
        price: 0,
        validFrom: validFrom,
        validTo: validTo
      }
    ]
  };

  // 4. ÉCRITURE DES NOUVELLES DONNÉES
  try {
    await setDoc(configRef, newConfig);
    console.log('%c ✅ SUCCÈS : CONFIGURATION CRÉNEAUX 2025-2026 INJECTÉE !', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('Liste des IDs injectés :', newConfig.creneaux.map(c => c.id).join(', '));
    alert('✅ CONFIGURATION RÉINITIALISÉE AVEC SUCCÈS !\n\nLes 4 créneaux (Matin, Aprem1, Aprem2, Soir) sont en place.\n\nL\'application va continuer son démarrage...');
  } catch (e) {
    console.error('❌ ERREUR CRITIQUE PENDANT L\'ÉCRITURE :', e);
    alert('❌ ERREUR LORS DU RESET : ' + e);
  }
}
EOF

echo "✅ Fichier 'src/app/reset-config.ts' créé."

# 2. Injection de l'appel dans main.ts
# C'est l'endroit le plus sûr pour exécuter du code au démarrage avant tout le reste
MAIN_FILE="src/main.ts"

# On utilise Node pour injecter proprement sans casser le fichier
node -e "
const fs = require('fs');
const file = '$MAIN_FILE';
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Si pas déjà injecté
  if (!content.includes('forceResetConfig')) {
    // Ajout des imports
    const imports = \"import { forceResetConfig } from './app/reset-config';\n\";
    
    // On injecte l'appel avant le bootstrapApplication
    if (content.includes('bootstrapApplication')) {
       // On remplace pour exécuter la fonction AVANT le bootstrap
       content = imports + content.replace(/bootstrapApplication\(/, 'forceResetConfig().then(() => bootstrapApplication(');
       // On ferme la parenthèse ajoutée au .then
       content = content.replace(/\)\s*\.catch/, ')).catch');
    }
    
    fs.writeFileSync(file, content);
    console.log('✅ src/main.ts modifié pour exécuter le reset au démarrage.');
  } else {
    console.log('ℹ️  src/main.ts contient déjà la logique de reset.');
  }
}
"

echo "----------------------------------------------------------------"
echo "🚀 TERMINÉ ! PRÊT À INJECTER."
echo ""
echo "👉 ÉTAPE 1 : Lancez 'ng serve' (si ce n'est pas déjà fait)"
echo "👉 ÉTAPE 2 : Ouvrez votre navigateur."
echo "👉 ÉTAPE 3 : Une alerte '✅ CONFIGURATION RÉINITIALISÉE' va s'afficher."
echo "👉 ÉTAPE 4 : Vérifiez votre formulaire, les options seront là."
echo ""
echo "⚠️  IMPORTANT : Une fois que c'est fait, supprimez l'appel dans 'src/main.ts'"
echo "   sinon cela réinitialisera la base à chaque rechargement de page !"
echo "----------------------------------------------------------------"