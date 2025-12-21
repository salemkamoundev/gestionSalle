#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
RES_FORM_TS="src/app/features/calendar/reservation-form/reservation-form.component.ts"
TEAM_FORM_TS="src/app/features/teams/team-form/team-form.component.ts"

echo "🏁 Correction finale des types (Slots & Team)..."

# ==========================================
# SCRIPT NODE.JS
# ==========================================
cat <<'EOF' > patch_final.js
const fs = require('fs');

const resFormPath = process.argv[2];
const teamFormPath = process.argv[3];

// 1. CORRECTION RESERVATION FORM (Slots start/end)
try {
    if (fs.existsSync(resFormPath)) {
        let content = fs.readFileSync(resFormPath, 'utf8');
        
        // On cherche la définition de availableSlots
        // Actuellement: { id: 'matin', label: 'Matin (08h - 16h)' }
        // On veut: { id: 'matin', label: 'Matin', start: '08:00', end: '16:00' }
        
        const oldSlots = /availableSlots = signal\(\[\s*\{ id: 'matin', label: 'Matin \(08h - 16h\)' \},\s*\{ id: 'soir', label: 'Soir \(18h - 02h\)' \}\s*\]\);/;
        
        const newSlots = `availableSlots = signal([
    { id: 'matin', label: 'Matin', start: '08:00', end: '16:00' },
    { id: 'soir', label: 'Soir', start: '18:00', end: '02:00' }
  ]);`;

        if (oldSlots.test(content)) {
            content = content.replace(oldSlots, newSlots);
            fs.writeFileSync(resFormPath, content);
            console.log('✅ Slots mis à jour avec start/end.');
        } else {
            // Tentative de remplacement plus générique si le formatage a changé
            if (content.includes("availableSlots = signal([")) {
                 const genericRegex = /availableSlots = signal\(\[([\s\S]*?)\]\);/;
                 content = content.replace(genericRegex, newSlots);
                 fs.writeFileSync(resFormPath, content);
                 console.log('✅ Slots mis à jour (méthode générique).');
            } else {
                 console.log('ℹ️ Slots déjà corrects ou introuvables.');
            }
        }
    }
} catch (e) {
    console.error('Erreur ResForm:', e);
}

// 2. CORRECTION TEAM FORM (Implicit Any)
try {
    if (fs.existsSync(teamFormPath)) {
        let content = fs.readFileSync(teamFormPath, 'utf8');
        
        // Erreur: t.services.forEach(s => ...)
        // Correction: t.services.forEach((s: any) => ...)
        
        if (content.includes('t.services.forEach(s =>')) {
            content = content.replace('t.services.forEach(s =>', 't.services.forEach((s: any) =>');
            fs.writeFileSync(teamFormPath, content);
            console.log('✅ TeamForm: Typage "any" ajouté sur le foreach.');
        } else {
            console.log('ℹ️ TeamForm déjà corrigé.');
        }
    }
} catch (e) {
    console.error('Erreur TeamForm:', e);
}
EOF

# ==========================================
# EXECUTION
# ==========================================
if command -v node &> /dev/null; then
    node patch_final.js "$RES_FORM_TS" "$TEAM_FORM_TS"
    rm patch_final.js
    echo "✨ Terminé. La compilation devrait passer au vert !"
else
    echo "❌ Node.js requis."
fi