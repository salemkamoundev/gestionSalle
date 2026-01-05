#!/bin/bash

# Fichier cible
TARGET="src/app/features/expenses/expense-manager/expense-manager.component.html"

echo "🔧 Correction de l'auto-remplissage (autofill) sur la recherche..."

if [ ! -f "$TARGET" ]; then
    echo "❌ Erreur : Fichier introuvable ($TARGET)"
    exit 1
fi

# On utilise Perl pour insérer autocomplete="off" et un name aléatoire juste avant le placeholder
# Cela empêche le navigateur de croire que c'est le login de l'admin
perl -pi -e 's/placeholder="Rechercher..."/autocomplete="off" name="search_expense_safe" readonly onfocus="this.removeAttribute(\x27readonly\x27);" placeholder="Rechercher..."/g' "$TARGET"

echo "✅ Correctif appliqué : Le champ recherche ne sera plus pré-rempli par l'email admin."