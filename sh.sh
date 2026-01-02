#!/bin/bash

# ==============================================================================
# SCRIPT : FORCE LARGEUR MINIMALE DE 250PX SUR LE CHAMP PRIX
# ==============================================================================

echo "🔍 Application de la largeur min-width: 250px sur les champs Prix..."

# Création du script Node.js temporaire
cat > fix_width_temp.js << 'EOF'
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const rootDir = 'src/app';
let count = 0;

walkDir(rootDir, (filePath) => {
    if (filePath.endsWith('.html')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Regex : Cherche 'Prix (TND)' suivi de n'importe quoi jusqu'à la balise <input
        const regex = /(Prix\s*\(TND\)(?:(?!<input)[\s\S])*<input)/gi;

        if (regex.test(content)) {
            let newContent = content.replace(regex, (match) => {
                
                // 1. Nettoyage : Si on avait mis le style 111px avant, on le remplace
                if (match.includes('width: 111px !important')) {
                    match = match.replace('width: 111px !important', '');
                }
                
                // 2. Application du nouveau style min-width
                // Si l'attribut style existe déjà
                if (match.includes('style="')) {
                     // On vérifie si on n'a pas déjà mis le min-width
                     if (!match.includes('min-width: 250px')) {
                        return match.replace('style="', 'style="min-width: 250px !important; ');
                     }
                     return match;
                } else {
                    // Sinon on crée l'attribut style
                    return match.replace('<input', '<input style="min-width: 250px !important"');
                }
            });

            // Nettoyage esthétique (éviter les ;; ou les espaces vides dans style)
            newContent = newContent.replace(/style="\s*;/g, 'style="');

            if (content !== newContent) {
                fs.writeFileSync(filePath, newContent);
                count++;
                console.log('✅ Correction appliquée (min-width: 250px) dans : ' + filePath);
            }
        }
    }
});

if (count === 0) {
    console.log('⚠️  Aucun champ "Prix (TND)" trouvé ou déjà modifié.');
} else {
    console.log('🚀 SUCCÈS : ' + count + ' fichier(s) mis à jour.');
}
EOF

# Exécution
node fix_width_temp.js

# Nettoyage
rm fix_width_temp.js