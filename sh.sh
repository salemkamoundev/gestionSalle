#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
# Liste des fichiers à scanner/réparer
FILES_TS=(
  "src/app/features/dashboard/dashboard.component.ts"
  "src/app/features/history/history.component.ts"
  "src/app/features/clients/client-history/client-history.component.ts"
  "src/app/features/payments/payment-list/payment-list.component.ts"
)

FILES_HTML=(
  "src/app/features/dashboard/dashboard.component.html"
  "src/app/features/history/history.component.html"
  "src/app/features/clients/client-history/client-history.component.ts" # Template Inline parfois
  "src/app/features/payments/payment-list/payment-list.component.html"
)

echo "🚑 Correction globale des Timestamps Firestore..."

# ==========================================
# SCRIPT NODE.JS
# ==========================================
cat <<'EOF' > patch_timestamps.js
const fs = require('fs');
const files = process.argv.slice(2);

// Helper à injecter
const TO_DATE_METHOD = `
  // Helper: Conversion Timestamp Firestore -> Date JS
  toDate(val: any): any {
    if (!val) return null;
    // Duck typing pour détecter un Timestamp Firestore
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate();
    }
    return val;
  }
`;

files.forEach(file => {
    if (!fs.existsSync(file)) return;

    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // ------------------------------------------------
    // 1. TRAITEMENT FICHIERS TS (Injection de la méthode)
    // ------------------------------------------------
    if (file.endsWith('.ts')) {
        // On vérifie si c'est un composant et s'il n'a pas déjà la méthode
        if (content.includes('@Component') && !content.includes('toDate(val: any)')) {
            const lastBrace = content.lastIndexOf('}');
            if (lastBrace !== -1) {
                content = content.slice(0, lastBrace) + TO_DATE_METHOD + content.slice(lastBrace);
                console.log(`✅ Helper toDate() ajouté dans : ${file}`);
                modified = true;
            }
        }
    }

    // ------------------------------------------------
    // 2. TRAITEMENT FICHIERS HTML (Utilisation du helper)
    // ------------------------------------------------
    // Note: On traite aussi les .ts car ils peuvent avoir des templates inline
    
    // Regex : Cherche {{ quelqueChose | date... }}
    // Capture groupe 1: Début {{ avec espaces
    // Capture groupe 2: La variable (ex: r.date)
    // Capture groupe 3: Le pipe | date
    const pipeRegex = /({{\s*)([^|\n}]+?)(\s*\|\s*date)/g;

    if (pipeRegex.test(content)) {
        content = content.replace(pipeRegex, (match, start, variable, pipeEnd) => {
            variable = variable.trim();
            
            // Si c'est déjà enveloppé, on ignore
            if (variable.startsWith('toDate(')) return match;
            
            // On ignore aussi 'viewDate' du calendrier qui est déjà une Date JS
            if (variable === 'viewDate' || variable === 'viewDate()') return match;

            return `${start}toDate(${variable})${pipeEnd}`;
        });
        
        // On ne marque modifié que si le contenu a changé
        if (content !== fs.readFileSync(file, 'utf8')) {
            console.log(`✅ Dates corrigées dans le template : ${file}`);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(file, content);
    }
});
EOF

# ==========================================
# EXECUTION
# ==========================================
if command -v node &> /dev/null; then
    # On passe tous les fichiers en arguments
    node patch_timestamps.js "${FILES_TS[@]}" "${FILES_HTML[@]}"
    rm patch_timestamps.js
    echo "✨ Terminé. Les erreurs NG02100 devraient avoir disparu."
else
    echo "❌ Node.js requis."
fi