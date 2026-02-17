#!/bin/bash

# Chemin du fichier cible
TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"

# 1. Vérification de l'existence du fichier
if [ ! -f "$TS_FILE" ]; then
    echo "❌ Erreur : Le fichier $TS_FILE est introuvable."
    echo "Assurez-vous d'être à la racine du projet."
    exit 1
fi

# 2. Vérification si le correctif est déjà appliqué
if grep -q "this.form.patchValue({ packs: \[\] }); this.updateServices(\[\]);" "$TS_FILE"; then
    echo "ℹ️  Le correctif semble déjà appliqué."
    exit 0
fi

echo "🔄 Application du correctif (Version macOS)..."

# 3. Remplacement avec sed compatible macOS (-i '')
sed -i '' 's/this.form.patchValue({ packs: \[\] });/this.form.patchValue({ packs: [] }); this.updateServices([]);/' "$TS_FILE"

echo "✅ Correctif appliqué avec succès !"