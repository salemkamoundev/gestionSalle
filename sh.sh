#!/bin/bash

# ==============================================================================
# SCRIPT : RENDRE LES CHAMPS HEURE DÉBUT/FIN NON MODIFIABLES (READONLY)
# ==============================================================================

FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

if [ ! -f "$FILE" ]; then
    echo "❌ Erreur : Le fichier $FILE est introuvable."
    exit 1
fi

echo "🔄 Modification de $FILE en cours..."

# Utilisation de Node.js pour un remplacement de texte fiable (mieux que sed pour le HTML)
node -e "
const fs = require('fs');
const filePath = '$FILE';
let content = fs.readFileSync(filePath, 'utf8');

// Définition des inputs originaux (tels qu'ils sont dans votre fichier actuel)
const oldStart = '<input type=\"time\" formControlName=\"startTime\" class=\"w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm\">';
const oldEnd = '<input type=\"time\" formControlName=\"endTime\" class=\"w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm\">';

// Définition des nouveaux inputs (readonly + style grisé + pas de clic souris)
// On change bg-slate-50 en bg-slate-200 et on ajoute pointer-events-none
const newStart = '<input type=\"time\" formControlName=\"startTime\" readonly class=\"w-full p-2 bg-slate-200 rounded border border-slate-200 text-sm text-slate-500 pointer-events-none\">';
const newEnd = '<input type=\"time\" formControlName=\"endTime\" readonly class=\"w-full p-2 bg-slate-200 rounded border border-slate-200 text-sm text-slate-500 pointer-events-none\">';

// Application des changements
if (content.includes(oldStart)) {
    content = content.replace(oldStart, newStart);
    console.log('✅ Champ Début (startTime) verrouillé.');
} else {
    console.log('⚠️  Champ Début non trouvé ou déjà modifié.');
}

if (content.includes(oldEnd)) {
    content = content.replace(oldEnd, newEnd);
    console.log('✅ Champ Fin (endTime) verrouillé.');
} else {
    console.log('⚠️  Champ Fin non trouvé ou déjà modifié.');
}

fs.writeFileSync(filePath, content);
"

echo "🚀 Terminé !"