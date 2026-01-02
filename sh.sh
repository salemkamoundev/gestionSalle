#!/bin/bash

# ==============================================================================
# SCRIPT DE RÉPARATION : SYNTAXE CLIENT FORM & VALIDATION
# ==============================================================================

echo "🛠️ Réparation des fichiers Client Form..."

node -e "
const fs = require('fs');

// --- 1. REPARATION DU TYPESCRIPT ---
const tsPath = 'src/app/features/clients/client-form/client-form.component.ts';
if (fs.existsSync(tsPath)) {
    let ts = fs.readFileSync(tsPath, 'utf8');
    let modified = false;

    // Correction du bug de syntaxe ']],' (double crochet)
    if (ts.includes(\"cin: ['', Validators.required]],\")) {
        ts = ts.replace(\"cin: ['', Validators.required]],\", \"cin: ['', Validators.required],\");
        console.log('✅ TS: Erreur de syntaxe corrigée (crochet en trop supprimé).');
        modified = true;
    }

    // Si le champ n'avait pas encore la validation (cas où le fichier était propre)
    if (ts.includes(\"cin: [''],\")) {
        ts = ts.replace(\"cin: [''],\", \"cin: ['', Validators.required],\");
        console.log('✅ TS: Validation CIN ajoutée.');
        modified = true;
    }

    // Ajout validation sur dateCin si manquant
    if (ts.includes(\"dateCin: [''],\")) {
        ts = ts.replace(\"dateCin: [''],\", \"dateCin: ['', Validators.required],\");
        console.log('✅ TS: Validation Date CIN ajoutée.');
        modified = true;
    }

    if (modified) fs.writeFileSync(tsPath, ts);
} else {
    console.error('❌ TS: Fichier introuvable !');
}

// --- 2. VÉRIFICATION DU HTML ---
const htmlPath = 'src/app/features/clients/client-form/client-form.component.html';
if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Si le HTML ne contient pas encore le champ dateCin, on remplace le bloc CIN
    if (!html.includes('formControlName=\"dateCin\"')) {
        
        // Regex pour trouver l'ancien bloc div contenant le CIN
        // On cherche large pour capturer le label et l'input
        const regexOldBlock = /<div class=\"mt-4\">\s*<label[^>]*>CIN \/ Passeport.*<\/label>\s*<input[^>]*formControlName=\"cin\"[^>]*>\s*<\/div>/s;
        
        // Nouveau bloc avec les 2 colonnes
        const newBlock = \`<div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mt-4\">
        <div>
          <label class=\"block text-xs font-bold text-slate-500 uppercase mb-1\">CIN / Passeport *</label>
          <input formControlName=\"cin\" type=\"text\" class=\"w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none transition\">
        </div>
        <div>
          <label class=\"block text-xs font-bold text-slate-500 uppercase mb-1\">Date de délivrance *</label>
          <input formControlName=\"dateCin\" type=\"date\" class=\"w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none transition\">
        </div>
      </div>\`;

        if (regexOldBlock.test(html)) {
            html = html.replace(regexOldBlock, newBlock);
            fs.writeFileSync(htmlPath, html);
            console.log('✅ HTML: Champ Date CIN ajouté.');
        } else {
            console.log('⚠️  HTML: Impossible de trouver l\'ancien bloc CIN pour le remplacer automatiquement.');
        }
    } else {
        console.log('ℹ️  HTML: Le champ Date CIN est déjà présent.');
    }
}
"

echo "🚀 Terminé ! Relancez la compilation."