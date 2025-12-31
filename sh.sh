#!/bin/bash

echo "🧹 SUPPRESSION DES DONNÉES MOCK AU DÉMARRAGE..."

node <<'EOF'
const fs = require('fs');

// =========================================================
// 1. NETTOYAGE DE src/main.ts
// =========================================================
const mainFile = 'src/main.ts';
if (fs.existsSync(mainFile)) {
    // On réécrit le fichier proprement sans le seedSeasonalSlots
    // On garde l'import de App depuis './app/app' comme dans votre fichier d'origine
    const newMainContent = `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
`;
    fs.writeFileSync(mainFile, newMainContent);
    console.log("✅ src/main.ts : Démarrage nettoyé (seedSeasonalSlots retiré).");
} else {
    console.error("❌ src/main.ts introuvable.");
}

// =========================================================
// 2. NETTOYAGE DE src/app/app.component.ts
// =========================================================
const appCompFile = 'src/app/app.component.ts';
if (fs.existsSync(appCompFile)) {
    let content = fs.readFileSync(appCompFile, 'utf8');

    // 1. Supprimer l'import du SeederService
    // Regex gère les espaces éventuels et le saut de ligne
    content = content.replace(/import\s*{\s*SeederService\s*}\s*from\s*['"]\.\/core\/services\/seeder\.service['"];\s*[\r\n]*/g, '');

    // 2. Supprimer l'injection (private seeder = inject(SeederService);)
    content = content.replace(/private\s+seeder\s*=\s*inject\(SeederService\);\s*[\r\n]*/g, '');

    fs.writeFileSync(appCompFile, content);
    console.log("✅ src/app/app.component.ts : Injection SeederService retirée.");
} else {
    console.error("❌ src/app/app.component.ts introuvable.");
}
EOF

echo "🚀 Terminé. L'application démarrera maintenant sans générer de fausses données."